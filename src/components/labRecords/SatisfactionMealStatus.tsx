'use client';

/** 식사 만족도 반기 현황 — 평가 33 식사 기준②(모든 수급자 식사 만족도를 반기별 1회 이상 파악)와 36 급여 만족도 안내. */
import { Card } from '@astryxdesign/core/Card';
import { HStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import type { MealSurveyCoverage, MealSurveyHalfStatus } from '@/lib/lab/satisfactionRules';
import { Chip, SupportText } from '@/components/lab/LabUi';

interface Props {
  year: number;
  status: MealSurveyHalfStatus;
  /** 조사 대상 어르신을 못 불러왔으면 null — 응답 수만 보여 준다 */
  coverage: MealSurveyCoverage | null;
  names: ReadonlyMap<number, string>;
}

export default function SatisfactionMealStatus({ year, status, coverage, names }: Props) {
  const halves = [
    { key: 'h1' as const, label: '상반기(1~6월)', count: status.h1, ok: status.met.h1 },
    { key: 'h2' as const, label: '하반기(7~12월)', count: status.h2, ok: status.met.h2 },
  ];
  return (
    <Card padding={4}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2)' }}>
        <Text type="large" weight="semibold">
          {year}년 식사 만족도 반기 현황
        </Text>
        <SupportText>평가 33 식사 기준②는 모든 수급자의 식사 만족도를 반기마다 1회 이상 파악하는 것이고, 36 급여 만족도는 평가일 면담으로 식사·프로그램·이동서비스 만족을 묻습니다. 공단이 제시한 문항은 없어 이 화면의 문항은 기관이 만든 것입니다.</SupportText>
        {halves.map((h) => {
          const cov = coverage ? coverage[h.key] : null;
          const missing = cov ? cov.missing.map((id) => names.get(id)).filter((n): n is string => !!n) : [];
          return (
            <div key={h.key}>
              <HStack gap={2} vAlign="center" wrap="wrap">
                <Text type="label">{h.label}</Text>
                <Chip tone={h.ok ? 'ok' : 'warn'} label={h.ok ? `응답 ${h.count}건` : '응답 없음'} />
                {cov && cov.total > 0 && <Chip tone={cov.missing.length === 0 ? 'ok' : 'warn'} label={`어르신 ${cov.done}/${cov.total}명`} />}
              </HStack>
              {missing.length > 0 && (
                <SupportText>
                  아직 못 받은 분: {missing.slice(0, 12).join(', ')}
                  {missing.length > 12 ? ` 외 ${missing.length - 12}명` : ''}
                </SupportText>
              )}
            </div>
          );
        })}
        <SupportText>익명 응답은 누구의 것인지 알 수 없어 어르신별 확인에는 세지 않습니다.</SupportText>
      </div>
    </Card>
  );
}
