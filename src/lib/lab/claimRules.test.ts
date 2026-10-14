/**
 * 공단 청구 대조 규칙 테스트 — `node --test src/lib/lab/claimRules.test.ts`
 * 왜: 청구 일수·구간이 한 칸 어긋나면 환수·삭감으로 돌아온다. 붙여넣기 글은 형식이 제각각이라 형식별로 읽는지 확인한다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { bandOfMinutes, claimBandLabel, isClaimBand, matchClaimRows, monthlyLimitUse, parseClaimText, reconcile } from './claimRules.ts';

const oct = (n: number) => Array.from({ length: n }, (_, i) => `2026-10-${String(i + 1).padStart(2, '0')}`);

test('bandOfMinutes — 구간 경계(179/180, 359/360, 479/480, 599/600, 780/781)', () => {
  const pairs: Array<[number, string]> = [[0, 'under3'], [179, 'under3'], [180, 'h3to6'], [359, 'h3to6'], [360, 'h6to8'], [479, 'h6to8'], [480, 'h8to10'], [599, 'h8to10'], [600, 'h10to13'], [780, 'h10to13'], [781, 'over13'], [1440, 'over13']];
  for (const [minutes, band] of pairs) assert.equal(bandOfMinutes(minutes), band, String(minutes));
  assert.equal(bandOfMinutes(-1), null);
  assert.equal(bandOfMinutes(Number.NaN), null);
});

test('구간 라벨과 판별', () => {
  assert.match(claimBandLabel('under3'), /80%/);
  assert.equal(claimBandLabel('h8to10'), '8시간 이상 10시간 미만');
  assert.equal(claimBandLabel(null), '');
  assert.equal(isClaimBand('over13'), true);
  assert.equal(isClaimBand('h13'), false);
});

test('parseClaimText — 계약 예: 탭·쉼표·공백, 머리글·합계 건너뜀', () => {
  const rows = parseClaimText('성명\t일수\t구간\n홍길동\t20일\t8시간 이상~10시간 미만\n김영희, 18, 6~8\n이순자 21 13시간 초과\n합계 59');
  assert.deepEqual(rows.map((r) => [r.name, r.days, r.band]), [['홍길동', 20, 'h8to10'], ['김영희', 18, 'h6to8'], ['이순자', 21, 'over13']]);
  assert.equal(rows[0].raw, '홍길동\t20일\t8시간 이상~10시간 미만');
});

test('parseClaimText — 구간 표기 여러 가지와 3시간 미만', () => {
  const rows = parseClaimText('가나다 5 3시간 미만\n나다라 6 3~6시간\n다라마 7일 6시간 이상 8시간 미만\n라마바 8 10시간 이상 13시간 이하\n마바사 9 10~13시간\n바사아 10');
  assert.deepEqual(rows.map((r) => r.band), ['under3', 'h3to6', 'h6to8', 'h10to13', 'h10to13', null]);
  assert.deepEqual(rows.map((r) => r.days), [5, 6, 7, 8, 9, 10]);
});

test('parseClaimText — 날짜·인정번호·금액 칸이 섞여 있어도 일수만 읽는다(날짜의 10-13을 구간으로 보지 않는다)', () => {
  const rows = parseClaimText('1\t박철수\t2026-10-13\tL1234567890\t1,528,200\t20일');
  assert.deepEqual(rows.map((r) => [r.name, r.days, r.band]), [['박철수', 20, null]]);
  const noUnit = parseClaimText('박철수\t2026-10-13\t7');
  assert.deepEqual(noUnit.map((r) => [r.days, r.band]), [[7, null]]);
});

test('parseClaimText — 순번 접두사, 일수 범위(0~31), 빈 줄·윈도우 줄바꿈, 소계·계', () => {
  const rows = parseClaimText('1. 최영 7일\r\n\r\n2) 정수 0\n소계 7\n계 7\n총계 7\n오류 40\n빈줄없음');
  assert.deepEqual(rows.map((r) => [r.name, r.days]), [['최영', 7], ['정수', 0]]);
  assert.deepEqual(parseClaimText(''), []);
  assert.deepEqual(parseClaimText(undefined as unknown as string), []);
});

test('parseClaimText — "일"이 붙은 칸을 우선한다', () => {
  assert.equal(parseClaimText('홍길동\t3\t20일')[0].days, 20);
});

test('matchClaimRows — 정확히 같으면 확정(공백 무시), 성·글자 수가 같으면 후보', () => {
  const elders = [{ id: 1, name: '홍길동' }, { id: 2, name: '김 영희' }, { id: 3, name: '이순덕' }, { id: 4, name: '이순영' }];
  const m = matchClaimRows([{ name: '홍길동' }, { name: '김영희' }, { name: '이순자' }, { name: '박철수' }], elders);
  assert.deepEqual(m.map((x) => [x.elderlyId, x.candidates]), [[1, []], [2, []], [null, [3, 4]], [null, []]]);
});

test('matchClaimRows — 동명이인은 확정하지 않고 후보로, 다른 줄에서 확정된 어르신은 후보에서 뺀다', () => {
  const dup = matchClaimRows([{ name: '김영희' }], [{ id: 1, name: '김영희' }, { id: 2, name: '김영희' }]);
  assert.deepEqual([dup[0].elderlyId, dup[0].candidates], [null, [1, 2]]);
  const m = matchClaimRows([{ name: '김영희' }, { name: '김영히' }], [{ id: 1, name: '김영희' }, { id: 2, name: '김영순' }]);
  assert.deepEqual(m.map((x) => [x.elderlyId, x.candidates]), [[1, []], [null, [2]]]);
});

test('matchClaimRows — 한 글자 이름·글자 수가 다른 이름은 후보로 삼지 않는다', () => {
  const m = matchClaimRows([{ name: '김' }, { name: '김영' }], [{ id: 1, name: '김영희' }, { id: 2, name: '김' }]);
  assert.deepEqual(m.map((x) => [x.elderlyId, x.candidates]), [[2, []], [null, []]]);
});

test('reconcile — 계약 예: 일치와 불일치(일수·구간 두 사유)', () => {
  const rec = reconcile({
    month: '2026-10',
    rows: [{ elderlyId: 1, days: 20, band: 'h8to10' }, { elderlyId: 2, days: 18, band: 'h6to8' }],
    attendance: { 1: oct(20), 2: [...oct(16), '2026-09-30'] },
    bills: [{ elderlyId: 1, billMonth: '2026-10', days: 20, hourBand: 'h8to10' }, { elderlyId: 2, billMonth: '2026-10', days: 18, hourBand: 'h8to10' }],
  });
  assert.deepEqual(rec.map((r) => [r.elderlyId, r.claimedDays, r.attendedDays, r.billedDays, r.status]), [[1, 20, 20, 20, 'MATCH'], [2, 18, 16, 18, 'MISMATCH']]);
  assert.deepEqual(rec[1].reasons, ['청구 일수가 출석보다 2일 많음', '시간 구간이 본인부담금 청구서와 다름']);
  assert.deepEqual(rec[0].reasons, []);
  assert.deepEqual([rec[1].claimedBand, rec[1].billBand], ['h6to8', 'h8to10']);
});

test('reconcile — 출석이 더 많으면 "적음", 같은 날 중복 출석은 하루, 달 밖·잘못된 날짜는 세지 않는다', () => {
  const [r] = reconcile({ month: '2026-10', rows: [{ elderlyId: 1, days: 2, band: null }], attendance: { 1: ['2026-10-01', '2026-10-01', '2026-10-02', '2026-10-03', '2026-11-01', '2026-10-32', 'x'] }, bills: [] });
  assert.equal(r.attendedDays, 3);
  assert.deepEqual(r.reasons, ['청구 일수가 출석보다 1일 적음']);
  assert.equal(r.billedDays, null);
});

test('reconcile — 청구서가 없거나 다른 달이면 비교하지 않고, 출석 기록이 없으면 0일', () => {
  const [a] = reconcile({ month: '2026-10', rows: [{ elderlyId: 1, days: 0, band: 'h3to6' }], attendance: {}, bills: [{ elderlyId: 1, billMonth: '2026-09', days: 5, hourBand: 'h8to10' }] });
  assert.deepEqual([a.status, a.billedDays, a.billBand, a.attendedDays], ['MATCH', null, null, 0]);
});

test('reconcile — 청구 일수만 청구서와 다를 때(구간은 같음)', () => {
  const [r] = reconcile({ month: '2026-10', rows: [{ elderlyId: 1, days: 5, band: 'h8to10' }], attendance: { 1: oct(5) }, bills: [{ elderlyId: 1, billMonth: '2026-10', days: 4, hourBand: 'h8to10' }] });
  assert.equal(r.status, 'MISMATCH');
  assert.equal(r.reasons.length, 1);
  assert.match(r.reasons[0], /청구서 일수와 다름/);
});

test('reconcile — 3시간 미만 청구는 청구서의 3~6시간 구간과 다르다고 알린다', () => {
  const [r] = reconcile({ month: '2026-10', rows: [{ elderlyId: 1, days: 1, band: 'under3' }], attendance: { 1: oct(1) }, bills: [{ elderlyId: 1, billMonth: '2026-10', days: 1, hourBand: 'h3to6' }] });
  assert.equal(r.status, 'MISMATCH');
});

test('monthlyLimitUse — 계약 예와 등급별 한도', () => {
  assert.deepEqual(monthlyLimitUse('3', 1528200), { limit: 1528200, used: 1528200, rate: 100, over: false });
  assert.deepEqual(monthlyLimitUse('3', 1600000), { limit: 1528200, used: 1600000, rate: 104.7, over: true });
  assert.equal(monthlyLimitUse('1', 0)?.rate, 0);
  assert.equal(monthlyLimitUse('cognitive', 676320)?.limit, 676320);
  assert.equal(monthlyLimitUse('9' as never, 1), null);
});

test('monthlyLimitUse — 소수 첫째 자리 반올림(0.05 경계는 올림)·한도 +1원은 초과', () => {
  // 한도 1,000,000짜리가 없으니 5등급(1,208,900)으로: 0.05% = 604.45원 → 정수 사용액으로 경계를 찾는다
  const limit = 1208900;
  const tenth = (used: number) => monthlyLimitUse('5', used)!.rate;
  assert.equal(tenth(0), 0);
  assert.equal(tenth(604), 0); // 0.04997% → 0.0
  assert.equal(tenth(605), 0.1); // 0.05005% → 0.1
  assert.equal(tenth(limit), 100);
  assert.equal(monthlyLimitUse('5', limit + 1)?.over, true);
  assert.equal(monthlyLimitUse('5', limit)?.over, false);
});

test('monthlyLimitUse — 음수·비수는 0으로, 소수 원은 반올림', () => {
  assert.equal(monthlyLimitUse('2', -5)?.used, 0);
  assert.equal(monthlyLimitUse('2', Number.NaN)?.used, 0);
  assert.equal(monthlyLimitUse('2', 100.4)?.used, 100);
});
