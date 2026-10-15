'use client';

/**
 * 수칙·운행표 제공 보기 — 규정·지침 대장의 이동서비스 수칙 상태, 최근 3개월 탑승 어르신 중 수칙 미제공(ruleDeliveryCoverage),
 * 여러 어르신 한 번에 제공 기록, 운행표 제공 현황(timetableMonths).
 */
import { useCallback, useMemo, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Loading } from '@/components/Loading';
import { listGuideDeliveries, listPolicyDocs, listTransportLogs } from '@/lib/lab/labApi';
import type { GuideKind } from '@/lib/lab/labTypes';
import { recentMonths, ridersBetween, ruleDeliveryCoverage } from '@/lib/lab/transportRules';
import { ErrorBanner } from '@/components/lab/LabUi';
import { todayString } from '@/components/lab/labFormat';
import type { LabElder } from '@/components/lab/useLabElders';
import { useRecordsLoader } from './useRecordsLoader';
import TransportDeliveryForm from './TransportDeliveryForm';
import TransportRuleCoverage from './TransportRuleCoverage';
import TransportRulesStatus from './TransportRulesStatus';
import TransportTimetable from './TransportTimetable';
import styles from './labRecords.module.css';

type FormState = { key: number; kind: GuideKind; ids: number[] };

export default function TransportRulesView({ elders }: { elders: LabElder[] }) {
  const today = todayString();
  const months = useMemo(() => recentMonths(today, 3), [today]);
  const from = `${months[0] ?? today.slice(0, 7)}-01`;
  const [form, setForm] = useState<FormState | null>(null);

  const loadDocs = useCallback(() => listPolicyDocs(), []);
  const loadRules = useCallback(() => listGuideDeliveries('TRANSPORT_RULES'), []);
  const loadTimetable = useCallback(() => listGuideDeliveries('TIMETABLE'), []);
  const loadLogs = useCallback(async () => (await Promise.all(months.map((m) => listTransportLogs({ month: m })))).flat(), [months]);
  const docs = useRecordsLoader(loadDocs, '규정·지침 대장을 불러오지 못했습니다', []);
  const rules = useRecordsLoader(loadRules, '수칙 제공 기록을 불러오지 못했습니다', []);
  const timetable = useRecordsLoader(loadTimetable, '운행표 제공 기록을 불러오지 못했습니다', []);
  const logs = useRecordsLoader(loadLogs, '최근 3개월 운행일지를 불러오지 못했습니다', []);

  const doc = docs.data.find((d) => d.kind === 'TRANSPORT_RULES') ?? null;
  const riderIds = useMemo(() => ridersBetween(logs.data, from, today), [logs.data, from, today]);
  const coverage = useMemo(() => ruleDeliveryCoverage(riderIds, rules.data, doc?.revisedOn ?? null), [riderIds, rules.data, doc]);
  const names = useMemo(() => {
    const map = new Map<number, string>();
    for (const l of logs.data) for (const r of l.riders) map.set(r.elderlyId, r.elderlyName);
    for (const e of elders) map.set(e.id, e.name);
    return map;
  }, [logs.data, elders]);

  const loading = docs.isLoading || rules.isLoading || timetable.isLoading || logs.isLoading;
  const errors = [docs, rules, timetable, logs].filter((l) => l.error);
  const open = (kind: GuideKind, ids: number[]) => setForm((f) => ({ key: (f?.key ?? 0) + 1, kind, ids }));
  const reloadDeliveries = () => {
    void rules.reload();
    void timetable.reload();
  };

  return (
    <div className={styles.stack}>
      <div className={styles.toolbar}>
        <div className={styles.spacer}>
          <span className={styles.chips}>
            <Button label="수칙 제공 기록" variant="primary" isDisabled={loading} onClick={() => open('TRANSPORT_RULES', [])} />
            <Button label="운행표 제공 기록" variant="secondary" isDisabled={loading} onClick={() => open('TIMETABLE', [])} />
          </span>
        </div>
      </div>

      {errors.map((l) => (
        <ErrorBanner key={l.error} message={l.error as string} onRetry={() => void l.reload()} />
      ))}

      {form && <TransportDeliveryForm key={form.key} elders={elders} initialIds={form.ids} initialKind={form.kind} riderIds={riderIds} onSaved={reloadDeliveries} onClose={() => setForm(null)} />}

      {loading && docs.data.length === 0 && rules.data.length === 0 ? (
        <Loading size="inline" label="수칙 제공 현황을 불러오는 중..." />
      ) : (
        <>
          {!docs.error && <TransportRulesStatus doc={doc} today={today} />}
          {!logs.error && !rules.error && (
            <TransportRuleCoverage coverage={coverage} names={names} revisedOn={doc?.revisedOn ?? null} from={from} today={today} onSelectMissing={() => open('TRANSPORT_RULES', coverage.missing)} />
          )}
          {!timetable.error && !rules.error && <TransportTimetable deliveries={timetable.data} rules={rules.data} months={months} onChanged={reloadDeliveries} />}
        </>
      )}
    </div>
  );
}
