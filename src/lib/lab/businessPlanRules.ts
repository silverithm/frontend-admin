/**
 * 연간 사업계획서 점검·예산 연결.
 *
 * 근거(research-7.md 3절, 2026 주야간보호 평가 2 사업계획 기준①)
 *  - 사업계획서에 기관운영·서비스 제공·직원 관리 3개 분야가 모두 있어야 한다. 단순 프로그램 사업계획만 있으면 불인정.
 *  - 항목마다 세부사업명·사업목표·사업내용·사업대상·사업예산·추진일정을 확인한다.
 *  - 기관 예산수립내역(총수입, 총지출)이 사업계획서에 들어 있어야 한다. 예산이 없는 사업은 내역을 확인해 평가한다.
 * 2026판에는 예산 별도 기준·운영 실적·결과 평가 반영(2025판 ②③④)이 없다. 작성 시기 제한도 명시되어 있지 않다.
 *
 * 금액은 정수 원이다. 사업예산 0은 "예산 없음 사유가 있는 사업"일 수 있어 허용하고, 비어 있는 칸(null)·음수·소수만 문제로 본다.
 */
import type { Budget, BusinessPlanItem, BusinessSection } from './labTypes.ts';
import { budgetTotals, type BudgetLike } from './budgetRules.ts';

export const SECTIONS: ReadonlyArray<{ value: BusinessSection; label: string }> = [
  { value: 'operation', label: '기관운영' },
  { value: 'service', label: '서비스 제공' },
  { value: 'staff', label: '직원관리' },
];

export const ITEM_FIELDS: ReadonlyArray<{ key: keyof BusinessPlanItem; label: string }> = [
  { key: 'name', label: '세부사업명' },
  { key: 'goal', label: '사업목표' },
  { key: 'content', label: '사업내용' },
  { key: 'target', label: '사업대상' },
  { key: 'budget', label: '사업예산' },
  { key: 'schedule', label: '추진일정' },
];

/** 항목 칸 길이 한도(서버 규칙과 같다) */
export const ITEM_LIMITS = { name: 60, goal: 300, content: 1000, target: 100, schedule: 100 } as const;
export const MAX_SECTION_ITEMS = 20;
export const MAX_PLAN_TOTAL = 10_000_000_000;
/** 항목 예산 상한 — 서버는 0 이상 정수만 요구하므로 총액 한도와 같게 둔다 */
export const MAX_ITEM_BUDGET = MAX_PLAN_TOTAL;

export function sectionLabel(section: string): string {
  return SECTIONS.find((s) => s.value === section)?.label ?? section;
}

export function emptyItem(): BusinessPlanItem {
  return { name: '', goal: '', content: '', target: '', budget: null, schedule: '' };
}

export type BusinessPlanLike = {
  planYear?: number;
  sections: { [K in BusinessSection]: ReadonlyArray<BusinessPlanItem> };
  totalIncome: number | null;
  totalExpense: number | null;
};

export interface BusinessPlanIssue {
  section: BusinessSection | null;
  index: number | null;
  field: keyof BusinessPlanItem | null;
  message: string;
}

function blank(value: unknown): boolean {
  return typeof value !== 'string' || value.trim().length === 0;
}

function validWon(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/**
 * 저장 전·평가 전 점검. 비어 있는 분야마다 1건, 항목의 여섯 칸 중 빈 칸마다 1건(예산은 0 허용 — 비었거나 음수·소수만),
 * 총수입이 없으면 1건, 총지출이 없으면 1건. 모두 채우면 빈 배열.
 */
export function businessPlanIssues(plan: BusinessPlanLike): BusinessPlanIssue[] {
  const issues: BusinessPlanIssue[] = [];
  for (const { value: section, label } of SECTIONS) {
    const items = plan.sections?.[section] ?? [];
    if (items.length === 0) {
      issues.push({ section, index: null, field: null, message: `${label} 분야의 사업이 없습니다 (3개 분야가 모두 있어야 합니다)` });
      continue;
    }
    items.forEach((item, index) => {
      for (const { key, label: fieldLabel } of ITEM_FIELDS) {
        const value = item?.[key];
        const missing = key === 'budget' ? !validWon(value) : blank(value);
        if (missing) issues.push({ section, index, field: key, message: `${label} ${index + 1}번째 사업의 ${fieldLabel}을(를) ${key === 'budget' ? '0원 이상의 금액으로 ' : ''}적어 주세요` });
      }
    });
  }
  if (!validWon(plan.totalIncome)) issues.push({ section: null, index: null, field: null, message: '기관 예산의 총수입을 적어 주세요' });
  if (!validWon(plan.totalExpense)) issues.push({ section: null, index: null, field: null, message: '기관 예산의 총지출을 적어 주세요' });
  return issues;
}

export interface SectionBudget {
  operation: number;
  service: number;
  staff: number;
  total: number;
}

/** 분야별·전체 항목 예산 합. 비었거나 음수·소수인 칸은 0원으로 본다(소수는 내림). */
export function sectionBudget(plan: Pick<BusinessPlanLike, 'sections'>): SectionBudget {
  const sum = (items: ReadonlyArray<BusinessPlanItem> | undefined) =>
    (items ?? []).reduce((acc, it) => (typeof it?.budget === 'number' && Number.isFinite(it.budget) && it.budget > 0 ? acc + Math.floor(it.budget) : acc), 0);
  const operation = sum(plan.sections?.operation);
  const service = sum(plan.sections?.service);
  const staff = sum(plan.sections?.staff);
  return { operation, service, staff, total: operation + service + staff };
}

export interface BudgetGap {
  planExpense: number;
  budgetExpense: number;
  /** planExpense − budgetExpense (양수면 사업계획 총지출이 예산 세출 합보다 큼) */
  diff: number;
}

/**
 * 사업계획 총지출과 예산·결산(5차)의 최신 예산 세출 합의 차이. 예산이 없거나 사업계획에 총지출이 없으면 null.
 * 연도가 둘 다 있는데 다르면 다른 해 예산이므로 null.
 */
export function budgetGap(plan: Pick<BusinessPlanLike, 'totalExpense'> & { planYear?: number }, budget: (BudgetLike & Partial<Pick<Budget, 'fiscalYear'>>) | null): BudgetGap | null {
  if (!budget || !validWon(plan.totalExpense)) return null;
  if (typeof plan.planYear === 'number' && typeof budget.fiscalYear === 'number' && plan.planYear !== budget.fiscalYear) return null;
  const budgetExpense = budgetTotals(budget).expense;
  return { planExpense: plan.totalExpense, budgetExpense, diff: plan.totalExpense - budgetExpense };
}
