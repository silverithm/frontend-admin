'use client';

/** 재난훈련 — 올해 상반기(1~6월)·하반기(7~12월) 각각 한 번씩, 연 2회 했는지. */
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import type { SafetyCheck } from '@/lib/lab/labTypes';
import { isPerformed, safetyCoverage } from '@/lib/lab/safetyRules';
import { Chip, ErrorBanner } from '@/components/lab/LabUi';
import { dotDate } from '@/components/lab/labFormat';
import { YearStepper } from './RecordsUi';

interface DrillProps {
  year: number;
  maxYear: number;
  checks: SafetyCheck[];
  isLoading: boolean;
  error: string | null;
  onYear: (year: number) => void;
  onRetry: () => void;
  onWrite: () => void;
  onOpen: (date: string) => void;
}

const HALVES = [
  { id: 'H1', label: '상반기 (1~6월)' },
  { id: 'H2', label: '하반기 (7~12월)' },
] as const;

export default function SafetyCheckDrill({ year, maxYear, checks, isLoading, error, onYear, onRetry, onWrite, onOpen }: DrillProps) {
  const coverage = safetyCoverage(checks, 'DRILL', { year });
  const done = checks.filter(isPerformed).sort((a, b) => a.checkDate.localeCompare(b.checkDate));
  return (
    <Card padding={4}>
      <VStack gap={3}>
        <HStack hAlign="between" vAlign="center" gap={3} wrap="wrap">
          <div>
            <Text type="large" weight="semibold">
              재난훈련 (연 2회)
            </Text>
            <br />
            <Text type="supporting" color="secondary">
              소방·재난 대피 훈련을 반기마다 한 번씩 하고 기록합니다.
            </Text>
          </div>
          <YearStepper value={year} onChange={onYear} max={maxYear} isDisabled={isLoading} />
        </HStack>

        {error ? (
          <ErrorBanner message={error} onRetry={onRetry} />
        ) : (
          <>
            <HStack gap={3} vAlign="center" wrap="wrap">
              {HALVES.map((h) => {
                const missing = coverage.missing.includes(`${year}-${h.id}`);
                return <Chip key={h.id} tone={isLoading ? 'neutral' : missing ? 'warn' : 'ok'} label={`${h.label} ${isLoading ? '확인 중' : missing ? '아직 안 함' : '완료'}`} />;
              })}
              <Text type="label" hasTabularNumbers>
                {isLoading ? '' : `${coverage.done}/${coverage.required}회`}
              </Text>
            </HStack>
            {done.length > 0 && (
              <HStack gap={2} wrap="wrap" vAlign="center">
                <Text type="supporting" color="secondary">
                  기록한 날
                </Text>
                {done.map((c) => (
                  <Button key={c.id} label={dotDate(c.checkDate)} variant="ghost" size="sm" onClick={() => onOpen(c.checkDate.slice(0, 10))} />
                ))}
              </HStack>
            )}
          </>
        )}
        <div>
          <Button label="재난훈련 기록하기" variant="secondary" onClick={onWrite} />
        </div>
      </VStack>
    </Card>
  );
}
