/**
 * 예방접종 규칙 — 평가 접종률 환산(2026 지표 32)과 올해 인플루엔자 접종 진행 현황. 전부 브라우저 안에서 도는 순수 함수다.
 *
 * 근거(research-10): 평가 기준일은 평가 연도 − 2년의 12월 31일, 분모는 그날 급여를 유지한 수급자,
 * 분자는 그중 평가 연도 − 1년에 인플루엔자 접종을 받은 수급자, 접종 거부 기록은 분모에서 뺀다.
 * 확인 못 한 것(대조 필요): 80% 미만의 점수(0점으로 둔다), EXCLUDED(제외) 사유의 인정 범위, "급여 유지"가 계약 유지인지 실이용인지.
 * 2026·2027 평가는 충족 처리다(평가시행세칙 대조 필요).
 */
import { isValidYmd } from './labDate.ts';
import { percentOneDecimal } from './percentRound.ts';
import type { VaccinationStatus, VaccineKind } from './labTypes.ts';

export interface VaccineContract {
  elderlyId: number;
  contractStart: string;
  contractEnd: string | null;
}

export interface VaccineRecord {
  elderlyId: number;
  seasonYear: number;
  vaccine: VaccineKind;
  status: VaccinationStatus;
}

export interface VaccineRateResult {
  /** 기준일에 급여를 유지한 수급자 수 */
  eligible: number;
  /** 거부·제외로 분자·분모에서 뺀 수 */
  excluded: number;
  denominator: number;
  vaccinated: number;
  /** 소수 첫째 자리 백분율. 분모 0이면 null */
  rate: number | null;
  /** 1 · 0.75 · 0.5 · 0 (80% 미만 점수는 대조 필요). rate가 null이면 null */
  score: number | null;
  /** 2026·2027 재가 정기평가는 충족 처리 */
  autoMet: boolean;
}

/** 이 평가 연도까지는 접종률과 관계없이 충족 처리한다 */
export const VACCINE_AUTO_MET_UNTIL_YEAR = 2027;

/** 평가 기준일 = (평가 연도 − 2)년 12월 31일 */
export function vaccineBaseDate(evalYear: number): string {
  return `${String(evalYear - 2).padStart(4, '0')}-12-31`;
}

/** 어르신 한 명의 인플루엔자 기록에서 가장 센 상태 하나를 고른다: 접종 > 거부 > 제외 > 미확인 */
function strongestStatus(statuses: readonly VaccinationStatus[]): VaccinationStatus | null {
  for (const s of ['DONE', 'REFUSED', 'EXCLUDED', 'UNKNOWN'] as const) if (statuses.includes(s)) return s;
  return null;
}

function influenzaByElder(vaccinations: readonly VaccineRecord[], year: number): Map<number, VaccinationStatus[]> {
  const map = new Map<number, VaccinationStatus[]>();
  for (const v of vaccinations) {
    if (v.vaccine !== 'INFLUENZA' || v.seasonYear !== year) continue;
    const list = map.get(v.elderlyId);
    if (list) list.push(v.status);
    else map.set(v.elderlyId, [v.status]);
  }
  return map;
}

/**
 * 점수 — 매뉴얼은 접종률을 "소수점 첫째자리 반올림"한 값으로 정의하고 그 값으로 구간을 가른다(9차 경력직·보수교육과 같은 방식).
 * 그래서 89.96%는 접종률 90.0%로 0.75점, 99.96%는 100.0%로 1점이다.
 */
function scoreOf(rate: number | null): number | null {
  if (rate === null) return null;
  if (rate >= 100) return 1;
  if (rate >= 90) return 0.75;
  if (rate >= 80) return 0.5;
  return 0;
}

/**
 * 평가 접종률 환산. 기준일 B = (evalYear−2)-12-31.
 * eligible = 계약 중 contractStart ≤ B이고 (contractEnd 없음 또는 contractEnd ≥ B)인 것이 하나라도 있는 어르신.
 * 그 어르신의 (evalYear−1)년 인플루엔자 기록: 접종(DONE)이 하나라도 있으면 vaccinated, 아니면 거부·제외가 있으면 excluded.
 */
export function evalVaccineRate(contracts: readonly VaccineContract[], vaccinations: readonly VaccineRecord[], evalYear: number): VaccineRateResult {
  const base = vaccineBaseDate(evalYear);
  const eligibleIds = new Set<number>();
  for (const c of contracts) {
    if (!isValidYmd(c.contractStart) || c.contractStart.slice(0, 10) > base) continue;
    if (c.contractEnd !== null && c.contractEnd !== '' && (!isValidYmd(c.contractEnd) || c.contractEnd.slice(0, 10) < base)) continue;
    eligibleIds.add(c.elderlyId);
  }
  const byElder = influenzaByElder(vaccinations, evalYear - 1);
  let vaccinated = 0;
  let excluded = 0;
  for (const id of eligibleIds) {
    const status = strongestStatus(byElder.get(id) ?? []);
    if (status === 'DONE') vaccinated += 1;
    else if (status === 'REFUSED' || status === 'EXCLUDED') excluded += 1;
  }
  const denominator = eligibleIds.size - excluded;
  const rate = percentOneDecimal(vaccinated, denominator);
  return {
    eligible: eligibleIds.size,
    excluded,
    denominator,
    vaccinated,
    rate,
    score: scoreOf(rate),
    autoMet: evalYear <= VACCINE_AUTO_MET_UNTIL_YEAR,
  };
}

export interface SeasonProgress {
  total: number;
  done: number;
  refused: number;
  excluded: number;
  /** 기록 없음·UNKNOWN */
  unknown: number;
  /** done / (total − refused − excluded), 소수 첫째 자리. 분모 0이면 null */
  rate: number | null;
}

/** 올해(year) 진행 중 어르신의 인플루엔자 접종 진행 현황. 같은 어르신 id가 겹쳐도 한 명으로 센다. */
export function seasonProgress(activeElderIds: readonly number[], vaccinations: readonly VaccineRecord[], year: number): SeasonProgress {
  const ids = [...new Set(activeElderIds)];
  const byElder = influenzaByElder(vaccinations, year);
  let done = 0;
  let refused = 0;
  let excluded = 0;
  for (const id of ids) {
    const status = strongestStatus(byElder.get(id) ?? []);
    if (status === 'DONE') done += 1;
    else if (status === 'REFUSED') refused += 1;
    else if (status === 'EXCLUDED') excluded += 1;
  }
  const unknown = ids.length - done - refused - excluded;
  return { total: ids.length, done, refused, excluded, unknown, rate: percentOneDecimal(done, ids.length - refused - excluded) };
}
