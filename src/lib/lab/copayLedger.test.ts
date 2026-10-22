/**
 * 월 청구대장·수납대장 계산 테스트 — `node --test src/lib/lab/copayLedger.test.ts`
 * 왜: 대장의 합계가 한 줄이라도 어긋나면 월말 정산에서 돈이 맞지 않는다. 손으로 센 합계와 맞춘다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { copayLedger, inconsistentRows, receiptLedger } from './copayLedger.ts';
import { buildCopayBillInput } from './copayBill.ts';
import type { CopayBill } from './labTypes.ts';

/** 실제 계산 함수로 청구 입력을 만들고 서버 규칙대로 totalDue를 더해 저장된 청구서 모양으로 */
function bill(id: number, name: string, o: { grade: '1' | '2' | '3' | '4' | '5' | 'cognitive'; days: number; previousUnpaid?: number; meal?: number; paid?: number; lastPaidOn?: string | null }): CopayBill {
  const built = buildCopayBillInput({
    elderlyId: id,
    billMonth: '2026-10',
    careGrade: o.grade,
    copayClass: 'standard',
    daycareUnit: 'general',
    hourBand: 'h8to10',
    days: o.days,
    nonCoveredItems: o.meal ? [{ label: '식재료비', amount: o.meal }] : [],
    previousUnpaid: o.previousUnpaid ?? 0,
  });
  assert.ok(!('error' in built), 'error' in built ? built.error : '');
  const nonCovered = built.nonCoveredItems.reduce((s, i) => s + i.amount, 0);
  const totalDue = built.copayAmount + built.overLimitAmount + nonCovered + built.previousUnpaid;
  const paid = o.paid ?? 0;
  return {
    id,
    elderlyId: id,
    elderlyName: name,
    billMonth: built.billMonth,
    careGrade: built.careGrade,
    copayClass: built.copayClass,
    daycareUnit: built.daycareUnit,
    hourBand: built.hourBand,
    days: built.days,
    dailyFee: built.dailyFee,
    coveredTotal: built.coveredTotal,
    copayAmount: built.copayAmount,
    overLimitAmount: built.overLimitAmount,
    nonCoveredItems: built.nonCoveredItems,
    nonCoveredAmount: nonCovered,
    previousUnpaid: built.previousUnpaid,
    totalDue,
    paidAmount: paid,
    lastPaidOn: o.lastPaidOn ?? null,
    payerName: paid > 0 ? '보호자' : null,
    status: paid <= 0 ? 'UNPAID' : paid >= totalDue ? 'PAID' : 'PARTIAL',
  };
}

test('손으로 센 값 — 3등급 8~10시간 15일: 급여비용 894,600원, 본인부담 134,190원', () => {
  // 59,640 × 15 = 894,600 (3등급 월 한도 1,528,200 + 20% 추가 산정 안이라 한도 초과 없음), 15% = 134,190
  const b = bill(1, '김말순', { grade: '3', days: 15, meal: 52500 });
  const { rows, totals } = copayLedger([b]);
  assert.equal(rows[0].totalFee, 894600);
  assert.equal(rows[0].copay, 134190);
  assert.equal(rows[0].insurerShare, 760410);
  assert.equal(rows[0].overLimit, 0);
  assert.equal(rows[0].nonCovered, 52500);
  assert.equal(rows[0].totalDue, 186690);
  assert.equal(totals.totalDue, 186690);
});

test('여러 줄 합계는 줄의 정수 합이고 공단부담+본인부담=급여비용 총액(한도 안)', () => {
  const bills = [
    bill(1, '박봉례', { grade: '5', days: 20, meal: 70000, previousUnpaid: 12000, paid: 100000, lastPaidOn: '2026-10-20' }),
    bill(2, '김말순', { grade: '3', days: 15, paid: 134190, lastPaidOn: '2026-10-05' }),
    bill(3, '이순남', { grade: '1', days: 26 }), // 1등급 월 한도 초과 가능
  ];
  const { rows, totals } = copayLedger(bills);
  assert.deepEqual(rows.map((r) => r.elderlyName), ['김말순', '박봉례', '이순남']); // 가나다 순
  for (const r of rows) {
    assert.equal(Number.isInteger(r.totalDue) && Number.isInteger(r.remaining), true);
    assert.equal(r.copay + r.overLimit + r.nonCovered + r.previousUnpaid, r.totalDue);
    assert.equal(r.insurerShare + r.copay + r.overLimit, r.totalFee);
  }
  const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((s, r) => s + f(r), 0);
  assert.equal(totals.totalDue, sum((r) => r.totalDue));
  assert.equal(totals.paid, 234190);
  assert.equal(totals.remaining, totals.totalDue - Math.min(totals.paid, totals.totalDue)); // 초과 수납 없음
  assert.equal(totals.count, 3);
  assert.equal(totals.unpaidCount, 2); // 박봉례(일부)·이순남(미납)
  assert.deepEqual(inconsistentRows(rows), []);
});

test('수납대장은 돈을 받은 청구서만, 수납일순으로', () => {
  const r = receiptLedger([
    bill(1, '박봉례', { grade: '5', days: 20, paid: 100000, lastPaidOn: '2026-10-20' }),
    bill(2, '김말순', { grade: '3', days: 15, paid: 134190, lastPaidOn: '2026-10-05' }),
    bill(3, '이순남', { grade: '1', days: 26 }),
  ]);
  assert.deepEqual(r.rows.map((x) => x.elderlyName), ['김말순', '박봉례']);
  assert.equal(r.total, 234190);
});

test('합계가 어긋난 줄을 알려 준다(대조용)', () => {
  const b = bill(1, '김말순', { grade: '3', days: 15 });
  const broken = { ...b, totalDue: b.totalDue + 10 };
  assert.deepEqual(inconsistentRows(copayLedger([broken]).rows).map((r) => r.billId), [1]);
});

test('청구서가 없으면 모두 0', () => {
  const { rows, totals } = copayLedger([]);
  assert.equal(rows.length, 0);
  assert.equal(totals.totalDue, 0);
  assert.equal(totals.unpaidCount, 0);
  console.log('copay-ledger verified');
});
