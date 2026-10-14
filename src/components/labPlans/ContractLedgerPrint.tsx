'use client';

/** 올해 연계기록지 제공대장 인쇄본(A4 세로) — 수급자명·제공일자·제공방법·제공자명·수령자명. 화면에서는 보이지 않는다. */
import { companyNameStored, dotDate, todayString } from '@/components/lab/labFormat';
import { hasProvidedLedger, providedMethodLabel } from '@/lib/lab/dischargeRules';
import type { DischargeReferral } from '@/lib/lab/labTypes';
import PlansPrintPortal from './PlansPrintPortal';
import styles from './labPlans.module.css';

interface Props {
  year: number;
  referrals: DischargeReferral[];
  printKey: number;
  onReady: () => void;
}

export default function ContractLedgerPrint({ year, referrals, printKey, onReady }: Props) {
  const rows = referrals.filter((r) => r.dischargeOn.startsWith(`${year}-`)).sort((a, b) => (a.dischargeOn < b.dischargeOn ? -1 : 1));
  const company = companyNameStored();
  return (
    <PlansPrintPortal printKey={printKey} onReady={onReady}>
      <h1 className={styles.printTitle}>연계기록지 제공대장</h1>
      <div className={styles.printMeta}>
        {company && <span>기관: {company}</span>}
        <span>기간: {year}년 퇴소</span>
        <span>출력일: {dotDate(todayString())}</span>
      </div>
      <table className={styles.sheetTable}>
        <thead>
          <tr>
            <th scope="col">번호</th>
            <th scope="col">수급자명</th>
            <th scope="col">제공일자</th>
            <th scope="col">제공방법</th>
            <th scope="col">제공자명</th>
            <th scope="col">수령자명</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={6}>이 해에 퇴소한 수급자가 없습니다</td>
            </tr>
          )}
          {rows.map((r, i) => {
            const given = hasProvidedLedger(r);
            return (
              <tr key={r.id}>
                <td>{i + 1}</td>
                <td>{r.elderlyName}</td>
                <td>{given ? dotDate(r.providedOn) : '미제공'}</td>
                <td>{given && r.providedMethod ? providedMethodLabel(r.providedMethod) : ''}</td>
                <td>{given ? r.providerName : ''}</td>
                <td>{given ? r.recipientName : ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className={styles.printNote}>계약 종료일(퇴소일)까지 수급자(보호자)에게 연계기록지를 제공하고, 제공한 내용을 이 대장에 적습니다.</p>
      <div className={styles.printSign}>
        <span>기관명: {company || '____________'}</span>
        <span>시설장: ____________ (서명 또는 인)</span>
      </div>
    </PlansPrintPortal>
  );
}
