'use client';

/** 운영위원회 안내 — 근거 법령, 위원 구성·임기, 개최 주기는 대조 필요. */
import { Card } from '@astryxdesign/core/Card';
import { VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import eight from './labPlans8.module.css';

export function CommitteeIntro() {
  return (
    <Card padding={4}>
      <VStack gap={2}>
        <Text type="label">운영위원회란</Text>
        <Text type="supporting" color="secondary">
          노인복지법 시행규칙 별표 10은 시설이 운영위원회를 설치·운영하도록 하고, 사회복지사업법 제36조와 같은 법 시행규칙 제24조가 구성을 정합니다.
          위원은 위원장을 포함해 5명 이상 15명 이하, 임기는 3년입니다. 시설의 장은 회계·예산·결산, 후원금, 시설운영 관련 사건·사고를 위원회에 보고합니다.
        </Text>
      </VStack>
    </Card>
  );
}

export function CommitteeVerify() {
  return (
    <Card padding={4}>
      <VStack gap={2}>
        <Text type="label">확인하고 쓰세요</Text>
        <ul className={eight.noteList}>
          <li>개최 주기(연 몇 회)와 회의록 보관 기간은 법령 본문에 숫자가 없습니다. ‘분기 1회’는 기관 기준 예시이며 대조 필요합니다.</li>
          <li>같은 호에 해당하는 위원 수 제한 등 위원 구성 세부 기준은 이 화면이 세지 않습니다. 시행규칙 제24조를 직접 확인해 주세요.</li>
          <li>회의록에는 개인정보가 들어가므로 필요한 만큼만 적고, 서명이 있는 원본은 따로 보관해 주세요.</li>
        </ul>
      </VStack>
    </Card>
  );
}
