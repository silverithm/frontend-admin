/**
 * 위생·안전·시설 점검 규칙 테스트 — `node --test src/lib/lab/safetyRules.test.ts`
 * 왜: 평가는 점검표가 "정해진 주기대로" 있는지를 본다. 반기 경계(6/30·7/1)나 월에 걸친 주를 잘못 세면
 * 점검을 안 한 달이 "완료"로, 한 달이 "누락"으로 보인다. 양식 항목은 현장 점검원이 읽는 문장이라 수치 요건이 빠지지 않아야 한다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  EVAL_SAFETY_KINDS,
  SAFETY_KINDS,
  SAFETY_TEMPLATES,
  answeredCount,
  blankItems,
  cadenceOf,
  checksNeedingActions,
  failedItems,
  failedWithLabels,
  isPerformed,
  isSafetyKind,
  itemLabel,
  monthlySafetySummary,
  safetyCoverage,
  safetyKindLabel,
  templateFor,
  unansweredCodes,
} from './safetyRules.ts';
import { EVAL_INDICATORS } from './evalIndicators.ts';
import type { SafetyKind } from './labTypes.ts';

const C = (kind: SafetyKind, checkDate: string, ok: boolean | null = true) => ({ kind, checkDate, items: [{ code: 'A1', ok, note: '' }] });
const OCT_DAYS = ['2026-10-01', '2026-10-02', '2026-10-05', '2026-10-06'];

// ---------- 양식 ----------

test('양식 — 일곱 종류, 종류마다 항목 5개 이상, 항목 code는 서버 규칙에 맞고 종류 안에서 유일', () => {
  assert.deepEqual(SAFETY_TEMPLATES.map((t) => t.kind).sort(), [...SAFETY_KINDS].sort());
  assert.equal(SAFETY_TEMPLATES.length, 7);
  for (const t of SAFETY_TEMPLATES) {
    assert.ok(t.items.length >= 5, t.kind);
    assert.ok(t.items.length <= 60, t.kind);
    assert.equal(new Set(t.items.map((i) => i.code)).size, t.items.length, `${t.kind} code 중복`);
    for (const i of t.items) {
      assert.match(i.code, /^[A-Z0-9_]{2,30}$/, `${t.kind}.${i.code}`);
      assert.ok(i.label.length >= 10 && i.label.length <= 300, `${t.kind}.${i.code} 문장 길이`);
    }
    assert.ok(t.description.length > 10);
  }
});

test('양식 — 주기는 계약 그대로(주방·위생·차량 매일, 감염 주 1회, 소방·시설 월 1회, 재난훈련 연 2회)', () => {
  assert.deepEqual(
    Object.fromEntries(SAFETY_TEMPLATES.map((t) => [t.kind, t.cadence])),
    { KITCHEN: 'DAILY', HYGIENE: 'DAILY', FIRE: 'MONTHLY', FACILITY: 'MONTHLY', VEHICLE: 'DAILY', INFECTION: 'WEEKLY', DRILL: 'TWICE_YEARLY' },
  );
  assert.equal(cadenceOf('DRILL'), 'TWICE_YEARLY');
});

test('양식 — 주방은 냉장 5℃·냉동 -18℃·조리도구 소독·보존식 144시간·조리원 위생을 점검한다', () => {
  const text = templateFor('KITCHEN').items.map((i) => i.label).join('\n');
  assert.match(text, /냉장.*5℃ 이하/);
  assert.match(text, /냉동.*-18℃ 이하/);
  assert.match(text, /소독/);
  assert.match(text, /보존식/);
  assert.match(text, /144시간/);
  assert.match(text, /위생복|건강진단/);
});

test('양식 — 차량은 운행 전 점검·안전벨트·소화기·응급키트·운전자 음주·피로', () => {
  const text = templateFor('VEHICLE').items.map((i) => i.label).join('\n');
  for (const word of ['운행 전', '안전벨트', '소화기', '응급키트', '음주', '피로']) assert.ok(text.includes(word), word);
});

test('양식 — 재난훈련은 대피 경로·역할 분담·소요 시간·보완점', () => {
  const text = templateFor('DRILL').items.map((i) => i.label).join('\n');
  for (const word of ['대피 경로', '역할 분담', '걸린 시간', '보완']) assert.ok(text.includes(word), word);
});

test('양식 도우미 — blankItems는 전부 미점검(null), itemLabel은 모르는 코드를 코드로 돌려준다', () => {
  const blank = blankItems('FIRE');
  assert.equal(blank.length, templateFor('FIRE').items.length);
  assert.ok(blank.every((i) => i.ok === null && i.note === ''));
  assert.equal(itemLabel('FIRE', 'EXTINGUISHER'), templateFor('FIRE').items[0].label);
  assert.equal(itemLabel('FIRE', 'GONE'), 'GONE');
  assert.equal(itemLabel('NOPE' as never, 'X'), 'X');
  assert.equal(safetyKindLabel('KITCHEN'), '급식·주방');
  assert.equal(safetyKindLabel('???'), '???');
  assert.equal(isSafetyKind('DRILL'), true);
  assert.equal(isSafetyKind('drill'), false);
  assert.equal(isSafetyKind(null), false);
});

// ---------- 점검 결과 읽기 ----------

test('failedItems — ok===false만, 모르는(null)·적합(true)은 빠진다. 빈 입력도 안전', () => {
  const failed = failedItems({ items: [{ code: 'A', ok: true, note: '' }, { code: 'B', ok: false, note: '7℃' }, { code: 'C', ok: null, note: '' }] });
  assert.deepEqual(failed.map((i) => i.code), ['B']);
  assert.deepEqual(failedItems({ items: [] }), []);
  assert.deepEqual(failedItems({} as never), []);
});

test('failedWithLabels — 점검표 문장을 붙이고, 양식에서 빠진 코드는 코드 그대로', () => {
  const out = failedWithLabels({ kind: 'KITCHEN', items: [{ code: 'FRIDGE_TEMP', ok: false, note: '7℃' }, { code: 'OLD_CODE', ok: false, note: '' }] });
  assert.equal(out[0].label, itemLabel('KITCHEN', 'FRIDGE_TEMP'));
  assert.equal(out[0].note, '7℃');
  assert.equal(out[1].label, 'OLD_CODE');
});

test('answeredCount·isPerformed·unansweredCodes — 한 항목도 답하지 않은 점검은 한 것이 아니다', () => {
  const blank = { kind: 'FIRE' as const, items: blankItems('FIRE') };
  assert.equal(answeredCount(blank), 0);
  assert.equal(isPerformed(blank), false);
  assert.equal(isPerformed({ items: [] }), false);
  const one = { kind: 'FIRE' as const, items: blankItems('FIRE').map((i, n) => (n === 0 ? { ...i, ok: false } : i)) };
  assert.equal(isPerformed(one), true);
  assert.equal(unansweredCodes(one).length, templateFor('FIRE').items.length - 1);
  assert.deepEqual(unansweredCodes({ kind: 'NOPE' as never, items: [] }), []);
});

test('checksNeedingActions — 부적합이 있는데 조치가 비어 있는 점검만', () => {
  const list = checksNeedingActions([
    { kind: 'FIRE', checkDate: '2026-10-20', items: [{ code: 'A', ok: false, note: '' }], actions: '' },
    { kind: 'FIRE', checkDate: '2026-10-21', items: [{ code: 'A', ok: false, note: '' }], actions: ' 소화기 교체 ' },
    { kind: 'FIRE', checkDate: '2026-10-22', items: [{ code: 'A', ok: true, note: '' }], actions: null },
    { kind: 'VEHICLE', checkDate: '2026-10-23', items: [{ code: 'A', ok: false, note: '' }], actions: null },
  ]);
  assert.deepEqual(list.map((c) => c.checkDate), ['2026-10-20', '2026-10-23']);
});

// ---------- 매 운영일(DAILY) ----------

test('DAILY — 운영일마다 하나, 빠진 날짜를 오름차순으로 돌려준다', () => {
  const r = safetyCoverage([C('KITCHEN', '2026-10-01'), C('KITCHEN', '2026-10-05')], 'KITCHEN', { month: '2026-10', operatingDays: OCT_DAYS });
  assert.deepEqual(r, { done: 2, required: 4, missing: ['2026-10-02', '2026-10-06'] });
});

test('DAILY — 운영일이 아닌 날(공휴일·휴무)의 점검은 필요한 횟수를 채우지 않고, 운영일 목록에서 빠진 날은 요구하지 않는다', () => {
  // 10/03(개천절)·10/04는 운영일 목록에 없다 — 그날 한 점검은 덤이다
  const r = safetyCoverage([C('HYGIENE', '2026-10-03'), C('HYGIENE', '2026-10-01')], 'HYGIENE', { month: '2026-10', operatingDays: OCT_DAYS });
  assert.equal(r.done, 1);
  assert.equal(r.required, 4);
  assert.ok(!r.missing.includes('2026-10-03'));
});

test('DAILY — 다른 종류·다른 달 점검, 중복 점검, 빈 점검은 세지 않거나 한 번만 센다', () => {
  const checks = [
    C('KITCHEN', '2026-10-01'),
    C('KITCHEN', '2026-10-01'), // 같은 날 중복
    C('HYGIENE', '2026-10-02'), // 다른 종류
    C('KITCHEN', '2026-09-30'), // 다른 달
    C('KITCHEN', '2026-10-05', null), // 아무 항목도 안 봄
  ];
  const r = safetyCoverage(checks, 'KITCHEN', { month: '2026-10', operatingDays: OCT_DAYS });
  assert.deepEqual(r, { done: 1, required: 4, missing: ['2026-10-02', '2026-10-05', '2026-10-06'] });
});

test('DAILY — 부적합(false) 점검도 점검을 한 것이다(고칠 점을 찾은 것이 곧 점검)', () => {
  const r = safetyCoverage([C('VEHICLE', '2026-10-01', false)], 'VEHICLE', { month: '2026-10', operatingDays: ['2026-10-01'] });
  assert.deepEqual(r, { done: 1, required: 1, missing: [] });
});

test('DAILY — 운영일 목록의 중복·다른 달 날짜·잘못된 날짜는 정리하고, 시각이 붙은 점검일도 읽는다', () => {
  const days = ['2026-10-01', '2026-10-01', '2026-09-30', '2026-11-01', '2026-10-32', 'oops'];
  const r = safetyCoverage([{ kind: 'KITCHEN', checkDate: '2026-10-01T09:30:00', items: [{ code: 'A', ok: true, note: '' }] }], 'KITCHEN', { month: '2026-10', operatingDays: days });
  assert.deepEqual(r, { done: 1, required: 1, missing: [] });
});

test('빈 입력 — 점검 없음·운영일 없음·운영일 목록 생략·잘못된 달', () => {
  assert.deepEqual(safetyCoverage([], 'KITCHEN', { month: '2026-10', operatingDays: OCT_DAYS }), { done: 0, required: 4, missing: OCT_DAYS });
  assert.deepEqual(safetyCoverage([C('KITCHEN', '2026-10-01')], 'KITCHEN', { month: '2026-10', operatingDays: [] }), { done: 0, required: 0, missing: [] });
  assert.deepEqual(safetyCoverage([], 'KITCHEN', { month: '2026-10' }), { done: 0, required: 0, missing: [] });
  assert.deepEqual(safetyCoverage([], 'KITCHEN', { month: '2026-13', operatingDays: OCT_DAYS }), { done: 0, required: 0, missing: [] });
  assert.deepEqual(safetyCoverage([], 'KITCHEN', { year: 2026 }), { done: 0, required: 0, missing: [] });
  assert.deepEqual(safetyCoverage(undefined as never, 'FIRE', { month: '2026-10' }), { done: 0, required: 1, missing: ['2026-10'] });
  assert.deepEqual(safetyCoverage([], 'NOPE' as never, { month: '2026-10' }), { done: 0, required: 0, missing: [] });
});

// ---------- 주 1회(WEEKLY) ----------

test('WEEKLY — 그 달에 걸친 주 중 운영일 있는 주마다 하나(10월: 9/28주·10/5주)', () => {
  const r = safetyCoverage([C('INFECTION', '2026-10-01')], 'INFECTION', { month: '2026-10', operatingDays: OCT_DAYS });
  assert.deepEqual(r, { done: 1, required: 2, missing: ['2026-10-05'] });
});

test('WEEKLY — 운영일이 하나도 없는 주는 필요한 횟수에서 뺀다', () => {
  // 10/12주·10/19주·10/26주는 운영일 목록에 날짜가 없다
  const r = safetyCoverage([], 'INFECTION', { month: '2026-10', operatingDays: ['2026-10-01', '2026-10-05'] });
  assert.equal(r.required, 2);
  assert.deepEqual(r.missing, ['2026-09-28', '2026-10-05']);
});

test('WEEKLY — 월에 걸친 주: 점검이 전달에 있어도 그 주 안이면 인정, 전달 날짜만 운영일인 주는 이번 달에서 빠진다', () => {
  // 2026-10의 첫 주(9/28~10/4): 10월 운영일이 10/01이면 필요, 점검은 9/29에 했어도 같은 주라 인정
  const r1 = safetyCoverage([C('INFECTION', '2026-09-29')], 'INFECTION', { month: '2026-10', operatingDays: ['2026-10-01'] });
  assert.deepEqual(r1, { done: 1, required: 1, missing: [] });
  // 운영일이 9/29(전달)뿐이면 10월 계산에는 그 주가 없다
  const r2 = safetyCoverage([], 'INFECTION', { month: '2026-10', operatingDays: ['2026-09-29', '2026-10-06'] });
  assert.deepEqual(r2, { done: 0, required: 1, missing: ['2026-10-05'] });
});

test('WEEKLY — 월~일 경계: 일요일 점검은 그 주, 다음 월요일 점검은 다음 주', () => {
  const days = ['2026-10-12', '2026-10-19'];
  const sunday = safetyCoverage([C('INFECTION', '2026-10-18')], 'INFECTION', { month: '2026-10', operatingDays: days });
  assert.deepEqual(sunday, { done: 1, required: 2, missing: ['2026-10-19'] });
  const monday = safetyCoverage([C('INFECTION', '2026-10-19')], 'INFECTION', { month: '2026-10', operatingDays: days });
  assert.deepEqual(monday, { done: 1, required: 2, missing: ['2026-10-12'] });
});

test('WEEKLY — 같은 주에 두 번 점검해도 한 번으로 센다, 운영일 목록이 비면 필요 0', () => {
  const r = safetyCoverage([C('INFECTION', '2026-10-05'), C('INFECTION', '2026-10-07')], 'INFECTION', { month: '2026-10', operatingDays: OCT_DAYS });
  assert.equal(r.done, 1);
  assert.deepEqual(safetyCoverage([], 'INFECTION', { month: '2026-10', operatingDays: [] }), { done: 0, required: 0, missing: [] });
});

// ---------- 월 1회(MONTHLY) ----------

test('MONTHLY — 그 달에 하나면 충분하고, 없으면 달을 돌려준다', () => {
  assert.deepEqual(safetyCoverage([C('FIRE', '2026-10-20')], 'FIRE', { month: '2026-10', operatingDays: OCT_DAYS }), { done: 1, required: 1, missing: [] });
  assert.deepEqual(safetyCoverage([C('FIRE', '2026-10-20'), C('FIRE', '2026-10-27')], 'FIRE', { month: '2026-10' }), { done: 1, required: 1, missing: [] });
  assert.deepEqual(safetyCoverage([C('FIRE', '2026-09-30'), C('FIRE', '2026-11-01')], 'FIRE', { month: '2026-10' }), { done: 0, required: 1, missing: ['2026-10'] });
  assert.deepEqual(safetyCoverage([C('FACILITY', '2026-10-20')], 'FIRE', { month: '2026-10' }), { done: 0, required: 1, missing: ['2026-10'] });
});

test('MONTHLY — 월 경계 날짜(1일·말일)도 그 달로 센다', () => {
  assert.equal(safetyCoverage([C('FACILITY', '2026-10-01')], 'FACILITY', { month: '2026-10' }).done, 1);
  assert.equal(safetyCoverage([C('FACILITY', '2026-10-31')], 'FACILITY', { month: '2026-10' }).done, 1);
  assert.equal(safetyCoverage([C('FACILITY', '2026-10-31')], 'FACILITY', { month: '2026-11' }).done, 0);
});

// ---------- 연 2회(TWICE_YEARLY) ----------

test('DRILL — 서로 다른 반기 둘이어야 2회다(같은 반기 두 번은 1회)', () => {
  assert.deepEqual(safetyCoverage([C('DRILL', '2026-03-10'), C('DRILL', '2026-05-10')], 'DRILL', { year: 2026 }), { done: 1, required: 2, missing: ['2026-H2'] });
  assert.deepEqual(safetyCoverage([C('DRILL', '2026-03-10'), C('DRILL', '2026-09-10')], 'DRILL', { year: 2026 }), { done: 2, required: 2, missing: [] });
  assert.deepEqual(safetyCoverage([C('DRILL', '2026-08-10'), C('DRILL', '2026-12-10')], 'DRILL', { year: 2026 }), { done: 1, required: 2, missing: ['2026-H1'] });
});

test('DRILL — 반기 경계: 6/30은 상반기, 7/1은 하반기', () => {
  assert.deepEqual(safetyCoverage([C('DRILL', '2026-06-30'), C('DRILL', '2026-07-01')], 'DRILL', { year: 2026 }), { done: 2, required: 2, missing: [] });
  assert.deepEqual(safetyCoverage([C('DRILL', '2026-06-30')], 'DRILL', { year: 2026 }), { done: 1, required: 2, missing: ['2026-H2'] });
  assert.deepEqual(safetyCoverage([C('DRILL', '2026-07-01')], 'DRILL', { year: 2026 }), { done: 1, required: 2, missing: ['2026-H1'] });
  // 6/30 + 6/1 은 둘 다 상반기
  assert.equal(safetyCoverage([C('DRILL', '2026-06-30'), C('DRILL', '2026-06-01')], 'DRILL', { year: 2026 }).done, 1);
});

test('DRILL — 해 경계: 12/31은 그 해 하반기, 1/1은 다음 해 상반기. 다른 해 훈련은 세지 않는다', () => {
  const checks = [C('DRILL', '2025-12-31'), C('DRILL', '2026-01-01'), C('DRILL', '2026-12-31')];
  assert.deepEqual(safetyCoverage(checks, 'DRILL', { year: 2026 }), { done: 2, required: 2, missing: [] });
  assert.deepEqual(safetyCoverage(checks, 'DRILL', { year: 2025 }), { done: 1, required: 2, missing: ['2025-H1'] });
  assert.deepEqual(safetyCoverage(checks, 'DRILL', { year: 2024 }), { done: 0, required: 2, missing: ['2024-H1', '2024-H2'] });
});

test('DRILL — 빈 훈련 기록·다른 종류는 세지 않고, 월로 물어도 그 해로 본다, 잘못된 해·월은 필요 0', () => {
  assert.deepEqual(safetyCoverage([C('DRILL', '2026-03-10', null), C('FIRE', '2026-09-10')], 'DRILL', { year: 2026 }), { done: 0, required: 2, missing: ['2026-H1', '2026-H2'] });
  assert.deepEqual(safetyCoverage([C('DRILL', '2026-03-10')], 'DRILL', { month: '2026-10' }), { done: 1, required: 2, missing: ['2026-H2'] });
  assert.deepEqual(safetyCoverage([], 'DRILL', { year: Number.NaN }), { done: 0, required: 0, missing: [] });
  assert.deepEqual(safetyCoverage([], 'DRILL', { month: '2026-13' }), { done: 0, required: 0, missing: [] });
});

// ---------- 이번 달 필수 점검 ----------

test('monthlySafetySummary — 한 달 단위 종류를 모두 더하고(DRILL 제외) 비율은 내림', () => {
  const checks = [C('KITCHEN', '2026-10-01'), C('KITCHEN', '2026-10-02'), C('FIRE', '2026-10-20'), C('DRILL', '2026-10-20')];
  const s = monthlySafetySummary(checks, '2026-10', OCT_DAYS);
  // 주방 4 + 위생 4 + 차량 4 + 감염 2(주) + 소방 1 + 시설 1 = 16, 한 것 = 주방 2 + 소방 1 = 3
  assert.equal(s.required, 16);
  assert.equal(s.done, 3);
  assert.equal(s.percent, 18);
  assert.equal(s.perKind.length, 6);
  assert.ok(!s.perKind.some((k) => k.kind === 'DRILL'));
});

test('monthlySafetySummary — 종류를 골라 센다(차량을 운영하지 않는 기관), 필요가 0이면 100%, 모든 점검을 하면 100%', () => {
  const only = monthlySafetySummary([C('HYGIENE', '2026-10-01')], '2026-10', ['2026-10-01'], ['HYGIENE', 'DRILL']);
  assert.deepEqual([only.done, only.required, only.percent, only.perKind.length], [1, 1, 100, 1]);
  assert.equal(monthlySafetySummary([], '2026-10', [], ['KITCHEN']).percent, 100);
  assert.equal(monthlySafetySummary([], '2026-10', ['2026-10-01'], ['KITCHEN']).percent, 0);
});

test('평가 연결 — 점검 종류 대응표는 SAFETY_CHECKS 지표에만, 재난 지표는 DRILL_TWICE', () => {
  const withSafety = EVAL_INDICATORS.filter((i) => i.autoSource === 'SAFETY_CHECKS').map((i) => i.code);
  assert.deepEqual(Object.keys(EVAL_SAFETY_KINDS).sort(), [...withSafety].sort());
  for (const kinds of Object.values(EVAL_SAFETY_KINDS)) for (const k of kinds) assert.ok(isSafetyKind(k) && cadenceOf(k) !== 'TWICE_YEARLY');
  assert.equal(EVAL_INDICATORS.find((i) => i.code === 'SAFE-07')?.autoSource, 'DRILL_TWICE');
  // 월 점검 일곱 종류 중 DRILL을 뺀 여섯이 어느 지표엔가 연결되어 있다
  const linked = new Set(Object.values(EVAL_SAFETY_KINDS).flat());
  assert.deepEqual([...linked].sort(), SAFETY_KINDS.filter((k) => k !== 'DRILL').sort());
});
