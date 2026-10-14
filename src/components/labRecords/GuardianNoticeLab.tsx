'use client';

/**
 * 보호자 월간 안내 — 달을 고르면 어르신별 상태(없음·초안·보냄)가 보이고, 어르신을 열면 사실 모으기부터 보냄 표시까지 한 화면에서 한다.
 * 안내는 일방향이라 2026 평가 ‘소통노력’의 보호자 상담(분기 1회)을 대신하지 못한다 — 위쪽 안내 한 줄로 알려 준다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card } from '@astryxdesign/core/Card';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Switch } from '@astryxdesign/core/Switch';
import { Text } from '@astryxdesign/core/Text';
import { Loading } from '@/components/Loading';
import { listGuardianNotices } from '@/lib/lab/labApi';
import type { GuardianNotice } from '@/lib/lab/labTypes';
import { noticeCoverage } from '@/lib/lab/guardianNotice';
import { ErrorBanner, LabConfirm, MonthStepper } from '@/components/lab/LabUi';
import { errorText, monthLabel, monthRange } from '@/components/lab/labFormat';
import { useLabElders } from '@/components/lab/useLabElders';
import { defaultNoticeMonth } from './GuardianNoticeDraft';
import GuardianNoticeEditor from './GuardianNoticeEditor';
import GuardianNoticeGuide from './GuardianNoticeGuide';
import GuardianNoticeList from './GuardianNoticeList';
import { useElderAttendanceDays } from './useElderAttendance';
import styles from './labRecords.module.css';

export default function GuardianNoticeLab() {
  const { elders, isLoading: eldersLoading, error: eldersError, reload: reloadElders } = useLabElders();
  const [month, setMonth] = useState(defaultNoticeMonth);
  const [notices, setNotices] = useState<GuardianNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [onlyPending, setOnlyPending] = useState(false);
  const seq = useRef(0);
  const { start, end } = monthRange(month);
  const attendance = useElderAttendanceDays(start, end);

  const load = useCallback(async (target: string) => {
    const n = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const list = await listGuardianNotices(target);
      if (n === seq.current) setNotices(list);
    } catch (e) {
      if (n === seq.current) {
        setNotices([]);
        setError(errorText(e, '보호자 안내를 불러오지 못했습니다'));
      }
    } finally {
      if (n === seq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(month);
    return () => {
      seq.current += 1;
    };
  }, [month, load]);

  const byElder = useMemo(() => {
    const map = new Map<number, GuardianNotice>();
    for (const n of notices) map.set(n.elderlyId, n);
    return map;
  }, [notices]);
  const coverage = useMemo(() => noticeCoverage(notices, elders, month), [notices, elders, month]);
  const visible = useMemo(() => (onlyPending ? elders.filter((e) => byElder.get(e.id)?.status !== 'SENT') : elders), [elders, byElder, onlyPending]);
  const selected = elders.find((e) => e.id === selectedId) ?? null;

  // 달을 넘기면 열어 둔 어르신은 닫는다(다른 달의 안내를 섞어 보지 않게)
  const [pendingMonth, setPendingMonth] = useState<string | null>(null);
  const changeMonth = (value: string) => {
    if (selected) setPendingMonth(value);
    else setMonth(value);
  };

  const upsert = (n: GuardianNotice) => setNotices((prev) => [...prev.filter((p) => p.elderlyId !== n.elderlyId), n]);

  return (
    <div className={styles.stack}>
      <GuardianNoticeGuide />

      <div className={styles.toolbar}>
        <MonthStepper value={month} onChange={changeMonth} isDisabled={loading} />
        <Text type="supporting" color="secondary">
          {monthLabel(month)} · 보냄 {coverage.sent} · 초안 {coverage.draft} · 없음 {coverage.missing}
        </Text>
        <div className={styles.spacer}>
          <Switch label="보내지 않은 분만" value={onlyPending} onChange={setOnlyPending} />
        </div>
      </div>

      {eldersError && <ErrorBanner message={eldersError} onRetry={() => void reloadElders()} />}
      {error && <ErrorBanner message={error} onRetry={() => void load(month)} />}

      {eldersLoading ? (
        <Loading size="inline" label="어르신 목록을 불러오는 중..." />
      ) : elders.length === 0 ? (
        <EmptyState title="등록된 어르신이 없습니다" description="회원관리 탭에서 어르신을 먼저 등록해 주세요." />
      ) : (
        <div className={styles.split} data-has-selection={selected ? 'true' : 'false'}>
          <div className={styles.splitList}>
            <Card padding={0}>
              {loading && notices.length === 0 ? (
                <Loading size="inline" label="안내 현황을 불러오는 중..." />
              ) : visible.length === 0 ? (
                <div className={styles.rowBlock}>
                  <Text type="supporting" color="secondary">
                    모든 어르신에게 보냈습니다.
                  </Text>
                </div>
              ) : (
                <GuardianNoticeList elders={visible} byElder={byElder} selectedId={selectedId} onSelect={setSelectedId} />
              )}
            </Card>
          </div>
          <div className={styles.splitDetail}>
            {selected ? (
              <GuardianNoticeEditor
                key={`${selected.id}-${month}`}
                elder={selected}
                month={month}
                notice={byElder.get(selected.id) ?? null}
                countedDays={attendance.days ? attendance.days.get(selected.id) ?? 0 : null}
                onChanged={upsert}
                onDeleted={() => {
                  setSelectedId(null);
                  void load(month);
                }}
                onBack={() => setSelectedId(null)}
              />
            ) : (
              <Card padding={6}>
                <EmptyState isCompact title="왼쪽에서 어르신을 골라 주세요" description="그 달의 기록을 모아 보여 드리고, 그 사실로 보호자께 보낼 안내 초안을 만들어 줍니다." />
              </Card>
            )}
          </div>
        </div>
      )}

      <LabConfirm
        isOpen={pendingMonth !== null}
        title="다른 달로 옮길까요?"
        description="열어 둔 안내에서 저장하지 않은 내용은 사라집니다."
        actionLabel="옮기기"
        onConfirm={() => {
          if (pendingMonth) {
            setSelectedId(null);
            setMonth(pendingMonth);
          }
          setPendingMonth(null);
        }}
        onClose={() => setPendingMonth(null)}
      />
    </div>
  );
}
