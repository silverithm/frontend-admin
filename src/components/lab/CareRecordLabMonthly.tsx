'use client';

/** 월별 기록지 — 어르신과 달을 고르면 하루씩 한 줄로 모아 보여 주고, 인쇄한다. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Selector } from '@astryxdesign/core/Selector';
import { Text } from '@astryxdesign/core/Text';
import { Loading } from '@/components/Loading';
import { CARE_GRADE_LABELS } from '@/lib/elderCare';
import { printSheets } from '@/lib/lab/careRecordFormRules';
import { listCareRecordsByElder } from '@/lib/lab/labApi';
import type { CareRecord } from '@/lib/lab/labTypes';
import CareRecordLabFormPrint from './CareRecordLabFormPrint';
import { CareMonthlyPrint, CareMonthlyTable } from './CareRecordLabSheet';
import { ErrorBanner, MonthStepper, SupportText } from './LabUi';
import { companyNameStored, currentMonth, errorText } from './labFormat';
import type { LabElder } from './useLabElders';
import styles from './lab.module.css';
import formStyles from './labForm.module.css';

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
  // 인쇄는 한 번에 한 가지만 그려 @page 설정이 섞이지 않게 한다 — 인쇄 단추가 먼저 어느 쪽을 그릴지 정한다
  const [printMode, setPrintMode] = useState<'table' | 'form'>('table');
  const [backEachSheet, setBackEachSheet] = useState(false);
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
  const sheetCount = useMemo(() => printSheets(records.map((r) => r.recordDate.slice(0, 10))).length, [records]);
  const gradeLabel = elder?.careGrade && elder.careGrade !== 'NONE' ? ((CARE_GRADE_LABELS as Record<string, string>)[elder.careGrade] ?? '') : '';
  const printAs = (mode: 'table' | 'form') => {
    flushSync(() => setPrintMode(mode));
    window.print();
  };

  if (eldersLoading) return <Loading size="inline" label="어르신 목록을 불러오는 중..." />;
  if (elders.length === 0) {
    return <EmptyState title="등록된 어르신이 없습니다" description="회원관리 탭에서 어르신을 먼저 등록해 주세요." />;
  }

  return (
    <div className={styles.stack}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarGrow} style={{ maxWidth: 240 }}>
          <Selector placeholder="고르기"
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
          onClick={() => printAs('table')}
        />
        <Button
          label="법정 서식(별지 제15호) 인쇄"
          variant="secondary"
          isDisabled={loading || !elder || filled === 0}
          onClick={() => printAs('form')}
        />
      </div>
      <div className={formStyles.formPrintOptions}>
        <CheckboxInput label="법정 서식은 장마다 뒷면(유의사항)도 찍기" value={backEachSheet} onChange={setBackEachSheet} />
        {filled > 0 && <SupportText>이용일 {filled}일 → 앞쪽 {sheetCount}장(한 장에 이용일 3칸)</SupportText>}
      </div>

      <Text type="supporting" color="secondary">
        {elder ? `${elder.name} 어르신 · 기록 ${filled}일` : ''} · ‘인쇄’는 한 달을 한 장 표로 모은 참고용입니다. ‘법정 서식(별지 제15호) 인쇄’는 서식 칸·유의사항을 서식 모양으로 찍지만, 제출·보관용은 공단 서식 원문과 대조해 주세요.
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

      {elder && filled > 0 && printMode === 'table' && (
        <CareMonthlyPrint month={month} elderName={elder.name} companyName={companyNameStored()} records={records} />
      )}
      {elder && filled > 0 && printMode === 'form' && (
        <CareRecordLabFormPrint month={month} elderName={elder.name} gradeLabel={gradeLabel} companyName={companyNameStored()} records={records} backEachSheet={backEachSheet} />
      )}
    </div>
  );
}
