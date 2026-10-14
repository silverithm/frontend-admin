'use client';

/** 퇴직금 추계 안내 — 대상 조건, 지급 기한 14일, IRP 이전 원칙, 대조가 필요한 계산 기준. */
import { Banner } from '@astryxdesign/core/Banner';
import { Card } from '@astryxdesign/core/Card';
import { VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { SEVERANCE_VERIFY_NOTES } from '@/lib/lab/severanceRules';
import styles from './labPlans6.module.css';

export function SeveranceIntro() {
  return (
    <Banner
      status="info"
      title="퇴직금은 계속근로 1년 이상, 주 15시간 이상이면 대상입니다"
      description="1년 미만이거나 주 소정근로시간이 15시간 미만이면 대상이 아닙니다. 퇴직일부터 14일 안에 지급하고, 퇴직연금(DB·DC) 가입자는 근로자가 지정한 IRP 계좌로 이전하는 것이 원칙입니다. 평가 8 기준⑤(1년 이상 직원 퇴직금 준비)를 보는 근거로 씁니다."
    />
  );
}

export function SeveranceVerify() {
  return (
    <Card padding={4}>
      <VStack gap={2}>
        <Text type="label">계산 기준과 대조가 필요한 것</Text>
        <ul className={styles.factList}>
          {SEVERANCE_VERIFY_NOTES.map((n) => (
            <li key={n}>
              <Text type="supporting" color="secondary">
                {n}
              </Text>
            </li>
          ))}
        </ul>
      </VStack>
    </Card>
  );
}
