'use client';

/**
 * 급여명세서 인쇄본 — A4 세로, 직원 한 명에 한 장. 지급·공제 내역과 산출 근거, 간이세액표 버전을 적는다.
 * 화면에서는 보이지 않고 인쇄할 때만 나타난다. 인쇄는 body 바로 아래(portal)에 그리고 다른 화면은 인쇄에서 숨긴다.
 * 사업주 부담 4대보험은 직원에게 주는 명세서에 넣지 않는다.
 */
import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { companyNameStored, dotDate, monthLabel, todayString } from '@/components/lab/labFormat';
import { WITHHOLDING_TABLE_VERSION } from '@/lib/lab/withholdingTable';
import type { PayrollProfileCalc } from '@/lib/lab/payrollRules';
import type { PayrollLineAmounts } from '@/lib/lab/payrollRules';
import { deductionTotal, wageBasis } from './PayrollDraft';
import { num, won } from './FinanceFormat';
import styles from './labRecords.module.css';

export interface SlipItem {
  memberId: number;
  name: string;
  jobText: string;
  hireDate: string;
  profile: PayrollProfileCalc | null;
  amounts: PayrollLineAmounts;
  /** 서버에 저장된 값과 같은가(저장 전 계산값이면 인쇄본에 표시) */
  saved: boolean;
}

interface Props {
  month: string;
  items: SlipItem[];
  /** 올릴 때마다 인쇄를 한 번 시작한다 */
  printKey: number;
  onReady: () => void;
}

function Row({ label, amount, strong }: { label: string; amount: number; strong?: boolean }) {
  return (
    <tr>
      <th scope="row">{strong ? <strong>{label}</strong> : label}</th>
      <td className={styles.num}>{strong ? <strong>{num(amount)}</strong> : num(amount)}</td>
    </tr>
  );
}

function SlipPage({ month, item, company }: { month: string; item: SlipItem; company: string }) {
  const a = item.amounts;
  const basis = item.profile ? wageBasis(item.profile) : null;
  const p = item.profile;
  const v = WITHHOLDING_TABLE_VERSION;
  return (
    <section className={styles.slipPage}>
      <h1 className={styles.printTitle}>급 여 명 세 서</h1>
      <div className={styles.printMeta}>
        <span>{monthLabel(month)}분</span>
        {company && <span>기관: {company}</span>}
        <span>성명: {item.name}</span>
        <span>직종: {item.jobText}</span>
        <span>입사일: {dotDate(item.hireDate)}</span>
      </div>
      {!item.saved && <p className={styles.printNote}>저장 전 계산값입니다. 저장·확정 후 다시 인쇄하면 이 표시가 사라집니다.</p>}

      <div className={styles.slipCols}>
        <table className={styles.sheetTable}>
          <thead>
            <tr>
              <th scope="col">지급 내역</th>
              <th scope="col" className={styles.num}>
                금액(원)
              </th>
            </tr>
          </thead>
          <tbody>
            <Row label="기본급" amount={a.basePay} />
            {a.overtimePay > 0 && <Row label="연장근로수당" amount={a.overtimePay} />}
            {a.nightPay > 0 && <Row label="야간근로수당" amount={a.nightPay} />}
            {a.holidayPay > 0 && <Row label="휴일근로수당" amount={a.holidayPay} />}
            {a.longServiceAward > 0 && <Row label="장기근속장려금" amount={a.longServiceAward} />}
            {a.seniorAllowance > 0 && <Row label="선임 요양보호사 수당" amount={a.seniorAllowance} />}
            {a.otherAllowances.map((x, i) => (
              <Row key={i} label={`${x.label || '기타 수당'}${x.taxable ? '' : ' (비과세)'}`} amount={x.amount} />
            ))}
            {a.mealAllowance > 0 && <Row label="식대 (비과세)" amount={a.mealAllowance} />}
            <Row label="총지급액" amount={a.grossPay} strong />
          </tbody>
        </table>
        <table className={styles.sheetTable}>
          <thead>
            <tr>
              <th scope="col">공제 내역</th>
              <th scope="col" className={styles.num}>
                금액(원)
              </th>
            </tr>
          </thead>
          <tbody>
            <Row label="국민연금" amount={a.nps} />
            <Row label="건강보험" amount={a.health} />
            <Row label="장기요양보험" amount={a.ltc} />
            <Row label="고용보험" amount={a.employment} />
            <Row label="소득세" amount={a.incomeTax} />
            <Row label="지방소득세" amount={a.localTax} />
            {a.otherDeductions.map((x, i) => (
              <Row key={i} label={x.label || '기타 공제'} amount={x.amount} />
            ))}
            <Row label="공제 합계" amount={deductionTotal(a)} strong />
          </tbody>
        </table>
      </div>

      <table className={`${styles.sheetTable} ${styles.slipNet}`}>
        <tbody>
          <tr>
            <th scope="row">실지급액 (총지급액 − 공제 합계)</th>
            <td className={styles.num}>
              <strong>{won(a.netPay)}</strong>
            </td>
          </tr>
        </tbody>
      </table>

      <h2 className={styles.printSection}>산출 근거</h2>
      <ul className={styles.slipBasis}>
        {p && basis && (
          <li>
            통상시급 {won(basis.hourly)}
            {p.payType === 'MONTHLY' ? ` (월급 ${won(p.baseAmount)} ÷ 월 소정근로시간 ${basis.monthlyHours}시간, 원 미만 반올림)` : ' (시급제 기준 금액)'}
          </li>
        )}
        <li>
          근로시간: 정규 {a.regularHours}시간
          {a.overtimeHours > 0 ? ` · 연장 ${a.overtimeHours}시간(×1.5)` : ''}
          {a.nightHours > 0 ? ` · 야간 ${a.nightHours}시간(가산 ×0.5)` : ''}
          {a.holidayHours > 0 ? ` · 휴일 ${a.holidayHours}시간(×1.5)` : ''}
          {a.holidayOver8Hours > 0 ? ` · 휴일 8시간 초과 ${a.holidayOver8Hours}시간(×2.0)` : ''}
        </li>
        <li>4대보험·소득세 과세 대상액 {won(a.taxablePay)} (총지급액에서 비과세 식대·비과세 수당을 뺀 금액)</li>
        <li>국민연금 4.75% · 건강보험 3.595% · 장기요양 건강보험료의 13.14% · 고용보험 0.9% (가입한 보험만, 10원 미만 절사)</li>
        <li>
          소득세: 근로소득 간이세액표{p ? `, 공제대상가족 ${p.dependents}명(본인 포함), 8~20세 자녀 ${p.children}명, 원천징수 비율 ${p.withholdingRate}%` : ''} · 지방소득세는 소득세의 10%
        </li>
        <li>
          간이세액표 버전: {v.law} (개정 {v.amended}, 적용 {v.appliesFrom}) — {v.note}
        </li>
      </ul>
      <p className={styles.printNote}>이 명세서는 케어브이 실험실의 계산 결과이며 일부 기준값은 &quot;대조 필요&quot;입니다. 신고·납부 전에 급여 담당자나 세무사가 확인하세요. 출력일 {dotDate(todayString())}</p>
      <div className={styles.printSign}>
        <span>작성자: ____________</span>
        <span>수령 확인: ____________ (서명)</span>
      </div>
    </section>
  );
}

export default function PayrollSlip({ month, items, printKey, onReady }: Props) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setHost(document.body);
  }, []);
  useEffect(() => {
    if (!host || printKey === 0 || items.length === 0) return undefined;
    // 포털이 그려진 다음 한 박자 뒤에 인쇄 창을 연다
    const timer = setTimeout(onReady, 60);
    return () => clearTimeout(timer);
    // 인쇄는 printKey가 바뀔 때만 시작한다(items·onReady의 정체가 바뀌어도 다시 열지 않는다)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host, printKey]);
  if (!host || items.length === 0) return null;
  const company = companyNameStored();

  return createPortal(
    <div className={styles.printRoot} data-lab-print-root="" data-astryx-theme="neutral">
      <style>{`
        @page { size: A4 portrait; margin: 14mm; }
        @media print {
          body > *:not([data-lab-print-root]) { display: none !important; }
          html, body { background: var(--color-background-card) !important; height: auto !important; overflow: visible !important; }
        }
      `}</style>
      {items.map((item) => (
        <SlipPage key={item.memberId} month={month} item={item} company={company} />
      ))}
    </div>,
    host,
  );
}
