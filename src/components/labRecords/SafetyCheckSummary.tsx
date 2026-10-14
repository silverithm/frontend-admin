'use client';

/** 이번 달 점검 현황 — 종류마다 done/required와 빠진 날. 빠진 날을 누르면 그 점검을 바로 쓰러 간다. */
import { Card } from '@astryxdesign/core/Card';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import type { SafetyKind } from '@/lib/lab/labTypes';
import { SAFETY_CADENCE_LABEL, cadenceOf } from '@/lib/lab/safetyRules';
import type { MonthlySafetySummary } from '@/lib/lab/safetyRules';
import { Chip } from '@/components/lab/LabUi';
import { monthLabel, weekdayKo } from '@/components/lab/labFormat';
import styles from './labRecords.module.css';

interface SummaryProps {
  month: string;
  summary: MonthlySafetySummary;
  noVehicle: boolean;
  onNoVehicle: (value: boolean) => void;
  saturday: boolean;
  onSaturday: (value: boolean) => void;
  isLoading: boolean;
  onPick: (kind: SafetyKind, missing: string) => void;
}

/** 빠진 곳 표시: 날짜 → "10/6(화)", 주 월요일 → "10/5 주", 'YYYY-MM' → "이번 달" */
function missingLabel(kind: SafetyKind, value: string): string {
  const cadence = cadenceOf(kind);
  if (cadence === 'MONTHLY') return '이 달 점검';
  const md = `${Number(value.slice(5, 7))}/${Number(value.slice(8, 10))}`;
  return cadence === 'WEEKLY' ? `${md} 주` : `${md}(${weekdayKo(value)})`;
}

const SHOW_MISSING = 12;

export default function SafetyCheckSummary({ month, summary, noVehicle, onNoVehicle, saturday, onSaturday, isLoading, onPick }: SummaryProps) {
  const tone = summary.required === 0 ? 'neutral' : summary.percent >= 100 ? 'ok' : summary.percent >= 70 ? 'warn' : 'danger';
  return (
    <Card padding={4}>
      <VStack gap={3}>
        <HStack hAlign="between" vAlign="center" gap={3} wrap="wrap">
          <div>
            <Text type="large" weight="semibold">
              {monthLabel(month)} 점검 현황
            </Text>
            <br />
            <Text type="supporting" color="secondary">
              {isLoading ? '불러오는 중...' : '오늘까지 해야 했던 점검 기준입니다. 연 2회 재난훈련은 아래에서 따로 봅니다.'}
            </Text>
          </div>
          <HStack gap={2} vAlign="center">
            <Chip tone={tone} label={summary.required === 0 ? '해당 점검 없음' : `완료율 ${summary.percent}%`} />
            <Text type="label" hasTabularNumbers>
              {summary.done}/{summary.required}
            </Text>
          </HStack>
        </HStack>

        <CheckboxInput label="차량 운행 안 함 (차량 점검을 필요 횟수에서 뺍니다)" value={noVehicle} onChange={onNoVehicle} />
        <CheckboxInput label="토요일도 운영 (토요일을 매일 점검 운영일에 넣습니다)" value={saturday} onChange={onSaturday} />

        <div>
          {summary.perKind.map((k) => {
            const shown = k.missing.slice(0, SHOW_MISSING);
            const pct = k.required === 0 ? 100 : Math.min(100, Math.floor((k.done / k.required) * 100));
            return (
              <div key={k.kind} className={styles.rowBlock}>
                <div className={styles.rowHead}>
                  <HStack gap={2} vAlign="center" wrap="wrap">
                    <Text type="label">{k.label}</Text>
                    <Text type="supporting" color="secondary">
                      {SAFETY_CADENCE_LABEL[cadenceOf(k.kind)]}
                    </Text>
                  </HStack>
                  <Text type="label" hasTabularNumbers>
                    {k.done}/{k.required}
                  </Text>
                </div>
                <div className={styles.meter} role="img" aria-label={`${k.label} ${k.done}/${k.required}`}>
                  <div className={styles.meterFill} style={{ width: `${pct}%` }} />
                </div>
                {k.missing.length > 0 && (
                  <div className={styles.missingWrap}>
                    <span className={styles.mutedText}>빠진 곳</span>
                    {shown.map((m) => (
                      <button key={m} type="button" className={styles.missingChip} onClick={() => onPick(k.kind, m)}>
                        {missingLabel(k.kind, m)}
                      </button>
                    ))}
                    {k.missing.length > shown.length && <span className={styles.mutedText}>외 {k.missing.length - shown.length}곳</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </VStack>
    </Card>
  );
}
