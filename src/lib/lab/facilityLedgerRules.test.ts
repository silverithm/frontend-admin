/**
 * 시설 관리 대장 규칙 테스트 — `node --test src/lib/lab/facilityLedgerRules.test.ts`
 * 왜: 법정 점검 기한을 하루라도 잘못 세면 기한 지남을 놓치거나 없는 의무를 만든다. 윤일(2/29)·해 넘김·창 경계·월말이 핵심이다.
 * 오늘 = 2026-10-15 (research-12 §4 손계산 예시).
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DUE_SOON_DAYS,
  FACILITY_ITEMS,
  cadenceLabel,
  facilityItem,
  itemApplies,
  ledgerSummary,
  nextDue,
  retainUntil,
} from './facilityLedgerRules.ts';
import { FACILITY_ITEM_CODES, type FacilityItemCode, type FacilityLog, type FacilityProfile } from './labTypes.ts';

const TODAY = '2026-10-15';
const PROF = (o: Partial<FacilityProfile> = {}): FacilityProfile => ({
  id: 1, approvedOn: '2019-03-12', grossAreaM2: 420, sprinkler: 'NONE', powerKind: 'GENERAL', gasKind: 'NONE', lpgCapacityKg: null, elevator: 'NONE', waterTank: 'NONE', septic: 'NONE',
  appliesOverride: {}, fireManagerName: null, note: null, writerName: null, updatedAt: null, ...o,
});
const L = (itemCode: FacilityItemCode, doneOn: string, o: Partial<FacilityLog> = {}): FacilityLog => ({
  id: 0, itemCode, doneOn, doneBy: 'SELF', vendorName: null, result: 'PASS', actionNote: null, reportedOn: null, validUntil: null, docLocation: '안전 서류철', writerName: null, updatedAt: null, ...o,
});
const due = (code: FacilityItemCode, logs: FacilityLog[], p: FacilityProfile | null = PROF(), today = TODAY) => {
  const d = nextDue(code, logs, p, today);
  return [d.dueYmd, d.status, d.daysLeft, d.missed];
};

test('항목은 19개이고 서버 FACILITY_ITEM_CODES 순서와 같다', () => {
  assert.equal(FACILITY_ITEMS.length, 19);
  assert.deepEqual(FACILITY_ITEMS.map((i) => i.code), [...FACILITY_ITEM_CODES]);
  assert.equal(new Set(FACILITY_ITEMS.map((i) => i.code)).size, 19);
});

test('항목 메타 — 평가 요건은 분기 전문소독 하나뿐이고 모든 항목에 근거·증빙이 있다', () => {
  assert.deepEqual(FACILITY_ITEMS.filter((i) => i.basis === 'EVAL').map((i) => i.code), ['DISINFECT_QUARTERLY']);
  for (const i of FACILITY_ITEMS) assert.ok(i.lawRef.length > 3 && i.evidence.length > 3 && i.name.length > 2, i.code);
  assert.equal(facilityItem('ELEV_ANNUAL')?.group, 'ELEVATOR');
  assert.deepEqual(FACILITY_ITEMS.filter((i) => i.retentionYears !== null).map((i) => [i.code, i.retentionYears]), [
    ['FIRE_OPERATION', 2], ['FIRE_COMPREHENSIVE', 2], ['FIRE_DRILL_LEGAL', 2], ['ELEC_SELF_USE', 4], ['TANK_CLEAN', 2], ['TANK_HYGIENE', 2], ['TANK_WATER_QUALITY', 2],
  ]);
});

test('주기 문구', () => {
  assert.equal(cadenceLabel({ kind: 'MONTH' }), '월 1회');
  assert.equal(cadenceLabel({ kind: 'ANNIV', years: 1, windowDays: 30 }), '1년마다(전후 30일)');
  assert.equal(cadenceLabel({ kind: 'ANNIV', years: 2, windowDays: 0 }), '2년마다');
  assert.match(cadenceLabel({ kind: 'ANNIV_MONTH', years: 1, windowMonths: 2 }), /전후 2개월/);
});

test('적용 판정 — 시설 정보가 있는 센터', () => {
  const p = PROF({ sprinkler: 'SIMPLE', gasKind: 'LPG', lpgCapacityKg: 300, elevator: 'BUILDING', waterTank: 'SMALL', septic: 'UNKNOWN', appliesOverride: { INSURANCE_FACILITY: 'YES' } });
  const codes: FacilityItemCode[] = ['FIRE_OPERATION', 'FIRE_COMPREHENSIVE', 'ELEC_GENERAL', 'ELEC_SELF_USE', 'GAS_CITY_REGULATOR', 'GAS_CITY_SPECIAL', 'GAS_LPG_INSPECT', 'ELEV_SELF_MONTHLY', 'TANK_CLEAN', 'SEPTIC_CLEAN', 'INSURANCE_FACILITY', 'DISINFECT_QUARTERLY'];
  assert.deepEqual(codes.map((c) => itemApplies(p, c).applies), ['YES', 'UNKNOWN', 'YES', 'NO', 'NO', 'NO', 'UNKNOWN', 'NO', 'NO', 'UNKNOWN', 'YES', 'YES']);
  assert.equal(itemApplies(p, 'INSURANCE_FACILITY').reason, '직접 지정');
});

test('적용 판정 — 시설 정보가 없으면(null) 무조건 YES인 항목 외에는 UNKNOWN이고 UNKNOWN은 관할 기관 확인 문구를 붙인다', () => {
  for (const c of ['FIRE_COMPREHENSIVE', 'ELEC_GENERAL', 'ELEC_SELF_USE', 'GAS_CITY_REGULATOR', 'GAS_LPG_INSPECT', 'ELEV_ANNUAL', 'TANK_HYGIENE', 'SEPTIC_CLEAN', 'INSURANCE_FACILITY'] as const) {
    const r = itemApplies(null, c);
    assert.equal(r.applies, 'UNKNOWN', c);
    assert.match(r.reason, /관할 기관 확인 필요/, c);
  }
  for (const c of ['FIRE_OPERATION', 'FIRE_DRILL_LEGAL', 'FIRE_MANAGER_TRAINING', 'DISINFECT_QUARTERLY', 'SOCIAL_SAFETY_HALF', 'INSURANCE_PROFESSIONAL'] as const) assert.equal(itemApplies(null, c).applies, 'YES', c);
});

test('적용 판정 — 직접 지정은 시설 정보보다 우선(NO로 끌 수도 있음)', () => {
  assert.deepEqual(itemApplies(PROF({ sprinkler: 'FULL', appliesOverride: { FIRE_COMPREHENSIVE: 'NO' } }), 'FIRE_COMPREHENSIVE'), { applies: 'NO', reason: '직접 지정' });
  assert.equal(itemApplies(PROF({ appliesOverride: { FIRE_OPERATION: 'NO' } }), 'FIRE_OPERATION').applies, 'NO');
});

test('적용 판정 — 스프링클러·전력', () => {
  assert.deepEqual((['FULL', 'NONE', 'SIMPLE', 'UNKNOWN'] as const).map((s) => itemApplies(PROF({ sprinkler: s }), 'FIRE_COMPREHENSIVE').applies), ['YES', 'NO', 'UNKNOWN', 'UNKNOWN']);
  assert.deepEqual((['GENERAL', 'SELF_USE', 'UNKNOWN'] as const).map((k) => [itemApplies(PROF({ powerKind: k }), 'ELEC_GENERAL').applies, itemApplies(PROF({ powerKind: k }), 'ELEC_SELF_USE').applies]), [['YES', 'NO'], ['NO', 'YES'], ['UNKNOWN', 'UNKNOWN']]);
});

test('적용 판정 — 도시가스·LPG 저장능력 경계(249·250·499·500)', () => {
  const lpg = (kg: number | null) => itemApplies(PROF({ gasKind: 'LPG', lpgCapacityKg: kg }), 'GAS_LPG_INSPECT').applies;
  assert.deepEqual([lpg(200), lpg(249), lpg(250), lpg(499), lpg(500), lpg(600), lpg(null)], ['NO', 'NO', 'UNKNOWN', 'UNKNOWN', 'YES', 'YES', 'UNKNOWN']);
  const city = PROF({ gasKind: 'CITY' });
  assert.deepEqual([itemApplies(city, 'GAS_CITY_REGULATOR').applies, itemApplies(city, 'GAS_CITY_SPECIAL').applies, itemApplies(city, 'GAS_LPG_INSPECT').applies], ['YES', 'UNKNOWN', 'NO']);
  assert.deepEqual([itemApplies(PROF({ gasKind: 'UNKNOWN' }), 'GAS_LPG_INSPECT').applies, itemApplies(PROF({ gasKind: 'NONE' }), 'GAS_CITY_REGULATOR').applies], ['UNKNOWN', 'NO']);
});

test('적용 판정 — 승강기·저수조(작은 건물은 조례 확인)·정화조', () => {
  assert.deepEqual((['CENTER', 'BUILDING', 'NONE', 'UNKNOWN'] as const).map((e) => itemApplies(PROF({ elevator: e }), 'ELEV_ANNUAL').applies), ['YES', 'NO', 'NO', 'UNKNOWN']);
  assert.deepEqual((['LARGE', 'SMALL', 'NONE', 'UNKNOWN'] as const).map((t) => itemApplies(PROF({ waterTank: t }), 'TANK_WATER_QUALITY').applies), ['YES', 'NO', 'NO', 'UNKNOWN']);
  assert.match(itemApplies(PROF({ waterTank: 'SMALL' }), 'TANK_CLEAN').reason, /조례/);
  assert.deepEqual((['YES', 'NONE', 'UNKNOWN'] as const).map((s) => itemApplies(PROF({ septic: s }), 'SEPTIC_CLEAN').applies), ['YES', 'NO', 'UNKNOWN']);
});

test('달 주기(승강기 자체점검) — 지난달에만 했으면 이번 달은 DUE이고 빠진 달을 센다', () => {
  assert.deepEqual(due('ELEV_SELF_MONTHLY', [L('ELEV_SELF_MONTHLY', '2026-07-03'), L('ELEV_SELF_MONTHLY', '2026-09-20')]), ['2026-10-31', 'DUE', 16, 1]);
});

test('달 주기 — 이번 달에 했으면 OK이고 기한은 다음 달 말일', () => {
  assert.deepEqual(due('ELEV_SELF_MONTHLY', [L('ELEV_SELF_MONTHLY', '2026-07-03'), L('ELEV_SELF_MONTHLY', '2026-09-20'), L('ELEV_SELF_MONTHLY', '2026-10-02')]), ['2026-11-30', 'OK', 46, 1]);
});

test('달 주기 — 기록이 없으면 DUE(이번 달 말일), 빠진 달 0', () => {
  assert.deepEqual(due('TANK_HYGIENE', []), ['2026-10-31', 'DUE', 16, 0]);
});

test('달 주기 — 12월 말 기한은 해를 넘겨도 맞고 2월은 윤년을 반영한다', () => {
  assert.deepEqual(due('ELEV_SELF_MONTHLY', [L('ELEV_SELF_MONTHLY', '2026-12-05')], PROF(), '2026-12-20'), ['2027-01-31', 'OK', 42, 0]);
  assert.deepEqual(due('ELEV_SELF_MONTHLY', [L('ELEV_SELF_MONTHLY', '2027-02-01')], PROF(), '2028-02-10'), ['2028-02-29', 'DUE', 19, 11]);
});

test('반기·분기 — 이번 기간에 했는지 달력 기간으로 본다(7월 1일이 하반기 경계)', () => {
  assert.deepEqual(due('SOCIAL_SAFETY_HALF', [L('SOCIAL_SAFETY_HALF', '2026-04-20')]), ['2026-12-31', 'DUE', 77, 0]);
  assert.deepEqual(due('SOCIAL_SAFETY_HALF', [L('SOCIAL_SAFETY_HALF', '2025-03-10')]), ['2026-12-31', 'DUE', 77, 2]);
  assert.deepEqual(due('SOCIAL_SAFETY_HALF', [L('SOCIAL_SAFETY_HALF', '2026-06-30')], PROF(), '2026-07-01'), ['2026-12-31', 'DUE', 183, 0]);
  assert.deepEqual(due('SOCIAL_SAFETY_HALF', [L('SOCIAL_SAFETY_HALF', '2026-07-01')], PROF(), '2026-07-01'), ['2027-06-30', 'OK', 364, 0]);
  assert.deepEqual(due('DISINFECT_QUARTERLY', [L('DISINFECT_QUARTERLY', '2026-08-10')]), ['2026-12-31', 'DUE', 77, 0]);
  assert.deepEqual(due('DISINFECT_QUARTERLY', [L('DISINFECT_QUARTERLY', '2026-10-01')]), ['2027-03-31', 'OK', 167, 0]);
});

test('연 주기(소방훈련 법정) — 올해 했으면 다음 해 말일까지 OK', () => {
  assert.deepEqual(due('FIRE_DRILL_LEGAL', [L('FIRE_DRILL_LEGAL', '2026-05-14')]), ['2027-12-31', 'OK', 442, 0]);
  assert.deepEqual(due('FIRE_DRILL_LEGAL', []), ['2026-12-31', 'DUE', 77, 0]);
});

test('소방 작동점검 — 사용승인 3월, 올해 기록 없으면 3월 말일이 지나 OVERDUE', () => {
  assert.deepEqual(due('FIRE_OPERATION', []), ['2026-03-31', 'OVERDUE', -198, 0]);
  assert.deepEqual(due('FIRE_OPERATION', [L('FIRE_OPERATION', '2026-03-20')]), ['2027-03-31', 'OK', 167, 0]);
});

test('소방 작동점검 — 작년 기록은 올해 점검으로 치지 않는다', () => {
  assert.deepEqual(due('FIRE_OPERATION', [L('FIRE_OPERATION', '2025-03-20')]), ['2026-03-31', 'OVERDUE', -198, 0]);
});

test('소방 — 종합점검 대상이면 작동점검은 승인 달 + 6개월, 종합점검은 승인 달', () => {
  const full = PROF({ sprinkler: 'FULL' });
  assert.deepEqual(due('FIRE_OPERATION', [], full), ['2026-09-30', 'OVERDUE', -15, 0]);
  assert.deepEqual(due('FIRE_COMPREHENSIVE', [], full), ['2026-03-31', 'OVERDUE', -198, 0]);
  // 승인 8월 + 6 = 14 → 2월(해를 넘기면 달만 쓴다)
  assert.deepEqual(due('FIRE_OPERATION', [], PROF({ approvedOn: '2019-08-01', sprinkler: 'FULL' })), ['2026-02-28', 'OVERDUE', -229, 0]);
  // 직접 지정으로 종합 대상이 아니라고 하면 승인 달 그대로
  assert.deepEqual(due('FIRE_OPERATION', [], PROF({ sprinkler: 'FULL', appliesOverride: { FIRE_COMPREHENSIVE: 'NO' } })), ['2026-03-31', 'OVERDUE', -198, 0]);
});

test('소방 작동점검 — 승인 달이 이번 달이면 IN_WINDOW, 아직 오지 않았으면 DUE, 승인일 모르면 NEED_INFO', () => {
  assert.deepEqual(due('FIRE_OPERATION', [], PROF({ approvedOn: '2019-10-02' })), ['2026-10-31', 'IN_WINDOW', 16, 0]);
  assert.deepEqual(due('FIRE_OPERATION', [], PROF({ approvedOn: '2019-11-15' })), ['2026-11-30', 'DUE', 46, 0]);
  const unknown = nextDue('FIRE_OPERATION', [], PROF({ approvedOn: null }), TODAY);
  assert.deepEqual([unknown.status, unknown.dueYmd, unknown.daysLeft], ['NEED_INFO', null, null]);
  assert.equal(nextDue('FIRE_OPERATION', [], null, TODAY).status, 'NEED_INFO');
});

test('소방 — 승인 달 말일 당일은 OVERDUE가 아니고(IN_WINDOW), 다음 날부터 OVERDUE', () => {
  assert.deepEqual(due('FIRE_OPERATION', [], PROF(), '2026-03-31'), ['2026-03-31', 'IN_WINDOW', 0, 0]);
  assert.deepEqual(due('FIRE_OPERATION', [], PROF(), '2026-04-01'), ['2026-03-31', 'OVERDUE', -1, 0]);
});

test('기념일 주기(승강기 정기검사, 전후 30일) — 창 안이면 IN_WINDOW', () => {
  const d = nextDue('ELEV_ANNUAL', [L('ELEV_ANNUAL', '2024-11-01'), L('ELEV_ANNUAL', '2025-11-10')], PROF(), TODAY);
  assert.deepEqual([d.dueYmd, d.windowStartYmd, d.windowEndYmd, d.status, d.daysLeft], ['2026-11-10', '2026-10-11', '2026-12-10', 'IN_WINDOW', 26]);
});

test('기념일 주기 — 창 시작 30일 전은 DUE, 31일 전은 OK, 창 끝 다음 날은 OVERDUE', () => {
  const at = (today: string) => nextDue('ELEV_ANNUAL', [L('ELEV_ANNUAL', '2025-11-10')], PROF(), today).status;
  // 창: 2026-10-11 ~ 2026-12-10
  assert.deepEqual([at('2026-09-10'), at('2026-09-11'), at('2026-10-10'), at('2026-10-11'), at('2026-12-10'), at('2026-12-11')], ['OK', 'DUE', 'DUE', 'IN_WINDOW', 'IN_WINDOW', 'OVERDUE']);
  assert.equal(at('2026-09-09'), 'OK');
});

test('기념일 주기 — 창 0일(압력조정기 1년): 기한 66일 전 OK, 당일 IN_WINDOW, 다음 날 OVERDUE', () => {
  assert.deepEqual(due('GAS_CITY_REGULATOR', [L('GAS_CITY_REGULATOR', '2025-12-20')]), ['2026-12-20', 'OK', 66, 0]);
  assert.equal(nextDue('GAS_CITY_REGULATOR', [L('GAS_CITY_REGULATOR', '2025-12-20')], PROF(), '2026-12-20').status, 'IN_WINDOW');
  assert.equal(nextDue('GAS_CITY_REGULATOR', [L('GAS_CITY_REGULATOR', '2025-12-20')], PROF(), '2026-12-21').status, 'OVERDUE');
});

test('기념일 주기 — 2/29에 한 2년 주기는 2/28이 기한(소방안전관리자 실무교육)', () => {
  assert.deepEqual(due('FIRE_MANAGER_TRAINING', [L('FIRE_MANAGER_TRAINING', '2024-02-29')]), ['2026-02-28', 'OVERDUE', -229, 0]);
  // 4년 뒤에도 2/29가 있는 해로 가면 2/29 그대로(1년 주기 항목으로 확인): 2027-02-28
  assert.equal(nextDue('ELEV_ANNUAL', [L('ELEV_ANNUAL', '2028-02-29')], PROF(), '2028-03-01').dueYmd, '2029-02-28');
});

test('기념일 주기 — 가장 늦은 실시일 기준이고 기록이 없으면 NEVER', () => {
  assert.deepEqual(due('ELEV_ANNUAL', []), [null, 'NEVER', null, 0]);
  const d = nextDue('ELEV_ANNUAL', [], PROF(), TODAY);
  assert.deepEqual([d.windowStartYmd, d.windowEndYmd], [null, null]);
  assert.equal(nextDue('ELEV_ANNUAL', [L('ELEV_ANNUAL', '2020-01-01'), L('ELEV_ANNUAL', '2026-01-05')], PROF(), TODAY).dueYmd, '2027-01-05');
});

test('기념일(달) 주기 — 전기 일반용: 도래한 달 말일이 기한, 앞뒤 2개월이 창', () => {
  const d = nextDue('ELEC_GENERAL', [L('ELEC_GENERAL', '2025-12-05')], PROF(), TODAY);
  assert.deepEqual([d.dueYmd, d.windowStartYmd, d.windowEndYmd, d.status, d.daysLeft], ['2026-12-31', '2026-10-01', '2027-02-28', 'IN_WINDOW', 77]);
});

test('기념일(달) 주기 — 창 0개월(저수조 수질검사): 그 달 1일~말일, 17일 전이면 DUE', () => {
  const d = nextDue('TANK_WATER_QUALITY', [L('TANK_WATER_QUALITY', '2025-11-20')], PROF(), TODAY);
  assert.deepEqual([d.dueYmd, d.windowStartYmd, d.windowEndYmd, d.status, d.daysLeft], ['2026-11-30', '2026-11-01', '2026-11-30', 'DUE', 46]);
  assert.equal(nextDue('TANK_WATER_QUALITY', [L('TANK_WATER_QUALITY', '2025-11-20')], PROF(), '2026-12-01').status, 'OVERDUE');
});

test('기념일(달) 주기 — 창 끝이 해를 넘어가고 윤년 2월 말일을 맞춘다', () => {
  const d = nextDue('ELEC_GENERAL', [L('ELEC_GENERAL', '2026-12-10')], PROF(), '2027-12-01');
  // 도래 달 2027-12, 창 2027-10-01 ~ 2028-02-29(윤년)
  assert.deepEqual([d.dueYmd, d.windowStartYmd, d.windowEndYmd], ['2027-12-31', '2027-10-01', '2028-02-29']);
});

test('보험 만기 — 가장 늦은 만기일 기준, 30일 이내는 DUE, 지나면 OVERDUE, 만기 당일은 DUE', () => {
  const logs = [L('INSURANCE_PROFESSIONAL', '2024-11-01', { validUntil: '2025-11-01' }), L('INSURANCE_PROFESSIONAL', '2025-11-01', { validUntil: '2026-11-01' })];
  assert.deepEqual(due('INSURANCE_PROFESSIONAL', logs), ['2026-11-01', 'DUE', 17, 0]);
  assert.deepEqual(due('INSURANCE_PROFESSIONAL', logs, PROF(), '2026-11-02'), ['2026-11-01', 'OVERDUE', -1, 0]);
  assert.deepEqual(due('INSURANCE_PROFESSIONAL', logs, PROF(), '2026-11-01'), ['2026-11-01', 'DUE', 0, 0]);
  assert.deepEqual(due('INSURANCE_PROFESSIONAL', logs, PROF(), '2026-10-02'), ['2026-11-01', 'DUE', DUE_SOON_DAYS, 0]);
  assert.deepEqual(due('INSURANCE_PROFESSIONAL', logs, PROF(), '2026-10-01'), ['2026-11-01', 'OK', 31, 0]);
});

test('보험 만기 — 기록이 없거나 만기일이 하나도 없으면 NEVER', () => {
  assert.equal(nextDue('INSURANCE_FACILITY', [], PROF(), TODAY).status, 'NEVER');
  assert.equal(nextDue('INSURANCE_FACILITY', [L('INSURANCE_FACILITY', '2026-01-01')], PROF(), TODAY).status, 'NEVER');
});

test('올바르지 않은 날짜의 기록은 건너뛴다', () => {
  assert.deepEqual(due('ELEV_SELF_MONTHLY', [L('ELEV_SELF_MONTHLY', '2026-02-30')]), ['2026-10-31', 'DUE', 16, 0]);
  assert.equal(nextDue('ELEV_SELF_MONTHLY', [], PROF(), 'not-a-date').status, 'NEED_INFO');
});

test('보관 만료일 — 연수가 있으면 더하고 2/29는 2/28, 없으면 null', () => {
  assert.equal(retainUntil('FIRE_OPERATION', '2026-03-20'), '2028-03-20');
  assert.equal(retainUntil('FIRE_DRILL_LEGAL', '2026-05-14'), '2028-05-14');
  assert.equal(retainUntil('ELEC_SELF_USE', '2026-01-31'), '2030-01-31');
  assert.equal(retainUntil('FIRE_OPERATION', '2024-02-29'), '2026-02-28');
  assert.equal(retainUntil('ELEV_ANNUAL', '2026-01-31'), null);
  assert.equal(retainUntil('FIRE_OPERATION', '2026-13-01'), null);
});

const SUMLOGS = [
  L('FIRE_DRILL_LEGAL', '2026-05-14', { docLocation: '' }),
  L('FIRE_MANAGER_TRAINING', '2024-10-20'),
  L('ELEC_GENERAL', '2025-12-05'),
  L('DISINFECT_QUARTERLY', '2026-08-10'),
  L('SOCIAL_SAFETY_HALF', '2026-04-20'),
  L('INSURANCE_PROFESSIONAL', '2025-11-01', { validUntil: '2026-11-01' }),
  L('ELEV_SELF_MONTHLY', '2026-10-01'),
];

test('대장 요약 — 기한 지남·30일 안·적용 확인 필요·보관 위치 없음 수', () => {
  const sum = ledgerSummary(PROF({ septic: 'UNKNOWN' }), SUMLOGS, TODAY);
  assert.deepEqual([sum.overdue, sum.soon, sum.unknown, sum.noDocLocation], [1, 2, 2, 1]);
});

test('대장 줄 — FACILITY_ITEMS 순서, 적용 NO는 NA·기한 없음, 마지막 실시일', () => {
  const sum = ledgerSummary(PROF({ septic: 'UNKNOWN' }), SUMLOGS, TODAY);
  assert.deepEqual(sum.rows.map((r) => r.code), [...FACILITY_ITEM_CODES]);
  const row = (c: string) => sum.rows.find((r) => r.code === c)!;
  assert.deepEqual([row('FIRE_OPERATION').applies, row('FIRE_OPERATION').status, row('FIRE_OPERATION').daysLeft, row('FIRE_OPERATION').lastDoneOn], ['YES', 'OVERDUE', -198, null]);
  assert.deepEqual([row('ELEV_SELF_MONTHLY').applies, row('ELEV_SELF_MONTHLY').status, row('ELEV_SELF_MONTHLY').dueYmd, row('ELEV_SELF_MONTHLY').lastDoneOn], ['NO', 'NA', null, '2026-10-01']);
  assert.deepEqual([row('FIRE_MANAGER_TRAINING').status, row('FIRE_MANAGER_TRAINING').daysLeft], ['DUE', 5]);
  assert.deepEqual([row('INSURANCE_FACILITY').applies, row('INSURANCE_FACILITY').status], ['UNKNOWN', 'NEVER']);
});

test('대장 요약 — 가장 늦은 기록의 보관 위치를 본다(옛 기록이 비어도 최신이 있으면 세지 않는다), 기록 없으면 세지 않는다', () => {
  const logs = [L('FIRE_DRILL_LEGAL', '2025-05-14', { docLocation: '' }), L('FIRE_DRILL_LEGAL', '2026-05-14', { docLocation: '서류철 2권' })];
  assert.equal(ledgerSummary(PROF(), logs, TODAY).noDocLocation, 0);
  assert.equal(ledgerSummary(PROF(), [L('FIRE_DRILL_LEGAL', '2026-05-14', { docLocation: '   ' })], TODAY).noDocLocation, 1);
  assert.equal(ledgerSummary(PROF(), [], TODAY).noDocLocation, 0);
  // 적용 NO(직접 지정)는 보관 위치 없음으로 세지 않는다
  assert.equal(ledgerSummary(PROF({ appliesOverride: { FIRE_DRILL_LEGAL: 'NO' } }), [L('FIRE_DRILL_LEGAL', '2026-05-14', { docLocation: null })], TODAY).noDocLocation, 0);
});

test('대장 요약 — 시설 정보가 없으면 판정 불가 항목이 UNKNOWN으로 잡히고 기한 지남은 YES 항목만 센다', () => {
  const sum = ledgerSummary(null, [], TODAY);
  const unknownCodes = FACILITY_ITEMS.filter((i) => itemApplies(null, i.code).applies === 'UNKNOWN').length;
  assert.equal(sum.unknown, unknownCodes);
  assert.equal(sum.rows.length, 19);
  // 승인일을 모르면 소방 작동점검은 NEED_INFO라 기한 지남에 세지 않는다
  assert.equal(sum.rows.find((r) => r.code === 'FIRE_OPERATION')!.status, 'NEED_INFO');
});
