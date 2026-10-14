'use client';

/** 입소 상담 위쪽 확인할 것 — 연락 예정 지남, 동의 없는 연락처, 거절 사유 없음, 오래된 새 문의. 누르면 그 상담을 연다. */
import { Card } from '@astryxdesign/core/Card';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Chip, SupportText } from '@/components/lab/LabUi';
import type { InquiryAlert, InquiryAlertCode } from '@/lib/lab/intakeRules';
import styles from './labPlans6.module.css';

const CODE_LABEL: Record<InquiryAlertCode, string> = {
  FOLLOW_UP_DUE: '연락 예정',
  NO_CONSENT: '동의 없음',
  DECLINE_REASON_MISSING: '거절 사유 없음',
  STALE_NEW: '오래된 새 문의',
};

const SHOWN = 8;

interface Props {
  alerts: InquiryAlert[];
  nameOf: (id: number) => string;
  onOpen: (id: number) => void;
}

export default function IntakeAlerts({ alerts, nameOf, onOpen }: Props) {
  return (
    <Card padding={4}>
      <VStack gap={2}>
        <HStack gap={2} vAlign="center" wrap="wrap">
          <Text type="label">확인할 것</Text>
          {alerts.length === 0 ? <Chip tone="ok" label="없음" /> : <Chip tone="warn" label={`${alerts.length}건`} />}
        </HStack>
        {alerts.length === 0 ? (
          <SupportText>오늘 연락할 곳, 동의나 사유가 빠진 기록, 오래 둔 새 문의가 없습니다.</SupportText>
        ) : (
          <>
            <ul className={styles.alertList}>
              {alerts.slice(0, SHOWN).map((a) => (
                <li key={`${a.inquiryId}-${a.code}`}>
                  <button type="button" className={styles.alertItem} data-tone={a.code === 'FOLLOW_UP_DUE' || a.code === 'STALE_NEW' ? 'warn' : 'danger'} onClick={() => onOpen(a.inquiryId)}>
                    <Chip tone={a.code === 'FOLLOW_UP_DUE' || a.code === 'STALE_NEW' ? 'warn' : 'danger'} label={CODE_LABEL[a.code]} />
                    <span className={styles.alertBody}>
                      <Text type="label">{nameOf(a.inquiryId)}</Text>
                      <Text type="supporting" color="secondary">
                        {a.message}
                      </Text>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {alerts.length > SHOWN && <SupportText>그 밖에 {alerts.length - SHOWN}건이 더 있습니다. 목록에서 확인하세요.</SupportText>}
          </>
        )}
      </VStack>
    </Card>
  );
}
