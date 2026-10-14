/**
 * 인건비 지출비율 — 주야간보호 인건비 지출비율(고시 제11조의2, 연 단위) 계산.
 *  - 인건비 = 총지급(기본급·수당·장기근속장려금 포함) 합 + 사업주 부담 4대보험 합 + 퇴직적립(기본은 총지급 합의 1/12)
 *  - 수입 = 장기요양급여비용(공단부담 + 본인부담) = 청구서 coveredTotal 합
 *  - 비율(%) = 인건비 ÷ 수입 × 100을 소수 둘째 자리에서 반올림(소수 첫째 자리까지 표시)
 * 기준 48.6%는 2차 근거라 화면에 "대조 필요"를 붙인다. 기준은 "이 비율 이상 써야 한다"는 하한으로 보고, 반올림한 값으로 비교한다.
 * 모든 계산은 정수(원)로 하고 마지막 비율만 소수 첫째 자리다.
 */
import type { PayrollLine } from './labTypes.ts';

/** 2026 주야간보호 인건비 지출비율 기준(%) — 2차 근거, 대조 필요 */
export const STAFF_COST_TARGET = 48.6;

export type StaffCostLine = Pick<PayrollLine, 'grossPay' | 'employerNps' | 'employerHealth' | 'employerLtc' | 'employerEmployment'>;

export interface StaffCostResult {
  /** 인건비(원) = 총지급 합 + 사업주 4대보험 합 + 퇴직적립 */
  laborCost: number;
  /** 총지급 합 */
  grossTotal: number;
  /** 사업주 4대보험 합 */
  employerInsuranceTotal: number;
  /** 퇴직적립(원) */
  retirementAccrual: number;
  revenue: number;
  /** 인건비 지출비율(%), 소수 첫째 자리. 수입이 0 이하이면 null */
  ratio: number | null;
  target: number;
  /** ratio ≥ target. 수입이 없으면 false */
  met: boolean;
}

function wholeWon(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function floorDiv(a: number, b: number): number {
  return (a - (a % b)) / b;
}

/** 인건비 ÷ 수입 × 100을 소수 둘째 자리에서 반올림한 값(소수 첫째 자리까지). 정수 연산. */
export function ratioPercent(laborCost: number, revenue: number): number | null {
  const cost = wholeWon(laborCost);
  const income = wholeWon(revenue);
  if (income === 0) return null;
  // 비율 × 10 = cost × 1000 ÷ income, 반올림(반올림은 +income/2)
  return floorDiv(cost * 2000 + income, 2 * income) / 10;
}

export function staffCostRatio(params: { lines: ReadonlyArray<StaffCostLine>; revenue: number; retirementAccrual?: number }): StaffCostResult {
  const { lines, revenue } = params;
  const grossTotal = lines.reduce((sum, l) => sum + wholeWon(l.grossPay), 0);
  const employerInsuranceTotal = lines.reduce((sum, l) => sum + wholeWon(l.employerNps) + wholeWon(l.employerHealth) + wholeWon(l.employerLtc) + wholeWon(l.employerEmployment), 0);
  const retirementAccrual = params.retirementAccrual === undefined ? floorDiv(grossTotal, 12) : wholeWon(params.retirementAccrual);
  const laborCost = grossTotal + employerInsuranceTotal + retirementAccrual;
  const income = wholeWon(revenue);
  const ratio = ratioPercent(laborCost, income);
  return {
    laborCost,
    grossTotal,
    employerInsuranceTotal,
    retirementAccrual,
    revenue: income,
    ratio,
    target: STAFF_COST_TARGET,
    met: ratio !== null && ratio >= STAFF_COST_TARGET,
  };
}
