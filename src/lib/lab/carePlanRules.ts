/**
 * 욕구사정·급여제공계획 점검.
 *
 * 평가는 어르신마다 "올해 계획이 있고, 수급자(보호자)에게 설명하고 동의받았는가"를 본다.
 * 계획은 있는데 동의일이 비어 있으면 서류상 절반이라 NEEDS_AGREEMENT, 작년 계획은 올해 것이 아니므로 MISSING이다.
 */
import type { CarePlan, CarePlanNeeds } from './labTypes.ts';
import { parseYmd } from './labDate.ts';

export type CarePlanStatus = 'MISSING' | 'NEEDS_AGREEMENT' | 'OK';

export const CARE_PLAN_STATUS_LABEL: Readonly<Record<CarePlanStatus, string>> = {
  MISSING: '계획 없음',
  NEEDS_AGREEMENT: '동의 필요',
  OK: '동의 완료',
};

export const CARE_PLAN_NEEDS_LABEL: Readonly<Record<keyof CarePlanNeeds, string>> = {
  physical: '신체 기능',
  cognition: '인지·정서',
  nutrition: '영양·식사',
  communication: '의사소통',
  family: '가족·환경',
  other: '기타 요구',
  disease: '질병상태',
  oral: '구강상태',
  subjective: '주관적 욕구',
  resources: '자원이용 욕구',
  summary: '총평',
  avoidFoods: '기피식품',
};

/** 점검에 필요한 칸만 */
export type CarePlanLike = Pick<CarePlan, 'planYear' | 'guardianAgreedOn'>;

/** 올해 계획이 없으면 MISSING, 있는데 보호자 동의일이 없거나 날짜가 아니면 NEEDS_AGREEMENT, 둘 다 있으면 OK. */
export function carePlanStatus(plan: CarePlanLike | null | undefined, year: number): CarePlanStatus {
  if (!plan || plan.planYear !== year) return 'MISSING';
  return parseYmd(plan.guardianAgreedOn ?? null) ? 'OK' : 'NEEDS_AGREEMENT';
}

const RANK: Record<CarePlanStatus, number> = { MISSING: 0, NEEDS_AGREEMENT: 1, OK: 2 };

export interface CarePlanCoverage {
  total: number;
  ok: number;
  needsAgreement: number;
  missing: number;
  /** 계획과 동의를 갖춘 어르신 비율(0~100, 반올림). 어르신이 없으면 0 */
  percent: number;
  perElder: Record<number, CarePlanStatus>;
}

/**
 * 어르신 전체의 올해 계획 현황. plans에 다른 기관·퇴소한 어르신의 계획이 섞여 있어도 elderIds에 없으면 세지 않는다.
 * 한 어르신의 계획이 여럿 오면(연도별 목록 등) 가장 나은 상태를 쓴다.
 */
export function carePlanCoverage(
  plans: ReadonlyArray<CarePlanLike & { elderlyId: number }>,
  elderIds: ReadonlyArray<number>,
  year: number,
): CarePlanCoverage {
  const perElder: Record<number, CarePlanStatus> = {};
  const unique = [...new Set(elderIds)];
  for (const id of unique) perElder[id] = 'MISSING';
  for (const plan of plans) {
    if (!Object.hasOwn(perElder, plan.elderlyId)) continue;
    const status = carePlanStatus(plan, year);
    if (RANK[status] > RANK[perElder[plan.elderlyId]]) perElder[plan.elderlyId] = status;
  }
  const values = unique.map((id) => perElder[id]);
  const ok = values.filter((s) => s === 'OK').length;
  const needsAgreement = values.filter((s) => s === 'NEEDS_AGREEMENT').length;
  return {
    total: unique.length,
    ok,
    needsAgreement,
    missing: unique.length - ok - needsAgreement,
    percent: unique.length === 0 ? 0 : Math.round((ok / unique.length) * 100),
    perElder,
  };
}

/**
 * 계획서가 "구체적인가"의 최소 점검 — 비어 있는 부분의 이름을 돌려준다(비어 있으면 []가 아니라 항목이 나온다).
 * 평가 요건은 욕구사정에 근거한 구체적인 목표·서비스 내용이다.
 */
export function carePlanGaps(plan: Pick<CarePlan, 'goals' | 'services'> & { needs: Partial<CarePlanNeeds> }): string[] {
  const gaps: string[] = [];
  const needs = plan.needs ?? ({} as Partial<CarePlanNeeds>);
  const filled = (Object.keys(CARE_PLAN_NEEDS_LABEL) as Array<keyof CarePlanNeeds>).filter((k) => typeof needs[k] === 'string' && needs[k]!.trim() !== '');
  if (filled.length === 0) gaps.push('욕구사정 내용');
  if (!plan.goals || plan.goals.trim() === '') gaps.push('목표');
  const services = Array.isArray(plan.services) ? plan.services.filter((s) => s && s.content.trim() !== '') : [];
  if (services.length === 0) gaps.push('제공 서비스');
  else if (services.some((s) => s.frequency.trim() === '')) gaps.push('서비스별 제공 횟수·주기');
  return gaps;
}
