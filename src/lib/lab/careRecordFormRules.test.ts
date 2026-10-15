/**
 * 급여제공기록지 법정 서식 칸 규칙 테스트 — `node --test src/lib/lab/careRecordFormRules.test.ts`
 * 왜: 서식 칸 검증이 어긋나면 법정 서식(별지 제15호)에 빈칸·모순 칸이 인쇄된다. 13시간 경계(정확히 780분)·자정 넘김·영역 서명이 핵심이다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AI_FORM_KEYS,
  BATH_METHODS,
  CARE_FORM_SECTIONS,
  MEAL_INTAKES,
  MEAL_KINDS,
  applyAiForm,
  careRecordMinutes,
  emptyCareForm,
  isCareFormEmpty,
  printSheets,
  reasonsMissing,
  reasonsRequired,
  sectionFilled,
  validateCareForm,
  writersMissing,
} from './careRecordFormRules.ts';

const E = emptyCareForm;
const NO_CTX = { unusedDay: false, cognitiveRequired: false, cognitiveCovered: false };

test('영역은 신체활동지원·인지관리 및 의사소통·건강 및 간호관리·기능회복훈련 순서', () => {
  assert.deepEqual(CARE_FORM_SECTIONS.map((s) => s.key), ['PHYSICAL', 'COGNITIVE', 'HEALTH', 'REHAB']);
  assert.deepEqual(CARE_FORM_SECTIONS.map((s) => s.label), ['신체활동지원', '인지관리 및 의사소통', '건강 및 간호관리', '기능회복훈련']);
});

test('선택지 라벨은 서식 원문대로 — 섭취량은 1·1/2 이상·1/2 미만', () => {
  assert.deepEqual(BATH_METHODS.map((o) => [o.key, o.label]), [['FULL', '전신입욕'], ['SHOWER', '샤워식']]);
  assert.deepEqual(MEAL_KINDS.map((o) => [o.key, o.label]), [['NORMAL', '일반식'], ['PORRIDGE', '죽'], ['LIQUID', '유동식(미음)']]);
  assert.deepEqual(MEAL_INTAKES.map((o) => [o.key, o.label]), [['FULL', '1'], ['HALF_OR_MORE', '1/2 이상'], ['LESS_THAN_HALF', '1/2 미만']]);
});

test('emptyCareForm — 모든 칸 비움, 호출마다 새 객체', () => {
  const a = E();
  assert.equal(a.transport, false);
  assert.equal(a.bathMinutes, null);
  assert.deepEqual({ ...a.writers }, { PHYSICAL: null, COGNITIVE: null, HEALTH: null, REHAB: null });
  assert.equal(a.reasons.length, 0);
  const b = E();
  b.reasons.push({ kind: 'UNUSED_DAY', text: 'x' });
  b.writers.PHYSICAL = 3;
  assert.deepEqual(E().reasons, []);
  assert.equal(E().writers.PHYSICAL, null);
  assert.equal(isCareFormEmpty(E()), true);
});

test('이용 분 — 09:00~17:30은 510분', () => {
  assert.deepEqual(careRecordMinutes('09:00', '17:30'), { minutes: 510, crossesMidnight: false, over13h: false });
});

test('13시간 경계 — 정확히 780분은 초과가 아니고 781분부터 초과', () => {
  assert.deepEqual(careRecordMinutes('08:00', '21:00'), { minutes: 780, crossesMidnight: false, over13h: false });
  assert.deepEqual(careRecordMinutes('08:00', '21:01'), { minutes: 781, crossesMidnight: false, over13h: true });
  assert.deepEqual(careRecordMinutes('08:00', '21:30'), { minutes: 810, crossesMidnight: false, over13h: true });
});

test('자정 넘김 — 종료가 시작보다 빠르면 다음 날로 본다', () => {
  assert.deepEqual(careRecordMinutes('14:00', '00:30'), { minutes: 630, crossesMidnight: true, over13h: false });
  // 20:00 시작 → 다음 날 11:00 종료 = 15시간, 자정 넘김이면서 13시간 초과
  assert.deepEqual(careRecordMinutes('20:00', '11:00'), { minutes: 900, crossesMidnight: true, over13h: true });
  // 23:59 → 00:00 = 1분
  assert.deepEqual(careRecordMinutes('23:59', '00:00'), { minutes: 1, crossesMidnight: true, over13h: false });
});

test('이용 분 — 초가 붙은 시각(HH:mm:ss)도 분 단위로 본다', () => {
  assert.deepEqual(careRecordMinutes('09:00:00', '17:30:00'), { minutes: 510, crossesMidnight: false, over13h: false });
});

test('이용 분 — 없음·같은 시각·형식 틀림은 null', () => {
  assert.equal(careRecordMinutes(null, '17:00'), null);
  assert.equal(careRecordMinutes('09:00', undefined), null);
  assert.equal(careRecordMinutes('09:00', '09:00'), null);
  assert.equal(careRecordMinutes('25:00', '17:00'), null);
  assert.equal(careRecordMinutes('9:00', '17:00'), null);
  assert.equal(careRecordMinutes('09:60', '17:00'), null);
});

test('서식 검사 — 목욕 시간만 있고 방법 없음, 식사 종류만 있고 섭취량 없음', () => {
  assert.deepEqual(validateCareForm({ ...E(), bathMinutes: 20, mealKind: 'PORRIDGE' }), ['BATH_METHOD_MISSING', 'MEAL_INTAKE_MISSING']);
});

test('서식 검사 — 모든 문제가 정해진 순서로 나온다', () => {
  const problems = validateCareForm({ ...E(), startTime: '09:00', transport: true, vehicleNo: '  ', bathMethod: 'SHOWER', bathMinutes: 0, mealIntake: 'FULL', bpSystolic: 130 });
  assert.deepEqual(problems, ['TIME_PAIR_MISSING', 'VEHICLE_MISSING', 'BATH_MINUTES_MISSING', 'MEAL_KIND_MISSING', 'BP_PAIR_MISSING']);
});

test('서식 검사 — 깨끗한 서식과 빈 서식은 문제 없음', () => {
  assert.deepEqual(validateCareForm(E()), []);
  assert.deepEqual(validateCareForm({ ...E(), startTime: '09:00', endTime: '17:00', transport: true, vehicleNo: '12가3456', bathMinutes: 25, bathMethod: 'SHOWER', mealKind: 'NORMAL', mealIntake: 'FULL', bpSystolic: 130, bpDiastolic: 80 }), []);
});

test('서식 검사 — 종료 시각만 있어도, 이완기만 있어도 짝 문제', () => {
  assert.deepEqual(validateCareForm({ ...E(), endTime: '17:00' }), ['TIME_PAIR_MISSING']);
  assert.deepEqual(validateCareForm({ ...E(), bpDiastolic: 80 }), ['BP_PAIR_MISSING']);
  // 송영 안 쓰면 차량번호는 필요 없고, 목욕 0분·방법 없음은 문제 아님
  assert.deepEqual(validateCareForm({ ...E(), transport: false, bathMinutes: 0 }), []);
});

test('영역 채움 — 체크·분·횟수 0 또는 서술 하나라도 있으면 채운 것, 공백 서술은 빈 것', () => {
  const rec = { physical: '', meal: '', toilet: '', bath: '', cognitive: '  ', nursing: '', training: '오후 걷기 연습 20분' };
  const f = { ...E(), toiletCount: 0, bpSystolic: 120, bpDiastolic: 80 };
  assert.deepEqual(CARE_FORM_SECTIONS.map((s) => sectionFilled(f, rec, s.key)), [true, false, true, true]);
  assert.deepEqual(CARE_FORM_SECTIONS.map((s) => sectionFilled(E(), null, s.key)), [false, false, false, false]);
});

test('영역 채움 — 서술 칸별로 맞는 영역에만 들어간다', () => {
  const only = (key: string) => CARE_FORM_SECTIONS.map((s) => sectionFilled(E(), { [key]: '기록' }, s.key));
  assert.deepEqual(only('meal'), [true, false, false, false]);
  assert.deepEqual(only('bath'), [true, false, false, false]);
  assert.deepEqual(only('cognitive'), [false, true, false, false]);
  assert.deepEqual(only('nursing'), [false, false, true, false]);
  assert.deepEqual(only('training'), [false, false, false, true]);
});

test('영역 채움 — 목욕 0분·분 0은 채운 것이 아니고 응급·프로그램명은 채운 것', () => {
  assert.equal(sectionFilled({ ...E(), bathMinutes: 0, healthCareMinutes: 0 }, null, 'PHYSICAL'), false);
  assert.equal(sectionFilled({ ...E(), healthCareMinutes: 0, nursingCareMinutes: 0 }, null, 'HEALTH'), false);
  assert.equal(sectionFilled({ ...E(), emergency: true }, null, 'HEALTH'), true);
  assert.equal(sectionFilled({ ...E(), programNames: ' 회상 활동 ' }, null, 'REHAB'), true);
  assert.equal(sectionFilled({ ...E(), programNames: '   ' }, null, 'REHAB'), false);
});

test('제공 직원 빠진 영역 — 채워진 영역 중 writers가 null인 것만, 영역 순서대로', () => {
  const rec = { training: '오후 걷기 연습 20분' };
  const f = { ...E(), toiletCount: 0, bpSystolic: 120, bpDiastolic: 80, writers: { PHYSICAL: null, COGNITIVE: null, HEALTH: 7, REHAB: null } };
  assert.deepEqual(writersMissing(f, rec), ['PHYSICAL', 'REHAB']);
  assert.deepEqual(writersMissing({ ...f, writers: { PHYSICAL: 1, COGNITIVE: null, HEALTH: 7, REHAB: 2 } }, rec), []);
  assert.deepEqual(writersMissing(E(), null), []);
});

test('사유 필요 — 자정 넘김과 인지활동형 누락', () => {
  const night = { ...E(), startTime: '14:00', endTime: '00:30' };
  assert.deepEqual(reasonsRequired(night, { unusedDay: false, cognitiveRequired: true, cognitiveCovered: false }), ['AFTER_MIDNIGHT', 'COG_PROGRAM_MISSED']);
});

test('사유 필요 — 13시간 초과와 미이용일, 인지활동형을 받았으면 요구하지 않는다', () => {
  const long = { ...E(), startTime: '08:00', endTime: '21:30' };
  assert.deepEqual(reasonsRequired(long, { unusedDay: true, cognitiveRequired: false, cognitiveCovered: false }), ['OVER_13H', 'UNUSED_DAY']);
  assert.deepEqual(reasonsRequired(E(), { unusedDay: false, cognitiveRequired: true, cognitiveCovered: true }), []);
  assert.deepEqual(reasonsRequired({ ...E(), startTime: '08:00', endTime: '21:00' }, NO_CTX), []);
});

test('사유 필요 — 20시~다음 날 11시는 자정 넘김과 13시간 초과가 함께', () => {
  assert.deepEqual(reasonsRequired({ ...E(), startTime: '20:00', endTime: '11:00' }, NO_CTX), ['AFTER_MIDNIGHT', 'OVER_13H']);
});

test('사유 빠짐 — 빈 글은 없는 것, 다른 종류의 글은 대신하지 못한다', () => {
  const night = { ...E(), startTime: '14:00', endTime: '00:30' };
  const ctx = { unusedDay: false, cognitiveRequired: true, cognitiveCovered: false };
  const form = { ...night, reasons: [{ kind: 'AFTER_MIDNIGHT' as const, text: '태풍으로 귀가 차량 운행 중단' }, { kind: 'COG_PROGRAM_MISSED' as const, text: '  ' }] };
  assert.deepEqual(reasonsMissing(form, ctx), ['COG_PROGRAM_MISSED']);
  assert.deepEqual(reasonsMissing({ ...night, reasons: [{ kind: 'OVER_13H', text: '동의' }] }, ctx), ['AFTER_MIDNIGHT', 'COG_PROGRAM_MISSED']);
  assert.deepEqual(reasonsMissing({ ...night, reasons: [{ kind: 'AFTER_MIDNIGHT', text: 'a' }, { kind: 'COG_PROGRAM_MISSED', text: 'b' }] }, ctx), []);
});

test('인쇄 장 — 날짜 오름차순으로 3개씩, 마지막 장은 남는 만큼', () => {
  assert.deepEqual(printSheets(['2026-10-05', '2026-10-01', '2026-10-02', '2026-10-08']), [['2026-10-01', '2026-10-02', '2026-10-05'], ['2026-10-08']]);
  assert.deepEqual(printSheets([]), []);
});

test('인쇄 장 수 — 14일 5장, 12일 4장, 3일 1장이고 같은 날짜는 한 번만, 입력은 바뀌지 않는다', () => {
  const days = (n: number) => Array.from({ length: n }, (_, i) => `2026-10-${String(i + 1).padStart(2, '0')}`);
  assert.equal(printSheets(days(14)).length, 5);
  assert.equal(printSheets(days(12)).length, 4);
  assert.equal(printSheets(days(3)).length, 1);
  const input = ['2026-10-03', '2026-10-03', '2026-10-01', '2026-13-45'];
  assert.deepEqual(printSheets(input), [['2026-10-01', '2026-10-03']]);
  assert.deepEqual(input, ['2026-10-03', '2026-10-03', '2026-10-01', '2026-13-45']);
});

test('인쇄 장 — 달을 넘나드는 날짜도 문자열 순서가 날짜 순서', () => {
  assert.deepEqual(printSheets(['2026-11-01', '2026-10-31', '2025-12-31', '2026-02-28']), [['2025-12-31', '2026-02-28', '2026-10-31'], ['2026-11-01']]);
});

test('isCareFormEmpty — 공백 문자열·빈 사유 배열은 빈 것, 서명 직원이나 사유가 있으면 비지 않음', () => {
  assert.equal(isCareFormEmpty({ ...E(), vehicleNo: '  ' }), true);
  assert.equal(isCareFormEmpty({ ...E(), washHelp: true }), false);
  assert.equal(isCareFormEmpty({ ...E(), writers: { PHYSICAL: 4, COGNITIVE: null, HEALTH: null, REHAB: null } }), false);
  assert.equal(isCareFormEmpty({ ...E(), reasons: [{ kind: 'UNUSED_DAY', text: '가족 행사' }] }), false);
  assert.equal(isCareFormEmpty({ ...E(), toiletCount: 0 }), false);
});

test('AI 제안 — 빈 칸에만 넣고 사람이 채운 칸은 덮지 않으며 넣은 칸 이름을 알려 준다', () => {
  const ai = { washHelp: true, bathMinutes: 25, bathMethod: 'SHOWER' as const, mealKind: 'PORRIDGE' as const, mealIntake: 'HALF_OR_MORE' as const, toiletCount: 3, mobilityHelp: false, cogSupport: false, commHelp: true, bpSystolic: 138, bpDiastolic: 86, temperature: 36.8 };
  const mine = { ...E(), bathMinutes: 30, mealIntake: 'FULL' as const };
  const r = applyAiForm(mine, ai);
  assert.equal(r.form.bathMinutes, 30);
  assert.equal(r.form.mealIntake, 'FULL');
  assert.equal(r.form.bathMethod, 'SHOWER');
  assert.equal(r.form.bpSystolic, 138);
  assert.deepEqual(r.filled, ['washHelp', 'bathMethod', 'mealKind', 'toiletCount', 'commHelp', 'temperature', 'bpSystolic', 'bpDiastolic']);
  assert.equal(mine.bathMethod, null, '입력 서식은 바뀌지 않는다');
});

test('AI 제안 — 혈압은 한쪽이라도 사람이 적었으면 건드리지 않고, 제안이 없으면 그대로', () => {
  const ai = { ...Object.fromEntries(AI_FORM_KEYS.map((k) => [k, null])), washHelp: false, mobilityHelp: false, cogSupport: false, commHelp: false, bpSystolic: 120, bpDiastolic: 80 } as Parameters<typeof applyAiForm>[1];
  const r = applyAiForm({ ...E(), bpSystolic: 150 }, ai);
  assert.deepEqual([r.form.bpSystolic, r.form.bpDiastolic, r.filled], [150, null, []]);
  assert.deepEqual(applyAiForm(E(), null).filled, []);
});
