/**
 * 노인요양공동생활가정 급여비용 가산 — /ltc/group-home-staffing-bonus 페이지의 원장.
 *
 * 점수 하나가 틀리면 기관이 받을 금액을 잘못 셈하게 된다. 값을 고칠 때는 반드시 아래 원문을 다시 열어 대조한다.
 * - 「장기요양급여 제공기준 및 급여비용 산정방법 등에 관한 고시」(보건복지부고시 제2026-189호, 2026.10.1. 시행)
 *   제55조제1항제1호나목(요양보호사 1인당 입소자 수 2.4명 미만)·제2호·제3호, 제55조제3항제2호(조리원 1명 이상 배치),
 *   제56조제1항(계산식 그림 flSeq 169768541, 시설급여 80%, 제2호가목~다목, 제3호가목 서비스유형점수),
 *   제56조제2항(가산점수 인정범위 표 그림 169768583 아래 표 — '노인요양공동생활가정·주·야간보호기관·단기보호기관' 칸),
 *   제56조제3항(가산점수의 합에 0.4점/0.25점을 더하고 인정범위에 포함하지 않음), 제59조(간호사배치), 제60조제2항(야간직원배치),
 *   제62조(맞춤형서비스제공). 2026-11-24에 본문과 그림을 다시 받았다(그림 sha256은 2026-11-17·11-23에 읽은 것과 같다 —
 *   169768583 ed6e90e3…, 169768541 fc43c2dd…, 169768581 4a4d680b…).
 * - 의무 인원(인력배치기준): 노인복지법 시행규칙 별표 4 제6호 — 요양보호사 입소자 3명당 1명(치매전담형 2.5명당 1명)
 *   + 고시 제48조제1항 반올림 — ltcNursingHomeStaffing.requiredStaff.
 *
 * 별표 4는 공동생활가정의 간호사 또는 간호조무사·물리치료사 또는 작업치료사 두 칸을 합쳐 '1명'으로, 시설의 장·사무국장·
 * 사회복지사 세 칸을 합쳐 '1명'으로 적는다. 합친 칸을 넘겨 둔 인원을 어느 직종의 추가 배치로 셀지는 고시 문장에 없어서,
 * 이 원장의 인원 계산은 요양보호사만 한다(다른 직종은 점수만 옮긴다).
 *
 * 제56조제2항 단서가 인정범위에서 빼는 조리원 점수(제1항제2호다목)는 '노인요양시설 및 주ㆍ야간보호기관'의 것이다.
 * 공동생활가정은 단서에 없으므로 이 원장은 공동생활가정의 조리원 1.2점을 인정범위 안에서 센다.
 * 점수는 0.1점 단위 정수(tenths)지만 제56조제3항의 0.25점 때문에 합은 0.01점 단위 정수(hundredths)로 셈한다.
 * 1인당 입소자 수는 0.01명 단위 정수로 셈해 부동소수 오차를 막는다.
 */

import { requiredStaff } from './ltcNursingHomeStaffing.ts';
import { CAP_BANDS, perHeadHundredths } from './ltcStaffingBonus.ts';

/** 원문을 마지막으로 대조한 날. 페이지의 "원문 대조"와 구조화 데이터 dateModified로 쓴다. */
export const GROUP_HOME_BONUS_VERIFIED_AT = '2026-11-24';

export type GroupHomeType = 'general' | 'dementia';

/** 요양보호사 의무 인원 비율 — 별표 4 제6호: 입소자 3명당 1명(치매전담형 2.5명당 1명). */
const RATIO: Readonly<Record<GroupHomeType, 'groupHome' | 'groupHomeDementia'>> = {
  general: 'groupHome',
  dementia: 'groupHomeDementia',
};

/** 요양보호사 1인당 입소자 수 상한(미만) — 제55조제1항제1호나목 "노인요양공동생활가정 : 2.4명 미만". 0.01명 단위 정수. */
export const CAREGIVER_PER_HEAD_BELOW = 240;

/** 간호(조무)사 1인당 입소자 수 상한(미만) — 제55조제1항제2호 "19.0명 미만". 0.01명 단위 정수. */
export const NURSE_PER_HEAD_BELOW = 1900;

/**
 * 가산점수 — 0.01점 단위 정수(제56조제3항 0.25점 때문에).
 * - caregiver·nurse: 요양보호사 또는 간호(조무)사 추가 1인당 1.2점 (제56조제1항제2호가목)
 * - socialWorker·therapist: 사회복지사 또는 물리(작업)치료사 추가 1인당 1.4점 (나목)
 * - cook: 조리원 — 인원수에 관계없이 노인요양공동생활가정 1.2점 (다목), 요건은 제55조제3항제2호 "조리원을 1명 이상 배치"
 * - withCaregiver·withoutCaregiver: 제56조제3항 "요양보호사가 포함된 경우 0.4점", "포함되지 않은 경우 0.25점"
 * - registeredNurse: 간호사배치 가산 간호사 1인당 0.6점 (제59조제1항)
 * - night: 야간직원배치 가산 기관당 0.9점 (제60조제2항)
 * - customLong·customShort: 맞춤형서비스제공 주 4회 또는 월 16회 이상 0.5점, 주 2~3회 또는 월 8회 이상 0.25점 (제62조제2항)
 */
export const POINTS = {
  caregiver: 120,
  nurse: 120,
  socialWorker: 140,
  therapist: 140,
  cook: 120,
  withCaregiver: 40,
  withoutCaregiver: 25,
  registeredNurse: 60,
  night: 90,
  customLong: 50,
  customShort: 25,
} as const;

/** 해당 월 가산 기준금액 — 제56조제1항제1호 "시설급여의 경우 수급자별 급여비용 합의 80%". */
export const BASE_AMOUNT_PERCENT = 80;

/** 서비스유형점수 — 제56조제1항제3호가목 "시설급여기관 : 1점(치매전담형 노인요양공동생활가정 … 0.9점)". 0.1점 단위. */
export const SERVICE_TYPE_POINTS: Readonly<Record<GroupHomeType, number>> = { general: 10, dementia: 9 };

/** 0.01점 단위 정수 → "1.2" / "0.25" (0.1점 단위로 떨어지면 소수 한 자리). */
export function formatPoints(hundredths: number): string {
  return hundredths % 10 === 0 ? (hundredths / 100).toFixed(1) : (hundredths / 100).toFixed(2);
}

/** 가산점수 인정범위 칸 — 제56조제2항 아래 표(공동생활가정·주·야간보호·단기보호가 같은 칸). 정원 9명 이하라 두 구간만 쓴다. */
export const GROUP_HOME_CAP_BANDS = CAP_BANDS.filter((band) => band.from < 10);

/** 입소자 수에 따른 가산점수 인정범위(0.01점 단위) — 제56조제2항. */
export function capFor(residents: number): number {
  if (!Number.isInteger(residents) || residents < 1) throw new RangeError(`입소자 수는 1 이상의 정수여야 한다: ${residents}`);
  const band = CAP_BANDS.find((b) => residents >= b.from && (b.below === null || residents < b.below));
  if (!band) throw new RangeError(`입소자 수가 표 밖이다: ${residents}`);
  return band.cap * 10;
}

/** 요양보호사 의무 인원 — 별표 4 제6호 + 고시 제48조제1항(반올림, 0.5 미만이면 기본 1명). */
export function requiredCaregivers(residents: number, type: GroupHomeType): number {
  return requiredStaff(residents, RATIO[type]);
}

/** 요양보호사 가산 요건 — 제55조제1항 본문(인력배치기준 초과)과 제1호나목(1인당 입소자 수 2.4명 미만, 제3호 절사). */
export function caregiverBonusEligible(residents: number, caregivers: number, type: GroupHomeType): boolean {
  return caregivers > requiredCaregivers(residents, type) && perHeadHundredths(residents, caregivers) < CAREGIVER_PER_HEAD_BELOW;
}

/** 요양보호사 가산 요건을 처음 채우는 근무인원. */
export function firstBonusCaregivers(residents: number, type: GroupHomeType): number {
  let caregivers = requiredCaregivers(residents, type) + 1;
  while (!caregiverBonusEligible(residents, caregivers, type)) caregivers += 1;
  return caregivers;
}

export interface CaregiverBand {
  from: number;
  to: number;
  required: number;
  firstBonus: number;
}

/** 의무 인원과 가산 시작 인원이 같은 입소자 수 구간 — 표로 보여 주려고 묶는다. */
export function caregiverBands(type: GroupHomeType, fromResidents: number, toResidents: number): CaregiverBand[] {
  const bands: CaregiverBand[] = [];
  for (let residents = fromResidents; residents <= toResidents; residents += 1) {
    const required = requiredCaregivers(residents, type);
    const firstBonus = firstBonusCaregivers(residents, type);
    const last = bands[bands.length - 1];
    if (last && last.required === required && last.firstBonus === firstBonus) {
      last.to = residents;
    } else {
      bands.push({ from: residents, to: residents, required, firstBonus });
    }
  }
  return bands;
}

export type AddedRole = 'caregiver' | 'nurse' | 'socialWorker' | 'therapist';

export interface GroupHomeBonusInput {
  /** 그달 입소자 수 — 제47조로 센 월 입소자 수(정수) */
  residents: number;
  /** 직종별로 인력배치기준을 넘겨 추가 배치했고 제55조 요건을 채운 인원 */
  added: Partial<Record<AddedRole, number>>;
  /** 조리원을 1명 이상 배치한 경우 — 제55조제3항제2호 */
  cook?: boolean;
}

export interface GroupHomeBonusPoints {
  /** 직종별 점수 합(조리원 포함) */
  raw: number;
  /** 제56조제2항 인정범위 */
  cap: number;
  /** 인정되는 점수 = min(raw, cap) */
  recognized: number;
  /** 제56조제3항 — 요양보호사 포함 0.4점, 미포함 0.25점, 인력추가배치가산이 없으면 0. 인정범위에 포함하지 않는다. */
  groupHomeExtra: number;
  /** 계산식에 넣는 가산점수의 합 = recognized + groupHomeExtra */
  total: number;
}

/** 인력추가배치 가산점수의 합 — 제56조제1항제2호, 제2항, 제3항. 0.01점 단위 정수. */
export function groupHomeBonusPoints(input: GroupHomeBonusInput): GroupHomeBonusPoints {
  const { residents, added } = input;
  let raw = 0;
  for (const role of ['caregiver', 'nurse', 'socialWorker', 'therapist'] as const) {
    const count = added[role] ?? 0;
    if (!Number.isInteger(count) || count < 0) throw new RangeError(`추가 인원은 0 이상의 정수여야 한다: ${role} ${count}`);
    raw += count * POINTS[role];
  }
  if (input.cook) raw += POINTS.cook;
  const cap = capFor(residents);
  const recognized = Math.min(raw, cap);
  const groupHomeExtra = raw === 0 ? 0 : (added.caregiver ?? 0) > 0 ? POINTS.withCaregiver : POINTS.withoutCaregiver;
  return { raw, cap, recognized, groupHomeExtra, total: recognized + groupHomeExtra };
}

/**
 * 가산금액 — 제56조제1항 계산식
 * "가산금액 = 해당 월 가산 기준금액 × [가산점수의 합/입소자수] × 서비스유형점수"
 * 기준금액은 수급자별 급여비용 합의 80%, 10원 미만은 반올림(제52조제2항).
 * benefitCostSum은 원 단위 정수, 점수는 0.01점 단위 정수, 서비스유형점수는 0.1점 단위 정수.
 */
export function bonusAmountWon(benefitCostSum: number, totalPoints: number, residents: number, serviceTypePoints: number): number {
  if (!Number.isInteger(benefitCostSum) || benefitCostSum < 0) throw new RangeError(`급여비용 합은 0 이상의 정수(원)여야 한다: ${benefitCostSum}`);
  if (!Number.isInteger(residents) || residents < 1) throw new RangeError(`입소자 수는 1 이상의 정수여야 한다: ${residents}`);
  // 금액 = 합 × 80/100 × (점수/100) / 입소자 × (유형점수/10) = 합 × 80 × 점수 × 유형점수 / (100000 × 입소자)
  const numerator = benefitCostSum * BASE_AMOUNT_PERCENT * totalPoints * serviceTypePoints;
  const denominator = 100000 * residents;
  return Math.floor((numerator + 5 * denominator) / (10 * denominator)) * 10;
}

export interface BonusSource {
  name: string;
  url: string;
}

export const GROUP_HOME_BONUS_SOURCES: ReadonlyArray<BonusSource> = [
  {
    name: '장기요양급여 제공기준 및 급여비용 산정방법 등에 관한 고시 (보건복지부고시 제2026-189호, 2026.10.1. 시행) 제47조·제48조·제51조·제52조·제53조·제54조·제55조·제56조·제59조·제60조·제62조·제70조·제72조',
    url: 'https://www.law.go.kr/행정규칙/장기요양급여제공기준및급여비용산정방법등에관한고시',
  },
  {
    name: '노인복지법 시행규칙 [별표 4] 노인의료복지시설의 시설기준 및 직원배치기준 — 노인요양공동생활가정 입소정원 5명 이상 9명 이하, 요양보호사 입소자 3명당 1명(치매전담형 2.5명당 1명)',
    url: 'https://www.law.go.kr/법령/노인복지법시행규칙',
  },
];
