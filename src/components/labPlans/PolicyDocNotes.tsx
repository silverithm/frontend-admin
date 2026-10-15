'use client';

/** 규정·지침 안내 — 종류별로 알아 둘 것(운영규정 두 가지 항목 체계, 감염병 대응 두 체계, 개인정보보호지침 항목). */
import { Card } from '@astryxdesign/core/Card';
import { VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import type { PolicyDocKind } from '@/lib/lab/labTypes';
import { PRIVACY_GUIDE_NO } from '@/lib/lab/policyDocRules';
import styles from './labPlans10.module.css';

export function PolicyDocIntro() {
  return (
    <Card padding={4}>
      <VStack gap={2}>
        <Text type="label">규정·지침 대장이란</Text>
        <Text type="supporting" color="secondary">
          운영규정, 급여제공지침 12종, 개인정보 처리방침, 감염병 대응계획, 이동서비스 수칙, 고충처리지침이 있는지, 최근 개정일은 언제인지, 직원이 언제든 볼 수 있는 장소에 두었는지를 한 장부로 모았습니다.
          운영규정과 급여제공지침은 각 급여종류 직원이 상시 열람할 수 있는 장소에 비치해야 합니다.
        </Text>
      </VStack>
    </Card>
  );
}

/** 지금 고른 종류에 맞는 안내 */
export function PolicyKindNote({ kind, guideNo }: { kind: PolicyDocKind; guideNo: number | null }) {
  if (kind === 'OPERATING_RULES') {
    return (
      <Card padding={3}>
        <VStack gap={2}>
          <Text type="label">운영규정 안내</Text>
          <ul className={styles.noteList}>
            <li>평가 매뉴얼의 11개 항목과 노인복지법 시행규칙 별표 10 제3호의 법정 항목은 서로 다릅니다. 둘 다 갖추어야 안전합니다. 이 화면의 체크는 평가 매뉴얼 11개 항목입니다.</li>
            <li>법정 항목에는 특별한 보호가 필요한 경우의 서비스 기준·비용, 의료가 필요한 경우의 처리절차, 시설물 사용상 주의사항, 운영위원회 설치·운영 등이 따로 있어 대조 필요입니다.</li>
            <li>운영규정은 작성해 시장·군수·구청장에게 제출하고 규정대로 운영해야 합니다.</li>
            <li>직원 모두에게 연 1회 이상 운영규정 교육을 해야 합니다. 교육일을 아래에 적어 두세요(참석자 서명은 직원 교육 기록에서 관리).</li>
          </ul>
        </VStack>
      </Card>
    );
  }
  if (kind === 'INFECTION_PLAN') {
    return (
      <Card padding={3}>
        <VStack gap={2}>
          <Text type="label">감염병 대응계획 안내</Text>
          <ul className={styles.noteList}>
            <li>국가 위기상황 발생 시 대응체계와 기관 내 환자 발생·확산 시 대응체계, 두 체계를 각각 수립해야 합니다.</li>
            <li>훈련과 물품 비축은 권고입니다. 훈련·검토 주기는 평가 문구에 숫자가 없어 기관 기준이며 대조 필요입니다. ‘교육일’은 기관이 정한 주기대로 적어 두세요.</li>
          </ul>
        </VStack>
      </Card>
    );
  }
  if (kind === 'CARE_GUIDE' && guideNo === PRIVACY_GUIDE_NO) {
    return (
      <Card padding={3}>
        <VStack gap={2}>
          <Text type="label">개인정보보호지침 안내</Text>
          <Text type="supporting" color="secondary">필수 내용은 수집·이용 목적, 수집 항목, 보유·이용 기간입니다. 개인정보보호법을 그대로 베끼지 말고 기관 특성에 맞게 쓰고, 직원이 연 1회 이상 급여제공지침 교육을 받아야 합니다.</Text>
        </VStack>
      </Card>
    );
  }
  if (kind === 'TRANSPORT_RULES') {
    return (
      <Card padding={3}>
        <Text type="supporting" color="secondary">이동서비스 수칙은 운전자 자격요건, 동승자의 역할, 차량안전수칙, 사고 시 조치사항 네 가지가 있어야 하고 이용자에게 제공해야 합니다. 개정하면 다시 제공해 주세요.</Text>
      </Card>
    );
  }
  return null;
}
