/**
 * 직원 인사 규칙 — 경력직 비율(평가 4)·요양보호사 보수교육(평가 5)·직원 건강검진(평가 15). 전부 브라우저 안에서 도는 순수 함수다.
 *
 * 근거(research-9): 노인장기요양보험법 시행령 제11조의2(매 2년 8시간)·시행규칙 제11조의3(합격 후 2년 미만 면제)·
 * 산업안전보건법 시행규칙 제197조(사무직 2년, 그 밖 1년)·2026 평가매뉴얼 4·5·15.
 * 평가 4·5의 산정은 공단 전산(인력신고·이수내역)이 정본이다. 여기 결과는 기관이 입력한 기준으로 센 "지금 기준 추정"이다.
 * 날짜는 'YYYY-MM-DD' 문자열이고 "오늘"은 호출하는 쪽이 한국 달력으로 정해 asOf로 넘긴다(여기서 new Date()를 쓰지 않는다).
 */
import { daysBetween, daysInMonth, formatYmd, parseYmd } from './labDate.ts';
import type { StaffCertKind, StaffProfileJobType } from './labTypes.ts';

export interface HrProfile {
  memberId: number;
  hireDate: string;
  jobType: StaffProfileJobType;
  birthYear: number | null;
  licensePassedOn: string | null;
  officeWorker: boolean;
}

export interface HrCert {
  memberId: number;
  kind: StaffCertKind;
  doneOn: string;
  hours: number | null;
}

/** 보수교육 시간 기준(시행령 제11조의2 — 매 2년마다 8시간 이상) */
export const CONTINUING_EDU_MIN_HOURS = 8;
/** 건강검진 만료 임박으로 보는 남은 일수 */
export const HEALTH_CHECK_SOON_DAYS = 30;

/** 소수 첫째 자리 반올림(정수 계산): 분수 num/den를 % 한 자리로. den이 0이면 null. */
function percent1(num: number, den: number): number | null {
  if (den <= 0) return null;
  // (num/den)*100 을 0.1 단위로 half-up → num*1000/den 을 정수 반올림, 부동소수 없이
  return Math.floor((num * 2000 + den) / (2 * den)) / 10;
}

/** 'YYYY-MM-DD'에 해를 더한다. 2월 29일 + 1년은 2월 28일(만료일이 하루 빨라지는 쪽이 안전하다). 날짜가 틀리면 null. */
export function addYearsClamped(ymd: string, years: number): string | null {
  const p = parseYmd(ymd);
  if (!p || !Number.isInteger(years)) return null;
  const y = p.year + years;
  return formatYmd(y, p.month, Math.min(p.day, daysInMonth(y, p.month)));
}

/**
 * 꽉 찬 근속 개월 = (연 차 × 12 + 월 차) − (asOf 일 < 입사 일이면 1). 입사 전이거나 날짜가 틀리면 0.
 * 입사일이 31일이면 30일까지만 있는 달에는 말일이어도 아직 한 달이 안 찬 것으로 센다(계약 식 그대로).
 */
export function tenureMonths(hireDate: string, asOf: string): number {
  const h = parseYmd(hireDate);
  const a = parseYmd(asOf);
  if (!h || !a) return 0;
  const months = (a.year - h.year) * 12 + (a.month - h.month) - (a.day < h.day ? 1 : 0);
  return months > 0 ? months : 0;
}

/** 이미 일하고 있는 직원인가(입사일이 asOf 이후인 예정자는 비율에서 뺀다). */
function isWorking(p: Pick<HrProfile, 'hireDate'>, asOf: string): boolean {
  const d = daysBetween(p.hireDate, asOf);
  return d !== null && d >= 0;
}

export interface ExperiencedRatio {
  /** 연속 근무 기준 개월 수 — 24, 기관 운영 24개월 미만이면 12 */
  threshold: number;
  eligible: number;
  total: number;
  /** %, 소수 첫째 자리 반올림. 직원이 없으면 null */
  ratio: number | null;
  /** 50% 이상 1점, 30% 이상 0.75점, 그 밖 0(30% 미만 점수는 매뉴얼 표에 없어 대조 필요). 직원이 없으면 null */
  score: number | null;
}

/**
 * 경력직 비율 추정. 입사일 기준 "지금까지" 이어 근무한 것으로 본다 — 퇴직·재입사·휴업·법인 내 이동·제외 사유(정년·사망 등)는
 * 공단 전산이 따로 보므로 화면은 '지금 기준 추정'으로 표시해야 한다. 대표자 겸 시설장 제외는 기관이 직원 기준에서 빼서 입력한다.
 * 점수는 매뉴얼처럼 반올림한 비율로 가른다.
 */
export function experiencedRatio(profiles: ReadonlyArray<Pick<HrProfile, 'hireDate'>>, asOf: string, facilityOpenedOn?: string | null): ExperiencedRatio {
  const threshold = facilityOpenedOn && parseYmd(facilityOpenedOn) && tenureMonths(facilityOpenedOn, asOf) < 24 ? 12 : 24;
  const working = profiles.filter((p) => isWorking(p, asOf));
  const eligible = working.filter((p) => tenureMonths(p.hireDate, asOf) >= threshold).length;
  const total = working.length;
  const ratio = percent1(eligible, total);
  const score = ratio === null ? null : ratio >= 50 ? 1 : ratio >= 30 ? 0.75 : 0;
  return { threshold, eligible, total, ratio, score };
}

/** 출생연도와 연도의 홀짝이 같으면 보수교육 대상(2025년 홀수년생 → 2027년도 홀수년생, 짝수년생은 짝수 해). 출생연도가 없으면 false. */
export function isEduTargetYear(birthYear: number | null | undefined, year: number): boolean {
  if (typeof birthYear !== 'number' || !Number.isInteger(birthYear) || !Number.isInteger(year)) return false;
  return Math.abs(birthYear % 2) === Math.abs(year % 2);
}

export type ContinuingEduStatusKind = 'NOT_REQUIRED' | 'EXEMPT' | 'NOT_TARGET' | 'DONE' | 'DUE' | 'MISSED' | 'UNKNOWN';

export interface ContinuingEduStatus {
  status: ContinuingEduStatusKind;
  /** 그 해 CONTINUING_EDU 시간 합(소수 첫째 자리) */
  hours: number;
}

function yearOf(ymd: string): number | null {
  return parseYmd(ymd)?.year ?? null;
}

/** 그 해 보수교육 이수 시간 합 — 0.1시간 단위 정수로 더해 부동소수 오차를 막는다. */
function eduHours(memberId: number, certs: ReadonlyArray<HrCert>, year: number): number {
  let tenths = 0;
  for (const c of certs) {
    if (c.memberId !== memberId || c.kind !== 'CONTINUING_EDU' || typeof c.hours !== 'number' || !(c.hours > 0)) continue;
    if (yearOf(c.doneOn) !== year) continue;
    tenths += Math.round(c.hours * 10);
  }
  return tenths / 10;
}

/**
 * 한 직원의 그 해 보수교육 상태.
 * 순서: 요양보호사 아님 → 면제(합격일이 그 해 1월 1일 기준 2년 미만) → 그 해 12월 31일 이후 입사(대상 아님) → 출생연도 없음 → 홀짝 → 시간.
 * 11월 이후 신규 입사자의 차기 연도 이수 예외(평가 Q&A)는 입사일·재입사 이력을 몰라 다루지 않는다(대조 필요).
 */
export function continuingEduStatus(profile: HrProfile, certs: ReadonlyArray<HrCert>, year: number, asOf: string): ContinuingEduStatus {
  if (profile.jobType !== 'CAREGIVER') return { status: 'NOT_REQUIRED', hours: 0 };
  const hours = eduHours(profile.memberId, certs, year);
  // 합격일 > (year−2)년 1월 1일 이면 그 해 1월 1일 기준 합격 후 2년이 지나지 않았다. 정확히 2년째 1월 1일은 면제가 아니다.
  if (profile.licensePassedOn && parseYmd(profile.licensePassedOn) && profile.licensePassedOn.slice(0, 10) > formatYmd(year - 2, 1, 1)) return { status: 'EXEMPT', hours };
  const hiredYear = yearOf(profile.hireDate);
  if (hiredYear !== null && hiredYear > year) return { status: 'NOT_TARGET', hours };
  if (profile.birthYear === null || profile.birthYear === undefined) return { status: 'UNKNOWN', hours };
  if (!isEduTargetYear(profile.birthYear, year)) return { status: 'NOT_TARGET', hours };
  if (hours >= CONTINUING_EDU_MIN_HOURS) return { status: 'DONE', hours };
  const a = parseYmd(asOf);
  return { status: a !== null && a.year > year ? 'MISSED' : 'DUE', hours };
}

export interface ContinuingEduRate {
  required: number;
  done: number;
  /** %, 소수 첫째 자리 반올림. 대상자가 없으면 null(해당없음) */
  rate: number | null;
  /** 95% 이상 1점, 75% 이상 0.75점, 그 밖 0(75% 미만 점수는 매뉴얼에 없어 대조 필요). 대상자가 없으면 null — 평가에서 빼고 환산 */
  score: number | null;
}

export function continuingEduRate(profiles: ReadonlyArray<HrProfile>, certs: ReadonlyArray<HrCert>, year: number, asOf: string): ContinuingEduRate {
  let required = 0;
  let done = 0;
  for (const p of profiles) {
    const s = continuingEduStatus(p, certs, year, asOf).status;
    if (s === 'DONE') {
      required += 1;
      done += 1;
    } else if (s === 'DUE' || s === 'MISSED') required += 1;
  }
  const rate = percent1(done, required);
  const score = rate === null ? null : rate >= 95 ? 1 : rate >= 75 ? 0.75 : 0;
  return { required, done, rate, score };
}

export type HealthCheckStatusKind = 'OK' | 'DUE_SOON' | 'OVERDUE' | 'MISSING';

export interface HealthCheckStatus {
  status: HealthCheckStatusKind;
  /** 인정되는 마지막 검진일. 없으면 null */
  lastOn: string | null;
  /** 다음 검진 기한(마지막 검진 + 1년, 사무직 2년). 기한 당일까지는 유효하다. 없으면 null */
  dueOn: string | null;
}

/**
 * 직원 건강검진 상태. 인정하는 검진은 입사일 1년 전 이후(입사 전 1년 안 결과 인정)이고 asOf 이전인 HEALTH_CHECK 중 가장 늦은 것이다.
 * 아직 오지 않은 날짜의 기록(예약 등)은 받은 검진으로 세지 않는다. 결핵 포함 5개 영역 충족 여부는 결과통보서로 따로 확인한다.
 */
export function healthCheckStatus(profile: HrProfile, certs: ReadonlyArray<HrCert>, asOf: string): HealthCheckStatus {
  const earliest = addYearsClamped(profile.hireDate, -1);
  let lastOn: string | null = null;
  for (const c of certs) {
    if (c.memberId !== profile.memberId || c.kind !== 'HEALTH_CHECK' || !parseYmd(c.doneOn)) continue;
    const d = c.doneOn.slice(0, 10);
    if (earliest !== null && d < earliest) continue;
    const toAsOf = daysBetween(d, asOf);
    if (toAsOf === null || toAsOf < 0) continue;
    if (lastOn === null || d > lastOn) lastOn = d;
  }
  if (lastOn === null) return { status: 'MISSING', lastOn: null, dueOn: null };
  const dueOn = addYearsClamped(lastOn, profile.officeWorker ? 2 : 1);
  const left = dueOn === null ? null : daysBetween(asOf, dueOn);
  if (dueOn === null || left === null) return { status: 'MISSING', lastOn, dueOn };
  if (left < 0) return { status: 'OVERDUE', lastOn, dueOn };
  return { status: left <= HEALTH_CHECK_SOON_DAYS ? 'DUE_SOON' : 'OK', lastOn, dueOn };
}

export interface HealthCheckRate {
  total: number;
  /** 정상(OK)과 만료 임박(DUE_SOON) */
  ok: number;
  /** %, 소수 첫째 자리 반올림. 직원이 없으면 null */
  rate: number | null;
  /** 모두 충족 3점, 75% 이상 2.25점, 그 밖 0(75% 미만 점수는 매뉴얼에 없어 대조 필요). 직원이 없으면 null. 가르는 기준은 반올림 전 정확한 비율이다(99.96%를 100으로 보지 않는다) */
  score: number | null;
}

/** 입사일이 asOf 이후인 예정자는 뺀다. 평가는 표본 직원으로 보므로 이 비율은 전체 직원 기준의 참고 추정이다. */
export function healthCheckRate(profiles: ReadonlyArray<HrProfile>, certs: ReadonlyArray<HrCert>, asOf: string): HealthCheckRate {
  const working = profiles.filter((p) => isWorking(p, asOf));
  const total = working.length;
  const ok = working.filter((p) => {
    const s = healthCheckStatus(p, certs, asOf).status;
    return s === 'OK' || s === 'DUE_SOON';
  }).length;
  if (total === 0) return { total, ok, rate: null, score: null };
  const score = ok === total ? 3 : ok * 4 >= total * 3 ? 2.25 : 0;
  return { total, ok, rate: percent1(ok, total), score };
}
