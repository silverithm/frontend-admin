'use client';

/** 날짜별 프로그램 목록 — 최근 날짜가 위. 수정·복사해서 새로 쓰기를 바로 누를 수 있다. */
import { Button } from '@astryxdesign/core/Button';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import type { Program } from '@/lib/lab/labTypes';
import { AiChip, Chip } from '@/components/lab/LabUi';
import { dateLabel } from '@/components/lab/labFormat';
import { categoryLabel } from './ProgramLogDraft';
import styles from './labRecords.module.css';

const NAME_PREVIEW = 6;

interface ListProps {
  programs: Program[];
  onEdit: (program: Program) => void;
  onCopy: (program: Program) => void;
}

export default function ProgramLogList({ programs, onEdit, onCopy }: ListProps) {
  const groups = new Map<string, Program[]>();
  for (const p of programs) {
    const key = p.programDate.slice(0, 10);
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  const days = [...groups.keys()].sort().reverse();

  return (
    <div>
      {days.map((day) => (
        <div className={styles.rowBlock} key={day}>
          <VStack gap={3}>
            <Text type="label">{dateLabel(day)}</Text>
            {[...(groups.get(day) ?? [])]
              .sort((a, b) => (a.startTime ?? '99:99').localeCompare(b.startTime ?? '99:99'))
              .map((p) => (
                <div key={p.id} className={styles.suggestBox} style={{ borderStyle: 'solid' }}>
                  <VStack gap={2}>
                    <HStack hAlign="between" vAlign="center" gap={2} wrap="wrap">
                      <HStack gap={2} vAlign="center" wrap="wrap">
                        <Chip tone={p.category === 'COGNITIVE' ? 'info' : 'neutral'} label={categoryLabel(p.category)} />
                        <Text type="body" weight="medium">
                          {p.startTime ? `${p.startTime} ` : ''}
                          {p.title}
                        </Text>
                        {p.aiAssisted && <AiChip label="AI 도움" />}
                      </HStack>
                      <HStack gap={1}>
                        <Button label="수정" variant="ghost" onClick={() => onEdit(p)} />
                        <Button label="복사해서 새로" variant="ghost" onClick={() => onCopy(p)} />
                      </HStack>
                    </HStack>
                    {p.goal && (
                      <Text type="supporting" color="secondary">
                        목표: {p.goal}
                      </Text>
                    )}
                    <Text type="supporting" color="secondary">
                      {p.instructorName ? `진행 ${p.instructorName} · ` : ''}
                      참여 {p.participantIds.length}명
                      {p.participantNames.length > 0 ? ` (${p.participantNames.slice(0, NAME_PREVIEW).join(', ')}${p.participantNames.length > NAME_PREVIEW ? ` 외 ${p.participantNames.length - NAME_PREVIEW}명` : ''})` : ''}
                    </Text>
                  </VStack>
                </div>
              ))}
          </VStack>
        </div>
      ))}
    </div>
  );
}
