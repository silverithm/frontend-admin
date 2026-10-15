'use client';

/** 안내 문구 — 복지 제공대장·가산금 입력 앞에 둔다. 여러 문장은 세로로 쌓는다. */
import { VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import styles from './StaffWelfare.module.css';

export function WelfareLedgerNotes() {
  return (
    <div className={styles.noteBox}>
      <VStack gap={1}>
        <Text type="label">복지(포상) 제공대장 쓰기 전에</Text>
        <Text type="supporting" color="secondary">인정: 상품권·서적 같은 현물, 교육·훈련비, 동호회, 의료비, 휴가비·교통비·피복비·예방접종비, 단체(상해)보험, 포상휴가, 포상금, 명절선물, 특별수당 등 인건비에 들어가지 않는 급여 외 지원입니다.</Text>
        <Text type="supporting" color="secondary">불인정: 회식·회의 간식, 상장·상패만 주는 것, 후원품 증정, 대표자 본인에게 준 것.</Text>
        <Text type="supporting" color="secondary">현금을 인출해 직접 주고 수령인 서명부만 받은 경우는 인정되지 않습니다. 이체내역이나 영수증 같은 지출 증빙이 함께 있어야 합니다.</Text>
        <Text type="supporting" color="secondary">인건비 지출비율을 맞추는 데 넣은 포상금은 복지로 인정되지 않습니다. 기준을 넘긴 몫이고 객관적 자료가 있을 때만 인정될 수 있어 대조가 필요합니다.</Text>
        <Text type="supporting" color="secondary">물품을 산 분기와 준 분기가 다르면 제공일이 든 분기로 셉니다.</Text>
      </VStack>
    </div>
  );
}

export function BonusFundNotes() {
  return (
    <div className={styles.noteBox}>
      <VStack gap={1}>
        <Text type="label">가산금 기록 쓰기 전에</Text>
        <Text type="supporting" color="secondary">직전 정기평가 결과로 받은 가산금을 직원 처우개선에 쓴 내역입니다. 영수증이나 거래 이체내역으로 확인합니다.</Text>
        <Text type="supporting" color="secondary">기관 내부 환경 개선(도배, 에어컨 설치 등)에 쓴 것은 인정되지 않으니 이 기록에 넣지 마세요.</Text>
        <Text type="supporting" color="secondary">대표자 겸 시설장·대표자 겸 직원에게 쓴 금액은 ‘대표자·시설장에게 쓴 금액’에 표시해 주세요. 사용 비율에서 빠집니다.</Text>
        <Text type="supporting" color="secondary">운영규정·직원 복지(포상) 지출과 겹치는지는 따로 확인하지 않습니다.</Text>
      </VStack>
    </div>
  );
}
