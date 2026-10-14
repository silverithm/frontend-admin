/**
 * 본인부담금 청구 입력 테스트 — `node --test src/lib/lab/copayBill.test.ts`
 * 왜: 수가 계산은 ltc2026.ts가 하지만, 그 결과를 서버 필드로 옮기는 이름 매핑(coveredFee→coveredTotal 등)과
 * 검증이 어긋나면 청구서가 틀린 금액으로 저장된다. 계산기와 직접 대조한다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { calcDaycareCopay, dailyFee } from '../ltc2026.ts';
import type { CopayBill } from './labTypes.ts';
import {
  MEAL_COST_LABEL,
  annualPaymentRows,
  annualPaymentTotals,
  mealCostItem,
  toCsv,
  withMealCost,
  billStatus,
  billTotals,
  buildCopayBillInput,
  cleanNonCoveredItems,
  copayNoticeText,
  elderGradeToLtc,
  isBuildError,
  remainingDue,
} from './copayBill.ts';

const base = {
  elderlyId: 7,
  billMonth: '2026-10',
  careGrade: '3' as const,
  copayClass: 'standard' as const,
  daycareUnit: 'general' as const,
  hourBand: 'h8to10' as const,
  days: 20,
  nonCoveredItems: [{ label: '식재료비', amount: 60000 }],
  previousUnpaid: 10000,
};

test('청구 입력이 ltc2026 계산기 결과와 필드별로 일치한다', () => {
  const bill = buildCopayBillInput(base);
  assert.ok(!isBuildError(bill));
  if (isBuildError(bill)) return;
  const ref = calcDaycareCopay({ grade: '3', unit: 'general', band: 'h8to10', days: 20, copayClass: 'standard' });
  assert.ok(ref);
  assert.equal(bill.dailyFee, dailyFee('3', 'general', 'h8to10'));
  assert.equal(bill.coveredTotal, ref.coveredFee);
  assert.equal(bill.copayAmount, ref.copayWithinLimit);
  assert.equal(bill.overLimitAmount, ref.overLimit);
  assert.equal(bill.days, 20);
  assert.equal(bill.previousUnpaid, 10000);
  assert.deepEqual(bill.nonCoveredItems, [{ label: '식재료비', amount: 60000 }]);
});

test('월 한도를 넘는 이용은 한도 초과분이 따로 나온다', () => {
  const bill = buildCopayBillInput({ ...base, careGrade: '5', hourBand: 'over13', days: 31 });
  assert.ok(!isBuildError(bill));
  if (isBuildError(bill)) return;
  const ref = calcDaycareCopay({ grade: '5', unit: 'general', band: 'over13', days: 31, copayClass: 'standard' });
  assert.ok(ref && ref.overLimit > 0);
  assert.equal(bill.overLimitAmount, ref.overLimit);
});

test('감경·의료급여 구분이 본인부담금에 반영된다', () => {
  const std = buildCopayBillInput(base);
  const r40 = buildCopayBillInput({ ...base, copayClass: 'reduced40' });
  const aid = buildCopayBillInput({ ...base, copayClass: 'medicalAid' });
  assert.ok(!isBuildError(std) && !isBuildError(r40) && !isBuildError(aid));
  if (isBuildError(std) || isBuildError(r40) || isBuildError(aid)) return;
  assert.ok(r40.copayAmount < std.copayAmount);
  assert.equal(aid.copayAmount, 0);
});

test('입력 검증 — 일수·월·미납·어르신', () => {
  assert.ok(isBuildError(buildCopayBillInput({ ...base, days: 40 })));
  assert.ok(isBuildError(buildCopayBillInput({ ...base, days: -1 })));
  assert.ok(isBuildError(buildCopayBillInput({ ...base, days: 3.5 })));
  assert.ok(isBuildError(buildCopayBillInput({ ...base, days: Number.NaN })));
  assert.ok(!isBuildError(buildCopayBillInput({ ...base, days: 0 })));
  assert.ok(!isBuildError(buildCopayBillInput({ ...base, days: 31 })));
  assert.ok(isBuildError(buildCopayBillInput({ ...base, billMonth: '2026-13' })));
  assert.ok(isBuildError(buildCopayBillInput({ ...base, billMonth: '2026-1' })));
  assert.ok(isBuildError(buildCopayBillInput({ ...base, previousUnpaid: -1 })));
  assert.ok(isBuildError(buildCopayBillInput({ ...base, elderlyId: 0 })));
});

test('치매전담실 1등급은 수가표에 없어 오류', () => {
  const r = buildCopayBillInput({ ...base, careGrade: '1', daycareUnit: 'dementia' });
  assert.ok(isBuildError(r));
});

test('비급여 항목 — 빈 줄은 버리고, 이름 없는 금액·음수·21개·긴 이름은 오류', () => {
  const ok = cleanNonCoveredItems([{ label: ' 간식비 ', amount: 5000 }, { label: '', amount: 0 }]);
  assert.deepEqual(ok, { items: [{ label: '간식비', amount: 5000 }] });
  assert.ok('error' in cleanNonCoveredItems([{ label: '', amount: 500 }]));
  assert.ok('error' in cleanNonCoveredItems([{ label: '식비', amount: -1 }]));
  assert.ok('error' in cleanNonCoveredItems([{ label: '식비', amount: 1.5 }]));
  assert.ok('error' in cleanNonCoveredItems(Array.from({ length: 21 }, (_, i) => ({ label: `항목${i}`, amount: 1 }))));
  assert.ok(!('error' in cleanNonCoveredItems(Array.from({ length: 20 }, (_, i) => ({ label: `항목${i}`, amount: 1 })))));
  assert.ok('error' in cleanNonCoveredItems([{ label: 'ㄱ'.repeat(41), amount: 1 }]));
  assert.ok(!('error' in cleanNonCoveredItems([{ label: 'ㄱ'.repeat(40), amount: 1 }])));
});

test('합계식 — 서버와 같은 totalDue', () => {
  const bill = buildCopayBillInput(base);
  assert.ok(!isBuildError(bill));
  if (isBuildError(bill)) return;
  const t = billTotals(bill);
  assert.equal(t.nonCoveredAmount, 60000);
  assert.equal(t.totalDue, bill.copayAmount + bill.overLimitAmount + 60000 + 10000);
});

test('납부 상태 규칙', () => {
  assert.equal(billStatus(0, 0), 'PAID');
  assert.equal(billStatus(1000, 0), 'UNPAID');
  assert.equal(billStatus(1000, 1), 'PARTIAL');
  assert.equal(billStatus(1000, 1000), 'PAID');
  assert.equal(billStatus(1000, 1500), 'PAID');
  assert.equal(remainingDue({ totalDue: 1000, paidAmount: 400 }), 600);
  assert.equal(remainingDue({ totalDue: 1000, paidAmount: 1500 }), 0);
});

test('등급 변환 — 어르신 프로필 → 수가표', () => {
  assert.equal(elderGradeToLtc('GRADE_1'), '1');
  assert.equal(elderGradeToLtc('GRADE_3'), '3');
  assert.equal(elderGradeToLtc('GRADE_5'), '5');
  assert.equal(elderGradeToLtc('COGNITIVE_SUPPORT'), 'cognitive');
  assert.equal(elderGradeToLtc('NONE'), null);
  assert.equal(elderGradeToLtc(null), null);
  assert.equal(elderGradeToLtc(undefined), null);
  assert.equal(elderGradeToLtc('toString'), null);
  assert.equal(elderGradeToLtc('GRADE_9'), null);
});

const sampleBill: CopayBill = {
  id: 1,
  elderlyId: 7,
  elderlyName: '홍순자',
  billMonth: '2026-10',
  careGrade: '3',
  copayClass: 'standard',
  daycareUnit: 'general',
  hourBand: 'h8to10',
  days: 20,
  dailyFee: 60000,
  coveredTotal: 1200000,
  copayAmount: 123000,
  overLimitAmount: 0,
  nonCoveredItems: [{ label: '식재료비', amount: 60000 }],
  nonCoveredAmount: 60000,
  previousUnpaid: 10000,
  totalDue: 193000,
  paidAmount: 0,
  lastPaidOn: null,
  payerName: null,
  status: 'UNPAID',
};

test('안내 문자 — 금액 콤마, 계좌 자리, 비급여·미납 줄', () => {
  const text = copayNoticeText(sampleBill, '숲속센터');
  assert.match(text, /^\[숲속센터\] 2026년 10월 장기요양 본인부담금 안내/);
  assert.match(text, /본인부담금: 123,000원/);
  assert.match(text, /식재료비\(비급여\): 60,000원/);
  assert.match(text, /이전 미납금: 10,000원/);
  assert.match(text, /납부하실 금액: 193,000원/);
  assert.match(text, /\[계좌\]/);
  assert.doesNotMatch(text, /한도 초과/);
});

test('안내 문자 — 일부 납부는 남은 금액, 완납은 감사 문구, 기관명 비면 센터', () => {
  const partial = copayNoticeText({ ...sampleBill, paidAmount: 100000, status: 'PARTIAL' }, '');
  assert.match(partial, /^\[센터\]/);
  assert.match(partial, /이미 낸 금액: 100,000원/);
  assert.match(partial, /납부하실 금액: 93,000원/);
  const paid = copayNoticeText({ ...sampleBill, paidAmount: 193000, status: 'PAID' }, '숲속센터');
  assert.match(paid, /납부가 모두 확인/);
  assert.doesNotMatch(paid, /\[계좌\]/);
  const over = copayNoticeText({ ...sampleBill, overLimitAmount: 5000, totalDue: 198000 }, '숲속센터');
  assert.match(over, /월 한도 초과분: 5,000원/);
});

// ---------- 식재료비 ----------

test('식재료비 — 이용일수 × 단가, 단가 0·이용일 0·정수 아님·한도 초과는 항목을 만들지 않는다', () => {
  assert.deepEqual(mealCostItem(18, 4500), { label: '식재료비', amount: 81000 });
  assert.equal(MEAL_COST_LABEL, '식재료비');
  assert.deepEqual(mealCostItem(31, 5000), { label: '식재료비', amount: 155000 });
  assert.equal(mealCostItem(18, 0), null);
  assert.equal(mealCostItem(0, 4500), null);
  assert.equal(mealCostItem(-1, 4500), null);
  assert.equal(mealCostItem(18.5, 4500), null);
  assert.equal(mealCostItem(18, 4500.5), null);
  assert.equal(mealCostItem(Number.NaN, 4500), null);
  assert.equal(mealCostItem(31, 4_000_000), null, '1억 원 한도 초과');
});

test('withMealCost — 없으면 맨 앞에 넣고, 있으면 그 자리만 새 금액으로, 단가 0이면 식재료비 줄만 뺀다', () => {
  const extra = { label: '프로그램 재료비', amount: 3000 };
  assert.deepEqual(withMealCost([extra], 10, 4500), [{ label: '식재료비', amount: 45000 }, extra]);
  assert.deepEqual(withMealCost([extra, { label: '식재료비', amount: 1 }, { label: '간식', amount: 500 }], 10, 4500), [extra, { label: '식재료비', amount: 45000 }, { label: '간식', amount: 500 }]);
  assert.deepEqual(withMealCost([extra, { label: '식재료비', amount: 1 }], 10, 0), [extra]);
  assert.deepEqual(withMealCost([{ label: '식재료비', amount: 1 }, { label: ' 식재료비 ', amount: 2 }], 2, 1000), [{ label: '식재료비', amount: 2000 }], '중복 식재료비 줄은 하나로');
  assert.deepEqual(withMealCost([], 0, 4500), []);
});

// ---------- 연간 납부 내역 ----------

const bill = (id: number, elderlyName: string, billMonth: string, paidAmount: number, lastPaidOn: string | null) => ({ id, elderlyName, billMonth, paidAmount, lastPaidOn });

test('연간 납부 내역 — 그 해 청구월에 수납이 있는 것만, 다른 해·0원·미수납은 제외, 이름·월 순', () => {
  const rows = annualPaymentRows(
    [
      bill(1, '가', '2026-03', 100000, '2026-04-05'),
      bill(2, '가', '2026-04', 0, null),
      bill(3, '나', '2025-12', 50000, '2026-01-03'),
      bill(4, '나', '2026-12', 70000, '2027-01-04'),
      bill(5, '가', '2026-01', 30000, '2026-02-02'),
      bill(6, '다', '2026-02', 20000, null),
    ],
    2026,
  );
  assert.deepEqual(rows.map((r) => [r.elderlyName, r.billMonth, r.paidAmount]), [['가', '2026-01', 30000], ['가', '2026-03', 100000], ['나', '2026-12', 70000], ['다', '2026-02', 20000]]);
  assert.equal(rows[3].lastPaidOn, null);
  assert.equal(rows[0].billId, 5);
});

test('연간 납부 내역 — 형식이 틀린 월·빈 목록은 안전하게', () => {
  assert.deepEqual(annualPaymentRows([], 2026), []);
  assert.deepEqual(annualPaymentRows([bill(1, '가', '2026-13', 1000, null), bill(2, '가', '2026', 1000, null)], 2026), []);
});

test('어르신별 연간 납부 합계', () => {
  assert.deepEqual(
    annualPaymentTotals([{ elderlyName: '나', paidAmount: 10 }, { elderlyName: '가', paidAmount: 20 }, { elderlyName: '나', paidAmount: 5 }]),
    [{ elderlyName: '가', paidAmount: 20 }, { elderlyName: '나', paidAmount: 15 }],
  );
});

// ---------- CSV ----------

test('toCsv — BOM으로 시작, 머리글 다음 줄에 값, 줄바꿈은 CRLF', () => {
  const csv = toCsv([{ a: '홍길동', b: 1000 }, { a: '김', b: 0 }], [{ key: 'a', label: '이름' }, { key: 'b', label: '금액' }]);
  assert.equal(csv, '\uFEFF이름,금액\r\n홍길동,1000\r\n김,0');
});

test('toCsv — 쉼표·따옴표·줄바꿈이 든 글은 큰따옴표로 감싸고 따옴표는 두 번', () => {
  const csv = toCsv(
    [{ a: '홍,길동', b: '그가 "안녕" 이라고 함', c: '첫줄\n둘째줄', d: '평범' }],
    [{ key: 'a', label: 'a' }, { key: 'b', label: 'b' }, { key: 'c', label: 'c' }, { key: 'd', label: 'd' }],
  );
  assert.ok(csv.includes('"홍,길동"'));
  assert.ok(csv.includes('"그가 ""안녕"" 이라고 함"'));
  assert.ok(csv.includes('"첫줄\n둘째줄"'));
  assert.ok(csv.endsWith(',평범'));
});

test('toCsv — 숫자는 그대로(따옴표·콤마 없음), 빈 값은 빈 칸, 머리글의 쉼표도 감싼다', () => {
  const csv = toCsv([{ amount: 1234567, none: null, undef: undefined, nan: Number.NaN, neg: -500 }], [
    { key: 'amount', label: '금액,원' },
    { key: 'none', label: 'n' },
    { key: 'undef', label: 'u' },
    { key: 'nan', label: 'x' },
    { key: 'neg', label: 'neg' },
  ]);
  assert.equal(csv, '\uFEFF"금액,원",n,u,x,neg\r\n1234567,,,,-500');
});

test('toCsv — 수식으로 읽힐 문자열(=,+,-,@)은 앞에 작은따옴표를 붙여 엑셀 수식 주입을 막는다', () => {
  const csv = toCsv([{ a: '=HYPERLINK("http://x")', b: '+1', c: '-큰', d: '@sum', e: '정상' }], (['a', 'b', 'c', 'd', 'e'] as const).map((k) => ({ key: k, label: k })));
  assert.ok(csv.includes('"\'=HYPERLINK(""http://x"")"'));
  assert.ok(csv.includes(",\'+1,"));
  assert.ok(csv.includes(",\'-큰,"));
  assert.ok(csv.includes(",\'@sum,"));
  assert.ok(csv.endsWith(',정상'));
});

test('toCsv — 행이 없으면 머리글만', () => {
  assert.equal(toCsv([], [{ key: 'a', label: '이름' }]), '\uFEFF이름');
});
