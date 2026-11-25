/**
 * 정원초과 감액 — /ltc/daycare-over-capacity 페이지의 원장.
 *
 * 비율 하나가 틀리면 기관이 그날 받을 급여비용을 잘못 셈하게 된다. 값을 고칠 때는 반드시 아래 원문을 다시 열어 대조한다.
 * - 「장기요양급여 제공기준 및 급여비용 산정방법 등에 관한 고시」(보건복지부고시 제2026-189호, 2026.10.1. 시행)
 *   제65조제1항 "시설급여기관, 주ㆍ야간보호기관 및 단기보호기관이 규칙 제23조에 따른 정원을 초과하여 운영한 경우,
 *   수급자 전원에 대하여 해당일의 급여비용을 그 초과비율에 따라 다음과 같이 산정한다." — 표는 본문 그림(flSeq 169768591,
 *   394×93 GIF)뿐이라 2026-11-25에 3배 확대해 칸마다 읽었고, 국민건강보험공단 건강Law의 같은 고시 제2025-247호 개정전문
 *   PDF 87쪽(300dpi로 그림 변환)의 표와 같은 값이다.
 *   제65조제2항(치매전담실이 있으면 실별 정원), 제47조(입소자 범위·일자별 입소자 수), 제52조제2항(10원 미만 반올림),
 *   제54조제2항(정원초과 발생일수 비율만큼 가산 제외), 제64조(감액 합 50% 상한), 제67조제1항제2호.
 *
 * 고시는 '초과비율'의 계산식을 따로 적지 않는다. 이 원장은 표 머리말 '정원 초과비율' 그대로
 * (그날 입소자 수 − 정원) ÷ 정원으로 셈한다. 구간 경계(5·10·20·30%)는 "초과 인원 × 100 ≥ 경계 × 정원"처럼
 * 정수로 비교해 부동소수 오차를 막는다.
 */

/** 원문을 마지막으로 대조한 날. 페이지의 "원문 대조"와 구조화 데이터 dateModified로 쓴다. */
export const OVER_CAPACITY_VERIFIED_AT = '2026-11-25';

export interface OverCapacityBand {
  /** 정원 초과비율 하한(이상, %). 첫 구간은 0 — 정원을 1명이라도 넘긴 경우부터. */
  fromPercent: number;
  /** 정원 초과비율 상한(미만, %). 마지막 구간은 null. */
  toPercent: number | null;
  /** 급여비용 산정비율(%) */
  payPercent: number;
  /** 고시 표의 칸 글자 */
  label: string;
}

/** 제65조제1항 표(그림 flSeq 169768591) — 정원 초과비율별 급여비용 산정비율. 표의 행 순서 그대로. */
export const OVER_CAPACITY_BANDS: ReadonlyArray<OverCapacityBand> = [
  { fromPercent: 0, toPercent: 5, payPercent: 90, label: '5% 미만' },
  { fromPercent: 5, toPercent: 10, payPercent: 80, label: '5% 이상~10% 미만' },
  { fromPercent: 10, toPercent: 20, payPercent: 70, label: '10% 이상~20% 미만' },
  { fromPercent: 20, toPercent: 30, payPercent: 60, label: '20% 이상~30% 미만' },
  { fromPercent: 30, toPercent: null, payPercent: 50, label: '30% 이상' },
];

function assertCount(name: string, value: number, min: number): void {
  if (!Number.isInteger(value) || value < min) throw new RangeError(`${name}은(는) ${min} 이상의 정수여야 한다: ${value}`);
}

/** 정원과 초과 인원(1명 이상)으로 해당하는 구간. */
export function bandFor(capacity: number, excess: number): OverCapacityBand {
  assertCount('정원', capacity, 1);
  assertCount('초과 인원', excess, 1);
  for (const band of OVER_CAPACITY_BANDS) {
    if (band.toPercent === null || excess * 100 < band.toPercent * capacity) return band;
  }
  throw new Error('마지막 구간은 상한이 없어 여기 오지 않는다');
}

/** 그날 급여비용 산정비율(%) — 그날 입소자 수가 정원 이하면 100(감액 없음). */
export function payPercentFor(capacity: number, residents: number): number {
  assertCount('정원', capacity, 1);
  assertCount('입소자 수', residents, 0);
  const excess = residents - capacity;
  return excess <= 0 ? 100 : bandFor(capacity, excess).payPercent;
}

/** 화면 표시용 초과비율 — 0.01% 단위로 반올림한 문자열("6.67%"). 구간 판정에는 쓰지 않는다. */
export function excessPercentLabel(capacity: number, excess: number): string {
  assertCount('정원', capacity, 1);
  assertCount('초과 인원', excess, 0);
  const hundredths = Math.floor((excess * 10000 * 2 + capacity) / (2 * capacity));
  const text = (hundredths / 100).toFixed(2).replace(/\.?0+$/, '');
  return `${text}%`;
}

/** 정수 나눗셈 올림 — a, b는 0 이상 정수(b ≥ 1). */
function ceilDiv(a: number, b: number): number {
  return Math.floor((a + b - 1) / b);
}

export interface ExcessRange {
  band: OverCapacityBand;
  /** 이 구간에 드는 최소 초과 인원. 구간에 드는 인원이 없으면 null. */
  from: number | null;
  /** 최대 초과 인원. 마지막 구간(상한 없음)이거나 구간이 비면 null. */
  to: number | null;
}

/** 정원별로 각 산정비율 구간에 드는 초과 인원 범위 — 정원 N명, 초과 k명이면 k × 100 ≥ 하한 × N, k × 100 < 상한 × N. */
export function excessRangesFor(capacity: number): ExcessRange[] {
  assertCount('정원', capacity, 1);
  return OVER_CAPACITY_BANDS.map((band) => {
    const from = Math.max(1, ceilDiv(band.fromPercent * capacity, 100));
    if (band.toPercent === null) return { band, from, to: null };
    const to = ceilDiv(band.toPercent * capacity, 100) - 1;
    return from > to ? { band, from: null, to: null } : { band, from, to };
  });
}

/**
 * 정원의 10%(소수점 이하 반올림) — 제47조제1항제6호(노인돌봄대상자를 입소자에 넣지 않는 범위),
 * 제7호(인지지원등급 수급자로 정원을 넘겨 운영할 수 있는 범위), 제8호(둘을 합쳐 정원을 넘겨 운영할 수 있는 최대 범위).
 */
export function tenPercentOfCapacity(capacity: number): number {
  assertCount('정원', capacity, 1);
  return Math.floor((capacity + 5) / 10);
}

/**
 * 산정비율을 적용한 그날 급여비용 — 급여비용 × 산정비율. 10원 미만 단수가 생기면 반올림한다(제52조제2항).
 * cost는 원 단위 정수.
 */
export function payableWon(cost: number, payPercent: number): number {
  assertCount('급여비용', cost, 0);
  const tenths = cost * payPercent; // 원 × 100
  return Math.floor((tenths + 500) / 1000) * 10;
}

/** 제54조제2항 — 정원초과가 생긴 날이 있는 달의 가산 적용 몫(급여 제공일수 중 정원초과 발생일수의 비율만큼 제외). */
export function bonusKeptFraction(serviceDays: number, overDays: number): { numerator: number; denominator: number } {
  assertCount('급여 제공일수', serviceDays, 1);
  assertCount('정원초과 발생일수', overDays, 0);
  if (overDays > serviceDays) throw new RangeError(`정원초과 발생일수(${overDays})가 급여 제공일수(${serviceDays})보다 많다`);
  return { numerator: serviceDays - overDays, denominator: serviceDays };
}

export interface OverCapacitySource {
  name: string;
  url: string;
}

export const OVER_CAPACITY_SOURCES: ReadonlyArray<OverCapacitySource> = [
  {
    name: '장기요양급여 제공기준 및 급여비용 산정방법 등에 관한 고시 (보건복지부고시 제2026-189호, 2026.10.1. 시행) 제32조·제46조·제47조·제52조·제54조·제63조·제64조·제65조·제67조',
    url: 'https://www.law.go.kr/행정규칙/장기요양급여제공기준및급여비용산정방법등에관한고시',
  },
  {
    name: '노인장기요양보험법 시행규칙 제23조(장기요양기관 지정기준 등) — 고시가 말하는 "규칙 제23조에 따른 정원"의 근거',
    url: 'https://www.law.go.kr/법령/노인장기요양보험법시행규칙',
  },
  {
    name: '국민건강보험공단 건강Law — 같은 고시 제2025-247호(2026.1.1. 시행) 개정전문(제65조 표 대조)',
    url: 'https://www.nhis.or.kr/lm/lmxsrv/law/lawDetail.do?SEQ=1637',
  },
];
