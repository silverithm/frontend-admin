/**
 * 예산·결산 규칙 테스트 — `node --test src/lib/lab/budgetRules.test.ts`
 * 왜: 예산 금액은 시·군·구청에 제출하는 숫자다. 부동소수 오차로 1,000원이 더 올라가거나 집행률이 한 칸 어긋나면 안 된다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { budgetDeadlines, budgetInputIssues, budgetTotals, budgetVsActual, draftAccounts, draftFromActuals, latestBudget, roundUpToThousand, settlement } from './budgetRules.ts';

const line = (direction: 'INCOME' | 'EXPENSE', accountCode: string, amount: number) => ({ direction, accountCode, amount, note: null });
const budget = { fiscalYear: 2026, revision: 1, status: 'CONFIRMED', lines: [line('EXPENSE', '132', 400000), line('INCOME', '1112', 200000), line('INCOME', '1111', 1000000), line('EXPENSE', '111', 700000)] } as never;
const E = (entryDate: string, direction: 'INCOME' | 'EXPENSE', accountCode: string, amount: number) => ({ entryDate, direction, accountCode, amount });
const entries = [
  E('2026-03-10', 'INCOME', '1111', 300000),
  E('2026-11-10', 'INCOME', '1111', 200000),
  E('2026-05-10', 'EXPENSE', '111', 350000),
  E('2026-06-10', 'EXPENSE', '132', 450000),
  E('2026-06-11', 'EXPENSE', '211', 50000),
  E('2025-12-31', 'EXPENSE', '111', 9999999),
];

test('최신 예산 — 그 해 revision이 가장 큰 것, 없으면 null', () => {
  const list = [{ fiscalYear: 2026, revision: 0 }, { fiscalYear: 2026, revision: 2 }, { fiscalYear: 2026, revision: 1 }, { fiscalYear: 2025, revision: 3 }];
  assert.equal(latestBudget(list, 2026)?.revision, 2);
  assert.equal(latestBudget(list, 2025)?.revision, 3);
  assert.equal(latestBudget(list, 2027), null);
  assert.equal(latestBudget([], 2026), null);
});

test('예산 합계 — 세입·세출·차이·균형', () => {
  assert.deepEqual(budgetTotals(budget), { income: 1200000, expense: 1100000, diff: 100000, balanced: false });
  assert.deepEqual(budgetTotals({ lines: [line('INCOME', '111', 500), line('EXPENSE', '111', 500)] }), { income: 500, expense: 500, diff: 0, balanced: true });
  assert.deepEqual(budgetTotals({ lines: [] }), { income: 0, expense: 0, diff: 0, balanced: true });
});

test('예산 대비 집행 — 수입 먼저·코드 오름차순, 예산에 없는 계정은 예산 0 줄(초과), 다른 해 실적은 뺀다', () => {
  const r = budgetVsActual(budget, entries, 2026);
  assert.deepEqual(
    r.rows.map((x) => [x.direction, x.accountCode, x.budget, x.actual, x.remaining, x.rate, x.over]),
    [
      ['INCOME', '1111', 1000000, 500000, 500000, 50, false],
      ['INCOME', '1112', 200000, 0, 200000, 0, false],
      ['EXPENSE', '111', 700000, 350000, 350000, 50, false],
      ['EXPENSE', '132', 400000, 450000, -50000, 112.5, true],
      ['EXPENSE', '211', 0, 50000, -50000, null, true],
    ],
  );
  assert.deepEqual(r.totals, { income: { budget: 1200000, actual: 500000 }, expense: { budget: 1100000, actual: 850000 } });
});

test('예산 대비 집행 — 코드는 숫자로 비교한다(1011이 911보다 뒤)', () => {
  const r = budgetVsActual({ lines: [line('INCOME', '1011', 1), line('INCOME', '911', 1), line('INCOME', '111', 1)] }, [], 2026);
  assert.deepEqual(r.rows.map((x) => x.accountCode), ['111', '911', '1011']);
});

test('예산 대비 집행 — throughMonth까지만, 범위 밖 값은 연간으로 본다', () => {
  const at = (m?: number) => budgetVsActual(budget, entries, 2026, m).rows.find((x) => x.accountCode === '1111')!.actual;
  assert.equal(at(3), 300000);
  assert.equal(at(2), 0);
  assert.equal(at(10), 300000);
  assert.equal(at(11), 500000);
  assert.equal(at(12), 500000);
  assert.equal(at(undefined), 500000);
  assert.equal(at(0), 500000);
  assert.equal(at(13), 500000);
  assert.equal(at(3.5), 500000);
});

test('예산 대비 집행 — 집행률은 소수 첫째 자리 반올림, 정확히 예산이면 초과가 아니다', () => {
  const r = budgetVsActual({ lines: [line('EXPENSE', '111', 3), line('EXPENSE', '132', 300)] }, [E('2026-01-01', 'EXPENSE', '111', 1), E('2026-01-01', 'EXPENSE', '132', 300)], 2026);
  assert.equal(r.rows[0].rate, 33.3);
  assert.deepEqual([r.rows[1].rate, r.rows[1].over], [100, false]);
});

test('예산 대비 집행 — 예산이 없으면(null) 실적만 예산 0 줄로', () => {
  const r = budgetVsActual(null, [E('2026-01-01', 'INCOME', '1111', 10)], 2026);
  assert.deepEqual(r.rows.map((x) => [x.budget, x.actual, x.rate, x.over]), [[0, 10, null, true]]);
});

test('전년 실적 초안 — +10% 천 원 올림(550,000이 551,000이 되면 안 된다)', () => {
  const draft = draftFromActuals(entries, 2026, 10);
  assert.deepEqual(draft, [
    { direction: 'INCOME', accountCode: '1111', amount: 550000 },
    { direction: 'EXPENSE', accountCode: '111', amount: 385000 },
    { direction: 'EXPENSE', accountCode: '132', amount: 495000 },
    { direction: 'EXPENSE', accountCode: '211', amount: 55000 },
  ]);
});

test('전년 실적 초안 — 올림·0%·음수·소수 증가율·상한', () => {
  const one = (amount: number, pct: number) => draftFromActuals([E('2026-01-01', 'EXPENSE', '121', amount)], 2026, pct)[0]?.amount;
  assert.equal(one(333333, 3), 344000); // 343,332.99 → 344,000
  assert.equal(one(500000, 0), 500000);
  assert.equal(one(1, 0), 1000);
  assert.equal(one(1000, 0), 1000);
  assert.equal(one(1001, 0), 2000);
  assert.equal(one(1000000, -10), 900000);
  assert.equal(one(1000000, 2.5), 1025000);
  assert.equal(one(1000000, 0.01), 1001000); // 1,000,100 → 1,001,000
  assert.equal(one(1000000, Number.NaN), 1000000);
  assert.equal(one(9_000_000_000, 50), 10_000_000_000); // 서버 상한
  assert.equal(one(10_000_000_000_000_000, 10), 10_000_000_000); // 곱이 안전한 정수를 넘어도 상한으로 자른다
  assert.equal(one(1000000, -100), undefined); // 0원이 되는 계정은 넣지 않는다
});

test('전년 실적 초안 — 실적 0·다른 해는 넣지 않고, 같은 계정은 합쳐서 계산', () => {
  assert.deepEqual(draftFromActuals([E('2026-01-01', 'EXPENSE', '111', 0), E('2025-01-01', 'EXPENSE', '132', 100)], 2026, 10), []);
  assert.deepEqual(draftFromActuals([E('2026-01-01', 'EXPENSE', '111', 100000), E('2026-02-01', 'EXPENSE', '111', 400000)], 2026, 10), [{ direction: 'EXPENSE', accountCode: '111', amount: 550000 }]);
});

test('천 원 올림 — 정수 경계·소수·비정상·상한', () => {
  assert.equal(roundUpToThousand(550000), 550000);
  assert.equal(roundUpToThousand(550001), 551000);
  assert.equal(roundUpToThousand(1234567), 1235000);
  assert.equal(roundUpToThousand(0), 0);
  assert.equal(roundUpToThousand(-5), 0);
  assert.equal(roundUpToThousand(Number.NaN), 0);
  assert.equal(roundUpToThousand(999.5), 1000);
  assert.equal(roundUpToThousand(1e12), 10_000_000_000);
});

test('제출 기한 — 예산은 개시 5일 전(전년 12/27), 추경 7일, 결산은 다음 해 3/31', () => {
  assert.deepEqual(budgetDeadlines(2026), { budgetDue: '2025-12-27', supplementaryDays: 7, settlementDue: '2027-03-31', submitTo: '시·군·구청장' });
  assert.equal(budgetDeadlines(2020).budgetDue, '2019-12-27');
});

test('결산 — 수입 실적·지출 실적·차이와 연간 집행 표', () => {
  const s = settlement(budget, entries, 2026);
  assert.deepEqual([s.incomeActual, s.expenseActual, s.surplus], [500000, 850000, -350000]);
  assert.equal(s.rows.length, 5);
  assert.deepEqual(settlement(null, [], 2026), { incomeActual: 0, expenseActual: 0, surplus: 0, rows: [] });
});

test('초안용 계정 목록 — 쓸 수 있는 계정 전부에 전년 실적(없으면 0), 300개 이내', () => {
  const list = draftAccounts([E('2025-05-05', 'EXPENSE', '133', 12345), E('2025-05-05', 'INCOME', '133', 7), E('2026-05-05', 'EXPENSE', '133', 9)], 2025);
  assert.ok(list.length > 30 && list.length <= 300);
  assert.equal(list.find((a) => a.direction === 'EXPENSE' && a.accountCode === '133')!.lastYear, 12345);
  assert.ok(list.every((a) => /^[0-9]{3,4}$/.test(a.accountCode) && a.accountName !== '' && a.lastYear >= 0));
  assert.equal(new Set(list.map((a) => `${a.direction}:${a.accountCode}`)).size, list.length);
});

test('저장 전 점검 — 연도·차수·계정·금액·중복', () => {
  const ok = { fiscalYear: 2026, revision: 0, note: null, lines: [line('EXPENSE', '111', 1000), line('INCOME', '611', 0)] };
  assert.deepEqual(budgetInputIssues(ok), []);
  assert.equal(budgetInputIssues({ ...ok, fiscalYear: 2019 }).length, 1);
  assert.equal(budgetInputIssues({ ...ok, revision: 10 }).length, 1);
  assert.equal(budgetInputIssues({ ...ok, lines: [line('EXPENSE', '999', 1)] }).length, 1);
  assert.equal(budgetInputIssues({ ...ok, lines: [line('EXPENSE', '111', -1)] }).length, 1);
  assert.equal(budgetInputIssues({ ...ok, lines: [line('EXPENSE', '111', 1.5)] }).length, 1);
  assert.equal(budgetInputIssues({ ...ok, lines: [line('EXPENSE', '111', 10_000_000_001)] }).length, 1);
  assert.match(budgetInputIssues({ ...ok, lines: [line('EXPENSE', '111', 1), line('EXPENSE', '111', 2)] })[0], /두 번/);
  assert.equal(budgetInputIssues({ ...ok, lines: Array.from({ length: 301 }, () => line('EXPENSE', '111', 1)) }).some((m) => /300개/.test(m)), true);
});
