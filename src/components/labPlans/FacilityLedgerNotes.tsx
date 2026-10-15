'use client';

/** 안내 문구 — 표 앞의 공통 안내와 항목마다 붙는 안내. 여러 문장은 세로로 쌓는다. */
import { VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import type { FacilityItemCode } from '@/lib/lab/labTypes';
import styles from './facilityLedger.module.css';

export function FacilityLedgerNotes() {
  return (
    <div className={styles.noteBox}>
      <VStack gap={1}>
        <Text type="label">대장을 쓰기 전에</Text>
        <Text type="supporting" color="secondary">분기별 전문소독은 2026 평가 요건이며 감염병예방법 제51조에 따른 의무는 아닙니다. 다만 평가에서는 계약서·소독증명서·지출내역을 봅니다.</Text>
        <Text type="supporting" color="secondary">소방 월 점검(평가 13)과 반기 재난훈련(평가 11)은 ‘위생·안전 점검’ 기록에서 봅니다. 이 대장에는 법정 점검·검사·청소·보험만 남깁니다.</Text>
        <Text type="supporting" color="secondary">판단이 어려운 항목(간이스프링클러만 있을 때 종합점검 대상 여부, 도시가스 특정가스사용시설, 대형건축물등 저수조)은 지어내지 않고 ‘확인 필요’로 두었습니다. 관할 소방서·지자체·한국가스안전공사에 확인한 뒤 ‘직접 지정’으로 정하세요.</Text>
        <Text type="supporting" color="secondary">여기 계산은 입력한 시설 정보와 기록 기준입니다. 실제 점검 기한은 관할 기관 통지가 우선입니다.</Text>
      </VStack>
    </div>
  );
}

/** 항목 하나를 열었을 때만 붙는 안내 */
export function itemHints(code: FacilityItemCode): string[] {
  switch (code) {
    case 'FIRE_OPERATION':
    case 'FIRE_COMPREHENSIVE':
      return ['점검이 끝난 날부터 15일 안에 소방서에 결과를 보고해야 합니다. 보고일을 함께 남기세요.', code === 'FIRE_COMPREHENSIVE' ? '간이스프링클러만 있는 시설은 종합점검 대상인지 관할 소방서에 확인하세요.' : '종합점검 대상이면 작동점검은 종합점검을 받은 달부터 6개월이 되는 달에 합니다.'];
    case 'DISINFECT_QUARTERLY':
      return ['분기 전문소독은 2026 평가 요건입니다. 감염병예방법 제51조 의무는 아니니 ‘법정’으로 오해하지 마세요.'];
    case 'GAS_CITY_SPECIAL':
      return ['특정가스사용시설로 지정됐는지는 월 사용량과 시설에 따라 달라 관할 기관 확인이 필요합니다.'];
    case 'GAS_LPG_INSPECT':
      return ['저장능력 250kg 이상 500kg 미만은 자동절체기가 있으면 면제될 수 있어 관할 기관 확인이 필요합니다.'];
    case 'TANK_CLEAN':
    case 'TANK_HYGIENE':
    case 'TANK_WATER_QUALITY':
      return ['대형건축물등에 드는지는 건물 기준으로 달라집니다. 소규모라면 지자체 조례를 확인하세요.'];
    case 'INSURANCE_FACILITY':
      return ['시설 범위에 드는지는 시행령으로 확인해야 해 관할 기관 확인이 필요합니다.'];
    case 'INSURANCE_PROFESSIONAL':
      return ['보험 만기일은 꼭 적어 주세요. 만기가 지나면 ‘기한 지남’으로 표시됩니다.'];
    default:
      return [];
  }
}
