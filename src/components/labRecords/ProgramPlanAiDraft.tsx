'use client';

/** AI 계획표 초안 — 제안 표로 보여 주고, 직원이 빼거나 고른 뒤 "계획표에 넣기"를 눌러야 계획표에 들어간다. */
import { useMemo } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { HStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import type { ScheduleItem } from '@/lib/lab/labTypes';
import { SCHEDULE_CATEGORIES, scheduleIssues } from '@/lib/lab/programPlanRules';
import { AiChip, SupportText } from '@/components/lab/LabUi';
import { dateLabel } from '@/components/lab/labFormat';
import own from './ProgramPlan.module.css';

const categoryText = (c: ScheduleItem['category']) => SCHEDULE_CATEGORIES.find((x) => x.value === c)?.label ?? c;

interface Props {
  month: string;
  proposal: ScheduleItem[];
  operatingDays: ReadonlyArray<string>;
  hasItems: boolean;
  onRemove: (index: number) => void;
  onAdd: () => void;
  onReplace: () => void;
  onDiscard: () => void;
}

export default function ProgramPlanAiDraft({ month, proposal, operatingDays, hasItems, onRemove, onAdd, onReplace, onDiscard }: Props) {
  const issues = useMemo(() => scheduleIssues(proposal, month, operatingDays), [proposal, month, operatingDays]);
  return (
    <Card padding={4}>
      <div className={own.dayPanel}>
        <HStack gap={2} vAlign="center" wrap="wrap">
          <AiChip />
          <Text type="large" weight="semibold">
            AI 계획표 초안 {proposal.length}개
          </Text>
        </HStack>
        <SupportText>제안일 뿐 아직 계획표에 들어가지 않았습니다. 빼고 싶은 줄은 빼고, 시각·강사는 넣은 뒤 직접 적어 주세요.</SupportText>
        {proposal.length === 0 ? (
          <SupportText>남은 제안이 없습니다.</SupportText>
        ) : (
          <div className={own.proposalScroll}>
            <table className={own.weekTable}>
              <thead>
                <tr>
                  <th scope="col">날짜</th>
                  <th scope="col">분류</th>
                  <th scope="col">제목</th>
                  <th scope="col">
                    빼기
                  </th>
                </tr>
              </thead>
              <tbody>
                {proposal.map((it, i) => (
                  <tr key={`${it.date}-${it.title}-${i}`}>
                    <td>{dateLabel(it.date)}</td>
                    <td>{categoryText(it.category)}</td>
                    <td>{it.title}</td>
                    <td>
                      <Button label="빼기" variant="ghost" onClick={() => onRemove(i)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {proposal.length > 0 && issues.length > 0 && (
          <ul className={own.issueList}>
            {issues.map((t) => (
              <li key={t}>
                <Text type="supporting">제안 점검: {t}</Text>
              </li>
            ))}
          </ul>
        )}
        <HStack gap={2} wrap="wrap">
          <Button label="계획표에 넣기" variant="primary" isDisabled={proposal.length === 0} onClick={onAdd} />
          {hasItems && <Button label="비우고 넣기" variant="secondary" isDisabled={proposal.length === 0} onClick={onReplace} />}
          <Button label="제안 버리기" variant="ghost" onClick={onDiscard} />
        </HStack>
        {hasItems && <SupportText>‘계획표에 넣기’는 지금 있는 칸을 두고, 같은 날 같은 제목이 아닌 제안만 더합니다.</SupportText>}
      </div>
    </Card>
  );
}
