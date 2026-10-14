'use client';

/** 입소 상담 목록 — 상태로 거르고, 대기는 순번(문의일이 이른 순)을 보여 준다. 연락처는 가운데 자리를 가린다. */
import { Card } from '@astryxdesign/core/Card';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Chip, SupportText } from '@/components/lab/LabUi';
import type { Tone } from '@/components/lab/LabUi';
import { dotDate } from '@/components/lab/labFormat';
import { INTAKE_SOURCES, intakeStatusLabel } from '@/lib/lab/intakeRules';
import type { IntakeInquiry, IntakeStatus } from '@/lib/lab/labTypes';
import { maskPhone } from './IntakeDraft';
import styles from './labPlans7.module.css';

const TONE: Record<IntakeStatus, Tone> = { NEW: 'info', CONSULTED: 'neutral', WAITING: 'warn', CONTRACTED: 'ok', DECLINED: 'danger', WITHDRAWN: 'neutral' };

interface Props {
  rows: IntakeInquiry[];
  /** 문의 번호 → 대기 순번 */
  ranks: ReadonlyMap<number, number>;
  activeId: number | null;
  filterLabel: string;
  onOpen: (id: number) => void;
}

export default function IntakeList({ rows, ranks, activeId, filterLabel, onOpen }: Props) {
  return (
    <Card padding={4}>
      <VStack gap={2}>
        <Text type="label">
          상담 목록 ({filterLabel} {rows.length}건)
        </Text>
        {rows.length === 0 ? (
          <Text type="supporting" color="secondary">
            {filterLabel === '전체' ? '아직 입소 상담 기록이 없습니다. ‘새 상담 기록’을 눌러 전화나 방문 문의를 남겨 보세요.' : `${filterLabel} 상태의 상담이 없습니다.`}
          </Text>
        ) : (
          <VStack gap={2}>
            {rows.map((q) => {
              const rank = ranks.get(q.id);
              const phone = maskPhone(q.contactPhone);
              const source = INTAKE_SOURCES.find((s) => s.value === q.source)?.label ?? q.source;
              return (
                <button key={q.id} type="button" className={styles.listButton} data-active={q.id === activeId} aria-pressed={q.id === activeId} onClick={() => onOpen(q.id)}>
                  {rank !== undefined && <span className={styles.rankBadge}><Chip tone="warn" label={`대기 ${rank}번`} /></span>}
                  <span className={styles.listMain}>
                    <Text type="label">{q.applicantName}</Text>
                    <Text type="supporting" color="secondary">
                      {dotDate(q.inquiryDate)} · {source}
                      {q.contactName ? ` · 문의 ${q.contactName}` : ''}
                      {phone ? ` · ${phone}` : ''}
                    </Text>
                  </span>
                  <HStack gap={2} vAlign="center" wrap="wrap">
                    {q.nextContactOn && ['NEW', 'CONSULTED', 'WAITING'].includes(q.status) && (
                      <Text type="supporting" color="secondary">
                        다음 연락 {dotDate(q.nextContactOn)}
                      </Text>
                    )}
                    <Chip tone={TONE[q.status]} label={intakeStatusLabel(q.status)} />
                  </HStack>
                </button>
              );
            })}
          </VStack>
        )}
        <SupportText>대기 순번은 문의일이 이른 순서입니다(같은 날이면 먼저 기록한 순). 연락처는 가운데 자리를 가려 보여 주고, 편집기에서만 전체가 보입니다.</SupportText>
      </VStack>
    </Card>
  );
}
