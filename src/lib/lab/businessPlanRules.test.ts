/**
 * 사업계획 점검·예산 연결 테스트 — `node --test src/lib/lab/businessPlanRules.test.ts`
 * 왜: 평가 2는 세 분야·여섯 칸·총수입·총지출이 하나라도 비면 불인정이다. 점검이 빠뜨리면 거짓 안심이다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { ITEM_FIELDS, SECTIONS, budgetGap, businessPlanIssues, emptyItem, sectionBudget } from './businessPlanRules.ts';

const item = (o: Record<string, unknown> = {}) => ({ name: '직원 보수교육', goal: '법정 교육 100% 이수', content: '분기별 교육', target: '전 직원', budget: 1000000, schedule: '3·6·9·12월', ...o }) as never;
const full = { planYear: 2027, sections: { operation: [item()], service: [item()], staff: [item({ budget: 0 })] }, totalIncome: 500000000, totalExpense: 490000000 } as never;

test('분야와 칸 이름', () => {
  assert.deepEqual(SECTIONS.map((s) => s.label), ['기관운영', '서비스 제공', '직원관리']);
  assert.deepEqual(ITEM_FIELDS.map((f) => f.label), ['세부사업명', '사업목표', '사업내용', '사업대상', '사업예산', '추진일정']);
});

test('점검 — 빈 분야 1·빈 칸 1·총수입·총지출 각 1', () => {
  const plan = { planYear: 2027, sections: { operation: [item()], service: [], staff: [item({ goal: '', budget: null })] }, totalIncome: null, totalExpense: null } as never;
  const issues = businessPlanIssues(plan);
  assert.equal(issues.length, 5);
  assert.deepEqual(issues.filter((i) => i.field !== null).map((i) => [i.section, i.index, i.field]), [['staff', 0, 'goal'], ['staff', 0, 'budget']]);
  assert.deepEqual(issues.filter((i) => i.section === 'service').map((i) => [i.index, i.field]), [[null, null]]);
  assert.equal(issues.filter((i) => i.section === null).length, 2);
});

test('점검 — 모두 채우면 문제 없음, 예산 0은 허용', () => {
  assert.deepEqual(businessPlanIssues(full), []);
});

test('점검 — 공백뿐인 칸·음수·소수 예산은 빈 칸, 총수입 0은 허용', () => {
  const plan = { sections: { operation: [item({ name: '   ' })], service: [item({ budget: -1 })], staff: [item({ budget: 1.5 })] }, totalIncome: 0, totalExpense: 0 } as never;
  const issues = businessPlanIssues(plan);
  assert.deepEqual(issues.map((i) => [i.section, i.field]), [['operation', 'name'], ['service', 'budget'], ['staff', 'budget']]);
});

test('점검 — 항목이 완전히 빈 줄이면 여섯 칸 모두 문제', () => {
  const plan = { sections: { operation: [emptyItem()], service: [item()], staff: [item()] }, totalIncome: 1, totalExpense: 1 } as never;
  assert.equal(businessPlanIssues(plan).length, 6);
});

test('분야별 예산 합 — 빈 칸·음수는 0', () => {
  const plan = { sections: { operation: [item({ budget: 700 }), item({ budget: null })], service: [item({ budget: -5 })], staff: [item({ budget: 300 })] } } as never;
  assert.deepEqual(sectionBudget(plan), { operation: 700, service: 0, staff: 300, total: 1000 });
  assert.deepEqual(sectionBudget({ sections: { operation: [], service: [], staff: [] } }), { operation: 0, service: 0, staff: 0, total: 0 });
});

test('분야별 예산 합 — 큰 금액도 정수로 정확히', () => {
  const big = Array.from({ length: 20 }, () => item({ budget: 999_999_999 }));
  assert.equal(sectionBudget({ sections: { operation: big, service: [], staff: [] } } as never).total, 19_999_999_980);
});

const budget = { fiscalYear: 2027, revision: 0, lines: [{ direction: 'EXPENSE', accountCode: '111', amount: 300000000 }, { direction: 'EXPENSE', accountCode: '133', amount: 14000000 }, { direction: 'INCOME', accountCode: '611', amount: 480000000 }] } as never;

test('예산과 차이 — 사업계획 총지출 − 예산 세출 합', () => {
  assert.deepEqual(budgetGap({ planYear: 2027, totalExpense: 500000000 }, budget), { planExpense: 500000000, budgetExpense: 314000000, diff: 186000000 });
  assert.equal(budgetGap({ planYear: 2027, totalExpense: 300000000 }, budget)?.diff, -14000000);
});

test('예산과 차이 — 예산이 없거나 총지출이 비었거나 다른 해 예산이면 null', () => {
  assert.equal(budgetGap({ planYear: 2027, totalExpense: 1 }, null), null);
  assert.equal(budgetGap({ planYear: 2027, totalExpense: null }, budget), null);
  assert.equal(budgetGap({ planYear: 2028, totalExpense: 1 }, budget), null);
});
