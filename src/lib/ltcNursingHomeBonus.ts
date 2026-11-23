/**
 * 요양원(노인요양시설) 급여비용 가산 — /ltc/nursing-home-staffing-bonus 페이지의 원장.
 *
 * 점수 하나가 틀리면 기관이 받을 금액을 잘못 셈하게 된다. 값을 고칠 때는 반드시 아래 원문을 다시 열어 대조한다.
 * - 「장기요양급여 제공기준 및 급여비용 산정방법 등에 관한 고시」(보건복지부고시 제2026-189호, 2026.10.1. 시행)
 *   제53조(가산 유형 표 — 본문 그림 flSeq 169768581), 제54조(가산 원칙), 제55조(인력추가배치 가산 요건),
 *   제56조(가산 금액 — 계산식 그림 169768541, 가산점수 인정범위 표 그림 169768583 중 '노인요양시설' 칸),
 *   제56조의2(노인요양시설 요양보호사 초과 배치 한시 가산), 제59조(간호사배치), 제60조(야간직원배치), 제62조(맞춤형서비스제공).
 *   2026-11-23에 본문을 다시 받고 그림을 내려받아 확대해 읽었다. 2.6·6.6·7.8처럼 흐린 숫자는 화소를 찍어 6과 8을 갈랐다
 *   (그림 sha256은 2026-11-17에 읽은 것과 같다 — 169768583 ed6e90e3…, 169768541 fc43c2dd…, 169768581 4a4d680b…).
 * - 제56조의2 유효기간: 부칙 <제2024-295호> 제4조, 부칙 <제2025-115호> 제3조 — 2026년 12월 31일까지.
 * - 의무 인원(인력배치기준): 노인복지법 시행규칙 별표 4 제6호 + 고시 제44조제1항·제48조제1항 — ltcNursingHomeStaffing.requiredStaff.
 *
 * 이 원장의 계산은 치매전담실이 없는 노인요양시설을 기준으로 한다. 치매전담실이 있으면 기준금액·입소자 수·서비스유형점수가
 * 달라지므로(제56조제1항제1호가목·나목, 제3호가목) 페이지에서 원문 문장으로만 안내한다.
 * 점수는 0.1점 단위 정수(tenths), 1인당 입소자 수는 0.01명 단위 정수(hundredths)로 셈해 부동소수 오차를 막는다.
 */

import { requiredStaff } from './ltcNursingHomeStaffing.ts';
import { perHeadHundredths } from './ltcStaffingBonus.ts';

/** 원문을 마지막으로 대조한 날. 페이지의 "원문 대조"와 구조화 데이터 dateModified로 쓴다. */
export const NURSING_HOME_BONUS_VERIFIED_AT = '2026-11-23';

/** 제56조의2(한시 가산)가 효력을 갖는 마지막 날 — 부칙 <제2024-295호> 제4조, <제2025-115호> 제3조. */
export const TEMP_BONUS_EXPIRES = '2026-12-31';

/** 간호(조무)사 1인당 입소자 수 상한(미만) — 제55조제1항제2호 "19.0명 미만". 0.01명 단위 정수. */
export const NURSE_PER_HEAD_BELOW = 1900;

/**
 * 가산점수 — 0.1점 단위 정수.
 * - nurse: 간호(조무)사 추가 1인당 1.2점 (제56조제1항제2호가목)
 * - socialWorker·therapist: 사회복지사·물리(작업)치료사 추가 1인당 1.4점 (나목)
 * - cook: 조리원 — 인원수에 관계없이 노인요양시설 1점 (다목)
 * - dementiaCaregiver: 치매전담실 요양보호사 추가 1인당 1.3점, 실별 최대 2명 (마목 단서)
 * - tempCaregiver: 요양보호사 초과 배치 한시 가산 1인당 1.3점 (제56조의2제1호)
 * - registeredNurse: 간호사배치 가산 간호사 1인당 0.6점 (제59조제1항), 입소자 50인 이상 노인요양시설은 0.2점을 더함 (제2항)
 * - night: 야간직원배치 가산 기관당 또는 야간직원 1인당 0.9점 (제60조제1항제1호·제2호)
 */
export const POINTS = {
  nurse: 12,
  socialWorker: 14,
  therapist: 14,
  cook: 10,
  dementiaCaregiver: 13,
  tempCaregiver: 13,
  registeredNurse: 6,
  registeredNurse50Plus: 2,
  night: 9,
} as const;

/** 치매전담실 요양보호사 가산 인원 상한(실별) — 제56조제1항제2호마목 단서 "각 실별 최대 2명까지". */
export const DEMENTIA_UNIT_MAX_ADDED = 2;

/** 해당 월 가산 기준금액 — 제56조제1항제1호 "시설급여의 경우 수급자별 급여비용 합의 80%". */
export const BASE_AMOUNT_PERCENT = 80;

/** 서비스유형점수 — 제56조제1항제3호가목 "시설급여기관 : 1점(치매전담형 노인요양공동생활가정, 치매전담실만 있는 노인요양시설은 0.9점)". */
export const SERVICE_TYPE_POINTS = { general: 10, dementiaOnly: 9 } as const;

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

/** 가산점수 인정범위 — 제56조제2항 표 중 '노인요양시설' 칸(본문 그림 flSeq 169768583 윗표). */
export const NURSING_HOME_CAP_BANDS: ReadonlyArray<CapBand> = [
  { from: 0, below: 10, cap: 14 },
  { from: 10, below: 30, cap: 26 },
  { from: 30, below: 50, cap: 40 },
  { from: 50, below: 70, cap: 52 },
  { from: 70, below: 90, cap: 66 },
  { from: 90, below: null, cap: 78 },
];

/** "30명 이상 50명 미만" — 원문 표의 행 이름 그대로. */
export function capBandLabel(band: { from: number; below: number | null }): string {
  if (band.from === 0) return `${band.below}명 미만`;
  if (band.below === null) return `${band.from}명 이상`;
  return `${band.from}명 이상 ${band.below}명 미만`;
}

/** 입소자 수에 따른 가산점수 인정범위(0.1점 단위) — 제56조제2항. */
export function capFor(residents: number): number {
  if (!Number.isInteger(residents) || residents < 1) throw new RangeError(`입소자 수는 1 이상의 정수여야 한다: ${residents}`);
  const band = NURSING_HOME_CAP_BANDS.find((b) => residents >= b.from && (b.below === null || residents < b.below));
  if (!band) throw new RangeError(`입소자 수가 표 밖이다: ${residents}`);
  return band.cap;
}

/**
 * 간호사 또는 간호조무사 의무 인원 — 별표 4 제6호: 입소자 30명 이상 '입소자 25명당 1명', 30명 미만 10명 이상 '1명'.
 * 25명당은 고시 제48조제1항으로 소수점 이하 반올림(0.5 미만이면 1명).
 */
export function requiredNurses(residents: number): number {
  if (!Number.isInteger(residents) || residents < 10) throw new RangeError(`노인요양시설 입소자 수는 10 이상의 정수로 계산한다: ${residents}`);
  return residents >= 30 ? requiredStaff(residents, 'perTwentyFive') : 1;
}

/** 간호(조무)사 가산 요건 — 제55조제1항 본문(인력배치기준 초과)과 제2호(1인당 입소자 수 19.0명 미만, 제3호 절사). */
export function nurseBonusEligible(residents: number, nurses: number): boolean {
  return nurses > requiredNurses(residents) && perHeadHundredths(residents, nurses) < NURSE_PER_HEAD_BELOW;
}

/** 간호(조무)사 가산 요건을 처음 채우는 근무인원. */
export function firstNurseBonusStaff(residents: number): number {
  let nurses = requiredNurses(residents) + 1;
  while (!nurseBonusEligible(residents, nurses)) nurses += 1;
  return nurses;
}

export interface NurseBonusBand {
  from: number;
  to: number;
  /** 의무 인원 */
  required: number;
  /** 가산 요건을 처음 채우는 근무인원 */
  firstBonus: number;
}

/** 의무 인원과 가산 시작 인원이 같은 입소자 수 구간 — 표로 보여 주려고 묶는다. */
export function nurseBonusBands(fromResidents: number, toResidents: number): NurseBonusBand[] {
  const bands: NurseBonusBand[] = [];
  for (let residents = fromResidents; residents <= toResidents; residents += 1) {
    const required = requiredNurses(residents);
    const firstBonus = firstNurseBonusStaff(residents);
    const last = bands[bands.length - 1];
    if (last && last.required === required && last.firstBonus === firstBonus) {
      last.to = residents;
    } else {
      bands.push({ from: residents, to: residents, required, firstBonus });
    }
  }
  return bands;
}

/** 치매전담실 한 실의 요양보호사 가산점수 — 제56조제1항제2호마목 단서(실별 최대 2명 × 1.3점). 0.1점 단위. */
export function dementiaUnitPoints(addedCaregivers: number): number {
  if (!Number.isInteger(addedCaregivers) || addedCaregivers < 0) throw new RangeError(`추가 인원은 0 이상의 정수여야 한다: ${addedCaregivers}`);
  return Math.min(addedCaregivers, DEMENTIA_UNIT_MAX_ADDED) * POINTS.dementiaCaregiver;
}

/**
 * 한시 가산 한도 — 제56조의2 본문·제1호: 전월(기준월) 대비 감소한 요양보호사 의무배치인원 수.
 * 의무 인원은 제44조제1항(입소자 2.1명당 1명, 반올림)으로 센다. 줄지 않았으면 0.
 */
export function tempBonusLimit(baseMonthResidents: number, residents: number): number {
  return Math.max(0, requiredStaff(baseMonthResidents, 'nursingHome') - requiredStaff(residents, 'nursingHome'));
}

/**
 * 한시 가산점수 — 제56조의2제1호: 인력배치기준을 초과하여 배치된 요양보호사 1인당 1.3점, 한도는 감소한 의무 인원 수. 0.1점 단위.
 * caregivers는 그달 요양보호사 근무인원(제51조로 센 정수).
 */
export function tempBonusPoints(baseMonthResidents: number, residents: number, caregivers: number): number {
  if (!Number.isInteger(caregivers) || caregivers < 0) throw new RangeError(`근무인원은 0 이상의 정수여야 한다: ${caregivers}`);
  const excess = Math.max(0, caregivers - requiredStaff(residents, 'nursingHome'));
  return Math.min(excess, tempBonusLimit(baseMonthResidents, residents)) * POINTS.tempCaregiver;
}

export type CappedRole = 'nurse' | 'socialWorker' | 'therapist';

export const CAPPED_ROLE_LABELS: Readonly<Record<CappedRole, string>> = {
  nurse: '간호(조무)사',
  socialWorker: '사회복지사',
  therapist: '물리(작업)치료사',
};

export interface NursingHomeBonusInput {
  /** 그달 입소자 수 — 제47조로 센 월 입소자 수(정수) */
  residents: number;
  /** 직종별로 인력배치기준을 넘겨 추가 배치했고 제55조 요건을 채운 인원 */
  added: Partial<Record<CappedRole, number>>;
  /** 조리원을 기준보다 1명 이상 더 둔 경우(급식위탁기관 제외) — 제55조제3항제1호 */
  cookAdded?: boolean;
}

export interface NursingHomeBonusPoints {
  /** 간호(조무)사·사회복지사·물리(작업)치료사 점수 합 */
  raw: number;
  /** 제56조제2항 노인요양시설 인정범위 */
  cap: number;
  /** 인정되는 점수 = min(raw, cap) — 노인요양시설에는 제4항 추가산정이 없다 */
  recognized: number;
  /** 조리원 점수 — 인정범위에 포함하지 않는다(제56조제2항 단서) */
  cook: number;
  /** 계산식에 넣는 가산점수의 합 = recognized + cook */
  total: number;
}

/** 인력추가배치 가산점수의 합(치매전담실 없는 노인요양시설) — 제56조제1항제2호, 제2항. 0.1점 단위 정수. */
export function nursingHomeBonusPoints(input: NursingHomeBonusInput): NursingHomeBonusPoints {
  const { residents, added } = input;
  let raw = 0;
  for (const role of Object.keys(CAPPED_ROLE_LABELS) as CappedRole[]) {
    const count = added[role] ?? 0;
    if (!Number.isInteger(count) || count < 0) throw new RangeError(`추가 인원은 0 이상의 정수여야 한다: ${role} ${count}`);
    raw += count * POINTS[role];
  }
  const cap = capFor(residents);
  const recognized = Math.min(raw, cap);
  const cook = input.cookAdded ? POINTS.cook : 0;
  return { raw, cap, recognized, cook, total: recognized + cook };
}

/**
 * 가산금액 — 제56조제1항 계산식
 * "가산금액 = 해당 월 가산 기준금액 × [가산점수의 합/입소자수] × 서비스유형점수"
 * 기준금액은 수급자별 급여비용 합의 80%, 10원 미만은 반올림(제52조제2항).
 * benefitCostSum은 원 단위 정수, 점수·서비스유형점수는 0.1점 단위 정수.
 */
export function bonusAmountWon(benefitCostSum: number, totalPoints: number, residents: number, serviceTypePoints: number): number {
  if (!Number.isInteger(benefitCostSum) || benefitCostSum < 0) throw new RangeError(`급여비용 합은 0 이상의 정수(원)여야 한다: ${benefitCostSum}`);
  if (!Number.isInteger(residents) || residents < 1) throw new RangeError(`입소자 수는 1 이상의 정수여야 한다: ${residents}`);
  // 금액 = 합 × 80/100 × (점수/10) / 입소자 × (유형점수/10) = 합 × 80 × 점수 × 유형점수 / (10000 × 입소자)
  const numerator = benefitCostSum * BASE_AMOUNT_PERCENT * totalPoints * serviceTypePoints;
  const denominator = 10000 * residents;
  return Math.floor((numerator + 5 * denominator) / (10 * denominator)) * 10;
}

export interface BonusSource {
  name: string;
  url: string;
}

export const NURSING_HOME_BONUS_SOURCES: ReadonlyArray<BonusSource> = [
  {
    name: '장기요양급여 제공기준 및 급여비용 산정방법 등에 관한 고시 (보건복지부고시 제2026-189호, 2026.10.1. 시행) 제44조·제47조·제48조·제51조·제52조·제53조·제54조·제55조·제56조·제56조의2·제59조·제60조·제62조·제70조, 부칙 <제2024-295호> 제4조, 부칙 <제2025-115호> 제2조·제3조',
    url: 'https://www.law.go.kr/행정규칙/장기요양급여제공기준및급여비용산정방법등에관한고시',
  },
  {
    name: '노인복지법 시행규칙 [별표 4] 노인의료복지시설의 시설기준 및 직원배치기준 — 간호사 또는 간호조무사 입소자 25명당 1명(30명 미만 10명 이상 1명), 요양보호사 입소자 2.1명당 1명(치매전담실 2명당 1명)',
    url: 'https://www.law.go.kr/법령/노인복지법시행규칙',
  },
];
