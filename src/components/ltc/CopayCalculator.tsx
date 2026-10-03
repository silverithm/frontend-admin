'use client';

// 주·야간보호 본인부담금 계산기.
// 첫 렌더(서버)는 기본값(4등급·8~10시간·20일·일반 15%)으로 계산한 결과를 그대로 그린다 —
// 자바스크립트 없이 받은 HTML에도 "예시 계산"이 들어 있어야 검색엔진이 이 페이지가 무엇을 답하는지 안다.
// 계산식은 @/lib/ltc2026의 calcDaycareCopay 하나뿐이고, 여기서는 입력과 표시만 다룬다.

import { useMemo, useState } from 'react';
import { Card } from '@astryxdesign/core/Card';
import { Selector } from '@astryxdesign/core/Selector';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { NumberInput } from '@astryxdesign/core/NumberInput';
import { Banner } from '@astryxdesign/core/Banner';
import { Divider } from '@astryxdesign/core/Divider';
import { Text } from '@astryxdesign/core/Text';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import {
  CARE_GRADES,
  COPAY_CLASSES,
  DAYCARE_UNITS,
  HOUR_BANDS,
  MAX_DAYS_IN_MONTH,
  calcDaycareCopay,
  formatWon,
  gradeLabel,
  hourBand,
  type CareGrade,
  type CopayClass,
  type DaycareCopayInput,
  type DaycareUnit,
  type HourBand,
} from '@/lib/ltc2026';

export const DEFAULT_COPAY_INPUT: DaycareCopayInput = {
  grade: '4',
  unit: 'general',
  band: 'h8to10',
  days: 20,
  copayClass: 'standard',
};

export default function CopayCalculator() {
  const [input, setInput] = useState<DaycareCopayInput>(DEFAULT_COPAY_INPUT);
  const result = useMemo(() => calcDaycareCopay(input), [input]);

  function update<K extends keyof DaycareCopayInput>(key: K, value: DaycareCopayInput[K]) {
    setInput((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <Card padding={6}>
      <VStack gap={6}>
        <VStack gap={4}>
          <SegmentedControl
            label="이용 구분"
            value={input.unit}
            onChange={(value) => update('unit', value as DaycareUnit)}
          >
            {DAYCARE_UNITS.map((unit) => (
              <SegmentedControlItem key={unit.id} value={unit.id} label={unit.label} />
            ))}
          </SegmentedControl>

          <div className="carev-ltc-form">
            <Selector
              label="장기요양등급"
              value={input.grade}
              onChange={(value) => update('grade', value as CareGrade)}
              options={CARE_GRADES.map((grade) => ({ value: grade.id, label: grade.label }))}
            />
            <Selector
              label="하루 이용시간"
              value={input.band}
              onChange={(value) => update('band', value as HourBand)}
              options={HOUR_BANDS.map((band) => ({ value: band.id, label: band.label }))}
            />
            <NumberInput
              label="한 달 이용일수"
              value={input.days}
              onChange={(value) => update('days', value)}
              min={1}
              max={MAX_DAYS_IN_MONTH}
              units="일"
            />
            <Selector
              label="본인부담 구분"
              value={input.copayClass}
              onChange={(value) => update('copayClass', value as CopayClass)}
              options={COPAY_CLASSES.map((item) => ({ value: item.id, label: item.label }))}
            />
          </div>
        </VStack>

        <Divider />

        <div aria-live="polite">
          {result === null ? (
            <Banner
              status="info"
              title="치매전담실 표에는 1등급 금액이 없습니다"
              description="고시 제74조의 치매전담실 급여비용은 2등급부터 인지지원등급까지만 정해져 있습니다. 일반 주·야간보호로 바꾸거나 다른 등급을 고르세요."
            />
          ) : (
            <VStack gap={3}>
              <ResultRow
                label="1일 급여비용"
                value={formatWon(result.dailyFee)}
                note={`${gradeLabel(input.grade)} · ${hourBand(input.band).short}`}
              />
              <ResultRow
                label="한 달 급여비용"
                value={formatWon(result.totalFee)}
                note={`${formatWon(result.dailyFee)} × ${result.days}일`}
              />
              <ResultRow
                label="적용 월 한도액"
                value={formatWon(result.appliedLimit)}
                note={
                  result.addOnPercent > 0
                    ? `기본 ${formatWon(result.baseLimit)} + 추가 산정 ${result.addOnPercent}% (${result.addOnBasis})`
                    : '추가 산정 없음'
                }
              />
              <ResultRow label="공단 부담금" value={formatWon(result.insurerShare)} />
              <ResultRow
                label={`본인부담금 (한도 안 ${result.copayPercent}%)`}
                value={formatWon(result.copayWithinLimit)}
              />
              {result.overLimit > 0 && (
                <ResultRow
                  label="한도 초과분 (전액 본인부담)"
                  value={formatWon(result.overLimit)}
                  note="월 한도액을 넘는 금액은 수급자가 전부 냅니다 (노인장기요양보험법 제40조제3항)"
                />
              )}

              <Divider />

              <HStack gap={3} hAlign="between" vAlign="center" wrap="wrap">
                <Text weight="semibold">이번 달 본인부담금</Text>
                <Text type="large" weight="bold" color="accent" hasTabularNumbers>
                  {formatWon(result.totalCopay)}
                </Text>
              </HStack>
              <Text type="supporting" color="secondary">
                원 미만은 버렸습니다. 실제 청구서는 끝전 처리 방식에 따라 몇 원 차이가 날 수 있고, 야간·공휴일 가산과 식사재료비 같은 비급여는 들어 있지 않습니다.
              </Text>
            </VStack>
          )}
        </div>
      </VStack>
    </Card>
  );
}

function ResultRow({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <VStack gap={0.5}>
      <HStack gap={3} hAlign="between" vAlign="center" wrap="wrap">
        <Text color="secondary">{label}</Text>
        <Text weight="semibold" hasTabularNumbers>
          {value}
        </Text>
      </HStack>
      {note && (
        <Text type="supporting" color="secondary">
          {note}
        </Text>
      )}
    </VStack>
  );
}
