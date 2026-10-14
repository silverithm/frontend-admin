/**
 * 직원 인사 규칙 테스트 — `node --test src/lib/lab/staffHrRules.test.ts`
 * 왜: 입사일 31일·월말·윤년·홀짝 연도·정확히 2년째 같은 경계가 하루만 틀려도 경력직·보수교육·건강검진 안내가 달라진다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  addYearsClamped,
  continuingEduRate,
  continuingEduStatus,
  experiencedRatio,
  healthCheckRate,
  healthCheckStatus,
  isEduTargetYear,
  tenureMonths,
  type HrCert,
  type HrProfile,
} from './staffHrRules.ts';

const P = (memberId: number, hireDate: string, o: Partial<HrProfile> = {}): HrProfile => ({
  memberId, hireDate, jobType: 'CAREGIVER', birthYear: 1961, licensePassedOn: '2018-03-01', officeWorker: false, ...o,
});
const C = (memberId: number, kind: HrCert['kind'], doneOn: string, hours: number | null = null): HrCert => ({ memberId, kind, doneOn, hours });

test('근속 개월: 하루 차이로 한 달이 갈린다', () => {
  assert.equal(tenureMonths('2024-10-16', '2026-10-15'), 23);
  assert.equal(tenureMonths('2024-10-15', '2026-10-15'), 24);
});

test('근속 개월: 입사일 31일은 말일에도 한 달이 안 찬다', () => {
  assert.equal(tenureMonths('2026-01-31', '2026-02-28'), 0);
  assert.equal(tenureMonths('2026-01-31', '2026-03-31'), 2);
  assert.equal(tenureMonths('2026-01-31', '2026-03-30'), 1);
});

test('근속 개월: 윤년 2월 29일·연 경계·입사 전·잘못된 날짜', () => {
  assert.equal(tenureMonths('2024-02-29', '2025-02-28'), 11);
  assert.equal(tenureMonths('2024-02-29', '2025-03-01'), 12);
  assert.equal(tenureMonths('2025-12-15', '2026-01-14'), 0);
  assert.equal(tenureMonths('2025-12-15', '2026-01-15'), 1);
  assert.equal(tenureMonths('2026-10-16', '2026-10-15'), 0);
  assert.equal(tenureMonths('2026-02-30', '2026-10-15'), 0);
});

test('날짜에 해 더하기: 2월 29일은 28일로 줄인다', () => {
  assert.equal(addYearsClamped('2024-02-29', 1), '2025-02-28');
  assert.equal(addYearsClamped('2024-02-29', 4), '2028-02-29');
  assert.equal(addYearsClamped('2026-10-15', -1), '2025-10-15');
  assert.equal(addYearsClamped('2026-13-01', 1), null);
});

const four = [P(1, '2020-01-01'), P(2, '2024-10-15'), P(3, '2024-10-16'), P(4, '2026-01-01')];

test('경력직 비율: 50%는 1점, 24개월 정확히 차면 포함', () => {
  assert.deepEqual(experiencedRatio(four, '2026-10-15'), { threshold: 24, eligible: 2, total: 4, ratio: 50, score: 1 });
});

test('경력직 비율: 40%는 0.75점, 28.6%는 0점, 소수 첫째 자리 반올림', () => {
  const five = [...four, P(5, '2026-05-01')];
  assert.deepEqual(experiencedRatio(five, '2026-10-15'), { threshold: 24, eligible: 2, total: 5, ratio: 40, score: 0.75 });
  const seven = [...five, P(6, '2026-06-01'), P(7, '2026-07-01')];
  assert.deepEqual(experiencedRatio(seven, '2026-10-15'), { threshold: 24, eligible: 2, total: 7, ratio: 28.6, score: 0 });
});

test('경력직 비율: 30%는 0.75점의 경계, 반올림해서 30.0이 되면 0.75점', () => {
  const ten = [P(1, '2020-01-01'), P(2, '2020-01-01'), P(3, '2020-01-01'), ...Array.from({ length: 7 }, (_, i) => P(10 + i, '2026-06-01'))];
  assert.equal(experiencedRatio(ten, '2026-10-15').score, 0.75);
  // 3/11 = 27.27%
  assert.equal(experiencedRatio([...ten, P(99, '2026-06-01')], '2026-10-15').ratio, 27.3);
});

test('경력직 비율: 운영 2년 미만 기관은 12개월 기준', () => {
  const r = experiencedRatio([P(1, '2025-06-01'), P(2, '2025-10-15'), P(3, '2025-10-16')], '2026-10-15', '2025-06-01');
  assert.deepEqual(r, { threshold: 12, eligible: 2, total: 3, ratio: 66.7, score: 1 });
});

test('경력직 비율: 운영 24개월 정확히면 24개월 기준, 개설일이 없으면 24개월', () => {
  assert.equal(experiencedRatio(four, '2026-10-15', '2024-10-15').threshold, 24);
  assert.equal(experiencedRatio(four, '2026-10-15', '2024-10-16').threshold, 12);
  assert.equal(experiencedRatio(four, '2026-10-15', null).threshold, 24);
});

test('경력직 비율: 직원이 없으면 null, 입사 예정자는 세지 않는다', () => {
  assert.deepEqual(experiencedRatio([], '2026-10-15'), { threshold: 24, eligible: 0, total: 0, ratio: null, score: null });
  assert.equal(experiencedRatio([...four, P(9, '2026-10-16')], '2026-10-15').total, 4);
});

test('보수교육 대상 연도: 출생연도와 연도의 홀짝이 같다', () => {
  assert.equal(isEduTargetYear(1961, 2025), true);
  assert.equal(isEduTargetYear(1962, 2025), false);
  assert.equal(isEduTargetYear(1962, 2026), true);
  assert.equal(isEduTargetYear(1961, 2027), true);
  assert.equal(isEduTargetYear(null, 2025), false);
});

const edu = [C(1, 'CONTINUING_EDU', '2025-05-01', 4), C(1, 'CONTINUING_EDU', '2025-09-01', 4), C(1, 'HEALTH_CHECK', '2025-03-01')];

test('보수교육 상태: 8시간 이수·진행 중·미이수', () => {
  assert.deepEqual(continuingEduStatus(P(1, '2020-01-01'), edu, 2025, '2025-10-15'), { status: 'DONE', hours: 8 });
  assert.deepEqual(continuingEduStatus(P(1, '2020-01-01'), edu.slice(0, 1), 2025, '2025-10-15'), { status: 'DUE', hours: 4 });
  assert.deepEqual(continuingEduStatus(P(1, '2020-01-01'), edu.slice(0, 1), 2025, '2026-01-10'), { status: 'MISSED', hours: 4 });
});

test('보수교육 상태: 12월 31일까지는 아직 진행 중, 다음 해 1월 1일부터 미이수', () => {
  const one = edu.slice(0, 1);
  assert.equal(continuingEduStatus(P(1, '2020-01-01'), one, 2025, '2025-12-31').status, 'DUE');
  assert.equal(continuingEduStatus(P(1, '2020-01-01'), one, 2025, '2026-01-01').status, 'MISSED');
});

test('보수교육 상태: 시간은 0.5 단위 합이 부동소수 없이 8이 된다', () => {
  const certs = [0.1, 0.2, 0.3, 3.4, 4].map((h, i) => C(1, 'CONTINUING_EDU', `2025-0${i + 1}-10`, h));
  assert.deepEqual(continuingEduStatus(P(1, '2020-01-01'), certs, 2025, '2025-12-01'), { status: 'DONE', hours: 8 });
  assert.equal(continuingEduStatus(P(1, '2020-01-01'), [C(1, 'CONTINUING_EDU', '2025-01-01', 7.9)], 2025, '2025-12-01').status, 'DUE');
});

test('보수교육 상태: 다른 해·다른 직원·다른 종류 기록은 세지 않는다', () => {
  const certs = [C(1, 'CONTINUING_EDU', '2024-12-31', 8), C(2, 'CONTINUING_EDU', '2025-05-01', 8), C(1, 'OTHER', '2025-05-01', 8)];
  assert.deepEqual(continuingEduStatus(P(1, '2020-01-01'), certs, 2025, '2025-10-15'), { status: 'DUE', hours: 0 });
});

test('보수교육 상태: 대상 연도 아님·요양보호사 아님·출생연도 없음', () => {
  assert.equal(continuingEduStatus(P(1, '2020-01-01', { birthYear: 1962 }), edu, 2025, '2025-10-15').status, 'NOT_TARGET');
  assert.equal(continuingEduStatus(P(1, '2020-01-01', { jobType: 'NURSE_AIDE' }), [], 2025, '2025-10-15').status, 'NOT_REQUIRED');
  assert.equal(continuingEduStatus(P(1, '2020-01-01', { birthYear: null }), [], 2025, '2025-10-15').status, 'UNKNOWN');
});

test('보수교육 상태: 합격 2년 미만 면제는 그 해 1월 1일 기준, 정확히 2년째 1월 1일은 면제 아님', () => {
  assert.equal(continuingEduStatus(P(1, '2020-01-01', { licensePassedOn: '2024-06-01' }), [], 2025, '2025-10-15').status, 'EXEMPT');
  assert.equal(continuingEduStatus(P(1, '2020-01-01', { licensePassedOn: '2023-01-02' }), [], 2025, '2025-10-15').status, 'EXEMPT');
  assert.equal(continuingEduStatus(P(1, '2020-01-01', { licensePassedOn: '2023-01-01' }), [], 2025, '2025-10-15').status, 'DUE');
  // 면제는 출생연도가 없어도 면제
  assert.equal(continuingEduStatus(P(1, '2020-01-01', { licensePassedOn: '2024-06-01', birthYear: null }), [], 2025, '2025-10-15').status, 'EXEMPT');
});

test('보수교육 상태: 그 해 12월 31일 뒤에 입사한 직원은 대상이 아니다', () => {
  assert.equal(continuingEduStatus(P(1, '2026-01-02'), [], 2025, '2026-02-01').status, 'NOT_TARGET');
  assert.equal(continuingEduStatus(P(1, '2025-12-31'), [], 2025, '2025-12-31').status, 'DUE');
});

const cg = [1961, 1963, 1965, 1967].map((b, i) => P(i + 1, '2020-01-01', { birthYear: b }));
const full = [1, 2, 3, 4].map((m) => C(m, 'CONTINUING_EDU', '2025-06-01', 8));

test('보수교육 이수율: 100%·75%·66.7%', () => {
  assert.deepEqual(continuingEduRate(cg, full, 2025, '2025-10-15'), { required: 4, done: 4, rate: 100, score: 1 });
  assert.deepEqual(continuingEduRate(cg, full.slice(0, 3), 2026 - 1, '2026-01-10'), { required: 4, done: 3, rate: 75, score: 0.75 });
  assert.deepEqual(continuingEduRate(cg.slice(0, 3), full.slice(0, 2), 2025, '2026-01-10'), { required: 3, done: 2, rate: 66.7, score: 0 });
});

test('보수교육 이수율: 95% 경계(19/20)는 1점, 18/20은 0.75점', () => {
  const twenty = Array.from({ length: 20 }, (_, i) => P(i + 1, '2020-01-01'));
  const done = (n: number) => Array.from({ length: n }, (_, i) => C(i + 1, 'CONTINUING_EDU', '2025-06-01', 8));
  assert.deepEqual(continuingEduRate(twenty, done(19), 2025, '2026-01-10'), { required: 20, done: 19, rate: 95, score: 1 });
  assert.equal(continuingEduRate(twenty, done(18), 2025, '2026-01-10').score, 0.75);
});

test('보수교육 이수율: 면제·비대상은 분모에서 빠지고, 대상자가 없으면 null', () => {
  const mixed = [P(1, '2020-01-01'), P(2, '2020-01-01', { birthYear: 1962 }), P(3, '2020-01-01', { jobType: 'NURSE' }), P(4, '2020-01-01', { licensePassedOn: '2024-06-01' })];
  assert.deepEqual(continuingEduRate(mixed, [C(1, 'CONTINUING_EDU', '2025-06-01', 8)], 2025, '2025-10-15'), { required: 1, done: 1, rate: 100, score: 1 });
  assert.deepEqual(continuingEduRate(mixed.slice(1), [], 2025, '2025-10-15'), { required: 0, done: 0, rate: null, score: null });
});

const hc = [C(1, 'HEALTH_CHECK', '2025-11-01')];

test('건강검진 상태: 정상·30일 안 만료·지남', () => {
  assert.deepEqual(healthCheckStatus(P(1, '2020-01-01'), hc, '2026-09-01'), { status: 'OK', lastOn: '2025-11-01', dueOn: '2026-11-01' });
  assert.equal(healthCheckStatus(P(1, '2020-01-01'), hc, '2026-10-15').status, 'DUE_SOON');
  assert.equal(healthCheckStatus(P(1, '2020-01-01'), hc, '2026-11-02').status, 'OVERDUE');
});

test('건강검진 상태: 만료 30일 전·만료 당일은 경계', () => {
  assert.equal(healthCheckStatus(P(1, '2020-01-01'), hc, '2026-10-01').status, 'OK'); // 31일 남음
  assert.equal(healthCheckStatus(P(1, '2020-01-01'), hc, '2026-10-02').status, 'DUE_SOON'); // 30일 남음
  assert.equal(healthCheckStatus(P(1, '2020-01-01'), hc, '2026-11-01').status, 'DUE_SOON'); // 당일까지 유효
});

test('건강검진 상태: 사무직은 2년', () => {
  assert.deepEqual(healthCheckStatus(P(1, '2020-01-01', { officeWorker: true }), hc, '2026-11-02'), { status: 'OK', lastOn: '2025-11-01', dueOn: '2027-11-01' });
});

test('건강검진 상태: 윤년 2월 29일 검진은 다음 해 2월 28일이 기한', () => {
  assert.equal(healthCheckStatus(P(1, '2020-01-01'), [C(1, 'HEALTH_CHECK', '2024-02-29')], '2025-02-28').status, 'DUE_SOON');
  assert.equal(healthCheckStatus(P(1, '2020-01-01'), [C(1, 'HEALTH_CHECK', '2024-02-29')], '2025-03-01').status, 'OVERDUE');
});

test('건강검진 상태: 기록이 없거나 미래 날짜뿐이면 MISSING', () => {
  assert.deepEqual(healthCheckStatus(P(1, '2020-01-01'), [], '2026-10-15'), { status: 'MISSING', lastOn: null, dueOn: null });
  assert.equal(healthCheckStatus(P(1, '2020-01-01'), [C(1, 'HEALTH_CHECK', '2026-10-16')], '2026-10-15').status, 'MISSING');
  assert.equal(healthCheckStatus(P(1, '2020-01-01'), [C(1, 'CONTINUING_EDU', '2026-05-01', 8), C(2, 'HEALTH_CHECK', '2026-05-01')], '2026-10-15').status, 'MISSING');
});

test('건강검진 상태: 가장 늦은 검진을 기준으로 한다', () => {
  const certs = [C(1, 'HEALTH_CHECK', '2024-05-01'), C(1, 'HEALTH_CHECK', '2026-05-01'), C(1, 'HEALTH_CHECK', '2025-05-01')];
  assert.deepEqual(healthCheckStatus(P(1, '2020-01-01'), certs, '2026-10-15'), { status: 'OK', lastOn: '2026-05-01', dueOn: '2027-05-01' });
});

test('건강검진 상태: 신규 직원은 입사 전 1년 안 결과만 인정한다', () => {
  assert.deepEqual(healthCheckStatus(P(1, '2026-10-01'), [C(1, 'HEALTH_CHECK', '2026-03-01')], '2026-10-15'), { status: 'OK', lastOn: '2026-03-01', dueOn: '2027-03-01' });
  assert.equal(healthCheckStatus(P(1, '2026-10-01'), [C(1, 'HEALTH_CHECK', '2025-10-01')], '2026-10-15').lastOn, '2025-10-01'); // 정확히 1년 전이면 인정(다만 기한은 지남)
  assert.equal(healthCheckStatus(P(1, '2026-10-01'), [C(1, 'HEALTH_CHECK', '2025-09-30')], '2026-10-15').status, 'MISSING'); // 1년 하루 전
});

const hp = [1, 2, 3, 4].map((m) => P(m, '2020-01-01'));

test('건강검진률: 정상·임박 2, 지남 1, 없음 1이면 50%·0점', () => {
  const certs = [C(1, 'HEALTH_CHECK', '2026-05-01'), C(2, 'HEALTH_CHECK', '2025-11-01'), C(3, 'HEALTH_CHECK', '2025-09-01')];
  assert.deepEqual(healthCheckRate(hp, certs, '2026-10-15'), { total: 4, ok: 2, rate: 50, score: 0 });
});

test('건강검진률: 100%는 3점, 75%는 2.25점', () => {
  const all = [1, 2, 3, 4].map((m) => C(m, 'HEALTH_CHECK', '2026-05-01'));
  assert.deepEqual(healthCheckRate(hp, all, '2026-10-15'), { total: 4, ok: 4, rate: 100, score: 3 });
  assert.deepEqual(healthCheckRate(hp, all.slice(0, 3), '2026-10-15'), { total: 4, ok: 3, rate: 75, score: 2.25 });
});

test('건강검진률: 반올림 전 정확한 비율로 가른다 — 1999/2000은 100이 아니다', () => {
  const many = Array.from({ length: 2000 }, (_, i) => P(i + 1, '2020-01-01'));
  const certs = Array.from({ length: 1999 }, (_, i) => C(i + 1, 'HEALTH_CHECK', '2026-05-01'));
  const r = healthCheckRate(many, certs, '2026-10-15');
  assert.equal(r.rate, 100);
  assert.equal(r.score, 2.25);
});

test('건강검진률: 직원이 없으면 null, 입사 예정자는 세지 않는다', () => {
  assert.deepEqual(healthCheckRate([], [], '2026-10-15'), { total: 0, ok: 0, rate: null, score: null });
  assert.equal(healthCheckRate([...hp, P(9, '2026-11-01')], [], '2026-10-15').total, 4);
});
