/**
 * 시설 관리 대장 규칙 — 법정 점검·청소·검사·보험의 적용 여부 판정, 다음 기한, 보관 만료일, 대장 요약.
 * 전부 브라우저 안에서 도는 순수 함수이고 날짜는 'YYYY-MM-DD'(한국 달력, labDate.ts)다.
 *
 * 근거(research-12 §B): 소방시설법·화재예방법·전기안전관리법·도시가스사업법·액화석유가스법·승강기 안전관리법·수도법·하수도법·
 * 사회복지사업법 제34조의3·제34조의4, 2026 평가 지표 16②.
 * 원칙: 해당 여부를 알 수 없는 항목은 지어내지 않고 UNKNOWN으로 두고 "관할 기관 확인 필요"를 붙인다.
 * 확인 못 한 것(대조 필요): 간이스프링클러만 있는 시설의 종합점검 대상 여부, 도시가스 특정가스사용시설 지정,
 * 자동절체기가 있는 LPG 시설의 500kg 기준, 저수조 SMALL의 조례 기준, 사회복지시설 책임보험 대상 범위.
 */
import { addDays, addYears, daysBetween, formatYmd, isValidYmd, monthEndYmd, parseYmd, shiftMonth } from './labDate.ts';
import type { FacilityApplies, FacilityItemCode, FacilityLog, FacilityProfile } from './labTypes.ts';

export type FacilityGroup = 'FIRE' | 'ELECTRIC' | 'GAS' | 'ELEVATOR' | 'WATER' | 'HYGIENE' | 'SAFETY' | 'INSURANCE';
export type FacilityBasis = 'LAW' | 'EVAL';

export type FacilityCadence =
  | { kind: 'MONTH' | 'QUARTER' | 'HALF' | 'YEAR' }
  /** 소방 점검 — 사용승인일이 속하는 달의 말일까지 연 1회 */
  | { kind: 'APPROVAL_MONTH' }
  /** 마지막 실시일 + years년이 기한, 기한 앞뒤 windowDays일이 가능 기간 */
  | { kind: 'ANNIV'; years: number; windowDays: number }
  /** 마지막 실시 달 + 12×years개월이 기한 달, 그 달 앞뒤 windowMonths개월이 가능 기간 */
  | { kind: 'ANNIV_MONTH'; years: number; windowMonths: number }
  /** 보험 — 가장 늦은 만기일이 기한 */
  | { kind: 'EXPIRY' };

export interface FacilityItem {
  code: FacilityItemCode;
  name: string;
  group: FacilityGroup;
  basis: FacilityBasis;
  lawRef: string;
  cadence: FacilityCadence;
  retentionYears: number | null;
  /** 남길 증빙 한 줄 */
  evidence: string;
}

export const FACILITY_GROUPS: ReadonlyArray<{ key: FacilityGroup; label: string }> = [
  { key: 'FIRE', label: '소방' },
  { key: 'ELECTRIC', label: '전기' },
  { key: 'GAS', label: '가스' },
  { key: 'ELEVATOR', label: '승강기' },
  { key: 'WATER', label: '저수조·정화조' },
  { key: 'HYGIENE', label: '소독' },
  { key: 'SAFETY', label: '시설 안전' },
  { key: 'INSURANCE', label: '보험' },
];

export const FACILITY_ITEMS: readonly FacilityItem[] = [
  {
    code: 'FIRE_OPERATION', name: '소방시설 작동점검', group: 'FIRE', basis: 'LAW',
    lawRef: '소방시설법 제22조, 시행규칙 제23조·별표 3', cadence: { kind: 'APPROVAL_MONTH' }, retentionYears: 2,
    evidence: '작동점검표와 자체점검 실시결과 보고서(점검 끝난 날부터 15일 이내 소방서 보고, 2년 보관)',
  },
  {
    code: 'FIRE_COMPREHENSIVE', name: '소방시설 종합점검', group: 'FIRE', basis: 'LAW',
    lawRef: '소방시설법 제22조, 시행규칙 제23조·별표 3', cadence: { kind: 'APPROVAL_MONTH' }, retentionYears: 2,
    evidence: '종합점검표와 자체점검 실시결과 보고서(점검 끝난 날부터 15일 이내 소방서 보고, 2년 보관)',
  },
  {
    code: 'FIRE_DRILL_LEGAL', name: '소방훈련·교육(법정, 연 1회)', group: 'FIRE', basis: 'LAW',
    lawRef: '화재예방법 제37조, 시행규칙 제36조', cadence: { kind: 'YEAR' }, retentionYears: 2,
    evidence: '소방훈련·교육 실시 결과 기록부(별지 제28호서식, 실시한 날부터 2년 보관)',
  },
  {
    code: 'FIRE_MANAGER_TRAINING', name: '소방안전관리자 실무교육', group: 'FIRE', basis: 'LAW',
    lawRef: '화재예방법 시행규칙 제29조③', cadence: { kind: 'ANNIV', years: 2, windowDays: 0 }, retentionYears: null,
    evidence: '실무교육 수료증(선임 후 6개월 이내, 이후 2년마다)',
  },
  {
    code: 'ELEC_GENERAL', name: '일반용 전기설비 정기점검', group: 'ELECTRIC', basis: 'LAW',
    lawRef: '전기안전관리법 제12조, 시행규칙 제12조·제14조', cadence: { kind: 'ANNIV_MONTH', years: 1, windowMonths: 2 }, retentionYears: null,
    evidence: '안전공사 점검결과 통지서(부적합 통지 시 개선 후 확인)',
  },
  {
    code: 'ELEC_SELF_USE', name: '자가용 전기설비 안전관리 점검', group: 'ELECTRIC', basis: 'LAW',
    lawRef: '전기안전관리법 제22조·제24조, 시행규칙 제36조·별표 9', cadence: { kind: 'MONTH' }, retentionYears: 4,
    evidence: '전기안전관리자(대행사업자) 점검 기록(4년 보존)',
  },
  {
    code: 'GAS_CITY_REGULATOR', name: '도시가스 압력조정기 안전점검', group: 'GAS', basis: 'LAW',
    lawRef: '도시가스사업법 시행규칙 별표 7', cadence: { kind: 'ANNIV', years: 1, windowDays: 0 }, retentionYears: null,
    evidence: '압력조정기 점검 기록(매 1년 1회 이상)',
  },
  {
    code: 'GAS_CITY_SPECIAL', name: '도시가스 특정가스사용시설 정기검사', group: 'GAS', basis: 'LAW',
    lawRef: '도시가스사업법 시행규칙 제25조③', cadence: { kind: 'ANNIV', years: 1, windowDays: 30 }, retentionYears: null,
    evidence: '정기검사 증명서(한국가스안전공사)',
  },
  {
    code: 'GAS_LPG_INSPECT', name: 'LPG 특정사용자 정기검사', group: 'GAS', basis: 'LAW',
    lawRef: '액화석유가스법 제44조, 시행규칙 제71조④⑦', cadence: { kind: 'ANNIV', years: 1, windowDays: 30 }, retentionYears: null,
    evidence: '정기검사 증명서와 공급자 안전점검 수요자 점검표',
  },
  {
    code: 'ELEV_SELF_MONTHLY', name: '승강기 자체점검(월 1회)', group: 'ELEVATOR', basis: 'LAW',
    lawRef: '승강기 안전관리법 제31조, 시행령 제28조·제29조', cadence: { kind: 'MONTH' }, retentionYears: null,
    evidence: '자체점검 결과(점검일부터 10일 이내 승강기안전종합정보망 입력)',
  },
  {
    code: 'ELEV_ANNUAL', name: '승강기 정기검사', group: 'ELEVATOR', basis: 'LAW',
    lawRef: '승강기 안전관리법 제32조, 시행규칙 제54조', cadence: { kind: 'ANNIV', years: 1, windowDays: 30 }, retentionYears: null,
    evidence: '정기검사 합격증(승강기 안 부착)',
  },
  {
    code: 'TANK_CLEAN', name: '저수조 청소(반기 1회)', group: 'WATER', basis: 'LAW',
    lawRef: '수도법 제33조, 시행령 제50조, 시행규칙 제22조의4·제22조의6', cadence: { kind: 'HALF' }, retentionYears: 2,
    evidence: '청소 결과 기록(청소업자 확인서, 2년 보관)',
  },
  {
    code: 'TANK_HYGIENE', name: '저수조 위생점검(월 1회)', group: 'WATER', basis: 'LAW',
    lawRef: '수도법 시행규칙 제22조의4·별표 6의2', cadence: { kind: 'MONTH' }, retentionYears: 2,
    evidence: '위생점검 결과 기록(2년 보관)',
  },
  {
    code: 'TANK_WATER_QUALITY', name: '저수조 수질검사(연 1회)', group: 'WATER', basis: 'LAW',
    lawRef: '수도법 시행규칙 제22조의4·제22조의6', cadence: { kind: 'ANNIV_MONTH', years: 1, windowMonths: 0 }, retentionYears: 2,
    evidence: '수질검사 성적서(검사한 날부터 1년이 되는 달 말일까지 다시 검사, 이용자에게 게시)',
  },
  {
    code: 'SEPTIC_CLEAN', name: '정화조 내부청소', group: 'WATER', basis: 'LAW',
    lawRef: '하수도법 제39조②, 시행규칙 제33조①', cadence: { kind: 'YEAR' }, retentionYears: null,
    evidence: '청소 영수증과 분뇨수집·운반업자 처리 확인',
  },
  {
    code: 'DISINFECT_QUARTERLY', name: '분기별 전문소독(실내·외)', group: 'HYGIENE', basis: 'EVAL',
    lawRef: '2026 평가 지표 16②(감염병예방법 제51조 의무는 아님)', cadence: { kind: 'QUARTER' }, retentionYears: null,
    evidence: '계약서·소독증명서·지출내역(살균·살충·살서를 모두 한 경우만 인정)',
  },
  {
    code: 'SOCIAL_SAFETY_HALF', name: '사회복지시설 정기안전점검(반기)', group: 'SAFETY', basis: 'LAW',
    lawRef: '사회복지사업법 제34조의4, 시행령 제18조의4', cadence: { kind: 'HALF' }, retentionYears: null,
    evidence: '점검 결과와 시장·군수·구청장 제출 증빙',
  },
  {
    code: 'INSURANCE_FACILITY', name: '사회복지시설 책임보험·공제', group: 'INSURANCE', basis: 'LAW',
    lawRef: '사회복지사업법 제34조의3', cadence: { kind: 'EXPIRY' }, retentionYears: null,
    evidence: '보험(공제) 증권과 만기일',
  },
  {
    code: 'INSURANCE_PROFESSIONAL', name: '전문인 배상책임보험', group: 'INSURANCE', basis: 'LAW',
    lawRef: '장기요양급여 제공기준 고시 제10조', cadence: { kind: 'EXPIRY' }, retentionYears: null,
    evidence: '보험 증권과 만기일(급여 개시일부터 가입)',
  },
];

const ITEM_BY_CODE: ReadonlyMap<string, FacilityItem> = new Map(FACILITY_ITEMS.map((i) => [i.code, i]));

export function facilityItem(code: FacilityItemCode): FacilityItem | null {
  return ITEM_BY_CODE.get(code) ?? null;
}

/** 주기를 사람이 읽는 말로 */
export function cadenceLabel(cadence: FacilityCadence): string {
  switch (cadence.kind) {
    case 'MONTH': return '월 1회';
    case 'QUARTER': return '분기 1회';
    case 'HALF': return '반기 1회';
    case 'YEAR': return '연 1회';
    case 'APPROVAL_MONTH': return '연 1회(사용승인일이 속하는 달)';
    case 'ANNIV': {
      const base = `${cadence.years}년마다`;
      return cadence.windowDays > 0 ? `${base}(전후 ${cadence.windowDays}일)` : base;
    }
    case 'ANNIV_MONTH': {
      const base = `${cadence.years}년마다(도래한 달 말일)`;
      return cadence.windowMonths > 0 ? `${base}·전후 ${cadence.windowMonths}개월` : base;
    }
    case 'EXPIRY': return '만기 전 갱신';
  }
}

// ---------- 적용 여부 ----------

export interface ApplyResult {
  applies: 'YES' | 'NO' | 'UNKNOWN';
  reason: string;
}

const CONFIRM = '관할 기관 확인 필요';
const yes = (reason: string): ApplyResult => ({ applies: 'YES', reason });
const no = (reason: string): ApplyResult => ({ applies: 'NO', reason });
const unknown = (reason: string): ApplyResult => ({ applies: 'UNKNOWN', reason: `${reason} — ${CONFIRM}` });
const NOT_ENTERED = '시설 정보에 아직 입력하지 않음';

/** 시설 정보로 그 항목이 이 센터에 해당하는지 판정한다. 직접 지정(appliesOverride)이 있으면 그 값이 이긴다. profile이 null이면 칸은 모두 UNKNOWN으로 본다. */
export function itemApplies(profile: FacilityProfile | null | undefined, code: FacilityItemCode): ApplyResult {
  const override: FacilityApplies | undefined = profile?.appliesOverride?.[code];
  if (override === 'YES' || override === 'NO') return { applies: override, reason: '직접 지정' };

  const sprinkler = profile?.sprinkler ?? 'UNKNOWN';
  const power = profile?.powerKind ?? 'UNKNOWN';
  const gas = profile?.gasKind ?? 'UNKNOWN';
  const elevator = profile?.elevator ?? 'UNKNOWN';
  const tank = profile?.waterTank ?? 'UNKNOWN';
  const septic = profile?.septic ?? 'UNKNOWN';

  switch (code) {
    case 'FIRE_OPERATION': return yes('노유자시설(주·야간보호)은 소방 자체점검 대상');
    case 'FIRE_DRILL_LEGAL': return yes('소방안전관리대상물은 연 1회 이상 소방훈련·교육');
    case 'FIRE_MANAGER_TRAINING': return yes('소방안전관리자 선임 대상(노유자시설) 실무교육');
    case 'DISINFECT_QUARTERLY': return yes('평가 요건(분기 1회 전문소독)');
    case 'SOCIAL_SAFETY_HALF': return yes('사회복지시설은 반기마다 정기안전점검');
    case 'INSURANCE_PROFESSIONAL': return yes('급여 개시일부터 전문인 배상책임보험 가입');
    case 'INSURANCE_FACILITY': return unknown('시설 범위에 드는지 시행령으로 확인해야 함');
    case 'FIRE_COMPREHENSIVE':
      if (sprinkler === 'FULL') return yes('스프링클러설비가 있어 종합점검 대상');
      if (sprinkler === 'NONE') return no('스프링클러설비 없음');
      if (sprinkler === 'SIMPLE') return unknown('간이스프링클러만 있으면 종합점검 대상인지 확인 필요');
      return unknown(NOT_ENTERED);
    case 'ELEC_GENERAL':
      if (power === 'GENERAL') return yes('일반용 전기설비(저압 75kW 미만)');
      if (power === 'SELF_USE') return no('자가용 전기설비');
      return unknown(NOT_ENTERED);
    case 'ELEC_SELF_USE':
      if (power === 'SELF_USE') return yes('자가용 전기설비');
      if (power === 'GENERAL') return no('일반용 전기설비');
      return unknown(NOT_ENTERED);
    case 'GAS_CITY_REGULATOR':
      if (gas === 'CITY') return yes('도시가스 사용');
      if (gas === 'NONE' || gas === 'LPG') return no(gas === 'NONE' ? '가스 사용 안 함' : 'LPG 사용(도시가스 아님)');
      return unknown(NOT_ENTERED);
    case 'GAS_CITY_SPECIAL':
      if (gas === 'CITY') return unknown('월 사용량·시설 지정에 따라 특정가스사용시설인지 확인 필요');
      if (gas === 'NONE' || gas === 'LPG') return no(gas === 'NONE' ? '가스 사용 안 함' : 'LPG 사용(도시가스 아님)');
      return unknown(NOT_ENTERED);
    case 'GAS_LPG_INSPECT': {
      if (gas === 'CITY' || gas === 'NONE') return no(gas === 'NONE' ? '가스 사용 안 함' : '도시가스 사용(LPG 아님)');
      if (gas === 'UNKNOWN') return unknown(NOT_ENTERED);
      const kg = profile?.lpgCapacityKg ?? null;
      if (kg === null) return unknown('LPG 저장능력(kg)을 입력하지 않음');
      if (kg < 250) return no('저장능력 250kg 미만은 정기검사 면제');
      if (kg < 500) return unknown('250kg 이상 500kg 미만은 자동절체기가 있으면 면제');
      return yes('저장능력 500kg 이상');
    }
    case 'ELEV_SELF_MONTHLY':
    case 'ELEV_ANNUAL':
      if (elevator === 'CENTER') return yes('센터가 승강기 관리주체');
      if (elevator === 'BUILDING') return no('건물 관리주체가 점검(센터 의무 아님)');
      if (elevator === 'NONE') return no('승강기 없음');
      return unknown(NOT_ENTERED);
    case 'TANK_CLEAN':
    case 'TANK_HYGIENE':
    case 'TANK_WATER_QUALITY':
      if (tank === 'LARGE') return yes('수도법 대형건축물등의 저수조');
      if (tank === 'SMALL') return no('대형건축물등 아님 — 지자체 조례로 정한 위생조치는 조례 확인');
      if (tank === 'NONE') return no('저수조 없음');
      return unknown(NOT_ENTERED);
    case 'SEPTIC_CLEAN':
      if (septic === 'YES') return yes('정화조가 있음');
      if (septic === 'NONE') return no('정화조 없음(공공하수처리구역)');
      return unknown(NOT_ENTERED);
  }
}

// ---------- 다음 기한 ----------

export type DueStatus = 'OK' | 'DUE' | 'IN_WINDOW' | 'OVERDUE' | 'NEVER' | 'NEED_INFO';

export interface NextDue {
  dueYmd: string | null;
  windowStartYmd: string | null;
  windowEndYmd: string | null;
  /** 기한 − 오늘(일). 지났으면 음수 */
  daysLeft: number | null;
  status: DueStatus;
  /** 달력 기간 주기에서 빠진 기간 수(기록이 없으면 0) */
  missed: number;
}

/** 기한이 이 일수 이하로 남으면 곧 도래(DUE)로 본다 */
export const DUE_SOON_DAYS = 30;

const result = (status: DueStatus, dueYmd: string | null, today: string, extra: Partial<NextDue> = {}): NextDue => ({
  dueYmd,
  windowStartYmd: null,
  windowEndYmd: null,
  daysLeft: dueYmd ? daysBetween(today, dueYmd) : null,
  status,
  missed: 0,
  ...extra,
});

const NEED_INFO_DUE = (today: string): NextDue => result('NEED_INFO', null, today);

const PERIOD_MONTHS = { MONTH: 1, QUARTER: 3, HALF: 6, YEAR: 12 } as const;

/** 달력 기간 번호(해×기간수 + 기간 순번) */
function periodIndex(ymd: string, months: number): number {
  const p = parseYmd(ymd)!;
  return p.year * (12 / months) + Math.floor((p.month - 1) / months);
}

/** 기간 번호의 말일 */
function periodEnd(index: number, months: number): string {
  const perYear = 12 / months;
  const year = Math.floor(index / perYear);
  const slot = index - year * perYear;
  return monthEndYmd(year, slot * months + months);
}

/** 상태를 정하는 ANNIV류 공통 판정 순서: 창 끝 지남 → OVERDUE, 창 시작 이후 → IN_WINDOW, 창 시작까지 30일 이내 → DUE, 그 밖 → OK */
function windowStatus(today: string, start: string, end: string): DueStatus {
  if (daysBetween(end, today)! > 0) return 'OVERDUE';
  if (daysBetween(start, today)! >= 0) return 'IN_WINDOW';
  return daysBetween(today, start)! <= DUE_SOON_DAYS ? 'DUE' : 'OK';
}

/**
 * 한 항목의 다음 기한. logs는 그 항목 것만 넣는다(올바른 날짜가 아닌 기록은 건너뛴다). 오늘은 'YYYY-MM-DD'.
 * 주기별 규칙은 계약(개정 15)대로: 달력 기간(월·분기·반기·연), 사용승인 달, 기념일(일 창·월 창), 보험 만기.
 */
export function nextDue(code: FacilityItemCode, logs: readonly FacilityLog[], profile: FacilityProfile | null | undefined, todayYmd: string): NextDue {
  const item = ITEM_BY_CODE.get(code);
  if (!item || !isValidYmd(todayYmd)) return NEED_INFO_DUE(todayYmd);
  const today = todayYmd.slice(0, 10);
  const dated = logs.filter((l) => isValidYmd(l.doneOn)).map((l) => ({ log: l, done: l.doneOn.slice(0, 10) }));
  const cadence = item.cadence;

  switch (cadence.kind) {
    case 'MONTH':
    case 'QUARTER':
    case 'HALF':
    case 'YEAR': {
      const months = PERIOD_MONTHS[cadence.kind];
      const current = periodIndex(today, months);
      const has = new Set(dated.map((d) => periodIndex(d.done, months)));
      let missed = 0;
      if (has.size > 0) {
        for (let i = Math.min(...has); i < current; i++) if (!has.has(i)) missed++;
      }
      return has.has(current) ? result('OK', periodEnd(current + 1, months), today, { missed }) : result('DUE', periodEnd(current, months), today, { missed });
    }
    case 'APPROVAL_MONTH': {
      const approved = parseYmd(profile?.approvedOn ?? null);
      if (!approved) return NEED_INFO_DUE(today);
      const todayP = parseYmd(today)!;
      // 종합점검 대상이면 작동점검은 종합점검을 받은 달부터 6개월이 되는 달 — 해를 넘기면 달만 쓴다
      let month = approved.month;
      if (code === 'FIRE_OPERATION' && itemApplies(profile, 'FIRE_COMPREHENSIVE').applies === 'YES') month = shiftMonth(approved.year, approved.month, 6).month;
      if (dated.some((d) => d.done.startsWith(`${String(todayP.year).padStart(4, '0')}-`))) return result('OK', monthEndYmd(todayP.year + 1, month), today);
      const due = monthEndYmd(todayP.year, month);
      if (daysBetween(today, due)! < 0) return result('OVERDUE', due, today);
      return result(todayP.month === month ? 'IN_WINDOW' : 'DUE', due, today);
    }
    case 'ANNIV': {
      if (dated.length === 0) return result('NEVER', null, today);
      const last = dated.map((d) => d.done).sort().at(-1)!;
      const due = addYears(last, cadence.years)!;
      const start = addDays(due, -cadence.windowDays)!;
      const end = addDays(due, cadence.windowDays)!;
      return result(windowStatus(today, start, end), due, today, { windowStartYmd: start, windowEndYmd: end });
    }
    case 'ANNIV_MONTH': {
      if (dated.length === 0) return result('NEVER', null, today);
      const last = parseYmd(dated.map((d) => d.done).sort().at(-1)!)!;
      const dueMonth = shiftMonth(last.year, last.month, 12 * cadence.years);
      const due = monthEndYmd(dueMonth.year, dueMonth.month);
      const from = shiftMonth(dueMonth.year, dueMonth.month, -cadence.windowMonths);
      const start = formatYmd(from.year, from.month, 1);
      const end = monthEndYmd(dueMonth.year, dueMonth.month + cadence.windowMonths);
      return result(windowStatus(today, start, end), due, today, { windowStartYmd: start, windowEndYmd: end });
    }
    case 'EXPIRY': {
      const expiries = dated.map((d) => d.log.validUntil).filter((v): v is string => isValidYmd(v)).map((v) => v.slice(0, 10)).sort();
      if (expiries.length === 0) return result('NEVER', null, today);
      const due = expiries.at(-1)!;
      const left = daysBetween(today, due)!;
      return result(left < 0 ? 'OVERDUE' : left <= DUE_SOON_DAYS ? 'DUE' : 'OK', due, today);
    }
  }
}

/** 보관 만료일 = 실시일 + 보관 연수(2/29는 2/28). 보관 의무가 없거나 날짜가 틀리면 null. */
export function retainUntil(code: FacilityItemCode, doneYmd: string): string | null {
  const years = ITEM_BY_CODE.get(code)?.retentionYears ?? null;
  return years === null ? null : addYears(doneYmd, years);
}

// ---------- 대장 요약 ----------

export type LedgerStatus = DueStatus | 'NA';

export interface LedgerRow {
  code: FacilityItemCode;
  applies: ApplyResult['applies'];
  reason: string;
  status: LedgerStatus;
  dueYmd: string | null;
  daysLeft: number | null;
  /** 가장 늦은 실시일 */
  lastDoneOn: string | null;
  missed: number;
}

export interface LedgerSummary {
  rows: LedgerRow[];
  /** 적용(YES)이고 기한이 지난 항목 수 */
  overdue: number;
  /** 적용(YES)이고 DUE·IN_WINDOW이며 기한이 30일 이내인 항목 수 */
  soon: number;
  /** 적용 여부 확인이 필요한(UNKNOWN) 항목 수 */
  unknown: number;
  /** 적용(YES)이고 보관 의무가 있는데 가장 늦은 기록의 보관 위치가 빈칸인 항목 수(기록이 하나도 없으면 세지 않음) */
  noDocLocation: number;
}

/** FACILITY_ITEMS 순서의 대장 줄과 요약 수. logs는 모든 항목의 기록을 한꺼번에 넣는다. */
export function ledgerSummary(profile: FacilityProfile | null | undefined, logs: readonly FacilityLog[], todayYmd: string): LedgerSummary {
  const byCode = new Map<string, FacilityLog[]>();
  for (const log of logs) {
    const list = byCode.get(log.itemCode);
    if (list) list.push(log);
    else byCode.set(log.itemCode, [log]);
  }
  let overdue = 0;
  let soon = 0;
  let unknownCount = 0;
  let noDocLocation = 0;
  const rows = FACILITY_ITEMS.map((item): LedgerRow => {
    const mine = (byCode.get(item.code) ?? []).filter((l) => isValidYmd(l.doneOn));
    const latest = mine.length > 0 ? mine.reduce((a, b) => (b.doneOn.slice(0, 10) > a.doneOn.slice(0, 10) ? b : a)) : null;
    const applies = itemApplies(profile, item.code);
    const base = { code: item.code, applies: applies.applies, reason: applies.reason, lastDoneOn: latest ? latest.doneOn.slice(0, 10) : null };
    if (applies.applies === 'NO') return { ...base, status: 'NA', dueYmd: null, daysLeft: null, missed: 0 };
    const due = nextDue(item.code, mine, profile, todayYmd);
    if (applies.applies === 'UNKNOWN') unknownCount++;
    else {
      if (due.status === 'OVERDUE') overdue++;
      if ((due.status === 'DUE' || due.status === 'IN_WINDOW') && due.daysLeft !== null && due.daysLeft <= DUE_SOON_DAYS) soon++;
      if (item.retentionYears !== null && latest && !(latest.docLocation ?? '').trim()) noDocLocation++;
    }
    return { ...base, status: due.status, dueYmd: due.dueYmd, daysLeft: due.daysLeft, missed: due.missed };
  });
  return { rows, overdue, soon, unknown: unknownCount, noDocLocation };
}
