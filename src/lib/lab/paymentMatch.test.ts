/**
 * 입금 내역 파싱·청구서 매칭 테스트 — `node --test src/lib/lab/paymentMatch.test.ts`
 * 왜: 은행 엑셀의 출금·잔액 열을 입금으로 읽으면 없는 수납이 생긴다. 실제 은행 모양을 흉내 낸 붙여넣기로 고정한다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { matchDeposits, nameRelation, normalizePersonName, parseBankText } from './paymentMatch.ts';
import type { MatchableBill } from './paymentMatch.ts';

const TODAY = new Date('2026-10-14T09:00:00+09:00');
const parse = (text: string) => parseBankText(text, TODAY);
const brief = (text: string) => parse(text).map((d) => [d.date, d.name, d.amount]);

test('계약 예시 3줄 — 탭 / 줄글 / 쉼표', () => {
  const deps = parse('2026-10-05\t홍길동\t123,000\n10/06 입금 김영희 98000원\n2026.10.07, 이철수, 45,500');
  assert.deepEqual(brief('2026-10-05\t홍길동\t123,000\n10/06 입금 김영희 98000원\n2026.10.07, 이철수, 45,500'), [
    ['2026-10-05', '홍길동', 123000],
    ['2026-10-06', '김영희', 98000],
    ['2026-10-07', '이철수', 45500],
  ]);
  assert.equal(deps[1].raw, '10/06 입금 김영희 98000원');
});

test('입금·출금·잔액 열이 있는 은행 엑셀(머리글 포함) — 출금 줄은 버리고 입금만', () => {
  const text = [
    '거래일시\t적요\t출금액\t입금액\t잔액\t내용',
    '2026.10.05 14:22:11\t전자금융\t\t123,000\t1,523,000\t홍길동',
    '2026.10.05 15:00:00\tCD출금\t50,000\t\t1,473,000\t',
    '2026.10.06 09:10:00\t타행이체\t\t98,000\t1,571,000\t김영희',
  ].join('\n');
  assert.deepEqual(brief(text), [
    ['2026-10-05', '홍길동', 123000],
    ['2026-10-06', '김영희', 98000],
  ]);
});

test('머리글에서 입금 열이 출금 열보다 앞이면 그 순서를 따른다', () => {
  const text = ['거래일자\t입금액\t출금액\t잔액\t거래내용', '2026-10-05\t123,000\t\t1,523,000\t홍길동', '2026-10-06\t\t7,000\t1,516,000\t편의점'].join('\n');
  assert.deepEqual(brief(text), [['2026-10-05', '홍길동', 123000]]);
});

test('머리글 없는 탭 표 — 끝에서부터 [출금, 입금, 잔액] 관례, 빈 칸 위치로 출금을 거른다', () => {
  const text = ['2026.10.05\t홍길동\t\t123,000\t1,523,000', '2026.10.06\t편의점\t5,000\t\t1,518,000', '2026.10.07\t김영희\t0\t98,000\t1,616,000'].join('\n');
  assert.deepEqual(brief(text), [
    ['2026-10-05', '홍길동', 123000],
    ['2026-10-07', '김영희', 98000],
  ]);
});

test('카카오뱅크식 — 구분 열과 거래금액 열', () => {
  const text = [
    '거래일시\t구분\t거래금액\t거래 후 잔액\t거래구분\t내용\t메모',
    '2026.10.05 14:22:11\t입금\t123,000\t1,523,000\t일반\t홍길동\t',
    '2026.10.05 18:00:00\t출금\t12,000\t1,511,000\t체크카드\t편의점\t',
  ].join('\n');
  assert.deepEqual(brief(text), [['2026-10-05', '홍길동', 123000]]);
});

test('줄글: 출금 낱말·음수 부호·0원은 입금이 아니다', () => {
  assert.deepEqual(brief('10/06 출금 편의점 5,000원'), []);
  assert.deepEqual(brief('2026-10-05 홍길동 -5,000'), []);
  assert.deepEqual(brief('2026-10-05 홍길동 0'), []);
  assert.deepEqual(brief('2026-10-05 홍길동 +5,000'), [['2026-10-05', '홍길동', 5000]]);
});

test('줄글에 잔액이 붙어 있으면 앞의 금액만 입금, 순번 숫자에 속지 않는다', () => {
  assert.deepEqual(brief('1 2026-10-05 홍길동 123,000 1,523,000'), [['2026-10-05', '홍길동', 123000]]);
  assert.deepEqual(brief('2026-10-05 홍길동 0 123,000 1,523,000'), [['2026-10-05', '홍길동', 123000]]);
  assert.deepEqual(brief('2026-10-05 편의점 5,000 0 1,518,000'), []);
});

test('금액 표기 — 콤마·원·₩·붙은 쉼표 구분(CSV)', () => {
  assert.equal(parse('2026-10-05 홍길동 123000원')[0].amount, 123000);
  assert.equal(parse('2026-10-05 홍길동 ₩123,000')[0].amount, 123000);
  assert.deepEqual(brief('2026-10-07,이철수,45500'), [['2026-10-07', '이철수', 45500]]);
  assert.deepEqual(brief('홍길동,123,000'), [[null, '홍길동', 123000]]);
  assert.deepEqual(brief('"2026-10-05","홍길동","123,000"'), [['2026-10-05', '홍길동', 123000]]);
});

test('날짜 표기 — YYYY.MM.DD, YY.MM.DD, MM/DD, 한글 날짜, 시각 붙은 형태', () => {
  assert.equal(parse('2026.10.07 홍길동 1000')[0].date, '2026-10-07');
  assert.equal(parse('26.10.07 홍길동 1000')[0].date, '2026-10-07');
  assert.equal(parse('10/06 홍길동 1000')[0].date, '2026-10-06');
  assert.equal(parse('10월 6일 홍길동 1000')[0].date, '2026-10-06');
  assert.equal(parse('2026년 10월 6일 홍길동 1000')[0].date, '2026-10-06');
  assert.equal(parse('2026-10-05 14:22:11 홍길동 1000')[0].date, '2026-10-05');
  assert.equal(parse('2026-02-30 홍길동 1000')[0].date, null);
});

test('연도 없는 날짜는 한 해 앞서면 작년으로 본다', () => {
  const january = new Date('2027-01-05T09:00:00+09:00');
  assert.equal(parseBankText('12/28 홍길동 1000', january)[0].date, '2026-12-28');
  assert.equal(parseBankText('01/03 홍길동 1000', january)[0].date, '2027-01-03');
});

test('합계 줄·계좌번호 줄·빈 줄·읽을 수 없는 줄은 건너뛴다', () => {
  const text = ['계좌번호 110-123-456789', '', '합계 168,000', '2026-10-05 홍길동 123,000', '안내 문구입니다', '110-123-456789'].join('\n');
  assert.deepEqual(brief(text), [['2026-10-05', '홍길동', 123000]]);
  assert.deepEqual(parse(''), []);
  assert.deepEqual(parse('   \n\n'), []);
});

test('1억원을 넘는 숫자(전화번호·계좌)는 금액이 아니다', () => {
  assert.deepEqual(brief('2026-10-05 홍길동 01012345678'), []);
});

test('윈도 줄바꿈·BOM·전각 공백', () => {
  assert.deepEqual(brief('﻿2026-10-05\t홍길동\t123,000\r\n2026-10-06\t김영희\t98,000\r\n'), [
    ['2026-10-05', '홍길동', 123000],
    ['2026-10-06', '김영희', 98000],
  ]);
  assert.equal(parse('2026-10-05　홍길동　123,000')[0].amount, 123000);
});

test('입금자명에서 거래 문구·계좌 모양을 뺀다', () => {
  assert.equal(parse('2026-10-05 전자금융 입금 홍길동 110-12-3456 123,000')[0].name, '홍길동');
  assert.equal(parse('10/06 타행이체 김영희 98,000')[0].name, '김영희');
});


test('머리글이 있으면 끝쪽 빈 칸이 잘려 나온 줄도 열 위치로 읽는다 (잔액을 입금으로 읽지 않는다)', () => {
  const text = [
    '거래일자\t거래시간\t적요\t출금\t입금\t내용\t잔액\t거래점',
    '2026-10-05\t14:22:11\t전자금융\t\t123,000\t홍길동\t1,523,000',
    '2026-10-05\t15:00:00\tCD출금\t50,000\t\t\t1,473,000\t강남',
  ].join('\n');
  assert.deepEqual(brief(text), [['2026-10-05', '홍길동', 123000]]);
});

test('앞쪽 칸이 비어 있는 탭 줄도 열 위치를 유지한다', () => {
  assert.deepEqual(brief('\t\t홍길동\t\t123,000\t1,523,000'), [[null, '홍길동', 123000]]);
});

test('머리글에 입금·출금 열이 둘 다 있는데 줄글로 붙여 넣으면 방향을 알 수 없는 줄은 건너뛴다', () => {
  const header = '거래일자 적요 출금액 입금액 잔액';
  assert.deepEqual(brief(`${header}\n2026-10-05 편의점 5,000 1,518,000`), []);
  assert.deepEqual(brief(`${header}\n2026-10-05 입금 홍길동 123,000 1,523,000`), [['2026-10-05', '홍길동', 123000]]);
  assert.deepEqual(brief(`${header}\n2026-10-05 홍길동 0 123,000 1,523,000`), [['2026-10-05', '홍길동', 123000]]);
});

test('입력 상한 — 너무 긴 줄은 건너뛰고 5000줄까지만 읽는다', () => {
  assert.deepEqual(brief(`2026-10-05 ${'가'.repeat(600)} 1000`), []);
  const many = Array.from({ length: 5200 }, () => '2026-10-05 홍길동 1000').join('\n');
  assert.equal(parse(many).length, 5000);
});

// ---------- 매칭 ----------

const bills: MatchableBill[] = [
  { id: 1, elderlyName: '홍순자', payerName: '홍길동', totalDue: 123000, paidAmount: 0, status: 'UNPAID' },
  { id: 2, elderlyName: '김말순', payerName: null, totalDue: 98000, paidAmount: 0, status: 'UNPAID' },
];

test('계약 예시 — 이름+금액은 HIGH, 금액만 맞으면 MEDIUM, 금액 없는 입금은 매칭 없음', () => {
  const deps = parse('2026-10-05\t홍길동\t123,000\n10/06 입금 김영희 98000원\n2026.10.07, 이철수, 45,500');
  const matches = matchDeposits(deps, bills);
  assert.deepEqual(matches.map((m) => [m.depositIndex, m.billId, m.confidence]), [
    [0, 1, 'HIGH'],
    [1, 2, 'MEDIUM'],
  ]);
  assert.ok(matches.every((m) => m.reason.length > 0));
});

test('어르신 본인 이름으로 입금해도 HIGH', () => {
  const m = matchDeposits([{ name: '김말순', amount: 98000 }], bills);
  assert.equal(m[0].confidence, 'HIGH');
  assert.equal(m[0].billId, 2);
});

test('남은 금액 기준 — 일부 납부된 청구서는 남은 금액과 맞춘다', () => {
  const partial: MatchableBill[] = [{ id: 9, elderlyName: '홍순자', payerName: '홍길동', totalDue: 123000, paidAmount: 100000, status: 'PARTIAL' }];
  const m = matchDeposits([{ name: '홍길동', amount: 23000 }], partial);
  assert.equal(m[0].confidence, 'HIGH');
  assert.equal(matchDeposits([{ name: '홍길동', amount: 123000 }], partial)[0].confidence, 'LOW');
});

test('이미 완납(PAID)이거나 남은 금액 0인 청구서는 대상에서 뺀다', () => {
  const done: MatchableBill[] = [{ ...bills[0], status: 'PAID', paidAmount: 123000 }, { ...bills[1], totalDue: 0 }];
  assert.deepEqual(matchDeposits([{ name: '홍길동', amount: 123000 }], done), []);
});

test('이름만 같고 금액이 다르면 LOW(분할·초과 납부 후보)', () => {
  const less = matchDeposits([{ name: '홍길동', amount: 50000 }], bills);
  assert.deepEqual(less.map((m) => [m.billId, m.confidence]), [[1, 'LOW']]);
  assert.match(less[0].reason, /적습니다/);
  const more = matchDeposits([{ name: '홍길동', amount: 200000 }], bills);
  assert.match(more[0].reason, /많습니다/);
});

test('같은 금액 청구서가 여러 건이면 이름으로 구분하고, 이름도 없으면 LOW', () => {
  const same: MatchableBill[] = [
    { id: 1, elderlyName: '홍순자', payerName: '홍길동', totalDue: 100000, paidAmount: 0, status: 'UNPAID' },
    { id: 2, elderlyName: '김말순', payerName: '김영희', totalDue: 100000, paidAmount: 0, status: 'UNPAID' },
  ];
  assert.deepEqual(matchDeposits([{ name: '김영희', amount: 100000 }], same).map((m) => [m.billId, m.confidence]), [[2, 'HIGH']]);
  const unknown = matchDeposits([{ name: '이철수', amount: 100000 }], same);
  assert.equal(unknown[0].confidence, 'LOW');
  assert.match(unknown[0].reason, /2건/);
});

test('한 청구서는 한 번만 짝 — 같은 입금을 두 번 붙여 넣어도 이중 수납을 제안하지 않는다', () => {
  const m = matchDeposits([{ name: '홍길동', amount: 123000 }, { name: '홍길동', amount: 123000 }], bills);
  assert.equal(m.filter((x) => x.billId === 1).length, 1);
  assert.equal(m[0].depositIndex, 0);
});

test('입금 하나에는 청구서 하나만, 한 쪽이 이름으로 더 맞으면 그쪽이 이긴다', () => {
  const rows: MatchableBill[] = [
    { id: 1, elderlyName: '박철수', payerName: null, totalDue: 90000, paidAmount: 0, status: 'UNPAID' },
    { id: 2, elderlyName: '김말순', payerName: '김영희', totalDue: 90000, paidAmount: 0, status: 'UNPAID' },
  ];
  const m = matchDeposits([{ name: '김영희', amount: 90000 }], rows);
  assert.equal(m.length, 1);
  assert.equal(m[0].billId, 2);
});

test('0원·소수·음수 입금은 매칭하지 않는다', () => {
  assert.deepEqual(matchDeposits([{ name: '홍길동', amount: 0 }, { name: '홍길동', amount: -5 }, { name: '홍길동', amount: 1.5 }], bills), []);
  assert.deepEqual(matchDeposits([], bills), []);
  assert.deepEqual(matchDeposits([{ name: '홍길동', amount: 123000 }], []), []);
});

test('이름 비교 — 괄호·접두어·한 글자 차이·두 글자 이름', () => {
  assert.equal(normalizePersonName('홍길동(국민)'), '홍길동');
  assert.equal(normalizePersonName(' 홍 길동1 '), '홍길동');
  assert.equal(nameRelation('홍길동', '홍길동'), 'exact');
  assert.equal(nameRelation('타행홍길동', '홍길동'), 'contains');
  assert.equal(nameRelation('홍길순', '홍길동'), 'close');
  assert.equal(nameRelation('이철수', '홍길동'), null);
  assert.equal(nameRelation('김수현', '김수'), null);
  assert.equal(nameRelation('김수', '김수'), 'exact');
  assert.equal(nameRelation('', '홍길동'), null);
  assert.equal(nameRelation('홍길동', null), null);
});
