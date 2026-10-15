'use client';

/** 증빙 회계 장부 기록 고르기 — 그 해 장부(listLedgerEntriesByYear)에서 날짜·적요·금액으로 찾는다. 장부를 못 읽으면 보관 위치 글만으로도 된다. */
import { Selector } from '@astryxdesign/core/Selector';
import { VStack } from '@astryxdesign/core/Stack';
import { ErrorBanner, SupportText } from '@/components/lab/LabUi';
import { dotDate } from '@/components/lab/labFormat';
import type { LedgerDirection, LedgerEntry } from '@/lib/lab/labTypes';
import { wonText } from './StaffWelfareFormat';
import { useLedgerYear } from './StaffWelfareLoad';

interface Props {
  year: number;
  /** 지출 증빙이면 EXPENSE, 받은 가산금이면 INCOME */
  direction: LedgerDirection;
  value: number | null;
  onChange: (id: number | null) => void;
  isDisabled?: boolean;
}

function optionLabel(e: LedgerEntry): string {
  return `${dotDate(e.entryDate)} · ${e.description} · ${wonText(e.amount)}`;
}

export default function StaffWelfareEvidence({ year, direction, value, onChange, isDisabled }: Props) {
  const { data, loading, error, reload } = useLedgerYear(year);
  const rows = data.filter((e) => e.direction === direction).sort((a, b) => (a.entryDate < b.entryDate ? 1 : -1));
  const options = rows.map((e) => ({ value: String(e.id), label: optionLabel(e) }));
  // 다른 해 장부를 연결해 둔 기록은 선택지에 없어도 연결 표시를 잃지 않게 한다
  if (value !== null && !options.some((o) => o.value === String(value))) options.unshift({ value: String(value), label: `연결된 장부 기록 (번호 ${value})` });
  return (
    <VStack gap={1}>
      <Selector
        label="증빙 장부 기록 (선택)"
        placeholder={loading ? '장부를 불러오는 중...' : `${year}년 ${direction === 'EXPENSE' ? '지출' : '수입'} 기록 고르기`}
        hasSearch
        searchPlaceholder="찾기"
        hasClear
        options={options}
        value={value === null ? null : String(value)}
        onChange={(v) => onChange(v === null || v === '' ? null : Number(v))}
        isDisabled={isDisabled || loading}
      />
      {error && <ErrorBanner message={error} onRetry={() => void reload()} />}
      {!loading && !error && rows.length === 0 && <SupportText>{year}년 장부에 {direction === 'EXPENSE' ? '지출' : '수입'} 기록이 없습니다. 보관 위치를 적어 두세요.</SupportText>}
    </VStack>
  );
}
