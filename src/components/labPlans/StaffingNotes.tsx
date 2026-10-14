'use client';

/** 인력배치 안내 — 평가 3 인력기준, 점수표 대조 필요, 다루지 않는 것. */
import { Card } from '@astryxdesign/core/Card';
import { VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import eight from './labPlans8.module.css';

export function StaffingIntro() {
  return (
    <Card padding={4}>
      <VStack gap={2}>
        <Text type="label">인력배치 점검이란</Text>
        <Text type="supporting" color="secondary">
          주야간보호 인력배치기준(노인복지법 시행규칙 별표 9, 장기요양급여 제공기준 고시)에 맞게 직원이 배치됐는지 달이 끝난 뒤 점검합니다.
          그래서 달은 지난달이 기본입니다. 평가 3 ‘인력기준’은 신고한 인력과 감액·가산 이력으로 평가하니, 감산 위험이 보이면 신고 인력과 맞춰 보세요.
        </Text>
      </VStack>
    </Card>
  );
}

export function StaffingVerify() {
  return (
    <Card padding={4}>
      <VStack gap={2}>
        <Text type="label">확인하고 쓰세요</Text>
        <ul className={eight.noteList}>
          <li>감산·가산 점수표와 1인당 입소자 가산 기준(6.4명·19.0명)은 고시 이미지 표를 읽은 것이라 원문 대조 필요입니다.</li>
          <li>공휴일 기본 목록도 대조 필요입니다. 인사혁신처 월력요항과 맞춰 보세요.</li>
          <li>치매전담실·통합재가 가산, 영양사·위생원, 감액 특례는 다루지 않습니다.</li>
          <li>이 화면은 점검용 참고입니다. 실제 감액은 공단 심사 결과를 따릅니다.</li>
        </ul>
      </VStack>
    </Card>
  );
}
