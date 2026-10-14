'use client';

/** 계약 알림 목록 — 위험·주의·안내 순. 알림을 누르면 그 계약 편집기로 간다. */
import { Card } from '@astryxdesign/core/Card';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Chip } from '@/components/lab/LabUi';
import { dotDate } from '@/components/lab/labFormat';
import type { ContractAlert } from '@/lib/lab/contractRules';
import { ALERT_LABEL, ALERT_TONE } from './ContractFormat';
import six from './labPlans6.module.css';

interface Props {
  alerts: ContractAlert[];
  nameOf: (elderlyId: number) => string;
  onOpen: (contractId: number) => void;
}

export default function ContractAlerts({ alerts, nameOf, onOpen }: Props) {
  const count = (level: ContractAlert['level']) => alerts.filter((a) => a.level === level).length;
  return (
    <Card padding={4}>
      <VStack gap={2}>
        <HStack gap={2} vAlign="center" wrap="wrap">
          <Text type="label">확인할 알림 ({alerts.length}건)</Text>
          {count('DANGER') > 0 && <Chip tone="danger" label={`위험 ${count('DANGER')}`} />}
          {count('WARN') > 0 && <Chip tone="warn" label={`주의 ${count('WARN')}`} />}
          {count('INFO') > 0 && <Chip tone="info" label={`안내 ${count('INFO')}`} />}
        </HStack>
        {alerts.length === 0 ? (
          <Text type="supporting" color="secondary">
            지금 확인할 계약 알림이 없습니다. 갱신 신청 기간·교부·공단 통보·계획 통보·인권 안내를 오늘 날짜로 살핀 결과입니다.
          </Text>
        ) : (
          <ul className={six.alertList}>
            {alerts.map((a) => (
              <li key={`${a.contractId}-${a.code}`}>
                <button type="button" className={six.alertItem} data-tone={ALERT_TONE[a.level]} onClick={() => onOpen(a.contractId)}>
                  <Chip tone={ALERT_TONE[a.level]} label={ALERT_LABEL[a.level]} />
                  <span className={six.alertBody}>
                    <Text type="label">{nameOf(a.elderlyId)}</Text>
                    <Text type="supporting" color="secondary">
                      {a.message}
                    </Text>
                  </span>
                  {a.dueOn && (
                    <span className={six.alertDue}>
                      <Text type="supporting" color="secondary" hasTabularNumbers>
                        기한 {dotDate(a.dueOn)}
                      </Text>
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
        <Text type="supporting" color="secondary">
          알림 근거: 갱신 신청은 유효기간 끝 90일 전~30일 전(시행규칙 제8조), 계약통보는 “지체 없이”, 급여제공계획 통보는 급여제공 시작일까지(2026 평가 22), 노인인권 지침 안내는 시작일부터 14일 안(2026 평가 19).
        </Text>
      </VStack>
    </Card>
  );
}
