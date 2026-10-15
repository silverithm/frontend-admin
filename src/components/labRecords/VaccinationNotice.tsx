'use client';

/** 예방접종 안내 — 질병관리청 절기 안내 한 줄과 거부·제외 기록 안내. */
import { Text } from '@astryxdesign/core/Text';
import styles from './Vaccination.module.css';

export function VaccinationKdcaNotice() {
  return (
    <div className={styles.infoBox}>
      <Text type="supporting" color="secondary">
        질병관리청 2026-27절기 안내: 65세 이상 인플루엔자 무료 접종은 10월 6일부터(75세 이상 먼저), 위탁의료기관·보건소에서 받고, 접종 내역은 예방접종도우미(nip.kdca.go.kr)에서 확인합니다. 주야간보호 이용자가 요양시설 별도 일정 대상인지는 확인하지 못했습니다(대조 필요).
      </Text>
    </div>
  );
}

export function VaccinationRefusalNotice() {
  return (
    <div className={styles.noticeBox}>
      <Text type="supporting">
        접종을 거부하거나 건강 상태로 제외한 경우에는 사유를 꼭 적어 주세요. 사유는 간호일지와 급여제공기록지에도 함께 남겨 두셔야 평가 때 근거로 쓸 수 있습니다.
      </Text>
    </div>
  );
}
