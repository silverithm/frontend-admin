'use client';

/**
 * 퇴소 연계기록지 인쇄본(A4 세로) — 사본에 들어가는 항목: 작성일자·수급자명·등급·심신기능 상태·제공한 급여·퇴소 후 서비스 이용계획.
 * 화면에서는 보이지 않는다. 공개 법령에 서식 번호가 없어 기관 자체 서식으로 만든다.
 */
import { companyNameStored, dotDate, todayString } from '@/components/lab/labFormat';
import { dischargeReasonLabel } from '@/lib/lab/dischargeRules';
import type { DischargeReferral } from '@/lib/lab/labTypes';
import { gradeText } from './ContractFormat';
import PlansPrintPortal from './PlansPrintPortal';
import styles from './labPlans.module.css';

interface Props {
  referral: DischargeReferral;
  printKey: number;
  onReady: () => void;
}

export default function ContractReferralPrint({ referral, printKey, onReady }: Props) {
  const company = companyNameStored();
  return (
    <PlansPrintPortal printKey={printKey} onReady={onReady}>
      <h1 className={styles.printTitle}>퇴소 연계기록지</h1>
      <table className={styles.sheetTable}>
        <tbody>
          <tr>
            <th scope="row">작성일자</th>
            <td>{dotDate(referral.writtenOn)}</td>
            <th scope="row">수급자명</th>
            <td>{referral.elderlyName}</td>
          </tr>
          <tr>
            <th scope="row">장기요양 등급</th>
            <td>{gradeText(referral.careGrade)}</td>
            <th scope="row">퇴소일(계약 종료일)</th>
            <td>
              {dotDate(referral.dischargeOn)} ({dischargeReasonLabel(referral.reason)})
            </td>
          </tr>
          <tr>
            <th scope="row">심신기능 상태</th>
            <td colSpan={3}>{referral.functionalStatus}</td>
          </tr>
          <tr>
            <th scope="row">제공한 급여</th>
            <td colSpan={3}>{referral.servicesProvided}</td>
          </tr>
          <tr>
            <th scope="row">퇴소 후 서비스 이용계획·희망급여</th>
            <td colSpan={3}>{referral.afterPlan}</td>
          </tr>
        </tbody>
      </table>
      <p className={styles.printNote}>위와 같이 장기요양급여 제공 종료에 따른 연계 내용을 작성하여 드립니다.</p>
      <div className={styles.printSign}>
        <span>기관명: {company || '____________'}</span>
        <span>작성자: {referral.writerName}</span>
        <span>시설장: ____________ (서명 또는 인)</span>
      </div>
      <div className={styles.printSign}>
        <span>출력일: {dotDate(todayString())}</span>
        <span>수령자(본인 또는 보호자): ____________ (서명)</span>
      </div>
    </PlansPrintPortal>
  );
}
