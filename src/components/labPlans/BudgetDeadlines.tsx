'use client';

/** 제출 기한 — 예산은 회계연도 개시 5일 전, 추경은 편성일로부터 7일 안, 결산은 다음 해 3월 31일까지 시·군·구청장에게. */
import { Card } from '@astryxdesign/core/Card';
import { VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Chip, SupportText } from '@/components/lab/LabUi';
import { dotDate } from '@/components/lab/labFormat';
import { budgetDeadlines } from '@/lib/lab/budgetRules';
import { addDays } from '@/lib/lab/programRules';
import styles from './labPlans.module.css';

interface Props {
  year: number;
  revision: number;
  /** 추경 편성(결정)일 'YYYY-MM-DD' 또는 '' */
  decidedOn: string;
  /** 저장된 본예산의 의결일(없으면 null) — 기한 안에 의결했으면 '기한 지남' 대신 '기한 안 의결'로 보인다 */
  baseDecidedOn: string | null;
  /** 이 해 본예산이 저장돼 있는가 */
  hasBase: boolean;
  today: string;
}

type DueState = 'OK' | 'LATE' | 'PAST' | null;
const DUE_CHIP: Record<Exclude<DueState, null>, { tone: 'ok' | 'warn'; label: string }> = {
  OK: { tone: 'ok', label: '기한 안 의결' },
  LATE: { tone: 'warn', label: '기한 뒤 의결' },
  PAST: { tone: 'warn', label: '기한 지남' },
};

export default function BudgetDeadlines({ year, revision, decidedOn, baseDecidedOn, hasBase, today }: Props) {
  const d = budgetDeadlines(year);
  const supplementaryDue = revision >= 1 && decidedOn !== '' ? addDays(decidedOn, d.supplementaryDays) : null;
  // 본예산: 의결일이 있으면 기한과 비교하고, 아직 본예산이 없을 때만 오늘 날짜로 '기한 지남'을 띄운다
  const budgetState: DueState = baseDecidedOn ? (baseDecidedOn <= d.budgetDue ? 'OK' : 'LATE') : !hasBase && today > d.budgetDue ? 'PAST' : null;
  const row = (label: string, value: string, state: DueState) => (
    <div className={styles.statBox} style={{ minWidth: 180 }}>
      <Text type="supporting" color="secondary">
        {label}
      </Text>
      <Text type="label" hasTabularNumbers>
        {value} {state ? <Chip tone={DUE_CHIP[state].tone} label={DUE_CHIP[state].label} /> : null}
      </Text>
    </div>
  );
  return (
    <Card padding={4}>
      <VStack gap={2}>
        <Text type="label">제출 기한 · 제출처 {d.submitTo}</Text>
        <div className={styles.toolbar}>
          {row('예산 (회계연도 개시 5일 전까지)', `${dotDate(d.budgetDue)}까지`, budgetState)}
          {row(`추경 (편성한 날부터 ${d.supplementaryDays}일 안)`, supplementaryDue ? `${dotDate(supplementaryDue)}까지` : revision >= 1 ? '편성일을 넣으면 계산됩니다' : '추경을 만들면 계산됩니다', supplementaryDue !== null && today > supplementaryDue ? 'PAST' : null)}
          {row('결산 (다음 해 3월 31일까지)', `${dotDate(d.settlementDue)}까지`, today > d.settlementDue ? 'PAST' : null)}
        </div>
        <SupportText>제출처는 관할 {d.submitTo}입니다. 기한은 장기요양기관 재무ㆍ회계 규칙(제4조·제6조·제10조)을 따른 것으로, 제출 방법과 서식은 관할 기관에 확인해 주세요(대조 필요).</SupportText>
      </VStack>
    </Card>
  );
}
