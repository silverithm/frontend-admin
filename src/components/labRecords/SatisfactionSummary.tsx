'use client';

/** 기간 요약 — 문항별 평균(막대)과 전체 평균. 평균 3.0 미만인 문항은 붉게 보이고 ‘낮음’ 표시가 붙는다. */
import { Card } from '@astryxdesign/core/Card';
import { HStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import type { SatisfactionKind } from '@/lib/lab/labTypes';
import type { SurveySummary } from '@/lib/lab/satisfactionRules';
import { SATISFACTION_KINDS, SURVEY_QUESTIONS } from '@/lib/lab/satisfactionRules';
import { Chip, SupportText } from '@/components/lab/LabUi';
import own from './Satisfaction.module.css';

interface Props {
  kind: SatisfactionKind;
  summary: SurveySummary;
}

export default function SatisfactionSummary({ kind, summary }: Props) {
  const kindLabel = SATISFACTION_KINDS.find((k) => k.value === kind)?.label ?? '';
  const questions = SURVEY_QUESTIONS[kind];
  return (
    <Card padding={4}>
      <HStack hAlign="between" vAlign="center" gap={2} wrap="wrap">
        <Text type="large" weight="semibold">
          {kindLabel} 만족도 요약
        </Text>
        <HStack gap={2} vAlign="center" wrap="wrap">
          <Chip tone="neutral" label={`응답 ${summary.count}건`} />
          {summary.overall !== null && <Chip tone={summary.overall < 3 ? 'danger' : 'info'} label={`전체 평균 ${summary.overall.toFixed(1)}점`} />}
        </HStack>
      </HStack>
      {summary.count === 0 ? (
        <SupportText>이 기간에 받은 {kindLabel} 응답이 없습니다. 위에서 응답을 받아 보세요.</SupportText>
      ) : (
        <div>
          {summary.byQuestion.map((row) => {
            const q = questions.find((x) => x.code === row.code);
            const low = summary.lowQuestions.includes(row.code);
            return (
              <div key={row.code} className={own.summaryRow}>
                <div className={`${own.summaryText} ${low ? own.summaryLow : ''}`}>
                  <Text type="supporting" color="inherit">
                    {q?.text ?? row.code} {low && '· 낮음'}
                  </Text>
                </div>
                <div className={`${own.summaryAvg} ${low ? own.summaryLow : ''}`}>{row.avg === null ? '-' : row.avg.toFixed(1)}</div>
                <div className={own.bar} aria-hidden>
                  <div className={low ? own.barFillLow : own.barFill} style={{ width: `${row.avg === null ? 0 : (row.avg / 5) * 100}%` }} />
                </div>
              </div>
            );
          })}
          <div style={{ marginTop: 'var(--spacing-2)' }}>
            <SupportText>점수는 1(매우 불만)~5(매우 만족)이고, 평균이 3.0 미만인 문항은 개선할 점으로 봅니다.</SupportText>
          </div>
        </div>
      )}
    </Card>
  );
}
