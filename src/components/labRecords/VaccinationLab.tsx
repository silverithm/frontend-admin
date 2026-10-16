'use client';

/**
 * 예방접종 — 연도별 진행 중 어르신의 인플루엔자 접종 상태, 여러 어르신 한 번에 접종 기록, 평가 접종률 환산, 참고 백신, A4 인쇄.
 * 접종률 점수는 지금 기록 기준 추정이며 2026·2027 평가는 충족 처리다.
 */
import { useCallback, useMemo, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Text } from '@astryxdesign/core/Text';
import { Loading } from '@/components/Loading';
import { listElderContracts, listVaccinations } from '@/lib/lab/labApi';
import type { Vaccination } from '@/lib/lab/labTypes';
import { seasonProgress } from '@/lib/lab/vaccineRules';
import { ErrorBanner } from '@/components/lab/LabUi';
import { todayString } from '@/components/lab/labFormat';
import { YearStepper } from './RecordsUi';
import { useRecordsLoader } from './useRecordsLoader';
import VaccinationBatchForm from './VaccinationBatchForm';
import type { ActiveElder } from './VaccinationDraft';
import VaccinationEval from './VaccinationEval';
import { VaccinationKdcaNotice } from './VaccinationNotice';
import VaccinationOther from './VaccinationOther';
import VaccinationSheet from './VaccinationSheet';
import VaccinationStatusTable from './VaccinationStatusTable';
import styles from './labRecords.module.css';
import own from './Vaccination.module.css';

type FormState = { key: number; initial: { elderId: number; record: Vaccination | null } | null };

export default function VaccinationLab({ onOpenContracts }: { onOpenContracts?: () => void }) {
  const today = todayString();
  const thisYear = Number(today.slice(0, 4));
  const [year, setYear] = useState(thisYear);
  const [form, setForm] = useState<FormState | null>(null);
  const [printing, setPrinting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const loadContracts = useCallback(() => listElderContracts({ status: 'ACTIVE' }), []);
  const loadRecords = useCallback(() => listVaccinations({ year }), [year]);
  const contracts = useRecordsLoader(loadContracts, '진행 중인 어르신을 불러오지 못했습니다', []);
  const records = useRecordsLoader(loadRecords, `${year}년 접종 기록을 불러오지 못했습니다`, []);

  const elders: ActiveElder[] = useMemo(() => {
    const map = new Map<number, string>();
    for (const c of contracts.data) if (c.status === 'ACTIVE' && !map.has(c.elderlyId)) map.set(c.elderlyId, c.elderlyName);
    return [...map].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }, [contracts.data]);
  const influenza = useMemo(() => records.data.filter((r) => r.vaccine === 'INFLUENZA'), [records.data]);
  const progress = useMemo(() => seasonProgress(elders.map((e) => e.id), influenza, year), [elders, influenza, year]);

  const loading = contracts.isLoading || records.isLoading;
  const error = contracts.error ?? records.error;
  const ready = !loading && !error;

  const changed = () => {
    void records.reload();
    setReloadKey((k) => k + 1);
  };
  const openForm = (initial: FormState['initial']) => setForm((f) => ({ key: (f?.key ?? 0) + 1, initial }));
  const changeYear = (next: number) => {
    setForm(null);
    setYear(next);
  };

  return (
    <div className={styles.stack}>
      <div className={styles.toolbar}>
        <YearStepper value={year} onChange={changeYear} max={thisYear} />
        <div className={styles.spacer}>
          <span className={styles.chips}>
            <Button label="접종 기록" variant="primary" isDisabled={!ready} onClick={() => openForm(null)} />
            <Button label="현황표 인쇄" variant="secondary" isDisabled={!ready || elders.length === 0} onClick={() => setPrinting(true)} />
          </span>
        </div>
      </div>

      <VaccinationKdcaNotice />

      {error && (
        <ErrorBanner
          message={error}
          onRetry={() => {
            void contracts.reload();
            void records.reload();
          }}
        />
      )}

      {form && (
        <VaccinationBatchForm
          key={form.key}
          year={year}
          elders={elders}
          existing={records.data}
          initial={form.initial}
          onSaved={changed}
          onClose={() => setForm(null)}
        />
      )}

      {loading && elders.length === 0 ? (
        <Loading size="inline" label="접종 현황을 불러오는 중..." />
      ) : ready ? (
        <>
          <div className={own.summaryBox} aria-label={`${year}년 인플루엔자 접종 진행`}>
            <div className={own.summaryItem}>
              <Text type="supporting" color="secondary">
                {year}년 접종률 (거부·제외 제외)
              </Text>
              <Text type="large" weight="semibold" hasTabularNumbers>
                {progress.rate === null ? '-' : `${progress.rate}%`}
              </Text>
            </div>
            <div className={own.summaryItem}>
              <Text type="supporting" color="secondary">
                접종
              </Text>
              <Text type="label" hasTabularNumbers>
                {progress.done}명
              </Text>
            </div>
            <div className={own.summaryItem}>
              <Text type="supporting" color="secondary">
                거부
              </Text>
              <Text type="label" hasTabularNumbers>
                {progress.refused}명
              </Text>
            </div>
            <div className={own.summaryItem}>
              <Text type="supporting" color="secondary">
                제외
              </Text>
              <Text type="label" hasTabularNumbers>
                {progress.excluded}명
              </Text>
            </div>
            <div className={own.summaryItem}>
              <Text type="supporting" color="secondary">
                미확인
              </Text>
              <Text type="label" hasTabularNumbers>
                {progress.unknown}명
              </Text>
            </div>
            <div className={own.summaryItem}>
              <Text type="supporting" color="secondary">
                진행 중 어르신
              </Text>
              <Text type="label" hasTabularNumbers>
                {progress.total}명
              </Text>
            </div>
          </div>
          <VaccinationStatusTable year={year} elders={elders} records={influenza} onEdit={(elderId, record) => openForm({ elderId, record })} onChanged={changed} onOpenContracts={onOpenContracts} />
        </>
      ) : null}

      <VaccinationEval reloadKey={reloadKey} />
      <VaccinationOther year={year} records={records.data} />

      {printing && <VaccinationSheet year={year} elders={elders} records={records.data} progress={progress} today={today} onDone={() => setPrinting(false)} />}
    </div>
  );
}
