'use client';

/** 2026 평가 '소통노력' 안내 한 줄 — 이 안내(일방향)는 보호자 상담을 대신하지 못한다. */
import { Text } from '@astryxdesign/core/Text';

export default function GuardianNoticeGuide() {
  return (
    <Text type="supporting" color="secondary">
      2026 평가 ‘소통노력’: 기관 소식은 월 1회 이상 안내하고, 보호자 상담은 분기 1회 이상(상담일지에 기록) 해야 합니다. 이 안내처럼 일방향으로 보내는 글만으로는 상담으로 인정되지 않습니다.
    </Text>
  );
}
