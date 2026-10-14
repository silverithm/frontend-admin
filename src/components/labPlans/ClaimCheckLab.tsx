'use client';

/**
 * 공단 청구 대조 — 월을 고르고 청구 내역을 붙여 넣으면 어르신과 맞춰 보고, 그 달 출석·본인부담금 청구서와 일수·구간을 대조한다.
 * 차이가 있는 줄은 확인 사유를 적어 저장하고(saveClaimReviewsBatch), 지난 결과는 다시 볼 수 있다.
 * 붙여 넣은 이름은 이 화면에서만 쓰고 AI·서버로 보내지 않는다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { ErrorBanner, MonthStepper, SupportText, useNotify } from '@/components/lab/LabUi';
import { currentMonth, defaultPersonName, errorText, monthLabel, PROVIDER_KEY, shiftMonth, writeStored } from '@/components/lab/labFormat';
import { useLabElders } from '@/components/lab/useLabElders';
import { useAlive } from '@/components/labRecords/recordsFormat';
import { matchClaimRows, monthlyLimitUse, parseClaimText, reconcile } from '@/lib/lab/claimRules';
import { listClaimReviews, saveClaimReviewsBatch } from '@/lib/lab/labApi';
import type { ClaimReview } from '@/lib/lab/labTypes';
import ClaimCheckBandCalc from './ClaimCheckBandCalc';
import { loadClaimData } from './ClaimCheckData';
import type { ClaimData } from './ClaimCheckData';
import { finalStatus, MAX_BATCH_ROWS, NO_ATTENDANCE_NOTE, planSave } from './ClaimCheckFormat';
import type { CheckedRow } from './ClaimCheckFormat';
import ClaimCheckHistory from './ClaimCheckHistory';
import ClaimCheckMatch from './ClaimCheckMatch';
import type { MatchedLine } from './ClaimCheckMatch';
import ClaimCheckPaste from './ClaimCheckPaste';
import ClaimCheckTable from './ClaimCheckTable';
import styles from './labPlans.module.css';

export default function ClaimCheckLab() {
  const alive = useAlive();
  const notify = useNotify();
  const { elders, isLoading: eldersLoading, error: eldersError } = useLabElders();
  const [month, setMonth] = useState(() => shiftMonth(currentMonth(), -1));
  const [text, setText] = useState('');
  const [picks, setPicks] = useState<Record<string, number | null>>({});
  const [data, setData] = useState<ClaimData | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [reviewer, setReviewer] = useState(() => defaultPersonName());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveResult, setSaveResult] = useState<string | null>(null);
  const [reviews, setReviews] = useState<ClaimReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewsError, setReviewsError] = useState<string | null>(null);
  const dataSeq = useRef(0);
  const reviewSeq = useRef(0);
  const savingRef = useRef(false);

  const loadReviews = useCallback(async () => {
    const n = ++reviewSeq.current;
    setReviewsLoading(true);
    setReviewsError(null);
    try {
      const list = await listClaimReviews(month);
      if (!alive.current || n !== reviewSeq.current) return;
      setReviews(list);
    } catch (err) {
      if (!alive.current || n !== reviewSeq.current) return;
      setReviews([]);
      setReviewsError(errorText(err, '지난 대조 결과를 불러오지 못했습니다'));
    } finally {
      if (alive.current && n === reviewSeq.current) setReviewsLoading(false);
    }
  }, [month, alive]);

  useEffect(() => {
    void loadReviews();
    return () => {
      reviewSeq.current += 1;
    };
  }, [loadReviews]);

  const changeMonth = (m: string) => {
    dataSeq.current += 1; // 늦게 오는 이전 달 자료는 버린다
    setMonth(m);
    setData(null);
    setDataError(null);
    setDataLoading(false);
    setNotes({});
    setSaveResult(null);
    setSaveError(null);
  };

  const rows = useMemo(() => parseClaimText(text), [text]);
  const lineCount = useMemo(() => text.split(/\r\n|\r|\n/).filter((l) => l.trim() !== '').length, [text]);
  const lines = useMemo<MatchedLine[]>(() => {
    const matches = matchClaimRows(rows, elders);
    const seen = new Set<number>();
    return matches.map((match) => {
      const elderlyId = match.elderlyId ?? picks[match.row.raw] ?? null;
      const duplicate = elderlyId !== null && seen.has(elderlyId);
      if (elderlyId !== null) seen.add(elderlyId);
      return { match, elderlyId, duplicate };
    });
  }, [rows, elders, picks]);
  const usable = useMemo(() => lines.filter((l) => l.elderlyId !== null && !l.duplicate), [lines]);

  const nameOf = useCallback((id: number) => elders.find((e) => e.id === id)?.name ?? reviews.find((r) => r.elderlyId === id)?.elderlyName ?? '(알 수 없는 어르신)', [elders, reviews]);

  const checked = useMemo<CheckedRow[]>(() => {
    if (!data || data.month !== month) return [];
    const result = reconcile({
      month,
      rows: usable.map((l) => ({ elderlyId: l.elderlyId as number, days: l.match.row.days, band: l.match.row.band })),
      attendance: data.attendance,
      bills: data.bills,
    });
    // 그 달 출석 기록이 한 건도 없으면(출결을 쓰지 않는 달) 모든 줄이 '청구가 출석보다 많음'으로 보인다 — 출석 비교만 빼고 나머지로 판정한다
    const noAttendance = !Object.values(data.attendance).some((dates) => dates.some((d) => d.slice(0, 7) === month));
    return result.map((r) => {
      const bill = data.bills.find((b) => b.elderlyId === r.elderlyId && b.billMonth === month) ?? null;
      const base = { ...r, name: nameOf(r.elderlyId), bill, limit: bill ? monthlyLimitUse(bill.careGrade, bill.coveredTotal) : null };
      if (!noAttendance) return base;
      const reasons = r.reasons.filter((reason) => !reason.startsWith('청구 일수가 출석보다'));
      return { ...base, reasons, status: reasons.length === 0 ? ('MATCH' as const) : ('MISMATCH' as const), attendanceUnknown: true };
    });
  }, [data, month, usable, nameOf]);
  const attendanceUnknown = checked.some((r) => r.attendanceUnknown);

  /** 이미 저장한 확인 사유가 있으면 처음에 채워 보여 준다 */
  const effectiveNotes = useMemo(() => {
    const merged: Record<number, string> = {};
    for (const r of reviews) if (r.note) merged[r.elderlyId] = r.note;
    return { ...merged, ...notes };
  }, [reviews, notes]);

  const unclaimed = useMemo(() => {
    if (!data || data.month !== month) return [];
    const claimed = new Set(usable.map((l) => l.elderlyId as number));
    return Object.entries(data.attendance)
      .filter(([id, dates]) => !claimed.has(Number(id)) && dates.some((d) => d.slice(0, 7) === month))
      .map(([id, dates]) => ({ id: Number(id), name: nameOf(Number(id)), days: new Set(dates.filter((d) => d.slice(0, 7) === month)).size }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }, [data, month, usable, nameOf]);

  const runReconcile = async () => {
    if (dataLoading || usable.length === 0) return;
    const n = ++dataSeq.current;
    setDataLoading(true);
    setDataError(null);
    setSaveResult(null);
    try {
      const loaded = await loadClaimData(month);
      if (!alive.current || n !== dataSeq.current) return;
      setData(loaded);
    } catch (err) {
      if (!alive.current || n !== dataSeq.current) return;
      setData(null);
      setDataError(errorText(err, '출석이나 본인부담금 청구서를 불러오지 못했습니다. 잠시 뒤 다시 시도해 주세요'));
    } finally {
      if (alive.current && n === dataSeq.current) setDataLoading(false);
    }
  };

  const plan = useMemo(() => planSave(month, checked, effectiveNotes, reviewer), [month, checked, effectiveNotes, reviewer]);
  const saveIssue = plan.rows.length === 0 ? '저장할 줄이 없습니다' : plan.rows.length > MAX_BATCH_ROWS ? `한 번에 ${MAX_BATCH_ROWS}줄까지 저장합니다` : reviewer.trim() === '' ? '확인자 이름을 적어 주세요' : null;

  const save = async () => {
    if (savingRef.current || saveIssue) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    setSaveResult(null);
    try {
      await saveClaimReviewsBatch({ month, rows: plan.rows });
      if (!alive.current) return;
      writeStored(PROVIDER_KEY, reviewer.trim());
      const { match, resolved, mismatch } = plan.counts;
      setSaveResult(`${plan.rows.length}줄을 저장했습니다 (일치 ${match} · 확인함 ${resolved} · 차이 ${mismatch})${plan.skipped > 0 ? `. 구간만 다르고 사유가 없는 ${plan.skipped}줄은 저장하지 않았습니다` : ''}`);
      notify('대조 결과를 저장했습니다', 'success');
      setNotes({});
      void loadReviews();
    } catch (err) {
      if (alive.current) setSaveError(errorText(err, '대조 결과를 저장하지 못했습니다'));
    } finally {
      savingRef.current = false;
      if (alive.current) setSaving(false);
    }
  };

  const mismatchOpen = checked.filter((r) => finalStatus(r, effectiveNotes[r.elderlyId] ?? '') === 'MISMATCH').length;
  const busy = saving || dataLoading;

  return (
    <div className={styles.stack}>
      <Card padding={4}>
        <VStack gap={2}>
          <Text type="label">1. 청구 월 고르기</Text>
          <div className={styles.toolbar}>
            <MonthStepper value={month} onChange={changeMonth} isDisabled={busy} />
          </div>
          <SupportText>공단에 청구한 달의 출석과 본인부담금 청구서를 가져와 견줍니다. 월을 바꾸면 대조 결과는 비워지고 붙여 넣은 글은 그대로 남습니다.</SupportText>
        </VStack>
      </Card>

      {eldersError && <ErrorBanner message={eldersError} />}

      <ClaimCheckPaste
        text={text}
        onChange={(v) => {
          setText(v);
          setSaveResult(null);
        }}
        readCount={rows.length}
        lineCount={lineCount}
        isDisabled={busy}
      />

      {eldersLoading && rows.length > 0 && <Text type="supporting" color="secondary">어르신 목록을 불러오는 중...</Text>}
      <ClaimCheckMatch
        lines={lines}
        elders={elders}
        onPick={(raw, id) => {
          setPicks((p) => ({ ...p, [raw]: id }));
          setSaveResult(null);
        }}
      />

      <Card padding={4}>
        <VStack gap={2}>
          <Text type="label">4. 출석·본인부담금 청구서와 대조</Text>
          <SupportText>{monthLabel(month)}의 출석(출결 기록에서 출석한 날)과 본인부담금 청구서(일수·시간 구간)를 불러와 청구 내역과 견줍니다.</SupportText>
          <HStack gap={2} vAlign="center" wrap="wrap">
            <Button label={data && data.month === month ? '다시 대조하기' : '대조하기'} variant="primary" isLoading={dataLoading} isDisabled={busy || usable.length === 0} onClick={() => void runReconcile()} />
            {usable.length === 0 && (
              <Text type="supporting" color="secondary">
                먼저 청구 내역을 붙여 넣고 어르신을 연결해 주세요.
              </Text>
            )}
          </HStack>
          {dataError && <ErrorBanner message={dataError} onRetry={() => void runReconcile()} />}
        </VStack>
      </Card>

      {checked.length > 0 && (
        <>
          {attendanceUnknown && (
            <SupportText tone="warn">
              {monthLabel(month)}에는 출결 기록이 한 건도 없어 출석 일수는 견주지 않았습니다. 청구 일수·구간을 본인부담금 청구서와만 비교했고, 저장하면 “{NO_ATTENDANCE_NOTE}”로 남습니다.
            </SupportText>
          )}
          <ClaimCheckTable rows={checked} notes={effectiveNotes} onNote={(id, v) => setNotes((n) => ({ ...n, [id]: v }))} isDisabled={saving} />

          {unclaimed.length > 0 && (
            <Card padding={4}>
              <VStack gap={1}>
                <Text type="label">출석했지만 청구 내역에 없는 어르신 ({unclaimed.length}명)</Text>
                <Text type="supporting" color="secondary">
                  {unclaimed.map((u) => `${u.name} ${u.days}일`).join(', ')}
                </Text>
                <SupportText tone="warn">붙여 넣은 글에서 빠졌거나 이름 연결을 안 한 어르신일 수 있습니다. 청구가 빠진 것이 아닌지 확인해 주세요.</SupportText>
              </VStack>
            </Card>
          )}

          <Card padding={4}>
            <VStack gap={2}>
              <Text type="label">6. 결과 저장</Text>
              <SupportText>
                차이가 있는 줄에 확인한 사유를 적으면 “확인함”으로 저장합니다. 사유를 안 적은 차이 줄은 “차이”로 저장해 두고 나중에 이어서 확인할 수 있습니다. 구간만 다른 줄은 서버가 일수만 비교하므로 사유가 있어야 저장합니다.
              </SupportText>
              <div className={styles.fieldGrid}>
                <TextInput label="확인자" value={reviewer} onChange={(v) => setReviewer(v.slice(0, 50))} isDisabled={saving} />
              </div>
              <HStack gap={2} vAlign="center" wrap="wrap">
                <Button label="대조 결과 저장" variant="primary" isLoading={saving} isDisabled={saving || saveIssue !== null} onClick={() => void save()} />
                <Text type="supporting" color="secondary">
                  저장 {plan.rows.length}줄 · 사유 없는 차이 {mismatchOpen}줄{plan.skipped > 0 ? ` · 사유가 필요한 구간 차이 ${plan.skipped}줄 제외` : ''}
                </Text>
              </HStack>
              {saveIssue && <SupportText tone="warn">{saveIssue}</SupportText>}
              {saveError && <ErrorBanner message={saveError} />}
              {saveResult && <SupportText>{saveResult}</SupportText>}
            </VStack>
          </Card>
        </>
      )}

      <ClaimCheckBandCalc />

      <ClaimCheckHistory month={month} reviews={reviews} loading={reviewsLoading} error={reviewsError} onReload={() => void loadReviews()} />
    </div>
  );
}
