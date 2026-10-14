'use client';

/** 올해 저장한 달 목록 — 달을 누르면 그 달 점검을 연다. 지우기는 확인 창을 거친다. */
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Loading } from '@/components/Loading';
import { Chip, ErrorBanner } from '@/components/lab/LabUi';
import { monthLabel } from '@/components/lab/labFormat';
import type { StaffingMonth } from '@/lib/lab/labTypes';
import { previousMonth } from '@/lib/lab/staffingRules';
import { checkOfRecord } from './StaffingCheckOf';
import eight from './labPlans8.module.css';

interface Props {
  year: number;
  rows: StaffingMonth[];
  loading: boolean;
  error: string | null;
  activeMonth: string;
  busy: boolean;
  onRetry: () => void;
  onOpen: (month: string) => void;
  onDelete: (row: StaffingMonth) => void;
}

export default function StaffingMonthList({ year, rows, loading, error, activeMonth, busy, onRetry, onOpen, onDelete }: Props) {
  // 지난달도 위반이었던 달은 연속 위반 배수를 곱해 보여 준다
  const baseViolated = new Map(rows.map((r) => [r.staffingMonth, checkOfRecord(r).check.violated]));
  return (
    <Card padding={4}>
      <VStack gap={2}>
        <Text type="label">{year}년 저장한 달 ({rows.length}개)</Text>
        {error && <ErrorBanner message={error} onRetry={onRetry} />}
        {loading && rows.length === 0 ? (
          <Loading size="section" label="저장한 달을 불러오는 중..." />
        ) : rows.length === 0 && !error ? (
          <Text type="supporting" color="secondary">올해 저장한 달이 없습니다. 위에서 점검한 뒤 저장하면 여기에 쌓입니다.</Text>
        ) : (
          <div className={eight.listStack}>
            {rows.map((r) => {
              const prev = previousMonth(r.staffingMonth);
              const c = checkOfRecord(r, prev !== null && baseViolated.get(prev) === true);
              return (
                <HStack key={r.id} gap={2} vAlign="center" wrap="wrap">
                  <button type="button" className={eight.listRow} data-active={r.staffingMonth === activeMonth} onClick={() => onOpen(r.staffingMonth)} style={{ flex: '1 1 260px', width: 'auto' }}>
                    <Text type="label">{monthLabel(r.staffingMonth)}</Text>
                    <Text type="supporting" color="secondary" hasTabularNumbers>
                      입소자 {c.users}명 · 직원 {r.staff.length}명
                    </Text>
                    <Chip tone={c.users === 0 ? 'neutral' : c.check.violated ? 'danger' : 'ok'} label={c.users === 0 ? '입소자 없음' : c.check.violated ? `결원 · 감산율 ${c.check.penaltyRate}%` : '기준 충족'} />
                  </button>
                  <Button label="삭제" variant="ghost" isDisabled={busy} onClick={() => onDelete(r)} />
                </HStack>
              );
            })}
          </div>
        )}
      </VStack>
    </Card>
  );
}
