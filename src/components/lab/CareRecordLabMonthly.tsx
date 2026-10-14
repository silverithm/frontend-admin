'use client';

/** 월별 기록지 — 어르신과 달을 고르면 하루씩 한 줄로 모아 보여 주고, 인쇄한다. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Selector } from '@astryxdesign/core/Selector';
import { Text } from '@astryxdesign/core/Text';
import { Loading } from '@/components/Loading';
import { listCareRecordsByElder } from '@/lib/lab/labApi';
import type { CareRecord } from '@/lib/lab/labTypes';
import { CareMonthlyPrint, CareMonthlyTable } from './CareRecordLabSheet';
import { ErrorBanner, MonthStepper } from './LabUi';
import { companyNameStored, currentMonth, errorText } from './labFormat';
import type { LabElder } from './useLabElders';
import styles from './lab.module.css';

interface CareMonthlyViewProps {
  elders: LabElder[];
  eldersLoading: boolean;
}

export default function CareRecordLabMonthly({ elders, eldersLoading }: CareMonthlyViewProps) {
  const [elderId, setElderId] = useState<number | null>(null);
  const [month, setMonth] = useState(currentMonth);
  const [records, setRecords] = useState<CareRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  // 첫 어르신을 기본으로 고른다
  useEffect(() => {
    if (elderId === null && elders.length > 0) setElderId(elders[0].id);
  }, [elders, elderId]);

  const load = useCallback(async (id: number, target: string) => {
    const n = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const list = await listCareRecordsByElder(id, target);
      if (n !== seq.current) return;
      setRecords(list);
    } catch (e) {
      if (n !== seq.current) return;
      setRecords([]);
      setError(errorText(e, '월간 급여제공기록을 불러오지 못했습니다'));
    } finally {
      if (n === seq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (elderId !== null) void load(elderId, month);
  }, [elderId, month, load]);

  const elder = elders.find((e) => e.id === elderId) ?? null;
  const options = useMemo(() => elders.map((e) => ({ value: String(e.id), label: e.name })), [elders]);
  const filled = records.length;

  if (eldersLoading) return <Loading size="inline" label="어르신 목록을 불러오는 중..." />;
  if (elders.length === 0) {
    return <EmptyState title="등록된 어르신이 없습니다" description="회원관리 탭에서 어르신을 먼저 등록해 주세요." />;
  }

  return (
    <div className={styles.stack}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarGrow} style={{ maxWidth: 240 }}>
          <Selector
            label="어르신"
            options={options}
            value={elderId === null ? undefined : String(elderId)}
            onChange={(value) => setElderId(value ? Number(value) : null)}
            hasSearch
            searchPlaceholder="이름 검색"
          />
        </div>
        <MonthStepper value={month} onChange={setMonth} isDisabled={loading} />
        <Button
          label="인쇄"
          variant="primary"
          isDisabled={loading || !elder || filled === 0}
          onClick={() => window.print()}
        />
      </div>

      <Text type="supporting" color="secondary">
        {elder ? `${elder.name} 어르신 · 기록 ${filled}일` : ''} · 인쇄본은 실험실에서 만든 참고용이며 공단 공식 서식(별지 제15호)이 아닙니다. 제출용은 공단 서식을 확인해 주세요.
      </Text>

      {error && <ErrorBanner message={error} onRetry={elderId !== null ? () => void load(elderId, month) : undefined} />}

      {loading ? (
        <Loading size="section" label="기록을 불러오는 중..." />
      ) : filled === 0 && !error ? (
        <Card padding={6}>
          <EmptyState
            isCompact
            title="이 달에는 기록이 없습니다"
            description="‘하루 기록’에서 날짜별로 기록을 남기면 여기에 모입니다."
          />
        </Card>
      ) : (
        <Card padding={0}>
          <div className={styles.tableScroll}>
            <CareMonthlyTable month={month} records={records} />
          </div>
        </Card>
      )}

      {elder && filled > 0 && (
        <CareMonthlyPrint month={month} elderName={elder.name} companyName={companyNameStored()} records={records} />
      )}
    </div>
  );
}
