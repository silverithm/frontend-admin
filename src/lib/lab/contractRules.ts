/**
 * 수급자 계약·장기요양 인정 규칙 — 유효기간 안내, 갱신 신청 창, 계약 알림.
 *
 * 근거(research-6.md 2·3절)
 *  - 유효기간(시행령 제8조): 최초 2년, 갱신하면 1등급 5년·2~4등급 4년·5등급과 인지지원등급 2년. 등급판정위원회가 6개월 범위에서 늘리거나 줄일 수 있어
 *    "예상 년수"는 안내용이다(실제 기간은 인정서의 유효기간).
 *  - 갱신 신청(시행규칙 제8조): 유효기간이 끝나기 90일 전부터 30일 전까지.
 *  - 계약서(시행규칙 제16조): 급여 개시 전 서면 체결, 2부 작성해 1부는 수급자에게 지체 없이 교부, 체결·변경 시 지체 없이 공단에 계약통보(며칠이라는 숫자는 없다).
 *  - 2026 평가 '급여제공계획 수립 및 제공' 기준②: 급여제공계획을 급여제공 시작일까지 공단에 통보(2026.1월부터 확인).
 *  - 2026 평가 '노인인권' 기준④: 신규 수급자에게 급여제공 시작일부터 14일 이내(토·공휴일 포함) 노인인권 8가지 지침 안내.
 *  - 2025판 평가의 '계약체결 및 통보'(전월 말일까지 통보)는 2026판에서 삭제됐다. 다만 청구 단계(고시 제32조 미이용일 급여비용)에서는
 *    "급여 개시 전월 말일까지 계약통보" 요건이 남아 있어 missedDayEligible은 화면에 그 요건을 대조 필요로 안내해야 한다.
 */
import type { ElderContract, LtcCareGrade } from './labTypes.ts';
import { addDays, isValidYmd } from './labDate.ts';

export const VALIDITY_RULE = {
  /** 최초 인정 유효기간(년) */
  initialYears: 2,
  /** 갱신 때 등급별 유효기간(년) */
  renewalYears: { '1': 5, '2': 4, '3': 4, '4': 4, '5': 2, cognitive: 2 } as Readonly<Record<LtcCareGrade, number>>,
  /** 등급판정위원회가 늘리거나 줄일 수 있는 범위(개월) */
  adjustMonths: 6,
  basis: '노인장기요양보험법 시행령 제8조',
  note: '유효기간은 등급판정위원회가 6개월 범위에서 늘리거나 줄일 수 있어 예상 년수는 안내용입니다. 실제 기간은 장기요양인정서로 확인하세요.',
} as const;

/** 갱신 신청 창(유효기간 끝나기 며칠 전): 90일 전부터 30일 전까지 — 시행규칙 제8조 */
export const RENEWAL_OPENS_BEFORE = 90;
export const RENEWAL_CLOSES_BEFORE = 30;
/** 갱신 신청 창이 열리기 며칠 전부터 "곧 열림" 안내를 하는가 */
export const RENEWAL_SOON_DAYS = 30;
/** 신규 수급자 노인인권 지침 안내 기한(급여제공 시작일부터 일) */
export const RIGHTS_GUIDE_DAYS = 14;
/** 미이용일 급여비용 대상 월 계약 이용일수(고시 제32조) */
export const MISSED_DAY_MIN_DAYS = 15;

/** 등급·갱신 횟수로 본 예상 유효기간(년). 0이면 최초 인정(2년), 1 이상이면 갱신. 알 수 없는 등급은 2년. */
export function expectedValidYears(careGrade: LtcCareGrade, renewalCount: number): number {
  if (!(renewalCount >= 1)) return VALIDITY_RULE.initialYears;
  return VALIDITY_RULE.renewalYears[careGrade] ?? VALIDITY_RULE.initialYears;
}

export interface RenewalWindow {
  /** 유효기간 끝 − 90일: 갱신 신청을 낼 수 있는 첫날 */
  opensOn: string;
  /** 유효기간 끝 − 30일: 갱신 신청을 내야 하는 마지막 날 */
  closesOn: string;
}

/** 유효기간 끝('YYYY-MM-DD')으로 갱신 신청 창. 날짜가 올바르지 않으면 null. */
export function renewalWindow(validTo: string): RenewalWindow | null {
  if (!isValidYmd(validTo)) return null;
  const opensOn = addDays(validTo.slice(0, 10), -RENEWAL_OPENS_BEFORE);
  const closesOn = addDays(validTo.slice(0, 10), -RENEWAL_CLOSES_BEFORE);
  return opensOn === null || closesOn === null ? null : { opensOn, closesOn };
}

export type ContractAlertCode =
  | 'RENEWAL_SOON'
  | 'RENEWAL_OPEN'
  | 'RENEWAL_LATE'
  | 'EXPIRED'
  | 'NOT_SIGNED'
  | 'COPY_NOT_GIVEN'
  | 'NOT_NOTIFIED'
  | 'PLAN_NOT_NOTIFIED'
  | 'RIGHTS_GUIDE_LATE';

export type ContractAlertLevel = 'INFO' | 'WARN' | 'DANGER';

export interface ContractAlert {
  contractId: number;
  elderlyId: number;
  code: ContractAlertCode;
  level: ContractAlertLevel;
  message: string;
  dueOn: string | null;
}

export type ContractForAlert = Pick<
  ElderContract,
  'id' | 'elderlyId' | 'status' | 'contractStart' | 'validTo' | 'signedOn' | 'copyGiven' | 'contractNotifiedOn' | 'planNotifiedOn' | 'rightsGuidedOn'
>;

const LEVEL_RANK: Record<ContractAlertLevel, number> = { DANGER: 0, WARN: 1, INFO: 2 };

function day(value: string | null | undefined): string | null {
  return typeof value === 'string' && isValidYmd(value) ? value.slice(0, 10) : null;
}

/**
 * 진행 중(ACTIVE) 계약의 알림. 이름은 담지 않는다(화면이 elderlyId로 이름을 붙인다).
 * 정렬: 위험 → 주의 → 안내, 같은 단계에서는 기한이 이른 순(기한 없는 것은 뒤), 그다음 어르신 번호·코드.
 */
export function contractAlerts(contracts: ReadonlyArray<ContractForAlert>, today: string): ContractAlert[] {
  const now = day(today);
  if (now === null) return [];
  const alerts: ContractAlert[] = [];
  for (const c of contracts) {
    if (c.status !== 'ACTIVE') continue;
    const push = (code: ContractAlertCode, level: ContractAlertLevel, message: string, dueOn: string | null) =>
      alerts.push({ contractId: c.id, elderlyId: c.elderlyId, code, level, message, dueOn });

    // 인정 유효기간 — 갱신 신청 창
    const validTo = day(c.validTo);
    const renewal = validTo ? renewalWindow(validTo) : null;
    if (validTo && renewal) {
      const soonFrom = addDays(renewal.opensOn, -RENEWAL_SOON_DAYS) as string;
      if (now > validTo) push('EXPIRED', 'DANGER', `장기요양 인정 유효기간이 ${validTo}에 끝났습니다. 갱신된 인정서가 있는지 확인하고 계약 정보를 고쳐 주세요`, validTo);
      else if (now > renewal.closesOn) push('RENEWAL_LATE', 'DANGER', `갱신 신청 기한(${renewal.closesOn})이 지났고 유효기간은 ${validTo}에 끝납니다. 갱신 신청을 했는지 확인하세요`, validTo);
      else if (now >= renewal.opensOn) push('RENEWAL_OPEN', 'WARN', `갱신 신청 기간입니다(${renewal.opensOn} ~ ${renewal.closesOn}). 유효기간은 ${validTo}에 끝납니다`, renewal.closesOn);
      else if (now >= soonFrom) push('RENEWAL_SOON', 'INFO', `${renewal.opensOn}부터 갱신 신청을 할 수 있습니다(유효기간 ${validTo}까지)`, renewal.opensOn);
    }

    // 계약서 — 체결·교부·공단 통보
    const start = day(c.contractStart);
    const signed = day(c.signedOn);
    if (signed === null) push('NOT_SIGNED', 'WARN', '계약서 체결일이 없습니다. 급여를 시작하기 전에 서면으로 계약해야 합니다', start);
    else {
      if (!c.copyGiven) push('COPY_NOT_GIVEN', 'WARN', '계약서 2부 중 1부를 수급자에게 교부했다는 기록이 없습니다', null);
      if (day(c.contractNotifiedOn) === null) push('NOT_NOTIFIED', 'WARN', '공단에 계약통보를 한 기록이 없습니다. 계약을 맺으면 지체 없이 통보해야 합니다', null);
    }

    // 급여제공계획 통보(2026 평가 22) · 노인인권 지침 안내(2026 평가 19 기준④)
    if (start !== null) {
      const planned = day(c.planNotifiedOn);
      if (planned === null) {
        if (now >= start) push('PLAN_NOT_NOTIFIED', 'DANGER', `급여제공계획을 공단에 통보한 기록이 없습니다. 급여제공 시작일(${start})까지 통보해야 합니다`, start);
      } else if (planned > start) {
        push('PLAN_NOT_NOTIFIED', 'DANGER', `급여제공계획을 급여제공 시작일(${start})보다 늦은 ${planned}에 통보했습니다. 시작일까지 통보해야 합니다`, start);
      }

      const guideDue = addDays(start, RIGHTS_GUIDE_DAYS) as string;
      const guided = day(c.rightsGuidedOn);
      if (guided === null) {
        if (now > guideDue) push('RIGHTS_GUIDE_LATE', 'WARN', `노인인권 지침 안내 기록이 없습니다. 급여제공 시작일부터 14일 이내(${guideDue}까지)에 안내해야 합니다`, guideDue);
      } else if (guided > guideDue) {
        push('RIGHTS_GUIDE_LATE', 'WARN', `노인인권 지침을 ${guided}에 안내했습니다. 급여제공 시작일부터 14일 이내(${guideDue}까지)에 안내해야 합니다`, guideDue);
      }
    }
  }
  return alerts.sort(
    (a, b) =>
      LEVEL_RANK[a.level] - LEVEL_RANK[b.level] ||
      (a.dueOn === null ? 1 : 0) - (b.dueOn === null ? 1 : 0) ||
      (a.dueOn ?? '').localeCompare(b.dueOn ?? '') ||
      a.elderlyId - b.elderlyId ||
      a.code.localeCompare(b.code),
  );
}

/** 월 이용 계약 일수가 15일 이상이면 미이용일 급여비용 대상(고시 제32조). 급여 개시 전월 말일까지 계약통보했는지와 본인부담금 사전 안내는 화면에서 대조 필요. */
export function missedDayEligible(contract: Pick<ElderContract, 'plannedDaysPerMonth'>): boolean {
  const days = contract.plannedDaysPerMonth;
  return typeof days === 'number' && days >= MISSED_DAY_MIN_DAYS;
}

// ---------- 등급 현황·변동 리포트 ----------

export interface GradeCount {
  grade: LtcCareGrade;
  label: string;
  count: number;
}

export interface GradeChange {
  elderlyId: number;
  elderlyName: string;
  from: LtcCareGrade;
  to: LtcCareGrade;
  /** 새 등급이 시작된 인정 유효기간 시작일 */
  on: string;
  /** 숫자 등급끼리만 방향을 말한다(1등급이 가장 무겁다). 인지지원등급이 끼면 null */
  direction: 'UP' | 'DOWN' | null;
}

export interface GradeReport {
  /** 진행 중 계약이 있는 수급자 수 */
  activeElders: number;
  byGrade: GradeCount[];
  /** 그 해에 일어난 등급 변동(시작일순) */
  changes: GradeChange[];
  /** 그 해에 끝난 계약 수 */
  endedInYear: number;
}

type ContractForGrade = Pick<ElderContract, 'elderlyId' | 'elderlyName' | 'careGrade' | 'validFrom' | 'contractStart' | 'contractEnd' | 'status'>;

const GRADE_ORDER: ReadonlyArray<LtcCareGrade> = ['1', '2', '3', '4', '5', 'cognitive'];
const GRADE_LABEL: Record<LtcCareGrade, string> = { '1': '1등급', '2': '2등급', '3': '3등급', '4': '4등급', '5': '5등급', cognitive: '인지지원등급' };

function gradeDirection(from: LtcCareGrade, to: LtcCareGrade): 'UP' | 'DOWN' | null {
  if (from === 'cognitive' || to === 'cognitive') return null;
  const a = Number(from);
  const b = Number(to);
  // 번호가 작을수록 무거운 등급이다
  return b < a ? 'UP' : b > a ? 'DOWN' : null;
}

/**
 * 수급자 등급 현황과 그 해의 등급 변동.
 * 현황은 진행 중(ACTIVE) 계약을 수급자마다 가장 최근 것 하나로 센다. 변동은 같은 수급자의 계약을 인정 유효기간 시작일순으로 놓고
 * 앞뒤 등급이 다른 지점이다(같은 등급 갱신은 변동이 아니다).
 */
export function gradeReport(contracts: ReadonlyArray<ContractForGrade>, year: number): GradeReport {
  const byElder = new Map<number, ContractForGrade[]>();
  for (const c of contracts) {
    const list = byElder.get(c.elderlyId) ?? [];
    list.push(c);
    byElder.set(c.elderlyId, list);
  }
  const counts = new Map<LtcCareGrade, number>();
  const changes: GradeChange[] = [];
  let activeElders = 0;
  for (const list of byElder.values()) {
    const sorted = [...list].sort((a, b) => a.validFrom.localeCompare(b.validFrom) || a.contractStart.localeCompare(b.contractStart));
    const active = sorted.filter((c) => c.status === 'ACTIVE');
    if (active.length > 0) {
      activeElders += 1;
      const latest = active[active.length - 1];
      counts.set(latest.careGrade, (counts.get(latest.careGrade) ?? 0) + 1);
    }
    for (let i = 1; i < sorted.length; i += 1) {
      const prev = sorted[i - 1];
      const cur = sorted[i];
      if (prev.careGrade !== cur.careGrade && Number(cur.validFrom.slice(0, 4)) === year) {
        changes.push({ elderlyId: cur.elderlyId, elderlyName: cur.elderlyName, from: prev.careGrade, to: cur.careGrade, on: cur.validFrom.slice(0, 10), direction: gradeDirection(prev.careGrade, cur.careGrade) });
      }
    }
  }
  changes.sort((a, b) => a.on.localeCompare(b.on) || a.elderlyName.localeCompare(b.elderlyName, 'ko'));
  const endedInYear = contracts.filter((c) => c.status === 'ENDED' && c.contractEnd !== null && Number(c.contractEnd.slice(0, 4)) === year).length;
  return {
    activeElders,
    byGrade: GRADE_ORDER.map((grade) => ({ grade, label: GRADE_LABEL[grade], count: counts.get(grade) ?? 0 })),
    changes,
    endedInYear,
  };
}
