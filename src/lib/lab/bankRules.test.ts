/**
 * 통장 대사 규칙 테스트 — `node --test src/lib/lab/bankRules.test.ts`
 * 왜: 출금을 입금으로 읽거나 1원 차이를 놓치면 장부가 통장과 어긋난 채 평가·결산 증빙이 된다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { donationAccountCheck, matchStatement, parseStatementText, reconcileMonth, type BookEntry } from './bankRules.ts';

const E = (id: number, entryDate: string, direction: BookEntry['direction'], amount: number, donationId: number | null = null): BookEntry => ({ id, entryDate, direction, amount, donationId });

test('거래 읽기: 탭 다섯 칸은 칸 자리로 입금 +, 출금 −', () => {
  const text = '거래일자\t적요\t입금\t출금\t잔액\n2026-10-01\t본인부담금 입금\t263,760\t\t1,263,760\n2026-10-05\t한국전력\t\t312,000\t951,760';
  const lines = parseStatementText(text, 2026);
  assert.deepEqual(lines.map((l) => [l.date, l.description, l.amount, l.balance]), [
    ['2026-10-01', '본인부담금 입금', 263760, 1263760],
    ['2026-10-05', '한국전력', -312000, 951760],
  ]);
});

test('거래 읽기: 줄글은 첫 금액이 거래액, 둘째가 잔액, 음수 부호는 출금', () => {
  const lines = parseStatementText('10/07 주유 -70,000\n2026.10.08 이자 1,200 952,960\n10-09 출금 관리비 5,000원', 2026);
  assert.deepEqual(lines.map((l) => [l.date, l.amount, l.balance]), [
    ['2026-10-07', -70000, null],
    ['2026-10-08', 1200, 952960],
    ['2026-10-09', -5000, null],
  ]);
  assert.equal(lines[1].description, '이자');
});

test('거래 읽기: 연도 없는 날짜는 인자 연도, 연도가 적힌 날짜는 그대로', () => {
  const lines = parseStatementText('12/31 연말 1,000\n2025/12/30 작년 2,000', 2026);
  assert.deepEqual(lines.map((l) => l.date), ['2026-12-31', '2025-12-30']);
});

test('거래 읽기: 날짜가 맨 앞이 아닌 줄·없는 날짜·합계 줄·머리글은 건너뛴다', () => {
  const text = '조회기간 2026-10-01 ~ 2026-10-31\n합계 1,000\n메모 10/01 1,000\n2026-02-30 없는날 1,000\n13/01 달이없음 1,000\n10/02 정상 3,000';
  const lines = parseStatementText(text, 2026);
  assert.deepEqual(lines.map((l) => [l.date, l.amount]), [['2026-10-02', 3000]]);
});

test('거래 읽기: 윤년 2월 29일은 윤년에만 읽힌다', () => {
  assert.equal(parseStatementText('02/29 윤일 1,000', 2028).length, 1);
  assert.equal(parseStatementText('02/29 윤일 1,000', 2027).length, 0);
});

test('거래 읽기: 탭 표에서 입금·출금이 둘 다 있거나 둘 다 없는 줄은 읽지 않는다', () => {
  const text = '2026-10-01\t이상\t1,000\t2,000\t5,000\n2026-10-02\t빈줄\t\t\t5,000\n2026-10-03\t영원\t0\t\t5,000\n2026-10-04\t정상\t\t4,000\t1,000';
  assert.deepEqual(parseStatementText(text, 2026).map((l) => l.amount), [-4000]);
});

test('거래 읽기: 출금 칸에 부호가 붙어 있어도 출금이고, 잔액이 음수여도 읽는다', () => {
  const lines = parseStatementText('2026-10-04\t대출이자\t\t-4,000\t-1,000\n2026-10-05\t시각\t14:03:22\t', 2026);
  assert.deepEqual(lines.map((l) => [l.amount, l.balance]), [[-4000, -1000]]);
});

test('거래 읽기: 날짜 뒤 시각 칸은 버리고 칸을 읽는다', () => {
  const lines = parseStatementText('2026-10-01\t14:03:22\t입금자 홍길동\t50,000\t\t100,000', 2026);
  assert.deepEqual(lines.map((l) => [l.description, l.amount, l.balance]), [['입금자 홍길동', 50000, 100000]]);
});

test('거래 읽기: 0원·금액 없는 줄·계좌번호 같은 긴 숫자는 거래가 아니다', () => {
  assert.equal(parseStatementText('10/01 수수료면제 0', 2026).length, 0);
  assert.equal(parseStatementText('10/01 안내문구', 2026).length, 0);
  assert.equal(parseStatementText('10/01 계좌 123456789012345678', 2026).length, 0);
});

test('거래 읽기: 윈도 줄바꿈·BOM·따옴표가 섞여도 읽는다', () => {
  const lines = parseStatementText('﻿"2026-10-01"\t"입금"\t"1,000"\t""\t"2,000"\r\n', 2026);
  assert.deepEqual(lines.map((l) => [l.date, l.amount, l.balance]), [['2026-10-01', 1000, 2000]]);
});

const lines = parseStatementText('2026-10-01\t본인부담금 입금\t263,760\t\t1,263,760\n2026-10-05\t한국전력\t\t312,000\t951,760\n10/07 주유 -70,000', 2026);
const ents = [E(1, '2026-10-01', 'INCOME', 263760), E(2, '2026-10-06', 'EXPENSE', 312000), E(3, '2026-10-20', 'EXPENSE', 45000)];

test('매칭: 금액·부호·날짜 허용 안이면 짝, 나머지는 따로', () => {
  assert.deepEqual(matchStatement(lines, ents), { matched: [{ lineIndex: 0, entryId: 1 }, { lineIndex: 1, entryId: 2 }], unmatchedLines: [2], unmatchedEntries: [3] });
});

test('매칭: 날짜 차이 허용(2일) 경계 — 2일은 되고 3일은 안 된다', () => {
  const l = [{ date: '2026-10-10', amount: -1000 }];
  assert.equal(matchStatement(l, [E(1, '2026-10-12', 'EXPENSE', 1000)]).matched.length, 1);
  assert.equal(matchStatement(l, [E(1, '2026-10-13', 'EXPENSE', 1000)]).matched.length, 0);
  assert.equal(matchStatement(l, [E(1, '2026-10-13', 'EXPENSE', 1000)], 3).matched.length, 1);
  assert.equal(matchStatement(l, [E(1, '2026-10-11', 'EXPENSE', 1000)], 0).matched.length, 0);
});

test('매칭: 월 경계·윤년을 넘어도 일수로 센다', () => {
  assert.equal(matchStatement([{ date: '2028-03-01', amount: 500 }], [E(1, '2028-02-27', 'INCOME', 500)]).matched.length, 0); // 윤년: 2/29가 끼어 3일 차이
  assert.equal(matchStatement([{ date: '2028-03-01', amount: 500 }], [E(1, '2028-02-28', 'INCOME', 500)]).matched.length, 1); // 윤년: 2일 차이
  assert.equal(matchStatement([{ date: '2027-03-01', amount: 500 }], [E(1, '2027-02-27', 'INCOME', 500)]).matched.length, 1); // 평년: 2일 차이
  assert.equal(matchStatement([{ date: '2027-03-01', amount: 500 }], [E(1, '2027-02-26', 'INCOME', 500)]).matched.length, 0); // 평년: 3일 차이
});

test('매칭: 1원 차이와 부호가 다르면 짝이 아니다', () => {
  assert.equal(matchStatement([{ date: '2026-10-01', amount: 1000 }], [E(1, '2026-10-01', 'INCOME', 1001)]).matched.length, 0);
  assert.equal(matchStatement([{ date: '2026-10-01', amount: 1000 }], [E(1, '2026-10-01', 'EXPENSE', 1000)]).matched.length, 0);
});

test('매칭: 같은 금액 둘이면 날짜가 가까운 것부터 하나씩만', () => {
  const l = [{ date: '2026-10-10', amount: -1000 }, { date: '2026-10-12', amount: -1000 }];
  const e = [E(1, '2026-10-12', 'EXPENSE', 1000), E(2, '2026-10-30', 'EXPENSE', 1000)];
  // 줄 1(10-12)이 기록 1(10-12)과 0일 차이로 먼저 짝이 된다. 줄 0(10-10)은 2일 차이지만 기록 1이 이미 쓰였다.
  assert.deepEqual(matchStatement(l, e), { matched: [{ lineIndex: 1, entryId: 1 }], unmatchedLines: [0], unmatchedEntries: [2] });
});

test('매칭: 같은 거리면 위쪽 줄과 앞 기록이 먼저, 입력이 비어 있어도 안전', () => {
  const l = [{ date: '2026-10-10', amount: 100 }, { date: '2026-10-10', amount: 100 }];
  const e = [E(7, '2026-10-10', 'INCOME', 100), E(8, '2026-10-10', 'INCOME', 100)];
  assert.deepEqual(matchStatement(l, e).matched, [{ lineIndex: 0, entryId: 7 }, { lineIndex: 1, entryId: 8 }]);
  assert.deepEqual(matchStatement([], []), { matched: [], unmatchedLines: [], unmatchedEntries: [] });
});

test('월말 대사: 장부 잔액·차이, 그 달 밖 기록은 뺀다', () => {
  const r = reconcileMonth({ openingBalance: 1000000, entries: [...ents, E(4, '2026-09-30', 'EXPENSE', 99999)], month: '2026-10', bankClosing: 951760 });
  assert.deepEqual(r, { bookClosing: 906760, bankClosing: 951760, diff: 45000, matched: false });
});

test('월말 대사: 1원 차이도 어긋남, 0이면 맞음', () => {
  const base = { openingBalance: 100, entries: [E(1, '2026-10-31', 'INCOME', 50), E(2, '2026-11-01', 'INCOME', 999)], month: '2026-10' };
  assert.deepEqual(reconcileMonth({ ...base, bankClosing: 151 }), { bookClosing: 150, bankClosing: 151, diff: 1, matched: false });
  assert.deepEqual(reconcileMonth({ ...base, bankClosing: 150 }), { bookClosing: 150, bankClosing: 150, diff: 0, matched: true });
  assert.equal(reconcileMonth({ ...base, bankClosing: 149 }).diff, -1);
});

test('월말 대사: 기록이 없는 달은 시작 잔액 그대로, 음수 잔액도 계산된다', () => {
  assert.deepEqual(reconcileMonth({ openingBalance: -500, entries: [], month: '2026-10', bankClosing: -500 }), { bookClosing: -500, bankClosing: -500, diff: 0, matched: true });
});

const donations = [
  { receivedOn: '2026-02-01', kind: 'CASH' as const, amount: 500000 },
  { receivedOn: '2026-03-01', kind: 'GOODS' as const, amount: 150000 },
  { receivedOn: '2025-12-01', kind: 'CASH' as const, amount: 100000 },
];

test('후원금 계좌 점검: 현금만, 그 해만, 연결 지출만', () => {
  const r = donationAccountCheck(donations, [E(1, '2026-05-01', 'EXPENSE', 45000, 1), E(2, '2026-05-02', 'EXPENSE', 9999, null)], 2026, 455000);
  assert.deepEqual(r, { received: 500000, used: 45000, expected: 455000, diff: 0 });
});

test('후원금 계좌 점검: 통장 잔액이 모르면 diff는 null, 1원 모자라면 −1', () => {
  assert.equal(donationAccountCheck(donations, [], 2026, null).diff, null);
  assert.equal(donationAccountCheck(donations, [], 2026, 499999).diff, -1);
});

test('후원금 계좌 점검: 지난해 연결 지출·수입 항목은 세지 않는다', () => {
  const r = donationAccountCheck(donations, [E(1, '2025-12-31', 'EXPENSE', 7000, 3), E(2, '2026-01-01', 'INCOME', 7000, 1)], 2026, 500000);
  assert.deepEqual(r, { received: 500000, used: 0, expected: 500000, diff: 0 });
});
