/**
 * 직원 복지·가산금 규칙 테스트 — `node --test src/lib/lab/welfareRules.test.ts`
 * 왜: 분기 판정은 3/31·4/1 하루로 갈리고, 불인정 종류·대표자 본인·증빙 공백이 한 건씩 점수를 가른다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { WELFARE_KINDS, bonusFundStatus, quarterOf, welfareEntryOk, welfareKindLabel, welfareQuarters } from './welfareRules.ts';
import type { WelfareKind } from './labTypes.ts';

const W = (givenOn: string, kind: WelfareKind = 'GIFT_CARD', over: Partial<Parameters<typeof welfareEntryOk>[0]> = {}) => ({ givenOn, kind, signed: true, recipientIsOwner: false, evidenceLedgerId: null as number | null, evidenceNote: '영수증철' as string | null, ...over });
const F = (kind: 'RECEIVED' | 'SPENT', amount: number, ownerUse = false) => ({ kind, amount, ownerUse });

test('복지 종류 — 인정 열다섯, 불인정 셋, 기타만 대조 필요', () => {
  assert.equal(WELFARE_KINDS.length, 18);
  assert.deepEqual(WELFARE_KINDS.filter((k) => !k.recognized).map((k) => k.key), ['DINNER', 'PLAQUE_ONLY', 'DONATED_GOODS']);
  assert.deepEqual(WELFARE_KINDS.filter((k) => k.check).map((k) => k.key), ['OTHER']);
  assert.equal(welfareKindLabel('BONUS'), '포상금');
  assert.equal(welfareKindLabel('UNKNOWN_KIND'), 'UNKNOWN_KIND');
});

test('welfareEntryOk — 인정 종류·서명·증빙·대표자 아님이 모두 있어야 한다', () => {
  assert.equal(welfareEntryOk(W('2026-02-10')), true);
  assert.equal(welfareEntryOk(W('2026-02-10', 'DINNER')), false);
  assert.equal(welfareEntryOk(W('2026-02-10', 'PLAQUE_ONLY')), false);
  assert.equal(welfareEntryOk(W('2026-02-10', 'DONATED_GOODS')), false);
  assert.equal(welfareEntryOk(W('2026-02-10', 'GIFT_CARD', { signed: false })), false);
  assert.equal(welfareEntryOk(W('2026-02-10', 'GIFT_CARD', { recipientIsOwner: true })), false);
});

test('welfareEntryOk — 증빙은 장부 기록이나 보관 위치 글, 공백뿐이면 증빙 없음', () => {
  assert.equal(welfareEntryOk(W('2026-02-10', 'BONUS', { evidenceNote: '   ', evidenceLedgerId: null })), false);
  assert.equal(welfareEntryOk(W('2026-02-10', 'BONUS', { evidenceNote: null, evidenceLedgerId: null })), false);
  assert.equal(welfareEntryOk(W('2026-02-10', 'BONUS', { evidenceNote: null, evidenceLedgerId: 12 })), true);
  assert.equal(welfareEntryOk(W('2026-02-10', 'BONUS', { evidenceNote: '', evidenceLedgerId: 12 })), true);
  assert.equal(welfareEntryOk(W('2026-02-10', 'BONUS', { evidenceNote: '', evidenceLedgerId: 0 })), false);
});

test('welfareEntryOk — 기타(OTHER)는 인정으로 셈한다(대조 필요 표시는 화면 몫)', () => {
  assert.equal(welfareEntryOk(W('2026-02-10', 'OTHER')), true);
});

test('quarterOf — 분기 경계', () => {
  assert.equal(quarterOf('2026-03-31'), '2026-Q1');
  assert.equal(quarterOf('2026-04-01'), '2026-Q2');
  assert.equal(quarterOf('2026-06-30'), '2026-Q2');
  assert.equal(quarterOf('2026-07-01'), '2026-Q3');
  assert.equal(quarterOf('2026-09-30'), '2026-Q3');
  assert.equal(quarterOf('2026-10-01'), '2026-Q4');
  assert.equal(quarterOf('2026-12-31'), '2026-Q4');
  assert.equal(quarterOf('2027-01-01'), '2027-Q1');
});

test('quarterOf — 올바르지 않은 날짜는 null, 시각이 붙어도 앞 날짜로', () => {
  assert.equal(quarterOf('2026-02-30'), null);
  assert.equal(quarterOf(''), null);
  assert.equal(quarterOf('2026-05-05T10:00'), '2026-Q2');
});

test('welfareQuarters — 끝난 분기는 인정 1건이면 MET 아니면 NOT_MET, 진행 중 분기는 IN_PROGRESS', () => {
  const r = welfareQuarters([W('2026-02-10'), W('2026-05-03', 'DINNER')], '2026-Q1', '2026-08-20');
  assert.deepEqual(r.quarters.map((q) => [q.quarter, q.entries, q.ok, q.state]), [['2026-Q1', 1, 1, 'MET'], ['2026-Q2', 1, 0, 'NOT_MET'], ['2026-Q3', 0, 0, 'IN_PROGRESS']]);
  assert.equal(r.met, 1);
  assert.equal(r.allMet, false);
});

test('welfareQuarters — 진행 중 분기에 이미 인정 건이 있으면 MET', () => {
  const r = welfareQuarters([W('2026-07-02')], '2026-Q3', '2026-07-15');
  assert.deepEqual(r.quarters.map((q) => q.state), ['MET']);
  assert.equal(r.allMet, true);
});

test('welfareQuarters — asOf가 분기 마지막 날(3/31)이면 아직 진행 중, 다음 날(4/1)이면 Q1은 끝난 분기', () => {
  assert.equal(welfareQuarters([], '2026-Q1', '2026-03-31').quarters[0].state, 'IN_PROGRESS');
  const r = welfareQuarters([], '2026-Q1', '2026-04-01');
  assert.deepEqual(r.quarters.map((q) => q.state), ['NOT_MET', 'IN_PROGRESS']);
  assert.equal(r.allMet, false);
});

test('welfareQuarters — 3/31 제공은 Q1, 4/1 제공은 Q2로 센다', () => {
  const r = welfareQuarters([W('2026-03-31'), W('2026-04-01')], '2026-Q1', '2026-06-30');
  assert.deepEqual(r.quarters.map((q) => q.ok), [1, 1]);
  assert.deepEqual(r.quarters.map((q) => q.state), ['MET', 'MET']);
});

test('welfareQuarters — 시작 분기 앞의 제공과 asOf 뒤의 제공은 세지 않는다', () => {
  const r = welfareQuarters([W('2025-12-20'), W('2026-11-01')], '2026-Q1', '2026-05-01');
  assert.deepEqual(r.quarters.map((q) => q.entries), [0, 0]);
});

test('welfareQuarters — 해를 넘기는 범위(2026-Q4~2027-Q1)', () => {
  const r = welfareQuarters([W('2026-11-11'), W('2027-02-01')], '2026-Q4', '2027-02-15');
  assert.deepEqual(r.quarters.map((q) => [q.quarter, q.state]), [['2026-Q4', 'MET'], ['2027-Q1', 'MET']]);
});

test('welfareQuarters — 시작 분기 형식이 틀리거나 asOf가 시작보다 앞이면 빈 목록', () => {
  assert.deepEqual(welfareQuarters([], '2026-Q5', '2026-05-01').quarters, []);
  assert.deepEqual(welfareQuarters([], '2026-Q3', '2026-05-01').quarters, []);
  assert.deepEqual(welfareQuarters([], '2026-Q1', 'x').quarters, []);
});

test('welfareQuarters — 같은 분기에 불인정만 있으면 건수는 세고 인정은 0', () => {
  const r = welfareQuarters([W('2026-02-01', 'DINNER'), W('2026-02-02', 'GIFT_CARD', { signed: false })], '2026-Q1', '2026-04-10');
  assert.deepEqual([r.quarters[0].entries, r.quarters[0].ok, r.quarters[0].state], [2, 0, 'NOT_MET']);
});

test('bonusFundStatus — 사용 비율은 대표자 몫을 뺀 금액 기준', () => {
  const r = bonusFundStatus([F('RECEIVED', 1_000_000), F('SPENT', 300_000), F('SPENT', 200_000, true)]);
  assert.deepEqual([r.received, r.spent, r.ownerSpent, r.countedSpent, r.ratio, r.state], [1_000_000, 500_000, 200_000, 300_000, 30, 'USED']);
});

test('bonusFundStatus — 받은 적 없으면 NOT_RECEIVED(충족 처리), 비율 null', () => {
  const r = bonusFundStatus([]);
  assert.deepEqual([r.received, r.ratio, r.state], [0, null, 'NOT_RECEIVED']);
  assert.equal(bonusFundStatus([F('SPENT', 5000)]).state, 'NOT_RECEIVED');
});

test('bonusFundStatus — 받고 안 쓰면 NOT_USED, 대표자에게만 썼어도 NOT_USED', () => {
  assert.deepEqual([bonusFundStatus([F('RECEIVED', 500_000)]).state, bonusFundStatus([F('RECEIVED', 500_000)]).ratio], ['NOT_USED', 0]);
  assert.equal(bonusFundStatus([F('RECEIVED', 500_000), F('SPENT', 100_000, true)]).state, 'NOT_USED');
});

test('bonusFundStatus — 비율은 소수 첫째 자리 반올림, 80% 경계 값도 그대로 나온다', () => {
  assert.equal(bonusFundStatus([F('RECEIVED', 3), F('SPENT', 1)]).ratio, 33.3);
  assert.equal(bonusFundStatus([F('RECEIVED', 1_000_000), F('SPENT', 800_000)]).ratio, 80);
  assert.equal(bonusFundStatus([F('RECEIVED', 1_000_000), F('SPENT', 799_999)]).ratio, 80);
  assert.equal(bonusFundStatus([F('RECEIVED', 1_000_000), F('SPENT', 1_200_000)]).ratio, 120);
});

test('bonusFundStatus — RECEIVED의 ownerUse는 무시, 음수·NaN 금액은 0', () => {
  const r = bonusFundStatus([F('RECEIVED', 1000, true), F('SPENT', -5), F('SPENT', Number.NaN), F('SPENT', 400)]);
  assert.deepEqual([r.received, r.spent, r.ownerSpent], [1000, 400, 0]);
});
