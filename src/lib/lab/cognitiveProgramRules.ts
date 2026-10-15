/**
 * 5등급·인지지원등급 인지활동형 프로그램 누락 점검 — 장기요양급여 제공기준 고시 제30조⑥⑦·제32조⑩⑪.
 * 5등급·인지지원등급 수급자는 그날 인지활동형 프로그램을 1회 60분 이상, 프로그램관리자·치매전문요양보호사·외부강사가 제공해야
 * 급여비용을 산정할 수 있다. 1~4등급은 노력 의무라 이 점검에 넣지 않는다. 전부 브라우저 안에서 도는 순수 함수다.
 *
 * 확인 못 한 것(대조 필요): 한 세션이 60분 미만이어도 같은 날 여러 세션을 합산해 60분으로 인정하는지는 고시에 없어 합산하지 않는다
 * (그날 한 세션이라도 60분 이상이어야 OK). 출석하지 않은 날은 점검 대상이 아니다.
 */
import { parseYmd } from './labDate.ts';
import type { CognitiveProviderKind } from './labTypes.ts';

/** 인지활동형 프로그램이 급여비용 산정 조건인 등급 */
export const COGNITIVE_REQUIRED_GRADES: readonly string[] = ['GRADE_5', 'COGNITIVE_SUPPORT'];

/** 한 세션의 최소 시간(분) */
export const COGNITIVE_MIN_MINUTES = 60;

export const COGNITIVE_PROVIDERS: ReadonlyArray<{ key: CognitiveProviderKind; label: string; allowed: boolean }> = [
  { key: 'PROGRAM_MANAGER', label: '프로그램관리자', allowed: true },
  { key: 'DEMENTIA_CAREGIVER', label: '치매전문요양보호사', allowed: true },
  { key: 'EXTERNAL_INSTRUCTOR', label: '외부강사', allowed: true },
  { key: 'OTHER', label: '기타', allowed: false },
];

export type CognitiveState = 'OK' | 'NO_SESSION' | 'PROVIDER_NOT_ALLOWED' | 'TOO_SHORT';

export const COGNITIVE_STATE_LABEL: Readonly<Record<CognitiveState, string>> = {
  OK: '인지활동형 제공됨',
  NO_SESSION: '인지활동형 프로그램에 참여한 기록 없음',
  PROVIDER_NOT_ALLOWED: '60분 이상이지만 제공자가 인정되지 않음(프로그램관리자·치매전문요양보호사·외부강사만)',
  TOO_SHORT: '1회 60분 미만이거나 시간 기록 없음',
};

export interface CognitiveAttendee {
  elderlyId: number;
  careGrade: string | null | undefined;
}

export interface CognitiveProgramSession {
  programDate: string;
  cognitiveActivity: boolean;
  durationMinutes: number | null;
  providerKind: CognitiveProviderKind | null;
  participantIds: readonly number[];
}

export interface CognitiveCoverageRow {
  elderlyId: number;
  state: CognitiveState;
}

export interface CognitiveGap extends CognitiveCoverageRow {
  date: string;
}

const ALLOWED_PROVIDERS = new Set<CognitiveProviderKind>(COGNITIVE_PROVIDERS.filter((p) => p.allowed).map((p) => p.key));

export function isCognitiveRequiredGrade(careGrade: string | null | undefined): boolean {
  return !!careGrade && COGNITIVE_REQUIRED_GRADES.includes(careGrade);
}

/** 그날 그 어르신이 참여한 인지활동형 세션들 — 화면이 rehabCogActivity·프로그램명을 제안할 때도 쓴다. */
export function cognitiveSessionsFor<T extends CognitiveProgramSession>(dayYmd: string, elderlyId: number, programs: readonly T[]): T[] {
  return programs.filter((p) => p.programDate === dayYmd && p.cognitiveActivity && p.participantIds.includes(elderlyId));
}

/**
 * 그날 출석한 어르신 중 5등급·인지지원 수급자의 인지활동형 제공 상태(elderlyId 오름차순).
 * OK = 60분 이상이고 허용 제공자인 세션이 하나라도 있음 / PROVIDER_NOT_ALLOWED = 60분 이상 세션은 있으나 제공자가 기타·미기록 /
 * TOO_SHORT = 세션은 있으나 모두 60분 미만(분 미기록 포함) / NO_SESSION = 참여한 인지활동형 세션이 없음.
 */
export function cognitiveCoverage(dayYmd: string, attendees: readonly CognitiveAttendee[], programs: readonly CognitiveProgramSession[]): CognitiveCoverageRow[] {
  const targets = Array.from(new Set(attendees.filter((a) => isCognitiveRequiredGrade(a.careGrade)).map((a) => a.elderlyId))).sort((a, b) => a - b);
  return targets.map((elderlyId) => {
    const sessions = cognitiveSessionsFor(dayYmd, elderlyId, programs);
    if (sessions.length === 0) return { elderlyId, state: 'NO_SESSION' as const };
    const longEnough = sessions.filter((s) => typeof s.durationMinutes === 'number' && s.durationMinutes >= COGNITIVE_MIN_MINUTES);
    if (longEnough.some((s) => s.providerKind !== null && ALLOWED_PROVIDERS.has(s.providerKind))) return { elderlyId, state: 'OK' as const };
    return { elderlyId, state: longEnough.length > 0 ? ('PROVIDER_NOT_ALLOWED' as const) : ('TOO_SHORT' as const) };
  });
}

/** 한 달 치 — 날짜별 출석자로 OK가 아닌 (날짜, 어르신, 상태)만 날짜·elderlyId 순으로. 올바르지 않은 날짜 키는 건너뛴다. */
export function monthCognitiveGaps(attendanceByDay: Readonly<Record<string, readonly CognitiveAttendee[]>>, programs: readonly CognitiveProgramSession[]): CognitiveGap[] {
  const out: CognitiveGap[] = [];
  for (const date of Object.keys(attendanceByDay).filter((d) => parseYmd(d) !== null).sort()) {
    for (const row of cognitiveCoverage(date, attendanceByDay[date], programs)) {
      if (row.state !== 'OK') out.push({ date, ...row });
    }
  }
  return out;
}
