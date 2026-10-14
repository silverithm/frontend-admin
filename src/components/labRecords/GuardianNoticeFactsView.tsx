'use client';

/** 모은 사실을 먼저 보여 준다 — AI 초안은 오직 이 묶음만 근거로 쓰므로, 직원이 사실부터 확인한다. */
import { Text } from '@astryxdesign/core/Text';
import { VStack } from '@astryxdesign/core/Stack';
import type { NoticeFacts } from '@/lib/lab/labTypes';
import { PROGRAM_CATEGORY_LABEL } from '@/lib/lab/programRules';
import { COPAY_STATUS_LABEL } from './GuardianNoticeDraft';
import styles from './labRecords.module.css';

const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;
const dayText = (date: string) => `${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일`;

export function factLines(f: NoticeFacts): string[] {
  const lines: string[] = [`출석 ${f.attendanceDays.toLocaleString('ko-KR')}일`];
  const { bp, bloodSugar, weight } = f.vitals;
  lines.push(bp ? `혈압 평균 ${bp.avgSys}/${bp.avgDia} (${bp.count}회 측정)` : '혈압 측정 기록 없음');
  if (bloodSugar) lines.push(`혈당 평균 ${bloodSugar.avg} (${bloodSugar.min}~${bloodSugar.max}, ${bloodSugar.count}회 측정)`);
  if (weight) lines.push(`체중 ${weight.first}kg → ${weight.last}kg (${weight.change > 0 ? '+' : ''}${weight.change}kg)`);
  const cats = Object.entries(f.programs.byCategory).map(([c, n]) => `${PROGRAM_CATEGORY_LABEL[c as keyof typeof PROGRAM_CATEGORY_LABEL] ?? c} ${n}회`);
  lines.push(f.programs.total > 0 ? `프로그램 참여 ${f.programs.total}회 (${cats.join(', ')})` : '프로그램 참여 기록 없음');
  lines.push(f.rehab.sessions > 0 ? `기능회복훈련 ${f.rehab.sessions}회 ${f.rehab.minutes.toLocaleString('ko-KR')}분 (${f.rehab.kinds.join(', ')})` : '기능회복훈련 기록 없음');
  lines.push(f.events.length > 0 ? `상태변화·사고 ${f.events.length}건: ${f.events.map((e) => `${dayText(e.date)} ${e.kindLabel}(${e.severityLabel})`).join(', ')}` : '상태변화·사고 없음');
  for (const note of f.specialNotes) lines.push(`특이사항: ${note}`);
  lines.push(f.copay ? `본인부담금 ${won(f.copay.totalDue)} (${COPAY_STATUS_LABEL[f.copay.status] ?? f.copay.status})` : '본인부담금 청구서 없음');
  return lines;
}

export default function GuardianNoticeFactsView({ facts }: { facts: NoticeFacts }) {
  return (
    <VStack gap={2}>
      <ul className={styles.factList}>
        {factLines(facts).map((line, i) => (
          <li key={i}>
            <Text type="supporting">{line}</Text>
          </li>
        ))}
      </ul>
    </VStack>
  );
}
