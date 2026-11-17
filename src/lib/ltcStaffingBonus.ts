/**
 * 주·야간보호(주간보호센터) 인력추가배치 가산 — /ltc/daycare-staffing-bonus 페이지의 원장.
 *
 * 점수 하나가 틀리면 기관이 받을 금액을 잘못 셈하게 된다. 값을 고칠 때는 반드시 아래 원문을 다시 열어 대조한다.
 * - 「장기요양급여 제공기준 및 급여비용 산정방법 등에 관한 고시」(보건복지부고시 제2026-189호, 2026.10.1. 시행)
 *   제55조(인력추가배치 가산) — 요건, 제56조(인력추가배치 가산 금액 등) — 기준금액·가산점수·서비스유형점수·인정범위.
 *   제56조제1항의 계산식과 제2항·제4항의 표는 국가법령정보센터 본문에 그림(GIF)으로만 실려 있다
 *   (flSeq=169768541 계산식, 169768583 가산점수 인정범위, 169768585 인정범위 추가산정).
 *   2026-11-17에 그림을 내려받아 확대하고, 흐린 숫자(6·8)는 화소를 찍어 칸마다 읽었다.
 * - 의무 인원(인력배치기준): 노인복지법 시행규칙 별표 9 + 고시 제48조제1항 — ltcStaffing.requiredCaregivers.
 * - 가산·감액 공통 규칙: 제47조(입소자 수), 제51조(근무인원), 제52조(범위·10원 미만 반올림), 제54조(가산 원칙).
 *
 * 이 원장의 계산은 일반실만 있는 주·야간보호를 기준으로 한다. 치매전담실이 함께 있거나 치매전담실만 있는 기관은
 * 기준금액·입소자 수·서비스유형점수가 달라지므로(제56조제1항제1호가목·나목, 제3호나목) 페이지에서 원문 문장으로만 안내한다.
 * 점수는 0.1점 단위 정수(tenths), 1인당 이용자 수는 0.01명 단위 정수(hundredths)로 셈해 부동소수 오차를 막는다.
 */

import { requiredCaregivers, type CareUnit } from './ltcStaffing.ts';

/** 원문을 마지막으로 대조한 날. 페이지의 "원문 대조"와 구조화 데이터 dateModified로 쓴다. */
export const BONUS_VERIFIED_AT = '2026-11-17';

/**
 * 요양보호사 1인당 이용자 수가 이 값 '미만'이어야 가산 — 제55조제1항제1호다목
 * "주ㆍ야간보호기관 : 6.4명 미만(치매전담형 3.9명 미만)". 0.01명 단위 정수.
 */
export const CAREGIVER_PER_HEAD_BELOW: Readonly<Record<CareUnit, number>> = { general: 640, dementia: 390 };

/** 간호(조무)사 1인당 이용자 수 상한(미만) — 제55조제1항제2호 "19.0명 미만". 0.01명 단위 정수. */
export const NURSE_PER_HEAD_BELOW = 1900;

/**
 * 직원 1인당 이용자 수 — 제55조제1항제3호 "입소자 수를 근무인원 수로 나누어 계산하고, 계산 결과 소수점 셋째자리에서 절사".
 * 0.01명 단위 정수로 돌려준다(642 = 6.42명).
 */
export function perHeadHundredths(users: number, staff: number): number {
  if (!Number.isInteger(users) || users < 1 || !Number.isInteger(staff) || staff < 1) {
    throw new RangeError(`이용자 수와 근무인원 수는 1 이상의 정수여야 한다: ${users} / ${staff}`);
  }
  return Math.floor((users * 100) / staff);
}

/** 0.01명 단위 정수 → "6.42" */
export function formatHundredths(value: number): string {
  return (value / 100).toFixed(2);
}

/**
 * 요양보호사 가산 요건 — 제55조제1항 본문(인력배치기준 초과)과 제1호다목(1인당 이용자 수 미만).
 * 근무인원은 제51조로 센 정수(시간 합산은 가산에서 소수점 이하 버림, 제51조제3항제1호)를 넘긴다.
 */
export function caregiverBonusEligible(users: number, caregivers: number, unit: CareUnit): boolean {
  return caregivers > requiredCaregivers(users, unit) && perHeadHundredths(users, caregivers) < CAREGIVER_PER_HEAD_BELOW[unit];
}

/** 가산 요건을 처음 채우는 요양보호사 근무인원 — 의무 인원보다 많고 1인당 이용자 수가 기준 미만이 되는 가장 작은 수. */
export function firstBonusCaregivers(users: number, unit: CareUnit): number {
  let caregivers = requiredCaregivers(users, unit) + 1;
  while (!caregiverBonusEligible(users, caregivers, unit)) caregivers += 1;
  return caregivers;
}

export interface BonusStartBand {
  from: number;
  to: number;
  /** 의무 인원(제48조제1항) */
  required: number;
  /** 가산 요건을 처음 채우는 근무인원 */
  firstBonus: number;
}

/** 의무 인원과 가산 시작 인원이 같은 이용자 수 구간 — 표로 보여 주려고 묶는다. */
export function bonusStartBands(unit: CareUnit, maxUsers: number): BonusStartBand[] {
  const bands: BonusStartBand[] = [];
  for (let users = 1; users <= maxUsers; users += 1) {
    const required = requiredCaregivers(users, unit);
    const firstBonus = firstBonusCaregivers(users, unit);
    const last = bands[bands.length - 1];
    if (last && last.required === required && last.firstBonus === firstBonus) {
      last.to = users;
    } else {
      bands.push({ from: users, to: users, required, firstBonus });
    }
  }
  return bands;
}

export type BonusRole = 'caregiver' | 'nurse' | 'socialWorker' | 'therapist';

/** 추가 배치 1명당 가산점수 — 제56조제1항제2호가목·나목. 0.1점 단위 정수. */
export const POINTS_PER_ADDED: Readonly<Record<BonusRole, number>> = {
  caregiver: 12,
  nurse: 12,
  socialWorker: 14,
  therapist: 14,
};

export const ROLE_LABELS: Readonly<Record<BonusRole, string>> = {
  caregiver: '요양보호사',
  nurse: '간호(조무)사',
  socialWorker: '사회복지사',
  therapist: '물리(작업)치료사',
};

/** 조리원 — 제56조제1항제2호다목 "인원수에 관계없이 … 주ㆍ야간보호기관의 경우 1.2점". 0.1점 단위 정수. */
export const COOK_POINTS = 12;

/** 서비스유형점수 — 제56조제1항제3호나목 "주ㆍ야간보호기관 : 1.5점(치매전담실만 있는 주ㆍ야간보호기관은 1.3점)". */
export const SERVICE_TYPE_POINTS = { general: 15, dementiaOnly: 13 } as const;

/** 해당 월 가산 기준금액 — 제56조제1항제1호 "재가급여의 경우 수급자별 급여비용 합의 85%". */
export const BASE_AMOUNT_PERCENT = 85;

/** 0.1점 단위 정수 → "1.2" */
export function formatPoints(tenths: number): string {
  return (tenths / 10).toFixed(1);
}

export interface CapBand {
  /** 이상 */
  from: number;
  /** 미만 (null = 상한 없음) */
  below: number | null;
  /** 가산점수 인정범위(이하), 0.1점 단위 */
  cap: number;
}

/** 가산점수 인정범위 — 제56조제2항 표 중 '노인요양공동생활가정·주·야간보호기관·단기보호기관' 행. */
export const CAP_BANDS: ReadonlyArray<CapBand> = [
  { from: 0, below: 5, cap: 14 },
  { from: 5, below: 10, cap: 26 },
  { from: 10, below: 30, cap: 40 },
  { from: 30, below: 50, cap: 64 },
  { from: 50, below: 70, cap: 88 },
  { from: 70, below: 80, cap: 100 },
  { from: 80, below: 90, cap: 112 },
  { from: 90, below: 120, cap: 136 },
  { from: 120, below: null, cap: 148 },
];

export interface ExtraCapStep {
  /** 요양보호사 추가 배치 인원 */
  caregivers: number;
  /** 마지막 단계는 'n명 이상' */
  orMore: boolean;
  /** 인정범위에 더하는 점수, 0.1점 단위 */
  extra: number;
}

export interface ExtraCapBand {
  from: number;
  below: number | null;
  steps: ReadonlyArray<ExtraCapStep>;
}

/** 가산점수 인정범위 추가산정 — 제56조제4항 표(주·야간보호기관·단기보호기관, 입소자 10인 이상). */
export const EXTRA_CAP_BANDS: ReadonlyArray<ExtraCapBand> = [
  { from: 10, below: 30, steps: [{ caregivers: 3, orMore: false, extra: 12 }, { caregivers: 4, orMore: true, extra: 24 }] },
  { from: 30, below: 50, steps: [{ caregivers: 4, orMore: false, extra: 12 }, { caregivers: 5, orMore: true, extra: 24 }] },
  { from: 50, below: 70, steps: [{ caregivers: 5, orMore: false, extra: 12 }, { caregivers: 6, orMore: true, extra: 24 }] },
  { from: 70, below: 90, steps: [{ caregivers: 6, orMore: false, extra: 12 }, { caregivers: 7, orMore: true, extra: 24 }] },
  {
    from: 90,
    below: 120,
    steps: [
      { caregivers: 7, orMore: false, extra: 12 },
      { caregivers: 8, orMore: false, extra: 24 },
      { caregivers: 9, orMore: true, extra: 36 },
    ],
  },
  {
    from: 120,
    below: null,
    steps: [
      { caregivers: 8, orMore: false, extra: 12 },
      { caregivers: 9, orMore: false, extra: 24 },
      { caregivers: 10, orMore: true, extra: 36 },
    ],
  },
];

/** "30명 이상 50명 미만" — 원문 표의 행 이름 그대로. */
export function bandLabel(band: { from: number; below: number | null }): string {
  if (band.from === 0) return `${band.below}명 미만`;
  if (band.below === null) return `${band.from}명 이상`;
  return `${band.from}명 이상 ${band.below}명 미만`;
}

function inBand(users: number, band: { from: number; below: number | null }): boolean {
  return users >= band.from && (band.below === null || users < band.below);
}

/** 이용자 수에 따른 가산점수 인정범위(0.1점 단위) — 제56조제2항. */
export function capFor(users: number): number {
  const band = CAP_BANDS.find((b) => inBand(users, b));
  if (!band) throw new RangeError(`이용자 수가 표 밖이다: ${users}`);
  return band.cap;
}

/** 인정범위 추가산정(0.1점 단위) — 제56조제4항. 이용자 10명 미만이거나 요양보호사 추가 인원이 표의 최소에 못 미치면 0. */
export function extraCapFor(users: number, addedCaregivers: number): number {
  const band = EXTRA_CAP_BANDS.find((b) => inBand(users, b));
  if (!band) return 0;
  let extra = 0;
  for (const step of band.steps) {
    if (step.orMore ? addedCaregivers >= step.caregivers : addedCaregivers === step.caregivers) extra = step.extra;
  }
  return extra;
}

export interface BonusPointsInput {
  /** 그달 이용자 수 — 제47조로 센 월 입소자 수(정수) */
  users: number;
  /** 직종별로 인력배치기준을 넘겨 추가 배치했고 제55조 요건을 채운 인원 */
  added: Partial<Record<BonusRole, number>>;
  /** 조리원을 기준보다 1명 이상 더 둔 경우(급식위탁기관 제외) — 제55조제3항제1호 */
  cookAdded?: boolean;
}

export interface BonusPoints {
  /** 직종별 점수 합(조리원 제외) */
  raw: number;
  /** 제56조제2항 인정범위 */
  cap: number;
  /** 제56조제4항 추가산정 — 인정범위를 넘었을 때만 */
  extraCap: number;
  /** 인정되는 직종별 점수 = min(raw, cap + extraCap) */
  recognized: number;
  /** 조리원 점수 — 인정범위에 포함하지 않는다(제56조제2항 단서) */
  cook: number;
  /** 계산식에 넣는 가산점수의 합 = recognized + cook */
  total: number;
}

/** 가산점수의 합 — 제56조제1항제2호, 제2항(단서 포함), 제4항. 모두 0.1점 단위 정수. */
export function bonusPoints(input: BonusPointsInput): BonusPoints {
  const { users, added } = input;
  if (!Number.isInteger(users) || users < 1) throw new RangeError(`이용자 수는 1 이상의 정수여야 한다: ${users}`);
  let raw = 0;
  for (const role of Object.keys(POINTS_PER_ADDED) as BonusRole[]) {
    const count = added[role] ?? 0;
    if (!Number.isInteger(count) || count < 0) throw new RangeError(`추가 인원은 0 이상의 정수여야 한다: ${role} ${count}`);
    raw += count * POINTS_PER_ADDED[role];
  }
  const cap = capFor(users);
  const extraCap = raw > cap ? extraCapFor(users, added.caregiver ?? 0) : 0;
  const recognized = Math.min(raw, cap + extraCap);
  const cook = input.cookAdded ? COOK_POINTS : 0;
  return { raw, cap, extraCap, recognized, cook, total: recognized + cook };
}

/**
 * 가산금액 — 제56조제1항 계산식
 * "가산금액 = 해당 월 가산 기준금액 × [가산점수의 합/입소자수] × 서비스유형점수"
 * 기준금액은 수급자별 급여비용 합(월 한도액 범위 안, 제52조제1항)의 85%, 10원 미만은 반올림(제52조제2항).
 * benefitCostSum은 원 단위 정수, 점수는 0.1점 단위 정수.
 */
export function bonusAmountWon(benefitCostSum: number, totalPoints: number, users: number, serviceTypePoints: number): number {
  if (!Number.isInteger(benefitCostSum) || benefitCostSum < 0) throw new RangeError(`급여비용 합은 0 이상의 정수(원)여야 한다: ${benefitCostSum}`);
  if (!Number.isInteger(users) || users < 1) throw new RangeError(`이용자 수는 1 이상의 정수여야 한다: ${users}`);
  // 금액 = 합 × 85/100 × (점수/10) / 이용자 × (유형점수/10) = 합 × 85 × 점수 × 유형점수 / (10000 × 이용자)
  const numerator = benefitCostSum * BASE_AMOUNT_PERCENT * totalPoints * serviceTypePoints;
  const denominator = 10000 * users;
  return Math.floor((numerator + 5 * denominator) / (10 * denominator)) * 10;
}

export interface BonusSource {
  name: string;
  url: string;
}

export const BONUS_SOURCES: ReadonlyArray<BonusSource> = [
  {
    name: '장기요양급여 제공기준 및 급여비용 산정방법 등에 관한 고시 (보건복지부고시 제2026-189호, 2026.10.1. 시행) 제47조·제48조·제51조·제52조·제53조·제54조·제55조·제56조·제59조·제62조·제70조',
    url: 'https://www.law.go.kr/행정규칙/장기요양급여제공기준및급여비용산정방법등에관한고시',
  },
  {
    name: '노인복지법 시행규칙 [별표 9] 재가노인복지시설의 시설기준 및 직원배치기준 — 요양보호사 이용자 7명당 1명(치매전담실 4명당 1명)',
    url: 'https://www.law.go.kr/법령/노인복지법시행규칙',
  },
];
