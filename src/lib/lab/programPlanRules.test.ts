/**
 * 프로그램 연간계획·월간 계획표·의견수렴 규칙 테스트 — `node --test src/lib/lab/programPlanRules.test.ts`
 * 왜: 평가 24·25·26(신체·인지 주 3회, 사회적응 월 1회, 연간계획 작성일, 반기 의견수렴)이 한 칸 어긋나면 점검표가 거짓 안심을 준다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PLAN_CATEGORIES,
  REQUIRED_FREQUENCY,
  annualPlanStatus,
  defaultOperatingDays,
  feedbackStatus,
  halfLabel,
  halfOfDate,
  scheduleIssues,
  scheduleWeekly,
  socialMonthlyStatus,
  weeklyCategoryStatus,
  writtenInPlanWindow,
} from './programPlanRules.ts';

const P = (programDate: string, category: 'PHYSICAL' | 'COGNITIVE' | 'SOCIAL' | 'LEISURE' | 'OTHER', title?: string) => ({ programDate, category, title });
const I = (date: string, category: 'PHYSICAL' | 'COGNITIVE' | 'SOCIAL' | 'LEISURE' | 'OTHER', startTime: string | null = null, title = `${category} 활동`) => ({ date, startTime, category, title, instructor: null });

test('분야 이름과 평가가 요구하는 횟수', () => {
  assert.deepEqual(PLAN_CATEGORIES.map((c) => c.label), ['신체기능', '인지기능', '사회적응']);
  assert.deepEqual(REQUIRED_FREQUENCY, { PHYSICAL: '주 3회 이상', COGNITIVE: '주 3회 이상', SOCIAL: '월 1회 이상' });
});

test('연간계획 작성일 — 그 해 안 또는 직전 해 12월만 인정', () => {
  assert.equal(writtenInPlanWindow('2026-01-01', 2026), true);
  assert.equal(writtenInPlanWindow('2026-12-31', 2026), true);
  assert.equal(writtenInPlanWindow('2025-12-01', 2026), true);
  assert.equal(writtenInPlanWindow('2025-12-31', 2026), true);
  assert.equal(writtenInPlanWindow('2025-11-30', 2026), false);
  assert.equal(writtenInPlanWindow('2027-01-01', 2026), false);
  assert.equal(writtenInPlanWindow('2026-02-30', 2026), false);
  assert.equal(writtenInPlanWindow('', 2026), false);
});

test('연간계획 상태 — 없음·작성일 밖·정상, 분야 순서 고정', () => {
  const plans = [
    { category: 'SOCIAL' as const, planYear: 2026, writtenOn: '2025-11-30' },
    { category: 'PHYSICAL' as const, planYear: 2026, writtenOn: '2026-01-10' },
    { category: 'COGNITIVE' as const, planYear: 2025, writtenOn: '2025-02-01' },
  ];
  const s = annualPlanStatus(plans, 2026);
  assert.deepEqual(s.map((x) => [x.category, x.ok, x.issue]), [['PHYSICAL', true, null], ['COGNITIVE', false, 'MISSING'], ['SOCIAL', false, 'WRITTEN_OUTSIDE_YEAR']]);
  assert.equal(s[0].plan?.writtenOn, '2026-01-10');
  assert.equal(s[1].plan, null);
  assert.deepEqual(annualPlanStatus([], 2026).map((x) => x.issue), ['MISSING', 'MISSING', 'MISSING']);
});

test('주 3회 — 월~일 안만 세고 다음 주 월요일은 뺀다', () => {
  const progs = [P('2026-10-12', 'PHYSICAL'), P('2026-10-14', 'PHYSICAL'), P('2026-10-18', 'PHYSICAL'), P('2026-10-19', 'PHYSICAL'), P('2026-10-11', 'PHYSICAL')];
  assert.deepEqual(weeklyCategoryStatus(progs, '2026-10-12', 'PHYSICAL'), { count: 3, met: true });
  assert.deepEqual(weeklyCategoryStatus(progs, '2026-10-19', 'PHYSICAL'), { count: 1, met: false });
});

test('주 3회 — 월요일이 아닌 날을 주면 그 주의 월요일로 본다, 틀린 날짜는 0회', () => {
  const progs = [P('2026-10-12', 'COGNITIVE', 'a'), P('2026-10-13', 'COGNITIVE', 'b'), P('2026-10-18', 'COGNITIVE', 'c')];
  assert.equal(weeklyCategoryStatus(progs, '2026-10-16', 'COGNITIVE').count, 3);
  assert.deepEqual(weeklyCategoryStatus(progs, '2026-13-01', 'COGNITIVE'), { count: 0, met: false });
});

test('주 3회 — 같은 날 같은 제목은 한 번, 제목이 다르면 둘로 센다', () => {
  const progs = [P('2026-10-12', 'PHYSICAL', '의자 체조'), P('2026-10-12', 'PHYSICAL', ' 의자  체조 '), P('2026-10-12', 'PHYSICAL', '걷기'), P('2026-10-13', 'COGNITIVE', '회상')];
  assert.equal(weeklyCategoryStatus(progs, '2026-10-12', 'PHYSICAL').count, 2);
  assert.equal(weeklyCategoryStatus(progs, '2026-10-12', 'COGNITIVE').count, 1);
});

test('주 경계 — 연말에서 새해로 걸친 주(2026-12-28~2027-01-03)', () => {
  const progs = [P('2026-12-28', 'PHYSICAL', 'a'), P('2026-12-31', 'PHYSICAL', 'b'), P('2027-01-03', 'PHYSICAL', 'c'), P('2027-01-04', 'PHYSICAL', 'd')];
  assert.deepEqual(weeklyCategoryStatus(progs, '2026-12-28', 'PHYSICAL'), { count: 3, met: true });
});

test('사회적응 월 1회 — 여가·취미는 세지 않고 다른 달은 뺀다', () => {
  const progs = [P('2026-10-20', 'SOCIAL'), P('2026-10-21', 'LEISURE'), P('2026-09-30', 'SOCIAL')];
  assert.deepEqual(socialMonthlyStatus(progs, '2026-10'), { count: 1, met: true });
  assert.deepEqual(socialMonthlyStatus([P('2026-11-03', 'LEISURE')], '2026-11'), { count: 0, met: false });
  assert.deepEqual(socialMonthlyStatus(progs, '2026-1'), { count: 0, met: false });
  // 말일은 그 달에 든다
  assert.equal(socialMonthlyStatus([P('2026-10-31', 'SOCIAL')], '2026-10').met, true);
});

const OCT = [
  I('2026-10-01', 'COGNITIVE'), I('2026-10-02', 'PHYSICAL'),
  I('2026-10-05', 'COGNITIVE'), I('2026-10-06', 'COGNITIVE'), I('2026-10-07', 'COGNITIVE', '10:00'), I('2026-10-07', 'OTHER', '10:00'),
  I('2026-10-05', 'PHYSICAL'), I('2026-10-08', 'PHYSICAL'), I('2026-10-09', 'PHYSICAL'),
  I('2026-10-16', 'SOCIAL'), I('2026-09-30', 'COGNITIVE'),
];

test('계획표 주별 — 그 달과 겹치는 주만, 달 밖 날짜는 세지 않는다', () => {
  assert.deepEqual(scheduleWeekly(OCT, '2026-10').map((w) => [w.weekStart, w.cognitive, w.physical, w.social, w.other]), [
    ['2026-09-28', 1, 1, 0, 0],
    ['2026-10-05', 3, 3, 0, 1],
    ['2026-10-12', 0, 0, 1, 0],
    ['2026-10-19', 0, 0, 0, 0],
    ['2026-10-26', 0, 0, 0, 0],
  ]);
  assert.deepEqual(scheduleWeekly(OCT, '2026-13'), []);
});

test('계획표 주별 — 여가·기타는 other, 똑같은 칸이 두 번 들어가도 한 번', () => {
  const w = scheduleWeekly([I('2026-11-02', 'LEISURE'), I('2026-11-02', 'LEISURE'), I('2026-11-03', 'OTHER', null, '다른 것')], '2026-11');
  assert.equal(w[0].weekStart, '2026-10-26');
  assert.equal(w[1].weekStart, '2026-11-02');
  assert.equal(w[1].other, 2);
});

test('계획표 점검 — 주마다 인지·신체 3회 미만, 시각 겹침을 알려 준다(운영일 3일 미만 주는 건너뜀)', () => {
  const issues = scheduleIssues(OCT, '2026-10');
  assert.equal(issues.length, 7);
  assert.equal(issues.filter((m) => /인지기능/.test(m)).length, 3);
  assert.equal(issues.filter((m) => /신체기능/.test(m)).length, 3);
  assert.equal(issues.filter((m) => /겹칩니다/.test(m)).length, 1);
  assert.ok(!issues.some((m) => /9월 28일/.test(m)), '10/1·10/2 두 운영일뿐인 첫 주는 건너뛴다');
  assert.ok(issues.some((m) => /10월 7일 10:00/.test(m)));
});

test('계획표 점검 — 사회적응이 한 번도 없으면 알린다', () => {
  assert.ok(scheduleIssues(OCT.filter((x) => x.category !== 'SOCIAL'), '2026-10').some((m) => /사회적응/.test(m)));
  assert.ok(!scheduleIssues(OCT, '2026-10').some((m) => /사회적응/.test(m)));
});

test('계획표 점검 — 운영일을 넘기면 그 날짜만 운영일로 본다(휴원 주는 건너뜀)', () => {
  // 10/12~10/16 주 중 이틀만 운영 → 그 주는 건너뛰고, 10/19·10/26 주는 점검 대상
  const open = defaultOperatingDays('2026-10').filter((d) => !['2026-10-14', '2026-10-15', '2026-10-16'].includes(d));
  const issues = scheduleIssues(OCT, '2026-10', open);
  assert.ok(!issues.some((m) => /10월 12일/.test(m)));
  assert.ok(issues.some((m) => /10월 19일/.test(m)));
  // 운영일이 하나도 없으면 주 점검·사회적응 경고 없음
  assert.deepEqual(scheduleIssues([], '2026-10', []), []);
});

test('계획표 점검 — 3일만 운영하는 주도 점검한다(경계), 시각이 없으면 겹침으로 보지 않는다', () => {
  const three = ['2026-11-02', '2026-11-03', '2026-11-04'];
  const items = [I('2026-11-02', 'COGNITIVE'), I('2026-11-02', 'PHYSICAL'), I('2026-11-02', 'SOCIAL', null, 'x')];
  const issues = scheduleIssues(items, '2026-11', three);
  assert.equal(issues.length, 2);
  assert.ok(!issues.some((m) => /겹칩니다/.test(m)));
});

test('기본 운영일 — 월~금(윤년 2월도)', () => {
  assert.equal(defaultOperatingDays('2028-02').length, 21);
  assert.equal(defaultOperatingDays('2026-10').length, 22);
  assert.deepEqual(defaultOperatingDays('bad'), []);
});

test('의견수렴 상태 — 상·하반기와 반영', () => {
  assert.deepEqual(feedbackStatus([{ half: '2026-H1', reflectedOn: null }, { half: '2026-H2', reflectedOn: '2026-08-30' }, { half: '2025-H2', reflectedOn: '2025-12-01' }], 2026), { h1: true, h2: true, reflected: true });
  assert.deepEqual(feedbackStatus([{ half: '2026-H1', reflectedOn: null }], 2026), { h1: true, h2: false, reflected: false });
  // 다른 해 반영은 그 해 반영으로 세지 않는다
  assert.deepEqual(feedbackStatus([{ half: '2025-H2', reflectedOn: '2025-12-01' }], 2026), { h1: false, h2: false, reflected: false });
  assert.deepEqual(feedbackStatus([], 2026), { h1: false, h2: false, reflected: false });
});

test('반기 — 6/30은 상반기, 7/1은 하반기', () => {
  assert.equal(halfOfDate('2026-06-30'), '2026-H1');
  assert.equal(halfOfDate('2026-07-01'), '2026-H2');
  assert.equal(halfOfDate('2026-02-30'), null);
  assert.equal(halfLabel('2026-H1'), '2026년 상반기');
  assert.equal(halfLabel('2026-H2'), '2026년 하반기');
});
