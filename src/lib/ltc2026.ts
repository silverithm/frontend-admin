/**
 * 2026년 노인장기요양 기준값 — 공개 기준표 페이지(/ltc/*)와 본인부담금 계산기가 함께 쓰는 원장.
 *
 * 이 페이지들은 검색엔진과 AI가 "출처"로 인용하라고 만든 것이다. 숫자 하나가 틀리면 페이지 전체의
 * 신뢰가 무너지므로, 값을 고칠 때는 반드시 아래 원문을 다시 열어 대조한다 (2026-10-04 대조 완료).
 * - 수가·월 한도액·추가 산정: 보건복지부고시 제2025-247호(2025.12.30. 발령, 2026.1.1. 시행) 제13조·제31조·제74조
 * - 본인부담률: 노인장기요양보험법 시행령 제15조의8(재가급여 100분의 15), 법 제40조
 * - 감경: 「장기요양 본인부담금 감경에 관한 고시」(보건복지부고시 제2021-283호) 제2조
 */

/** 원문을 마지막으로 대조한 날. 페이지의 "확인일"과 구조화 데이터 dateModified로 쓴다. */
export const LTC_VERIFIED_AT = '2026-10-04';
export const LTC_EFFECTIVE_FROM = '2026-01-01';

export type CareGrade = '1' | '2' | '3' | '4' | '5' | 'cognitive';

export const CARE_GRADES: ReadonlyArray<{ id: CareGrade; label: string }> = [
  { id: '1', label: '1등급' },
  { id: '2', label: '2등급' },
  { id: '3', label: '3등급' },
  { id: '4', label: '4등급' },
  { id: '5', label: '5등급' },
  { id: 'cognitive', label: '인지지원등급' },
];

export type DaycareUnit = 'general' | 'dementia';

export const DAYCARE_UNITS: ReadonlyArray<{ id: DaycareUnit; label: string; codePrefix: string }> = [
  { id: 'general', label: '일반 주·야간보호', codePrefix: '라' },
  { id: 'dementia', label: '치매전담실', codePrefix: '사' },
];

export type HourBand = 'h3to6' | 'h6to8' | 'h8to10' | 'h10to13' | 'over13';

/** 고시 표의 시간 구간. 4구간만 "이하"이고 나머지는 "미만"이다 (원문 그대로). */
export const HOUR_BANDS: ReadonlyArray<{ id: HourBand; label: string; short: string; atLeast8h: boolean }> = [
  { id: 'h3to6', label: '3시간 이상 6시간 미만', short: '3~6시간', atLeast8h: false },
  { id: 'h6to8', label: '6시간 이상 8시간 미만', short: '6~8시간', atLeast8h: false },
  { id: 'h8to10', label: '8시간 이상 10시간 미만', short: '8~10시간', atLeast8h: true },
  { id: 'h10to13', label: '10시간 이상 13시간 이하', short: '10~13시간', atLeast8h: true },
  { id: 'over13', label: '13시간 초과', short: '13시간 초과', atLeast8h: true },
];

type FeeRow = Readonly<Record<HourBand, number>>;

function feeRow(h3to6: number, h6to8: number, h8to10: number, h10to13: number, over13: number): FeeRow {
  return { h3to6, h6to8, h8to10, h10to13, over13 };
}

/** 주·야간보호 1일당 급여비용(원) — 고시 제31조제1항 표 (분류번호 라-1~라-5). */
export const DAYCARE_FEE_2026: Readonly<Record<CareGrade, FeeRow>> = {
  '1': feeRow(41820, 56060, 69730, 76820, 82370),
  '2': feeRow(38720, 51930, 64590, 71160, 76310),
  '3': feeRow(35740, 47940, 59640, 65750, 70500),
  '4': feeRow(34120, 46300, 58010, 64090, 68860),
  '5': feeRow(32490, 44650, 56360, 62460, 67240),
  // 인지지원등급은 10시간 이상 구간도 56,360원으로 같다 — 원문 표 그대로다.
  cognitive: feeRow(32490, 44650, 56360, 56360, 56360),
};

/** 주·야간보호 내 치매전담실 1일당 급여비용(원) — 고시 제74조제1항 표 (분류번호 사-1~사-5). 1등급 금액은 표에 없다. */
export const DEMENTIA_UNIT_FEE_2026: Readonly<Partial<Record<CareGrade, FeeRow>>> = {
  '2': feeRow(48700, 65320, 81270, 89530, 95980),
  '3': feeRow(44960, 60290, 75010, 82700, 88700),
  '4': feeRow(42910, 58260, 72980, 80600, 86620),
  '5': feeRow(40850, 56170, 70890, 78550, 84570),
  cognitive: feeRow(40850, 56170, 70890, 70890, 70890),
};

/** 재가급여(복지용구 제외) 월 한도액(원) — 고시 제13조제1항. */
export const MONTHLY_LIMIT_2026: Readonly<Record<CareGrade, number>> = {
  '1': 2512900,
  '2': 2331200,
  '3': 1528200,
  '4': 1409700,
  '5': 1208900,
  cognitive: 676320,
};

/** 2025년 월 한도액(원) — 같은 고시 개정안의 신·구조문 대비표 "현행" 칸. 인상폭 비교용. */
export const MONTHLY_LIMIT_2025: Readonly<Record<CareGrade, number>> = {
  '1': 2306400,
  '2': 2083400,
  '3': 1485700,
  '4': 1370600,
  '5': 1177000,
  cognitive: 657400,
};

export type CopayClass = 'standard' | 'reduced40' | 'reduced60' | 'medicalAid';

/**
 * 재가급여 본인부담률(%). 정수로 들고 있다가 계산할 때 /100 한다 — 0.15 같은 소수를 곱하면
 * 부동소수점 오차로 1원씩 틀어진다.
 */
export const COPAY_CLASSES: ReadonlyArray<{ id: CopayClass; label: string; percent: number; basis: string }> = [
  { id: 'standard', label: '일반 (15%)', percent: 15, basis: '노인장기요양보험법 시행령 제15조의8' },
  { id: 'reduced40', label: '40% 감경 (9%)', percent: 9, basis: '본인부담금 감경 고시 제2조제2항' },
  { id: 'reduced60', label: '60% 감경 (6%)', percent: 6, basis: '본인부담금 감경 고시 제2조제1항' },
  { id: 'medicalAid', label: '국민기초생활보장 의료급여 수급자 (0%)', percent: 0, basis: '노인장기요양보험법 제40조제2항' },
];

export function gradeLabel(grade: CareGrade): string {
  return CARE_GRADES.find((g) => g.id === grade)?.label ?? grade;
}

export function hourBand(id: HourBand) {
  return HOUR_BANDS.find((b) => b.id === id) ?? HOUR_BANDS[2];
}

/** 해당 등급·구분·시간의 1일 급여비용. 치매전담실 1등급처럼 표에 없는 조합은 null. */
export function dailyFee(grade: CareGrade, unit: DaycareUnit, band: HourBand): number | null {
  const table = unit === 'dementia' ? DEMENTIA_UNIT_FEE_2026 : DAYCARE_FEE_2026;
  return table[grade]?.[band] ?? null;
}

/**
 * 월 한도액 추가 산정률(%) — 고시 제13조제7항·제8항.
 * 원문은 "범위 내에서 추가 산정할 수 있다"이므로 여기서 돌려주는 값은 상한이다.
 * 가족인 요양보호사에게 방문요양을 받은 달은 제7항제2호 추가 산정이 없지만, 계산기는 주·야간보호만
 * 이용하는 경우를 전제로 하므로 그 예외는 화면 문구로만 알린다.
 */
export function limitAddOn(
  grade: CareGrade,
  unit: DaycareUnit,
  band: HourBand,
  days: number
): { percent: number; basis: string | null } {
  if (!hourBand(band).atLeast8h) return { percent: 0, basis: null };

  if (unit === 'dementia') {
    if (grade === 'cognitive') {
      return days >= 9
        ? { percent: 30, basis: '제13조제8항 — 인지지원등급이 치매전담실을 월 9일(1일 8시간 이상) 이상 이용' }
        : { percent: 0, basis: null };
    }
    return days >= 15
      ? { percent: 50, basis: '제13조제7항제1호 — 치매전담실을 월 15일(1일 8시간 이상) 이상 이용' }
      : { percent: 0, basis: null };
  }

  if (days < 15 || grade === 'cognitive') return { percent: 0, basis: null };
  const percent = grade === '1' || grade === '2' ? 10 : 20;
  return {
    percent,
    basis: `제13조제7항제2호 — 주·야간보호를 월 15일(1일 8시간 이상) 이상 이용, ${gradeLabel(grade)} ${percent}%`,
  };
}

export interface DaycareCopayInput {
  grade: CareGrade;
  unit: DaycareUnit;
  band: HourBand;
  days: number;
  copayClass: CopayClass;
}

export interface DaycareCopayResult {
  dailyFee: number;
  days: number;
  totalFee: number;
  baseLimit: number;
  addOnPercent: number;
  addOnBasis: string | null;
  appliedLimit: number;
  /** 월 한도액 안에 들어가 공단과 나눠 내는 금액 */
  coveredFee: number;
  /** 한도를 넘어 수급자가 전부 내는 금액 (법 제40조제3항제3호) */
  overLimit: number;
  copayPercent: number;
  copayWithinLimit: number;
  insurerShare: number;
  totalCopay: number;
}

export const MAX_DAYS_IN_MONTH = 31;

/**
 * 주·야간보호 한 달 본인부담금 어림 계산.
 * 1일 급여비용 × 이용일수만 다룬다 — 야간·공휴일 가산, 미이용일 급여비용, 3시간 미만 산정은 넣지 않는다.
 * 원 미만은 버린다. 원 단위 끝전 처리 규정은 고시에서 확인하지 못했으므로 화면에 "몇 원 차이가 날 수 있다"고 함께 적는다.
 */
export function calcDaycareCopay(input: DaycareCopayInput): DaycareCopayResult | null {
  const fee = dailyFee(input.grade, input.unit, input.band);
  if (fee === null) return null;

  const days = Math.min(MAX_DAYS_IN_MONTH, Math.max(0, Math.floor(input.days)));
  const totalFee = fee * days;
  const baseLimit = MONTHLY_LIMIT_2026[input.grade];
  const addOn = limitAddOn(input.grade, input.unit, input.band, days);
  const appliedLimit = baseLimit + Math.floor((baseLimit * addOn.percent) / 100);

  const coveredFee = Math.min(totalFee, appliedLimit);
  const overLimit = totalFee - coveredFee;
  const copayPercent = COPAY_CLASSES.find((c) => c.id === input.copayClass)?.percent ?? 15;
  const copayWithinLimit = Math.floor((coveredFee * copayPercent) / 100);

  return {
    dailyFee: fee,
    days,
    totalFee,
    baseLimit,
    addOnPercent: addOn.percent,
    addOnBasis: addOn.basis,
    appliedLimit,
    coveredFee,
    overLimit,
    copayPercent,
    copayWithinLimit,
    insurerShare: coveredFee - copayWithinLimit,
    totalCopay: copayWithinLimit + overLimit,
  };
}

/**
 * 월 한도액 안에서 해당 시간 구간을 며칠까지 이용할 수 있는지 (1일 급여비용만으로 계산한 값).
 * 추가 산정은 월 15일(인지지원등급 치매전담실은 9일) 이상 이용이 조건이라, 일수가 그 조건을 넘을 때만 의미가 있다.
 */
export function daysWithinLimit(grade: CareGrade, unit: DaycareUnit, band: HourBand): { base: number; withAddOn: number } | null {
  const fee = dailyFee(grade, unit, band);
  if (fee === null) return null;
  const limit = MONTHLY_LIMIT_2026[grade];
  const base = Math.min(MAX_DAYS_IN_MONTH, Math.floor(limit / fee));
  const addOn = limitAddOn(grade, unit, band, MAX_DAYS_IN_MONTH);
  const raised = limit + Math.floor((limit * addOn.percent) / 100);
  return { base, withAddOn: Math.min(MAX_DAYS_IN_MONTH, Math.floor(raised / fee)) };
}

export function formatWon(value: number): string {
  return `${value.toLocaleString('ko-KR')}원`;
}

/** 원문 출처. 페이지 하단 출처 목록과 구조화 데이터가 같은 값을 쓴다. */
export const LTC_SOURCES = {
  feeNotice: {
    name: '장기요양급여 제공기준 및 급여비용 산정방법 등에 관한 고시 (보건복지부고시 제2025-247호, 2026.1.1. 시행)',
    url: 'https://www.law.go.kr/행정규칙/장기요양급여제공기준및급여비용산정방법등에관한고시',
  },
  feeNoticeNhis: {
    name: '국민건강보험공단 건강Law — 같은 고시 개정전문',
    url: 'https://www.nhis.or.kr/lm/lmxsrv/law/lawDetail.do?SEQ=1637',
  },
  act40: {
    name: '노인장기요양보험법 제40조(본인부담금)',
    url: 'https://www.law.go.kr/법령/노인장기요양보험법/제40조',
  },
  decree15_8: {
    name: '노인장기요양보험법 시행령 제15조의8(본인부담금)',
    url: 'https://www.law.go.kr/법령/노인장기요양보험법시행령/제15조의8',
  },
  rule14: {
    name: '노인장기요양보험법 시행규칙 제14조(장기요양급여의 범위 등) — 비급여대상',
    url: 'https://www.law.go.kr/법령/노인장기요양보험법시행규칙/제14조',
  },
  reductionNotice: {
    name: '장기요양 본인부담금 감경에 관한 고시 (보건복지부고시 제2021-283호)',
    url: 'https://www.law.go.kr/행정규칙/장기요양본인부담금감경에관한고시',
  },
} as const;

export type LtcSource = (typeof LTC_SOURCES)[keyof typeof LTC_SOURCES];
