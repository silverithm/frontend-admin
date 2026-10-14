'use client';

/**
 * 위험도 평가 — 욕창(Braden)·낙상(Morse)·인지기능. 반기(1~6월·7~12월)마다 모든 수급자를 세 기준으로 평가해야 한다.
 * 위쪽은 이번 반기 진행 현황, 아래는 어르신별 마지막 평가와 "평가가 필요한 분"을 한눈에 보는 표다.
 * 최근 6개월 낙상 사고 기록보다 마지막 Morse 평가가 이르면 "낙상 후 재평가"로 표시한다(사고 기록을 못 불러와도 표는 그대로).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Switch } from '@astryxdesign/core/Switch';
import { Text } from '@astryxdesign/core/Text';
import { Loading } from '@/components/Loading';
import { StatRow, StatTile } from '@/components/StatTile';
import { fallsNeedingReassessment } from '@/lib/lab/careEventRules';
import { listCareEvents, listRiskLatest } from '@/lib/lab/labApi';
import { currentHalfLabel, daysUntilHalfEnd, elderHalfYearStatus, halfYearSummary } from '@/lib/lab/riskScales';
import type { RiskKind, RiskLatest } from '@/lib/lab/labTypes';
import { Chip, ErrorBanner, SupportText } from './LabUi';
import RiskElderDialog from './RiskElderDialog';
import type { RiskDialogView } from './RiskElderDialog';
import { RiskCell } from './RiskParts';
import { currentMonth, errorText, shiftMonth } from './labFormat';
import styles from './lab.module.css';

interface DialogState {
  elder: RiskLatest;
  view: RiskDialogView;
  kind: RiskKind;
}

export default function RiskAssessmentLab() {
  const [latest, setLatest] = useState<RiskLatest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [onlyDue, setOnlyDue] = useState(false);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [fallIds, setFallIds] = useState<number[]>([]);
  const [fallNote, setFallNote] = useState<string | null>(null);
  const [fallLoading, setFallLoading] = useState(false);
  const seq = useRef(0);
  const fallSeq = useRef(0);
  // 화면을 연 시각 기준으로 반기를 판정한다(자정을 넘겨 열어 두면 새로 불러오기 때 갱신됨)
  const [today, setToday] = useState(() => new Date());

  const load = useCallback(async () => {
    const n = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const list = await listRiskLatest();
      if (n !== seq.current) return;
      setLatest([...list].sort((a, b) => a.elderlyName.localeCompare(b.elderlyName, 'ko')));
      setToday(new Date());
    } catch (e) {
      if (n !== seq.current) return;
      setError(errorText(e, '위험도 평가 현황을 불러오지 못했습니다'));
    } finally {
      if (n === seq.current) setLoading(false);
    }
  }, []);

  // 낙상 사고는 월 단위로만 읽을 수 있어 최근 6개월을 나란히 받는다. 일부 달이 실패해도 받은 달로 계산하고 안내만 남긴다.
  const loadFalls = useCallback(async (list: RiskLatest[]) => {
    const n = ++fallSeq.current;
    setFallLoading(true);
    setFallNote(null);
    const base = currentMonth();
    const results = await Promise.allSettled([0, 1, 2, 3, 4, 5].map((i) => listCareEvents({ month: shiftMonth(base, -i) })));
    if (n !== fallSeq.current) return;
    const events = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
    const failed = results.filter((r) => r.status === 'rejected').length;
    setFallIds(fallsNeedingReassessment(events, list));
    setFallNote(failed > 0 ? '일부 달의 사고 기록을 불러오지 못해 "낙상 후 재평가" 표시가 빠졌을 수 있습니다.' : null);
    setFallLoading(false);
  }, []);

  useEffect(() => {
    if (!loading && !error) void loadFalls(latest);
  }, [loading, error, latest, loadFalls]);

  useEffect(() => {
    void load();
    return () => {
      seq.current += 1;
      fallSeq.current += 1;
    };
  }, [load]);

  // 반기 점검 요약: 욕창·낙상·인지 세 기준 각각의 완료 수와 하나라도 남은 어르신
  const summary = useMemo(() => halfYearSummary(latest, today), [latest, today]);
  const dueIds = useMemo(() => new Set(summary.pending.map((p) => p.elderlyId)), [summary]);
  const visible = onlyDue ? latest.filter((l) => dueIds.has(l.elderlyId)) : latest;
  const daysLeft = daysUntilHalfEnd(today);
  const dueCount = summary.pending.length;
  const fallSet = useMemo(() => new Set(fallIds), [fallIds]);
  const fallNames = latest.filter((l) => fallSet.has(l.elderlyId)).map((l) => l.elderlyName);

  const open = (elder: RiskLatest, view: RiskDialogView) => {
    // 이번 반기에 남은 첫 평가부터 연다(욕창 → 낙상 → 인지). 모두 마쳤으면 욕창.
    const status = elderHalfYearStatus(elder, today);
    const firstMissing = (['BRADEN', 'MORSE', 'COGNITIVE'] as const).find((k) => status[k] !== 'DONE');
    setDialog({ elder, view, kind: firstMissing ?? 'BRADEN' });
  };

  return (
    <div className={styles.stack}>
      <StatRow>
        <StatTile value={`${summary.done.BRADEN}/${summary.total}`} label="욕창(Braden) 완료" tone={summary.total > 0 && summary.done.BRADEN === summary.total ? 'success' : 'neutral'} />
        <StatTile value={`${summary.done.MORSE}/${summary.total}`} label="낙상(Morse) 완료" tone={summary.total > 0 && summary.done.MORSE === summary.total ? 'success' : 'neutral'} />
        <StatTile value={`${summary.done.COGNITIVE}/${summary.total}`} label="인지기능 완료" tone={summary.total > 0 && summary.done.COGNITIVE === summary.total ? 'success' : 'neutral'} />
        <StatTile value={`${daysLeft}일`} label={`${currentHalfLabel(today)} 마감까지`} tone={daysLeft <= 30 && dueCount > 0 ? 'warning' : 'neutral'} />
      </StatRow>

      {dueCount > 0 && !loading && (
        <Banner
          status="warning"
          title={`${currentHalfLabel(today)} 평가가 필요한 어르신이 ${dueCount}분 있습니다`}
          description={`2026 평가는 욕창·낙상·인지기능 세 기준을 반기마다 요구합니다. 세 가지를 모두 마친 어르신은 ${summary.allDone}/${summary.total}분이에요. 평가 기준일은 한국 날짜입니다.`}
        />
      )}

      {fallNames.length > 0 && !loading && (
        <Banner
          status="warning"
          title={`낙상 후 재평가가 필요한 어르신이 ${fallNames.length}분 있습니다`}
          description={`최근 6개월 안에 낙상 사고가 있었는데 그 뒤 낙상(Morse) 평가가 없습니다: ${fallNames.join(', ')}. 낙상 뒤 재평가는 필수 항목이 아니라 낙상 후 관리 차원의 권장입니다.`}
        />
      )}
      {fallLoading && <SupportText>낙상 사고 기록을 확인하는 중입니다...</SupportText>}
      {fallNote && <SupportText tone="warn">{fallNote}</SupportText>}

      <div className={styles.toolbar}>
        <Switch label="평가가 필요한 어르신만" value={onlyDue} onChange={setOnlyDue} />
        <div style={{ marginInlineStart: 'auto' }}>
          <Button label="새로 불러오기" variant="ghost" isDisabled={loading} onClick={() => void load()} />
        </div>
      </div>

      {error && <ErrorBanner message={error} onRetry={() => void load()} />}

      {loading && latest.length === 0 ? (
        <Loading size="section" label="평가 현황을 불러오는 중..." />
      ) : latest.length === 0 && !error ? (
        <EmptyState title="등록된 어르신이 없습니다" description="회원관리 탭에서 어르신을 먼저 등록해 주세요." />
      ) : visible.length === 0 && !error ? (
        <EmptyState title="평가가 필요한 어르신이 없습니다" description="이번 반기 평가를 모두 마쳤습니다. 다음 반기에 다시 확인해 주세요." />
      ) : (
        <Card padding={0}>
          <div className={styles.tableScroll}>
            <table className={`${styles.table} ${styles.stackTable}`}>
              <thead>
                <tr>
                  <th scope="col">어르신</th>
                  <th scope="col">욕창 (Braden)</th>
                  <th scope="col">낙상 (Morse)</th>
                  <th scope="col">인지기능</th>
                  <th scope="col">
                    <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>작업</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((l) => (
                  <tr key={l.elderlyId}>
                    <td>
                      <Text type="body" weight="medium">
                        {l.elderlyName}
                      </Text>
                      {fallSet.has(l.elderlyId) && (
                        <div>
                          <Chip tone="warn" label="낙상 후 재평가" />
                        </div>
                      )}
                    </td>
                    <td data-label="욕창 (Braden)">
                      <RiskCell entry={l.braden} today={today} />
                    </td>
                    <td data-label="낙상 (Morse)">
                      <RiskCell entry={l.morse} today={today} />
                    </td>
                    <td data-label="인지기능">
                      <RiskCell entry={l.cognitive ?? null} today={today} isCognitive />
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 'var(--spacing-1)', justifyContent: 'flex-start', flexWrap: 'wrap' }}>
                        <Button label="평가" size="sm" variant="secondary" onClick={() => open(l, 'assess')} />
                        <Button label="이력" size="sm" variant="ghost" onClick={() => open(l, 'history')} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {dialog && (
        <RiskElderDialog
          key={`${dialog.elder.elderlyId}-${dialog.view}`}
          elderId={dialog.elder.elderlyId}
          elderName={dialog.elder.elderlyName}
          initialView={dialog.view}
          initialKind={dialog.kind}
          onClose={() => setDialog(null)}
          onChanged={() => void load()}
        />
      )}
    </div>
  );
}
