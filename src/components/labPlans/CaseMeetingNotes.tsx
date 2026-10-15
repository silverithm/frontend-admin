'use client';

/** 사례관리 회의 안내 — 인정 기준, 인정되지 않는 예, 지역사회자원 연계, 참석 직종, 대조 필요. */
import { Card } from '@astryxdesign/core/Card';
import { VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import styles from './labPlans10.module.css';

export function CaseMeetingIntro() {
  return (
    <Card padding={4}>
      <VStack gap={2}>
        <Text type="label">사례관리 회의란</Text>
        <Text type="supporting" color="secondary">
          문제가 생겨 급여 이용, 생활환경, 의료적 처치 등에서 도움이 필요한 어르신을 여러 직종이 함께 논의하는 회의입니다. 반기마다 1회 이상 열고,
          일자·대상 어르신·선정 사유·참석 직원별 의견·사례관리 계획·참석자 서명을 갖춰야 합니다. 회의 다음날부터 30일 안에 반영하고, 반영일부터 30일 안에 평가합니다.
        </Text>
      </VStack>
    </Card>
  );
}

export function CaseMeetingGuide() {
  return (
    <Card padding={4}>
      <VStack gap={2}>
        <Text type="label">확인하고 쓰세요</Text>
        <ul className={styles.noteList}>
          <li>참석은 시설장과 각 직종 1인 이상, 합쳐서 3인 이상입니다. 조리원·운전원은 필수 직종에서 빠집니다. 사회복지사가 인력배치 기준상 필수가 아닌 기관은 예외가 될 수 있어 대조 필요입니다.</li>
          <li>발언자 이름을 기록하도록 권고됩니다. 의견이 없었던 사람은 ‘의견 없음’으로 남겨 주세요.</li>
          <li>사례관리로 인정되지 않는 예: 단순 보고 회의, 1회성으로 끝나는 내용, 병원 입원 지원, 등급변경 신청, 요양시설 전원 의뢰, 단순 물품 구매.</li>
          <li>지역사회자원 연계는 신청만으로는 인정되지 않고 선정 결과가 있어야 인정됩니다. 협약서·회의자료·사진 같은 증빙을 남겨 두세요.</li>
          <li>회의 결과를 급여에 반영할 수 없거나 급여 변경이 필요 없는 어르신은 사례관리 대상으로 보기 어렵습니다. 등급외자는 제외됩니다.</li>
          <li>서명은 인쇄본에 직접 받습니다. 한 회의에서 여러 어르신을 다뤄도 되는지, 대상 인원 하한은 규정에 없어 대조 필요입니다.</li>
        </ul>
      </VStack>
    </Card>
  );
}
