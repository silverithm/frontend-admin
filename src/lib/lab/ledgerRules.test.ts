/**
 * 회계 장부 규칙 테스트 — `node --test src/lib/lab/ledgerRules.test.ts`
 * 왜: 계정 코드가 한 자리 틀리면 결산서(세입·세출)의 다른 과목으로 들어가고, 잔액이 한 줄 어긋나면 그 뒤 모든 줄이 틀린다.
 * 후원금은 지정 용도 밖으로 쓰였는지 보는 근거라 연결 합계가 정확해야 한다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  EXPENSE_ACCOUNTS,
  INCOME_ACCOUNTS,
  LEDGER_VERIFY_NOTES,
  accountLabel,
  accountsFor,
  carryForward,
  cashBook,
  cashBookTotals,
  donationUsage,
  findAccount,
  isAccountCode,
  ledgerEntryIssues,
  ledgerSummary,
  type LedgerLike,
} from './ledgerRules.ts';

// ---------- 계정 목록 ----------

test('세출 계정 — 별표 10의 관·항·목이 빠짐없이 있다', () => {
  const codes = EXPENSE_ACCOUNTS.map((a) => a.code);
  const expected = ['111', '112', '113', '115', '116', '121', '122', '123', '131', '132', '133', '135', '136', '137', '211', '212', '213', '311', '312', '314', '315', '331', '341', '342', '411', '412', '511', '611', '612', '711', '811', '812', '911', '912'];
  for (const code of expected) assert.ok(codes.includes(code), `세출 ${code}`);
  // 별표에 없는 번호는 만들어 넣지 않는다
  for (const code of ['114', '134', '313', '332']) assert.equal(codes.includes(code), false, `세출 ${code}는 별표에 없음`);
});

test('세출 계정 — 이름이 확인된 값(111 급여 · 133 공공요금 · 135 차량비 · 331 프로그램사업비)', () => {
  assert.equal(findAccount('EXPENSE', '111')?.name, '급여');
  assert.equal(findAccount('EXPENSE', '115')?.name, '퇴직금 및 퇴직적립금');
  assert.equal(findAccount('EXPENSE', '116')?.name, '사회보험 부담금');
  assert.equal(findAccount('EXPENSE', '132')?.name, '수용비 및 수수료');
  assert.equal(findAccount('EXPENSE', '133')?.name, '공공요금 및 각종 세금공과금');
  assert.equal(findAccount('EXPENSE', '135')?.name, '차량비');
  assert.equal(findAccount('EXPENSE', '331')?.name, '프로그램사업비');
  assert.equal(findAccount('EXPENSE', '111')?.group, '사무비');
  assert.equal(findAccount('EXPENSE', '111')?.section, '인건비');
  assert.equal(findAccount('EXPENSE', '211')?.group, '재산조성비');
  assert.equal(findAccount('EXPENSE', '311')?.group, '사업비');
});

test('계정 목록 — 코드는 방향 안에서 중복이 없고 3~4자리 숫자다(서버 VARCHAR(4))', () => {
  for (const list of [EXPENSE_ACCOUNTS, INCOME_ACCOUNTS]) {
    assert.equal(new Set(list.map((a) => a.code)).size, list.length);
    for (const a of list) {
      assert.match(a.code, /^\d{3,4}$/);
      assert.ok(a.name.length > 0 && a.group.length > 0 && a.section.length > 0);
    }
  }
});

test('계정 목록 — 목의 앞자리가 항 코드와 맞고, 항의 앞자리가 관 번호와 맞는다(관 01 → 항 11 → 목 111)', () => {
  for (const list of [EXPENSE_ACCOUNTS, INCOME_ACCOUNTS]) {
    for (const a of list) {
      assert.ok(a.code.startsWith(a.sectionCode), `${a.code}의 항 ${a.sectionCode}`);
      assert.ok(a.sectionCode.startsWith(String(Number(a.groupCode))), `${a.sectionCode}의 관 ${a.groupCode}`);
    }
  }
});

test('네 자리 목(별표 1011~1014·1111·1112)을 근사 없이 그대로 가진다', () => {
  assert.equal(findAccount('EXPENSE', '1011')?.name, '운영충당 적립금 지출');
  assert.equal(findAccount('EXPENSE', '1012')?.name, '시설환경개선준비금 지출');
  for (const c of ['1011', '1012', '1013', '1014', '1111', '1112']) assert.ok(findAccount('INCOME', c), c);
  assert.equal(findAccount('INCOME', '1014')?.name, '기타잡수입');
  assert.equal(findAccount('EXPENSE', '101'), null);
  assert.equal(findAccount('INCOME', '101'), null);
  assert.ok([...EXPENSE_ACCOUNTS, ...INCOME_ACCOUNTS].every((a) => !('approximate' in a)));
  assert.equal(isAccountCode('INCOME', '1111'), true);
  assert.equal(isAccountCode('EXPENSE', '1111'), false);
  assert.equal(accountLabel('INCOME', '1014'), '1014 기타잡수입');
});

test('연간 요약 — 네 자리 목이 관·항·목으로 묶인다(세입 관 10 항 101 목 1011·1014, 세출 관 10)', () => {
  const s = ledgerSummary(
    [
      { entryDate: '2026-03-02', direction: 'INCOME', accountCode: '1011', amount: 1000 },
      { entryDate: '2026-03-09', direction: 'INCOME', accountCode: '1014', amount: 500 },
      { entryDate: '2026-04-01', direction: 'INCOME', accountCode: '1111', amount: 70 },
      { entryDate: '2026-03-03', direction: 'EXPENSE', accountCode: '1012', amount: 300 },
    ],
    2026,
  );
  const g10 = s.income.groups.find((g) => g.code === '10')!;
  assert.equal(g10.total, 1500);
  const sec = g10.sections.find((x) => x.code === '101')!;
  assert.equal(sec.total, 1500);
  assert.equal(sec.accounts.find((x) => x.code === '1011')!.months[2], 1000);
  assert.equal(sec.accounts.find((x) => x.code === '1014')!.total, 500);
  assert.equal(s.income.groups.find((g) => g.code === '11')!.total, 70);
  assert.equal(s.income.total, 1570);
  assert.equal(s.expense.groups.find((g) => g.code === '10')!.sections[0].accounts.find((x) => x.code === '1012')!.total, 300);
  assert.equal(s.net, 1270);
  assert.ok(s.income.groups.every((g) => !g.sections.some((x) => x.accounts.some((a) => a.unknown))));
});

test('세입 계정(참고용) — 본인부담금·식재료비·기타비급여·후원금·장기요양급여수입이 있다', () => {
  assert.equal(findAccount('INCOME', '112')?.name, '본인부담금수입');
  assert.equal(findAccount('INCOME', '113')?.name, '식재료비수입');
  assert.equal(findAccount('INCOME', '116')?.name, '기타비급여수입');
  assert.equal(findAccount('INCOME', '511')?.name, '지정후원금');
  assert.equal(findAccount('INCOME', '512')?.name, '비지정후원금');
  assert.equal(findAccount('INCOME', '611')?.name, '장기요양급여수입');
});

test('같은 코드도 방향이 다르면 다른 계정이다(세입 411 국고보조금 / 세출 411 법인회계 전출금)', () => {
  assert.equal(findAccount('INCOME', '411')?.name, '국고보조금');
  assert.equal(findAccount('EXPENSE', '411')?.name, '법인회계 전출금');
  assert.equal(findAccount('INCOME', '111'), null);
  assert.equal(findAccount('EXPENSE', '111')?.name, '급여');
  assert.equal(accountsFor('INCOME'), INCOME_ACCOUNTS);
  assert.equal(accountsFor('EXPENSE'), EXPENSE_ACCOUNTS);
});

test('isAccountCode · accountLabel', () => {
  assert.equal(isAccountCode('EXPENSE', '133'), true);
  assert.equal(isAccountCode('INCOME', '133'), false);
  assert.equal(isAccountCode('EXPENSE', 133), false);
  assert.equal(isAccountCode('EXPENSE', '13'), false);
  assert.equal(accountLabel('EXPENSE', '133'), '133 공공요금 및 각종 세금공과금');
  assert.equal(accountLabel('EXPENSE', '999'), '999 (목록에 없음)');
});

// ---------- 입력 검증 ----------

const ENTRY = { entryDate: '2026-10-05', direction: 'EXPENSE' as const, accountCode: '132', description: '키친타월', amount: 12_000, counterparty: null };

test('ledgerEntryIssues — 정상 입력은 통과, 한도는 서버와 같다', () => {
  assert.deepEqual(ledgerEntryIssues(ENTRY), []);
  assert.equal(ledgerEntryIssues({ ...ENTRY, entryDate: '2026-10' }).length, 1);
  assert.equal(ledgerEntryIssues({ ...ENTRY, accountCode: '999' }).length, 1);
  assert.equal(ledgerEntryIssues({ ...ENTRY, direction: 'INCOME', accountCode: '132' }).length, 1);
  assert.equal(ledgerEntryIssues({ ...ENTRY, description: '  ' }).length, 1);
  assert.equal(ledgerEntryIssues({ ...ENTRY, description: '가'.repeat(201) }).length, 1);
  assert.deepEqual(ledgerEntryIssues({ ...ENTRY, description: '가'.repeat(200) }), []);
  assert.equal(ledgerEntryIssues({ ...ENTRY, amount: 0 }).length, 1);
  assert.equal(ledgerEntryIssues({ ...ENTRY, amount: 1.5 }).length, 1);
  assert.equal(ledgerEntryIssues({ ...ENTRY, amount: 10_000_000_001 }).length, 1);
  assert.deepEqual(ledgerEntryIssues({ ...ENTRY, amount: 10_000_000_000 }), []);
  assert.equal(ledgerEntryIssues({ ...ENTRY, counterparty: '가'.repeat(101) }).length, 1);
});

// ---------- 현금출납부 ----------

const entries: LedgerLike[] = [
  { entryDate: '2026-10-02', direction: 'INCOME', accountCode: '112', amount: 500_000 },
  { entryDate: '2026-10-05', direction: 'EXPENSE', accountCode: '132', amount: 120_000 },
  { entryDate: '2026-10-07', direction: 'EXPENSE', accountCode: '111', amount: 300_000 },
];

test('현금출납부 — 줄마다 잔액, 마지막 잔액 = 이월 + 수입 − 지출', () => {
  const book = cashBook(entries, '2026-10', 1_000_000);
  assert.deepEqual(book.map((r) => r.balance), [1_500_000, 1_380_000, 1_080_000]);
  assert.equal(book[book.length - 1].balance, 1_000_000 + 500_000 - 120_000 - 300_000);
  assert.equal(book[0].income, 500_000);
  assert.equal(book[0].expense, 0);
  assert.equal(book[1].expense, 120_000);
  assert.equal(book[1].income, 0);
});

test('현금출납부 — 날짜순으로 정렬하고 같은 날은 id 순, 그다음은 들어온 순서', () => {
  const shuffled: LedgerLike[] = [
    { id: 3, entryDate: '2026-10-07', direction: 'EXPENSE', accountCode: '111', amount: 300_000 },
    { id: 2, entryDate: '2026-10-05', direction: 'EXPENSE', accountCode: '132', amount: 120_000 },
    { id: 1, entryDate: '2026-10-05', direction: 'INCOME', accountCode: '112', amount: 500_000 },
  ];
  const book = cashBook(shuffled, '2026-10', 0);
  assert.deepEqual(book.map((r) => r.id), [1, 2, 3]);
  assert.deepEqual(book.map((r) => r.balance), [500_000, 380_000, 80_000]);
  const same: LedgerLike[] = [
    { entryDate: '2026-10-05', direction: 'EXPENSE', accountCode: '132', amount: 1 },
    { entryDate: '2026-10-05', direction: 'INCOME', accountCode: '112', amount: 2 },
  ];
  assert.deepEqual(cashBook(same, '2026-10', 0).map((r) => r.direction), ['EXPENSE', 'INCOME']);
});

test('현금출납부 — 그 달 기록만(월 경계: 9/30은 9월, 11/01은 11월)', () => {
  const border: LedgerLike[] = [
    { entryDate: '2026-09-30', direction: 'INCOME', accountCode: '112', amount: 10 },
    { entryDate: '2026-10-01', direction: 'INCOME', accountCode: '112', amount: 20 },
    { entryDate: '2026-10-31', direction: 'EXPENSE', accountCode: '132', amount: 5 },
    { entryDate: '2026-11-01', direction: 'INCOME', accountCode: '112', amount: 40 },
  ];
  const october = cashBook(border, '2026-10', 0);
  assert.equal(october.length, 2);
  assert.equal(october[1].balance, 15);
  assert.equal(cashBook(border, '2026-09', 0).length, 1);
  assert.equal(cashBook(border, '2026-11', 0).length, 1);
  assert.equal(cashBook(border, '2026-12', 7).length, 0);
  // 연도가 다르면 같은 월이어도 섞이지 않는다
  assert.equal(cashBook([{ entryDate: '2025-10-05', direction: 'INCOME', accountCode: '112', amount: 1 }], '2026-10', 0).length, 0);
});

test('현금출납부 — 이월 잔액은 이전 기록으로 구한다(carryForward)', () => {
  const all: LedgerLike[] = [
    { entryDate: '2026-08-10', direction: 'INCOME', accountCode: '112', amount: 1_000_000 },
    { entryDate: '2026-09-30', direction: 'EXPENSE', accountCode: '132', amount: 250_000 },
    ...entries,
  ];
  assert.equal(carryForward(all, '2026-10', 100_000), 100_000 + 1_000_000 - 250_000);
  assert.equal(carryForward(all, '2026-08', 100_000), 100_000);
  assert.equal(carryForward(all, '2026-09', 0), 1_000_000);
  const opening = carryForward(all, '2026-10', 100_000);
  assert.equal(cashBook(all, '2026-10', opening).at(-1)?.balance, 100_000 + 1_000_000 - 250_000 + 500_000 - 120_000 - 300_000);
});

test('현금출납부 — 잔액이 음수가 될 수 있다(지출이 더 큰 경우를 숨기지 않는다)', () => {
  const book = cashBook([{ entryDate: '2026-10-01', direction: 'EXPENSE', accountCode: '132', amount: 700 }], '2026-10', 500);
  assert.equal(book[0].balance, -200);
});

test('현금출납부 — 합계(cashBookTotals)', () => {
  const book = cashBook(entries, '2026-10', 1_000_000);
  assert.deepEqual(cashBookTotals(book, 1_000_000), { opening: 1_000_000, income: 500_000, expense: 420_000, closing: 1_080_000 });
  assert.deepEqual(cashBookTotals([], 5), { opening: 5, income: 0, expense: 0, closing: 5 });
});

// ---------- 연간 요약 ----------

const yearEntries: LedgerLike[] = [
  { entryDate: '2026-01-05', direction: 'EXPENSE', accountCode: '111', amount: 2_000_000 },
  { entryDate: '2026-01-25', direction: 'EXPENSE', accountCode: '112', amount: 150_000 },
  { entryDate: '2026-02-05', direction: 'EXPENSE', accountCode: '111', amount: 2_100_000 },
  { entryDate: '2026-02-10', direction: 'EXPENSE', accountCode: '132', amount: 48_200 },
  { entryDate: '2026-12-31', direction: 'EXPENSE', accountCode: '133', amount: 312_000 },
  { entryDate: '2026-02-02', direction: 'INCOME', accountCode: '112', amount: 900_000 },
  { entryDate: '2026-02-20', direction: 'INCOME', accountCode: '511', amount: 100_000 },
  { entryDate: '2025-12-31', direction: 'EXPENSE', accountCode: '111', amount: 999 },
  { entryDate: '2027-01-01', direction: 'EXPENSE', accountCode: '111', amount: 888 },
];

test('연간 요약 — 관·항·목별 월별 합과 합계', () => {
  const s = ledgerSummary(yearEntries, 2026);
  assert.equal(s.year, 2026);
  assert.equal(s.expense.total, 2_000_000 + 150_000 + 2_100_000 + 48_200 + 312_000);
  assert.equal(s.income.total, 1_000_000);
  const office = s.expense.groups.find((g) => g.code === '01');
  assert.equal(office?.name, '사무비');
  const labor = office?.sections.find((x) => x.code === '11');
  assert.equal(labor?.name, '인건비');
  const salary = labor?.accounts.find((a) => a.code === '111');
  assert.equal(salary?.months[0], 2_000_000);
  assert.equal(salary?.months[1], 2_100_000);
  assert.equal(salary?.total, 4_100_000);
  assert.equal(labor?.total, 4_100_000 + 150_000);
  assert.equal(labor?.months[0], 2_150_000);
  assert.equal(office?.total, 4_250_000 + 48_200 + 312_000);
  // 12월 31일은 12월, 전년 12월 31일·다음 해 1월 1일은 제외
  assert.equal(s.expense.months[11], 312_000);
  assert.equal(s.expense.months[0], 2_150_000);
});

test('연간 요약 — 수입·지출을 나누고 월별 순액과 연 순액을 낸다', () => {
  const s = ledgerSummary(yearEntries, 2026);
  assert.equal(s.income.months[1], 1_000_000);
  assert.equal(s.netByMonth[1], 1_000_000 - 2_100_000 - 48_200);
  assert.equal(s.net, s.income.total - s.expense.total);
  assert.equal(s.netByMonth.length, 12);
  assert.equal(s.income.groups.find((g) => g.code === '05')?.total, 100_000);
});

test('연간 요약 — 합계가 0인 계정도 목록 순서대로 들어 있고 월별 합은 12칸이다', () => {
  const empty = ledgerSummary([], 2026);
  assert.equal(empty.expense.total, 0);
  const flat = empty.expense.groups.flatMap((g) => g.sections.flatMap((x) => x.accounts));
  assert.deepEqual(flat.map((a) => a.code), EXPENSE_ACCOUNTS.map((a) => a.code));
  for (const a of flat) assert.equal(a.months.length, 12);
});

test('연간 요약 — 목록에 없는 코드는 미분류로 따로 모으고 합계에는 넣는다', () => {
  const s = ledgerSummary([{ entryDate: '2026-03-03', direction: 'EXPENSE', accountCode: '999', amount: 5_000 }], 2026);
  const unknown = s.expense.groups.find((g) => g.name === '미분류');
  assert.equal(unknown?.total, 5_000);
  assert.equal(unknown?.sections[0].accounts[0].unknown, true);
  assert.equal(s.expense.total, 5_000);
  assert.equal(s.expense.months[2], 5_000);
});

test('연간 요약 — 구간 합은 정수 합이라 소수 오차가 없다(0.1 단위 금액 없음)', () => {
  const many: LedgerLike[] = Array.from({ length: 1000 }, (_, i) => ({ entryDate: `2026-${String((i % 12) + 1).padStart(2, '0')}-15`, direction: 'EXPENSE' as const, accountCode: '132', amount: 33_333 }));
  const s = ledgerSummary(many, 2026);
  assert.equal(s.expense.total, 33_333_000);
  assert.equal(s.expense.months.reduce((a, b) => a + b, 0), 33_333_000);
});

// ---------- 후원금 ----------

test('후원금 사용 현황 — 연결된 지출 합과 잔액', () => {
  const usage = donationUsage({ id: 9, amount: 1_000_000 }, [
    { donationId: 9, direction: 'EXPENSE', amount: 300_000 },
    { donationId: 9, direction: 'EXPENSE', amount: 200_000 },
    { donationId: 8, direction: 'EXPENSE', amount: 999 },
    { donationId: null, direction: 'EXPENSE', amount: 77 },
  ]);
  assert.equal(usage.used, 500_000);
  assert.equal(usage.remaining, 500_000);
  assert.equal(usage.overspent, false);
  assert.equal(usage.entries.length, 2);
});

test('후원금 사용 현황 — 수입 줄은 사용액이 아니다, 다 쓰면 잔액 0, 더 쓰면 음수와 overspent', () => {
  const income = donationUsage({ id: 1, amount: 100 }, [{ donationId: 1, direction: 'INCOME', amount: 50 }]);
  assert.equal(income.used, 0);
  assert.equal(income.entries.length, 0);
  const exact = donationUsage({ id: 1, amount: 100 }, [{ donationId: 1, direction: 'EXPENSE', amount: 100 }]);
  assert.equal(exact.remaining, 0);
  assert.equal(exact.overspent, false);
  const over = donationUsage({ id: 1, amount: 100 }, [{ donationId: 1, direction: 'EXPENSE', amount: 130 }]);
  assert.equal(over.remaining, -30);
  assert.equal(over.overspent, true);
});

test('후원금 사용 현황 — 연결 지출을 날짜순으로 돌려주고, 연결이 없으면 전액 잔액', () => {
  const usage = donationUsage({ id: 4, amount: 500 }, [
    { donationId: 4, direction: 'EXPENSE', amount: 10, entryDate: '2026-10-09' },
    { donationId: 4, direction: 'EXPENSE', amount: 20, entryDate: '2026-10-03' },
  ]);
  assert.deepEqual(usage.entries.map((e) => e.entryDate), ['2026-10-03', '2026-10-09']);
  const none = donationUsage({ id: 4, amount: 500 }, []);
  assert.equal(none.used, 0);
  assert.equal(none.remaining, 500);
});

test('대조 필요 목록 — 별표 버전과 네 자리 목 대체를 밝힌다', () => {
  assert.ok(LEDGER_VERIFY_NOTES.every((n) => n.includes('대조 필요') || n.includes('대조해')));
  assert.ok(LEDGER_VERIFY_NOTES.some((n) => n.includes('별표 9·10')));
});
