/**
 * 직원 급여 계산 규칙 테스트 — `node --test src/lib/lab/payrollRules.test.ts`
 * 왜: 급여·세금은 한 칸(10원 절사 방향, 월 경계, 상·하한)만 틀려도 직원 통장과 신고가 어긋난다.
 * 기대값은 정보연계센터 예시·별표 2 표에서 읽은 값과, 십진 정밀 계산(Decimal)으로 따로 구한 값이다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CHILD_CREDIT_CHANGE_MONTH,
  MEAL_TAX_FREE_LIMIT,
  MIN_WAGE_2026,
  PAYROLL_VERIFY_NOTES,
  buildPayrollLine,
  childCredit,
  extraPay,
  hourlyWageOf,
  insurancePremiums,
  lineIssues,
  lineTotalsConsistent,
  longServiceAward,
  minimumWageIssue,
  monthlyHoursOf,
  npsLimitsFor,
  npsPremium,
  profileIssues,
  seniorAllowanceOf,
  serviceYears,
  withholdingTax,
  type PayrollProfileCalc,
} from './payrollRules.ts';

const ALL = { nps: true, health: true, employment: true };
const prem = (taxablePay: number, payMonth = '2026-10', enrolled = ALL) => insurancePremiums({ taxablePay, payMonth, enrolled });
const tax = (taxablePay: number, dependents: number, children = 0, rate = 100, payMonth = '2026-10') => withholdingTax({ taxablePay, dependents, children, rate, payMonth });

// ---------- 4대보험 ----------

test('건강보험·장기요양 — 정보연계센터 예시: 월 200만 원 → 71,900 / 9,440', () => {
  const p = prem(2_000_000);
  assert.equal(p.health, 71_900);
  assert.equal(p.ltc, 9_440);
  assert.equal(p.employerHealth, 71_900);
  assert.equal(p.employerLtc, 9_440);
});

test('건강보험·장기요양 — 250만 원 → 89,870 / 11,800 (3.595% = 89,875 → 10원 미만 절사)', () => {
  const p = prem(2_500_000);
  assert.equal(p.health, 89_870);
  assert.equal(p.ltc, 11_800);
});

test('건강보험·장기요양·고용 — 십진 정밀 계산으로 구한 값과 같다(끝전 절사)', () => {
  const expected: Array<[number, number, number, number, number]> = [
    // 과세, 건보, 장기요양, 고용(근로자), 고용(사업주)
    [1_234_567, 44_380, 5_830, 11_110, 14_190],
    [3_333_333, 119_830, 15_740, 29_990, 38_330],
    [987_654, 35_500, 4_660, 8_880, 11_350],
    [5_432_109, 195_280, 25_650, 48_880, 62_460],
    [2_999_999, 107_840, 14_170, 26_990, 34_490],
    [2_550_000, 91_670, 12_040, 22_950, 29_320],
  ];
  for (const [pay, health, ltc, emp, empr] of expected) {
    const p = prem(pay);
    assert.equal(p.health, health, `건보 ${pay}`);
    assert.equal(p.ltc, ltc, `장기요양 ${pay}`);
    assert.equal(p.employment, emp, `고용 ${pay}`);
    assert.equal(p.employerEmployment, empr, `고용(사업주) ${pay}`);
  }
});

test('고용보험 — 근로자 0.9%, 사업주 1.15% (200만 원 → 18,000 / 23,000)', () => {
  const p = prem(2_000_000);
  assert.equal(p.employment, 18_000);
  assert.equal(p.employerEmployment, 23_000);
});

test('국민연금 — 200만 원 95,000, 250만 원 118,750 (근로자 4.75%)', () => {
  assert.equal(prem(2_000_000).nps, 95_000);
  assert.equal(prem(2_500_000).nps, 118_750);
  assert.equal(prem(2_000_000).employerNps, 95_000);
});

test('국민연금 — 기준소득월액은 천 원 미만 절사(2,501,999 → 2,501,000 × 4.75% = 118,797.5 → 118,790)', () => {
  assert.equal(prem(2_501_999).nps, 118_790);
  assert.equal(prem(2_501_000).nps, 118_790);
  assert.equal(prem(2_500_999).nps, 118_750);
});

test('국민연금 — 2026-07 이후 상한 659만 / 하한 41만', () => {
  assert.equal(prem(7_000_000, '2026-10').nps, 313_020);
  assert.equal(prem(6_590_000, '2026-10').nps, 313_020);
  // 6,589,999 → 6,589,000 × 4.75% = 312,977.5 → 312,970
  assert.equal(prem(6_589_999, '2026-10').nps, 312_970);
  assert.equal(prem(300_000, '2026-10').nps, 19_470);
  assert.equal(prem(410_000, '2026-10').nps, 19_470);
  assert.equal(prem(409_999, '2026-10').nps, 19_470);
  // 411,000 → 19,522.5 → 19,520
  assert.equal(prem(411_000, '2026-10').nps, 19_520);
});

test('국민연금 — 2026-01~06 상한 637만 / 하한 40만', () => {
  assert.equal(prem(7_000_000, '2026-03').nps, 302_570);
  assert.equal(prem(6_370_000, '2026-06').nps, 302_570);
  assert.equal(prem(300_000, '2026-03').nps, 19_000);
  assert.equal(prem(399_999, '2026-06').nps, 19_000);
});

test('국민연금 — 6월과 7월 사이에서 상·하한이 바뀐다(같은 급여 650만 원)', () => {
  assert.equal(prem(6_500_000, '2026-06').nps, 302_570);
  assert.equal(prem(6_500_000, '2026-07').nps, 308_750);
  assert.deepEqual(npsLimitsFor('2026-06'), { min: 400_000, max: 6_370_000 });
  assert.deepEqual(npsLimitsFor('2026-07'), { min: 410_000, max: 6_590_000 });
  assert.deepEqual(npsLimitsFor('2025-07'), { min: 400_000, max: 6_370_000 });
  assert.deepEqual(npsLimitsFor('2027-06'), { min: 410_000, max: 6_590_000 });
});

test('국민연금 — 급여가 0이면 하한을 적용하지 않고 0이다', () => {
  assert.equal(npsPremium(0, '2026-10'), 0);
  assert.deepEqual(prem(0), { nps: 0, health: 0, ltc: 0, employment: 0, employerNps: 0, employerHealth: 0, employerLtc: 0, employerEmployment: 0 });
});

test('미가입은 0 — 보험마다 따로, 건강보험 미가입이면 장기요양도 0', () => {
  const p = insurancePremiums({ taxablePay: 2_000_000, payMonth: '2026-10', enrolled: { nps: false, health: true, employment: false } });
  assert.equal(p.nps, 0);
  assert.equal(p.employerNps, 0);
  assert.equal(p.employment, 0);
  assert.equal(p.employerEmployment, 0);
  assert.equal(p.health, 71_900);
  const q = insurancePremiums({ taxablePay: 2_000_000, payMonth: '2026-10', enrolled: { nps: true, health: false, employment: true } });
  assert.equal(q.health, 0);
  assert.equal(q.ltc, 0);
  assert.equal(q.employerHealth, 0);
  assert.equal(q.employerLtc, 0);
  assert.equal(q.nps, 95_000);
});

test('보험료는 모두 10원 단위다(전 구간 표본)', () => {
  for (let pay = 0; pay <= 8_000_000; pay += 7_919) {
    const p = prem(pay);
    for (const [key, value] of Object.entries(p)) assert.equal(value % 10, 0, `${key} ${pay}`);
  }
});

test('보험료 입력이 음수·소수·NaN이어도 깨지지 않는다', () => {
  assert.equal(prem(-100).health, 0);
  assert.equal(prem(Number.NaN).nps, 0);
  assert.equal(prem(2_000_000.9).health, 71_900);
});

// ---------- 소득세·지방소득세 ----------

test('간이세액 — 표에서 읽은 값(별표 2)', () => {
  const cases: Array<[number, number, number]> = [
    [2_500_000, 1, 35_600],
    [2_500_000, 2, 28_600],
    [2_500_000, 3, 16_530],
    [2_500_000, 4, 13_150],
    [3_500_000, 4, 49_340],
    [2_000_000, 1, 19_520],
    [3_000_000, 1, 74_350],
    [5_000_000, 1, 335_470],
    [4_000_000, 3, 109_590],
    [1_500_000, 2, 4_420],
    [1_060_000, 1, 1_040],
    [1_060_000, 2, 0],
    [10_000_000, 1, 1_507_400],
  ];
  for (const [pay, dep, want] of cases) assert.equal(tax(pay, dep).incomeTax, want, `${pay} ${dep}명`);
});

test('지방소득세 = 소득세 10%, 10원 미만 절사', () => {
  assert.equal(tax(2_500_000, 1).localTax, 3_560);
  assert.equal(tax(3_500_000, 4).localTax, 4_930);
  // 소득세 37,310 → 3,731 → 3,730
  assert.equal(tax(2_550_000, 1).localTax, 3_730);
  assert.equal(tax(1_060_000, 2).localTax, 0);
});

test('자녀 공제 — 2026-03 이후 20,830 / 45,830 / 45,830 + 33,330×(n−2)', () => {
  assert.equal(childCredit(0, '2026-10'), 0);
  assert.equal(childCredit(1, '2026-10'), 20_830);
  assert.equal(childCredit(2, '2026-10'), 45_830);
  assert.equal(childCredit(3, '2026-10'), 79_160);
  assert.equal(childCredit(4, '2026-10'), 112_490);
  assert.equal(childCredit(10, '2026-10'), 45_830 + 33_330 * 8);
  assert.equal(tax(3_500_000, 4, 1).incomeTax, 49_340 - 20_830);
  assert.equal(tax(3_500_000, 4, 2).incomeTax, 3_510);
});

test('자녀 공제 — 2026-03 전후로 금액이 바뀐다(2026-02 옛 금액 12,500 / 29,160 / 29,160 + 25,000×(n−2))', () => {
  assert.equal(CHILD_CREDIT_CHANGE_MONTH, '2026-03');
  assert.equal(childCredit(1, '2026-02'), 12_500);
  assert.equal(childCredit(2, '2026-02'), 29_160);
  assert.equal(childCredit(3, '2026-02'), 54_160);
  assert.equal(childCredit(1, '2026-03'), 20_830);
  assert.equal(childCredit(1, '2025-12'), 12_500);
  assert.equal(tax(3_500_000, 4, 1, 100, '2026-02').incomeTax, 36_840);
  assert.equal(tax(3_500_000, 4, 1, 100, '2026-03').incomeTax, 28_510);
});

test('자녀 공제가 세액보다 크면 0(음수 없음)', () => {
  assert.equal(tax(2_500_000, 4, 3).incomeTax, 0);
  assert.equal(tax(2_500_000, 4, 3).localTax, 0);
  assert.equal(tax(1_060_000, 1, 1).incomeTax, 0);
});

test('선택 비율 80·100·120% — 공제 뒤 세액에 곱하고 10원 미만 절사', () => {
  assert.equal(tax(2_500_000, 1, 0, 80).incomeTax, 28_480);
  assert.equal(tax(2_500_000, 1, 0, 100).incomeTax, 35_600);
  assert.equal(tax(2_500_000, 1, 0, 120).incomeTax, 42_720);
  // 16,530 × 120% = 19,836 → 19,830 / × 80% = 13,224 → 13,220
  assert.equal(tax(2_500_000, 3, 0, 120).incomeTax, 19_830);
  assert.equal(tax(2_500_000, 3, 0, 80).incomeTax, 13_220);
  assert.equal(tax(2_500_000, 3, 0, 120).localTax, 1_980);
  // 자녀 공제 후 곱: (49,340 − 20,830) × 120% = 34,212 → 34,210
  assert.equal(tax(3_500_000, 4, 1, 120).incomeTax, 34_210);
});

test('선택 비율이 80·100·120이 아니면 100으로 본다', () => {
  assert.equal(tax(2_500_000, 1, 0, 90).incomeTax, 35_600);
  assert.equal(tax(2_500_000, 1, 0, Number.NaN).incomeTax, 35_600);
});

test('간이세액 — 월 10,000천원 초과 산식을 거친다', () => {
  assert.equal(tax(12_000_000, 1).incomeTax, 2_218_400);
  assert.equal(tax(12_000_000, 1).localTax, 221_840);
});

// ---------- 시급·가산수당 ----------

test('월 소정근로시간 — 주 40시간 209, 그 밖은 (주 + 주/5) × 365 ÷ 7 ÷ 12 반올림', () => {
  assert.equal(monthlyHoursOf(40), 209);
  assert.equal(monthlyHoursOf(20), 104);
  assert.equal(monthlyHoursOf(15), 78);
  assert.equal(monthlyHoursOf(30), 156);
  assert.equal(monthlyHoursOf(44), 229);
  assert.equal(monthlyHoursOf(52), 271);
  assert.equal(monthlyHoursOf(35.5), 185);
  assert.equal(monthlyHoursOf(0), 0);
});

test('시급 환산 — 시급제는 기준 금액, 월급제는 월급 ÷ 월 소정근로시간(원 미만 반올림)', () => {
  assert.equal(hourlyWageOf({ payType: 'HOURLY', baseAmount: 12_000, weeklyHours: 20 }), 12_000);
  assert.equal(hourlyWageOf({ payType: 'MONTHLY', baseAmount: 2_156_880, weeklyHours: 40 }), 10_320);
  // 2,500,000 ÷ 209 = 11,961.72 → 11,962
  assert.equal(hourlyWageOf({ payType: 'MONTHLY', baseAmount: 2_500_000, weeklyHours: 40 }), 11_962);
  // 1,000,000 ÷ 104 = 9,615.38 → 9,615
  assert.equal(hourlyWageOf({ payType: 'MONTHLY', baseAmount: 1_000_000, weeklyHours: 20 }), 9_615);
  // 정확히 .5 → 올림: 209 × 10,000 + 104.5 가 되는 경우는 없지만 2 × base + hours 식이 반올림임을 보인다
  assert.equal(hourlyWageOf({ payType: 'MONTHLY', baseAmount: 208, weeklyHours: 40 }), 1);
});

test('가산수당 — 연장 ×1.5, 야간 가산 ×0.5, 휴일 ×1.5, 휴일 8시간 초과 ×2.0', () => {
  const ex = extraPay(10_320, { overtime: 2, night: 2, holiday: 8, holidayOver8: 1 });
  assert.equal(ex.overtimePay, 30_960);
  assert.equal(ex.nightPay, 10_320);
  assert.equal(ex.holidayPay, 123_840);
  assert.equal(ex.holidayOver8, 20_640);
});

test('가산수당 — 각각 원 미만 절사, 0.1시간 단위', () => {
  // 10,321 × 1.5시간 × 1.5 = 23,222.25 → 23,222
  assert.equal(extraPay(10_321, { overtime: 1.5, night: 0, holiday: 0, holidayOver8: 0 }).overtimePay, 23_222);
  // 10,320 × 0.5시간 × 0.5 = 2,580
  assert.equal(extraPay(10_320, { overtime: 0, night: 0.5, holiday: 0, holidayOver8: 0 }).nightPay, 2_580);
  // 10,321 × 0.1 × 0.5 = 516.05 → 516
  assert.equal(extraPay(10_321, { overtime: 0, night: 0.1, holiday: 0, holidayOver8: 0 }).nightPay, 516);
  // 0.3시간이 float 곱(0.3 × 10 = 3.0000000000000004)이어도 3으로 읽는다: 10,000 × 0.3 × 1.5 = 4,500
  assert.equal(extraPay(10_000, { overtime: 0.3, night: 0, holiday: 0, holidayOver8: 0 }).overtimePay, 4_500);
  assert.deepEqual(extraPay(10_320, { overtime: 0, night: 0, holiday: 0, holidayOver8: 0 }), { overtimePay: 0, nightPay: 0, holidayPay: 0, holidayOver8: 0 });
  assert.deepEqual(extraPay(10_320, { overtime: -1, night: Number.NaN, holiday: 0, holidayOver8: 0 }), { overtimePay: 0, nightPay: 0, holidayPay: 0, holidayOver8: 0 });
});

// ---------- 장기근속장려금·선임수당 ----------

const L = (hireDate: string, jobType: PayrollProfileCalc['jobType'], payMonth = '2026-10', facility?: 'HOME' | 'RESIDENTIAL') => longServiceAward({ hireDate, jobType }, payMonth, facility);

test('장기근속장려금 — 1년 미만 0, 1~3년 50,000', () => {
  assert.equal(L('2025-08-01', 'CAREGIVER'), 50_000);
  assert.equal(L('2025-12-01', 'CAREGIVER'), 0);
  assert.equal(L('2026-10-01', 'CAREGIVER'), 0);
});

test('장기근속장려금 — 근속은 입사일부터 그 달 말일까지: 정확히 1년이 되는 날이 말일이면 받는다', () => {
  assert.equal(L('2025-10-31', 'CAREGIVER'), 50_000);
  assert.equal(L('2025-11-01', 'CAREGIVER'), 0);
  assert.equal(serviceYears('2025-10-31', '2026-10'), 1);
  assert.equal(serviceYears('2025-11-01', '2026-10'), 0);
});

test('장기근속장려금 — 3·5·7년 경계(재가·방문형 110,000 / 130,000 / 150,000)', () => {
  assert.equal(L('2023-10-31', 'CAREGIVER'), 110_000);
  assert.equal(L('2023-11-01', 'CAREGIVER'), 50_000);
  assert.equal(L('2021-10-31', 'CAREGIVER'), 130_000);
  assert.equal(L('2021-11-01', 'CAREGIVER'), 110_000);
  assert.equal(L('2019-10-31', 'CAREGIVER'), 150_000);
  assert.equal(L('2019-11-01', 'CAREGIVER'), 130_000);
  assert.equal(L('2000-01-01', 'CAREGIVER'), 150_000);
});

test('장기근속장려금 — 입소형 140,000 / 160,000 / 180,000, 1~3년은 같은 50,000', () => {
  assert.equal(L('2022-09-01', 'CAREGIVER', '2026-10', 'RESIDENTIAL'), 140_000);
  assert.equal(L('2021-10-31', 'CAREGIVER', '2026-10', 'RESIDENTIAL'), 160_000);
  assert.equal(L('2019-10-31', 'CAREGIVER', '2026-10', 'RESIDENTIAL'), 180_000);
  assert.equal(L('2025-08-01', 'CAREGIVER', '2026-10', 'RESIDENTIAL'), 50_000);
  assert.equal(L('2022-09-01', 'CAREGIVER'), 110_000);
  assert.equal(L('2019-01-01', 'SOCIAL_WORKER'), 150_000);
});

test('장기근속장려금 — 대상 직종만(요양보호사·사회복지사·간호사·간호조무사·치료사·조리원·영양사·위생원)', () => {
  for (const job of ['CAREGIVER', 'SOCIAL_WORKER', 'NURSE', 'NURSE_AIDE', 'THERAPIST', 'COOK', 'NUTRITIONIST', 'SANITATION'] as const) assert.equal(L('2019-01-01', job), 150_000, job);
  for (const job of ['DRIVER', 'OFFICE', 'DIRECTOR', 'OTHER'] as const) assert.equal(L('2019-01-01', job), 0, job);
});

test('장기근속장려금 — 윤일 입사는 평년에 2월 28일을 기념일로 본다', () => {
  assert.equal(L('2024-02-29', 'CAREGIVER', '2025-02'), 50_000);
  assert.equal(L('2024-02-29', 'CAREGIVER', '2025-01'), 0);
  assert.equal(L('2024-02-29', 'CAREGIVER', '2028-02'), 110_000);
});

test('장기근속장려금 — 입사일이 그 달보다 뒤거나 날짜가 잘못이면 0', () => {
  assert.equal(L('2026-11-01', 'CAREGIVER'), 0);
  assert.equal(L('', 'CAREGIVER'), 0);
  assert.equal(L('2019-02-30', 'CAREGIVER'), 0);
  assert.equal(L('2019-01-01', 'CAREGIVER', '2026-13'), 0);
});

test('선임 요양보호사 수당 — 요양보호사이고 대상일 때만 150,000', () => {
  assert.equal(seniorAllowanceOf({ jobType: 'CAREGIVER', seniorCaregiver: true }), 150_000);
  assert.equal(seniorAllowanceOf({ jobType: 'CAREGIVER', seniorCaregiver: false }), 0);
  assert.equal(seniorAllowanceOf({ jobType: 'NURSE', seniorCaregiver: true }), 0);
});

// ---------- 최저임금 ----------

test('최저임금 — 시급 10,319원은 미달, 10,320원은 통과', () => {
  assert.equal(MIN_WAGE_2026, 10_320);
  assert.match(minimumWageIssue({ payType: 'HOURLY', baseAmount: 10_000, weeklyHours: 40 }) ?? '', /최저임금/);
  assert.match(minimumWageIssue({ payType: 'HOURLY', baseAmount: 10_319, weeklyHours: 40 }) ?? '', /10,319원/);
  assert.equal(minimumWageIssue({ payType: 'HOURLY', baseAmount: 10_320, weeklyHours: 40 }), null);
});

test('최저임금 — 월급제는 최저시급 × 월 소정근로시간과 정수로 비교한다(주 40시간 2,156,880원)', () => {
  assert.equal(minimumWageIssue({ payType: 'MONTHLY', baseAmount: 2_156_880, weeklyHours: 40 }), null);
  assert.match(minimumWageIssue({ payType: 'MONTHLY', baseAmount: 2_156_879, weeklyHours: 40 }) ?? '', /2,156,880원/);
  // 주 20시간 월 104시간 → 1,073,280원
  assert.equal(minimumWageIssue({ payType: 'MONTHLY', baseAmount: 1_073_280, weeklyHours: 20 }), null);
  assert.notEqual(minimumWageIssue({ payType: 'MONTHLY', baseAmount: 1_073_279, weeklyHours: 20 }), null);
});

test('최저임금 경고에 "대조 필요"가 붙는다(2차 근거 값)', () => {
  assert.match(minimumWageIssue({ payType: 'HOURLY', baseAmount: 9_000, weeklyHours: 40 }) ?? '', /대조 필요/);
});

// ---------- 급여대장 한 줄 ----------

const CAREGIVER: PayrollProfileCalc = {
  payType: 'MONTHLY',
  baseAmount: 2_500_000,
  weeklyHours: 40,
  dependents: 1,
  children: 0,
  withholdingRate: 100,
  mealAllowance: 200_000,
  hireDate: '2025-08-01',
  jobType: 'CAREGIVER',
  seniorCaregiver: false,
  npsEnrolled: true,
  healthEnrolled: true,
  employmentEnrolled: true,
};
const HOURS = { regularHours: 209, overtimeHours: 0, nightHours: 0, holidayHours: 0, holidayOver8Hours: 0 };
const NONE = { otherAllowances: [], otherDeductions: [] };

test('급여대장 한 줄 — 월급 250만 + 식대 20만 + 장기근속 5만, 손으로 계산한 값', () => {
  const line = buildPayrollLine(CAREGIVER, HOURS, NONE, '2026-10');
  assert.equal(line.basePay, 2_500_000);
  assert.equal(line.longServiceAward, 50_000);
  assert.equal(line.mealAllowance, 200_000);
  assert.equal(line.grossPay, 2_750_000);
  assert.equal(line.taxablePay, 2_550_000);
  assert.equal(line.nps, 121_120);
  assert.equal(line.health, 91_670);
  assert.equal(line.ltc, 12_040);
  assert.equal(line.employment, 22_950);
  assert.equal(line.incomeTax, 37_310);
  assert.equal(line.localTax, 3_730);
  assert.equal(line.netPay, 2_461_180);
  assert.equal(line.employerNps, 121_120);
  assert.equal(line.employerHealth, 91_670);
  assert.equal(line.employerLtc, 12_040);
  assert.equal(line.employerEmployment, 29_320);
  assert.equal(line.payMonth, '2026-10');
  assert.equal(lineTotalsConsistent(line), true);
});

test('급여대장 한 줄 — 연장·야간·휴일·선임수당·기타 수당·기타 공제를 합에 넣는다', () => {
  const profile = { ...CAREGIVER, seniorCaregiver: true, mealAllowance: 0 };
  const line = buildPayrollLine(
    profile,
    { regularHours: 209, overtimeHours: 2, nightHours: 2, holidayHours: 8, holidayOver8Hours: 1 },
    { otherAllowances: [{ label: '교통비', amount: 30_000, taxable: true }, { label: '자격수당', amount: 20_000, taxable: false }], otherDeductions: [{ label: '식비', amount: 55_000 }] },
    '2026-10',
  );
  // 시급 11,962(2,500,000 ÷ 209 반올림): 연장 11,962×2×1.5 = 35,886 / 야간 11,962×2×0.5 = 11,962 / 휴일 11,962×8×1.5 = 143,544 / 초과 11,962×1×2 = 23,924
  assert.equal(line.overtimePay, 35_886);
  assert.equal(line.nightPay, 11_962);
  assert.equal(line.holidayPay, 143_544 + 23_924);
  assert.equal(line.seniorAllowance, 150_000);
  const gross = 2_500_000 + 35_886 + 11_962 + 143_544 + 23_924 + 50_000 + 150_000 + 30_000 + 20_000;
  assert.equal(line.grossPay, gross);
  // 비과세 기타 수당 20,000은 과세에서 빠진다
  assert.equal(line.taxablePay, gross - 20_000);
  assert.equal(lineTotalsConsistent(line), true);
  assert.equal(line.otherDeductions[0].amount, 55_000);
  assert.equal(line.netPay, line.grossPay - (line.nps + line.health + line.ltc + line.employment + line.incomeTax + line.localTax + 55_000));
});

test('급여대장 한 줄 — 식대가 한도 20만 원을 넘으면 넘은 만큼 과세', () => {
  assert.equal(MEAL_TAX_FREE_LIMIT, 200_000);
  const line = buildPayrollLine({ ...CAREGIVER, mealAllowance: 250_000 }, HOURS, NONE, '2026-10');
  assert.equal(line.grossPay, 2_500_000 + 50_000 + 250_000);
  assert.equal(line.taxablePay, line.grossPay - 200_000);
});

test('급여대장 한 줄 — 시급제는 시급 × 소정근로시간(0.1시간 단위, 원 미만 절사)', () => {
  const hourly: PayrollProfileCalc = { ...CAREGIVER, payType: 'HOURLY', baseAmount: 12_000, weeklyHours: 20, mealAllowance: 0, jobType: 'OFFICE', npsEnrolled: false, healthEnrolled: false, employmentEnrolled: true };
  const line = buildPayrollLine(hourly, { ...HOURS, regularHours: 86.5, overtimeHours: 1 }, NONE, '2026-10');
  assert.equal(line.basePay, 1_038_000);
  assert.equal(line.overtimePay, 18_000);
  assert.equal(line.nps, 0);
  assert.equal(line.health, 0);
  assert.equal(line.employment, 9_500);
  assert.equal(line.longServiceAward, 0);
  assert.equal(lineTotalsConsistent(line), true);
  const odd = buildPayrollLine({ ...hourly, baseAmount: 10_321 }, { ...HOURS, regularHours: 0.7 }, NONE, '2026-10');
  // 10,321 × 0.7 = 7,224.7 → 7,224
  assert.equal(odd.basePay, 7_224);
});

test('급여대장 한 줄 — 미가입 보험은 공제도 사업주 부담도 0', () => {
  const line = buildPayrollLine({ ...CAREGIVER, npsEnrolled: false, healthEnrolled: false, employmentEnrolled: false }, HOURS, NONE, '2026-10');
  assert.equal(line.nps + line.health + line.ltc + line.employment, 0);
  assert.equal(line.employerNps + line.employerHealth + line.employerLtc + line.employerEmployment, 0);
});

test('급여대장 한 줄 — 입력 시간은 0.1시간 단위로 맞추고 음수·NaN은 0', () => {
  const line = buildPayrollLine(CAREGIVER, { regularHours: 209.04, overtimeHours: -3, nightHours: Number.NaN, holidayHours: 1.25, holidayOver8Hours: 0 }, NONE, '2026-10');
  assert.equal(line.regularHours, 209);
  assert.equal(line.overtimeHours, 0);
  assert.equal(line.nightHours, 0);
  assert.equal(line.holidayHours, 1.3);
});

test('급여대장 한 줄 — 기타 수당·공제는 10줄까지만, 금액은 0 이상 정수로 정리한다', () => {
  const many = Array.from({ length: 12 }, (_, i) => ({ label: ` 수당${i} `, amount: 1_000.9, taxable: true }));
  const line = buildPayrollLine(CAREGIVER, HOURS, { otherAllowances: many, otherDeductions: [{ label: '음수', amount: -5 }] }, '2026-10');
  assert.equal(line.otherAllowances.length, 10);
  assert.equal(line.otherAllowances[0].label, '수당0');
  assert.equal(line.otherAllowances[0].amount, 1_000);
  assert.equal(line.otherDeductions[0].amount, 0);
});

test('급여대장 한 줄 — 자녀가 있으면 2026-03 전후 공제가 달라진다', () => {
  const profile = { ...CAREGIVER, dependents: 4, children: 1, baseAmount: 3_500_000, mealAllowance: 0, hireDate: '2026-09-01' };
  const after = buildPayrollLine(profile, HOURS, NONE, '2026-03');
  const before = buildPayrollLine(profile, HOURS, NONE, '2026-02');
  assert.equal(after.incomeTax, 28_510);
  assert.equal(before.incomeTax, 36_840);
});

test('급여대장 한 줄 — 선택 비율(120%)이 소득세에 반영된다', () => {
  const line = buildPayrollLine({ ...CAREGIVER, withholdingRate: 120, jobType: 'OFFICE' }, HOURS, NONE, '2026-10');
  // 과세 2,500,000 → 35,600 × 120% = 42,720
  assert.equal(line.incomeTax, 42_720);
  assert.equal(line.localTax, 4_270);
});

test('급여대장 한 줄 — 입소형 장기근속 옵션', () => {
  const line = buildPayrollLine({ ...CAREGIVER, hireDate: '2022-09-01' }, HOURS, NONE, '2026-10', { facility: 'RESIDENTIAL' });
  assert.equal(line.longServiceAward, 140_000);
});

test('lineTotalsConsistent — 총지급·실지급 합이 어긋나면 거짓', () => {
  const line = buildPayrollLine(CAREGIVER, HOURS, NONE, '2026-10');
  assert.equal(lineTotalsConsistent({ ...line, grossPay: line.grossPay + 1 }), false);
  assert.equal(lineTotalsConsistent({ ...line, netPay: line.netPay - 1 }), false);
});

// ---------- 검증 ----------

test('profileIssues — 서버 한도와 같은 범위를 검사한다', () => {
  assert.deepEqual(profileIssues(CAREGIVER), []);
  assert.equal(profileIssues({ ...CAREGIVER, baseAmount: 0 }).length, 1);
  assert.equal(profileIssues({ ...CAREGIVER, baseAmount: 20_000_001 }).length, 1);
  assert.equal(profileIssues({ ...CAREGIVER, baseAmount: 2_500_000.5 }).length, 1);
  assert.equal(profileIssues({ ...CAREGIVER, weeklyHours: 52.1 }).length, 1);
  assert.equal(profileIssues({ ...CAREGIVER, weeklyHours: 0.5 }).length, 1);
  assert.deepEqual(profileIssues({ ...CAREGIVER, weeklyHours: 52 }), []);
  assert.equal(profileIssues({ ...CAREGIVER, dependents: 12 }).length, 1);
  assert.equal(profileIssues({ ...CAREGIVER, dependents: 0 }).length, 1);
  assert.equal(profileIssues({ ...CAREGIVER, children: 11, dependents: 11 }).length, 1);
  assert.equal(profileIssues({ ...CAREGIVER, children: 1, dependents: 1 }).length, 1);
  assert.deepEqual(profileIssues({ ...CAREGIVER, children: 1, dependents: 2 }), []);
  assert.equal(profileIssues({ ...CAREGIVER, mealAllowance: 200_001 }).length, 1);
  assert.equal(profileIssues({ ...CAREGIVER, hireDate: '2026-02-30' }).length, 1);
  assert.equal(profileIssues({ ...CAREGIVER, withholdingRate: 90 as 100 }).length, 1);
  assert.equal(profileIssues({ ...CAREGIVER, jobType: 'PILOT' as 'OTHER' }).length, 1);
});

test('lineIssues — 시간·기타 줄·실지급 음수', () => {
  assert.deepEqual(lineIssues(HOURS, NONE), []);
  assert.equal(lineIssues({ ...HOURS, overtimeHours: -1 }, NONE).length, 1);
  assert.equal(lineIssues({ ...HOURS, nightHours: 1.25 }, NONE).length, 1);
  assert.equal(lineIssues({ ...HOURS, regularHours: 744.1 }, NONE).length, 1);
  assert.deepEqual(lineIssues({ ...HOURS, regularHours: 744 }, NONE), []);
  assert.equal(lineIssues(HOURS, { otherAllowances: Array.from({ length: 11 }, () => ({ label: 'a', amount: 1, taxable: true })), otherDeductions: [] }).length, 1);
  assert.equal(lineIssues(HOURS, { otherAllowances: [], otherDeductions: [{ label: 'a', amount: -1 }] }).length, 1);
  assert.equal(lineIssues(HOURS, NONE, { netPay: -1 }).length, 1);
  assert.deepEqual(lineIssues(HOURS, NONE, { netPay: 0 }), []);
});

test('대조 필요 목록 — 화면이 표시할 문구가 있고 모두 "대조 필요" 또는 근사·미적용을 밝힌다', () => {
  assert.ok(PAYROLL_VERIFY_NOTES.length >= 8);
  assert.ok(PAYROLL_VERIFY_NOTES.some((n) => n.includes('간이세액표')));
  assert.ok(PAYROLL_VERIFY_NOTES.every((n) => /대조 필요|근사|넣지 않았|직접/.test(n)));
});
