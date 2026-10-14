/**
 * 사업계획 편집 상태 — 항목마다 줄 번호(key)를 붙여 위아래 이동·삭제에도 입력칸이 섞이지 않게 한다.
 * 서버로 보내는 값(BusinessPlanInput)과 규칙 모듈이 읽는 값(BusinessPlanLike)으로 바꾸는 함수도 여기에 둔다.
 */
import type { BusinessPlan, BusinessPlanInput, BusinessPlanItem, BusinessSection } from '@/lib/lab/labTypes';
import { ITEM_LIMITS, MAX_ITEM_BUDGET, MAX_PLAN_TOTAL, MAX_SECTION_ITEMS, SECTIONS, emptyItem } from '@/lib/lab/businessPlanRules';
import type { BusinessPlanLike } from '@/lib/lab/businessPlanRules';

export interface ItemDraft extends BusinessPlanItem {
  key: number;
}

export interface PlanDraft {
  id: number | null;
  year: number;
  sections: Record<BusinessSection, ItemDraft[]>;
  totalIncome: number | null;
  totalExpense: number | null;
  writtenOn: string;
  writerName: string;
  aiAssisted: boolean;
}

export const MAX_WRITER = 50;
export { MAX_ITEM_BUDGET, MAX_PLAN_TOTAL, MAX_SECTION_ITEMS, ITEM_LIMITS };

let nextKey = 1;
export const newKey = () => nextKey++;

export function newItem(from: BusinessPlanItem = emptyItem()): ItemDraft {
  return { ...from, key: newKey() };
}

export function emptyPlanDraft(year: number, writerName: string): PlanDraft {
  return { id: null, year, sections: { operation: [], service: [], staff: [] }, totalIncome: null, totalExpense: null, writtenOn: '', writerName, aiAssisted: false };
}

const withKeys = (items: ReadonlyArray<BusinessPlanItem>): ItemDraft[] => items.map((it) => newItem(it));

export function draftOfPlan(plan: BusinessPlan): PlanDraft {
  return {
    id: plan.id,
    year: plan.planYear,
    sections: { operation: withKeys(plan.sections.operation ?? []), service: withKeys(plan.sections.service ?? []), staff: withKeys(plan.sections.staff ?? []) },
    totalIncome: plan.totalIncome,
    totalExpense: plan.totalExpense,
    writtenOn: plan.writtenOn ?? '',
    writerName: plan.writerName ?? '',
    aiAssisted: plan.aiAssisted,
  };
}

const plainItem = ({ name, goal, content, target, budget, schedule }: ItemDraft): BusinessPlanItem => ({ name, goal, content, target, budget, schedule });

export function plainOf(d: PlanDraft): BusinessPlanLike & { planYear: number } {
  return {
    planYear: d.year,
    sections: { operation: d.sections.operation.map(plainItem), service: d.sections.service.map(plainItem), staff: d.sections.staff.map(plainItem) },
    totalIncome: d.totalIncome,
    totalExpense: d.totalExpense,
  };
}

export function inputOfDraft(d: PlanDraft): BusinessPlanInput {
  const plain = plainOf(d);
  return {
    planYear: d.year,
    sections: { operation: [...plain.sections.operation], service: [...plain.sections.service], staff: [...plain.sections.staff] },
    totalIncome: d.totalIncome,
    totalExpense: d.totalExpense,
    writtenOn: d.writtenOn === '' ? null : d.writtenOn,
    writerName: d.writerName.trim(),
    aiAssisted: d.aiAssisted,
  };
}

/** 저장하지 않은 변경이 있는지 비교하려고 입력 내용만 문자열로 만든다(줄 번호는 뺀다) */
export function fingerprint(d: PlanDraft): string {
  const { sections, ...rest } = inputOfDraft(d);
  return JSON.stringify({ ...rest, writerName: d.writerName, sections, id: d.id });
}

/** 저장을 막는 것만(점검 항목은 저장을 막지 않는다) */
export function saveBlockers(d: PlanDraft): string[] {
  const out: string[] = [];
  if (d.writerName.trim() === '') out.push('작성자 이름을 적어 주세요');
  for (const { value, label } of SECTIONS) {
    if (d.sections[value].length > MAX_SECTION_ITEMS) out.push(`${label} 분야는 ${MAX_SECTION_ITEMS}개까지 적을 수 있습니다`);
  }
  return out;
}

export function moveItem<T>(list: T[], index: number, delta: -1 | 1): T[] {
  const to = index + delta;
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}

/** 이름·목표 등 어느 칸이라도 적힌 항목인가(AI 초안이 덮어써도 되는지 보려고) */
export function hasContent(items: ReadonlyArray<BusinessPlanItem>): boolean {
  return items.some((it) => [it.name, it.goal, it.content, it.target, it.schedule].some((v) => v.trim() !== '') || (it.budget ?? 0) > 0);
}
