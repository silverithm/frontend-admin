'use client';

/** 상담일지 목록 — 월별로 묶어 최신순. 어르신별 보기에서는 이름을 빼고, 월별 전체 보기에서는 이름을 보여 준다. */
import { Button } from '@astryxdesign/core/Button';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import type { Consultation } from '@/lib/lab/labTypes';
import { AiChip, Chip } from '@/components/lab/LabUi';
import { dateLabel, monthLabel } from '@/components/lab/labFormat';
import { counterpartLabel, methodLabel } from './ConsultationCarePlanConsultDraft';
import styles from './labRecords.module.css';

interface ListProps {
  items: Consultation[];
  showElderName?: boolean;
  onEdit: (item: Consultation) => void;
}

export default function ConsultationCarePlanConsultList({ items, showElderName, onEdit }: ListProps) {
  const groups = new Map<string, Consultation[]>();
  for (const c of items) {
    const key = c.consultedOn.slice(0, 7);
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }
  const months = [...groups.keys()].sort().reverse();

  return (
    <div>
      {months.map((month) => {
        const list = [...(groups.get(month) ?? [])].sort((a, b) => (a.consultedOn < b.consultedOn ? 1 : a.consultedOn > b.consultedOn ? -1 : b.id - a.id));
        return (
          <div className={styles.rowBlock} key={month}>
            <VStack gap={3}>
              <Text type="label">
                {monthLabel(month)} <span className={styles.mutedText}>· {list.length}건</span>
              </Text>
              {list.map((c) => (
                <div key={c.id} className={styles.suggestBox} style={{ borderStyle: 'solid' }}>
                  <VStack gap={2}>
                    <HStack hAlign="between" vAlign="center" gap={2} wrap="wrap">
                      <HStack gap={2} vAlign="center" wrap="wrap">
                        <Text type="body" weight="medium">
                          {showElderName ? `${c.elderlyName} · ` : ''}
                          {dateLabel(c.consultedOn.slice(0, 10))}
                        </Text>
                        <Chip tone="neutral" label={`${counterpartLabel(c.counterpart)}${c.counterpartName ? ` ${c.counterpartName}` : ''}`} />
                        <Chip tone="neutral" label={methodLabel(c.method)} />
                        {c.followUp && <Chip tone="warn" label="후속 조치" />}
                        {c.aiAssisted && <AiChip label="AI 도움" />}
                      </HStack>
                      <Button label="수정" variant="ghost" onClick={() => onEdit(c)} />
                    </HStack>
                    {c.content && (
                      <Text type="body">
                        <span className={styles.pre}>{c.content}</span>
                      </Text>
                    )}
                    {c.followUp && (
                      <Text type="supporting" color="secondary">
                        <span className={styles.pre}>후속 조치: {c.followUp}</span>
                      </Text>
                    )}
                    {c.consultantName && (
                      <Text type="supporting" color="secondary">
                        상담자 {c.consultantName}
                      </Text>
                    )}
                  </VStack>
                </div>
              ))}
            </VStack>
          </div>
        );
      })}
    </div>
  );
}
