'use client';

/** 모은 사실을 먼저 보여 준다 — AI 초안은 오직 이 묶음만 근거로 쓰므로 직원이 사실부터 확인한다. */
import { Text } from '@astryxdesign/core/Text';
import { VStack } from '@astryxdesign/core/Stack';
import { dotDate } from '@/components/lab/labFormat';
import type { DischargeFacts } from '@/lib/lab/labTypes';
import { PROGRAM_CATEGORY_LABEL } from '@/lib/lab/programRules';
import six from './labPlans6.module.css';

const dayText = (date: string) => `${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일`;

export function dischargeFactLines(f: DischargeFacts): string[] {
  const lines: string[] = [`기간 ${dotDate(f.period.from)} ~ ${dotDate(f.period.to)}`];
  lines.push(f.attendanceDays === null ? '출석 일수를 확인하지 못했습니다' : `출석 ${f.attendanceDays.toLocaleString('ko-KR')}일`);
  const { bp, bloodSugar, weight } = f.vitals;
  lines.push(bp ? `혈압 평균 ${bp.avgSys}/${bp.avgDia} (${bp.count}회 측정)` : '혈압 측정 기록 없음');
  if (bloodSugar) lines.push(`혈당 평균 ${bloodSugar.avg} (${bloodSugar.min}~${bloodSugar.max}, ${bloodSugar.count}회 측정)`);
  if (weight) lines.push(`체중 ${weight.first}kg → ${weight.last}kg (${weight.change > 0 ? '+' : ''}${weight.change}kg)`);
  const cats = Object.entries(f.programs.byCategory).map(([c, n]) => `${PROGRAM_CATEGORY_LABEL[c as keyof typeof PROGRAM_CATEGORY_LABEL] ?? c} ${n}회`);
  lines.push(f.programs.total > 0 ? `프로그램 참여 ${f.programs.total}회 (${cats.join(', ')})` : '프로그램 참여 기록 없음');
  lines.push(f.rehab.sessions > 0 ? `기능회복훈련 ${f.rehab.sessions}회 ${f.rehab.minutes.toLocaleString('ko-KR')}분 (${f.rehab.kinds.join(', ')})` : '기능회복훈련 기록 없음');
  lines.push(f.bath.count > 0 ? `목욕 ${f.bath.count}회` : '목욕 기록 없음');
  lines.push(f.events.length > 0 ? `상태변화·사고 ${f.events.length}건: ${f.events.map((e) => `${dayText(e.date)} ${e.kindLabel}(${e.severityLabel})`).join(', ')}` : '상태변화·사고 없음');
  for (const note of f.specialNotes) lines.push(`특이사항: ${note}`);
  return lines;
}

export default function ContractReferralFacts({ facts }: { facts: DischargeFacts }) {
  return (
    <VStack gap={1}>
      <ul className={six.factList}>
        {dischargeFactLines(facts).map((line, i) => (
          <li key={i}>
            <Text type="supporting">{line}</Text>
          </li>
        ))}
      </ul>
    </VStack>
  );
}
