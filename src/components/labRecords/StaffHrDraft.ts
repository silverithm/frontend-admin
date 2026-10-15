/**
 * 직원 인사 화면의 입력 상태·표시 글자 — 규칙 계산은 staffHrRules가 한다.
 * 여기서는 직원 기준·이수·검진 기록의 입력 초안과 검사, 상태 글자만 맡는다.
 */
import { isValidYmd } from '@/lib/lab/labDate';
import type { ContinuingEduStatusKind, HealthCheckStatusKind, HrCert, HrProfile } from '@/lib/lab/staffHrRules';
import type { LabStaff, PayrollJobType, PayrollProfile, StaffCert, StaffCertInput, StaffCertKind, StaffProfile, StaffProfileInput } from '@/lib/lab/labTypes';
import type { Tone } from '@/components/lab/LabUi';
import { numberText, orNull, parseDecimal } from './recordsFormat';

export const HR_LIMITS = { note: 200, institution: 100, certNo: 40 } as const;
export const BIRTH_YEAR_MIN = 1930;
export const BIRTH_YEAR_MAX = 2010;
export const EDU_HOURS_MIN = 0.5;
export const EDU_HOURS_MAX = 40;
/** 기관 개설일을 이 브라우저에 기억해 두는 키 */
export const OPENED_ON_KEY = 'carev.lab.staffHr.openedOn';

// ---------- 직원 ----------

/** 같은 기관 직원 한 명 — 인사 기준이 없으면 profile이 null */
export interface HrPerson {
  memberId: number;
  name: string;
  profile: StaffProfile | null;
}

/** 직원 목록과 인사 기준을 합친다. 목록에 없는 기준(퇴사 등)도 이름이 있으면 남긴다. */
export function buildPeople(staff: ReadonlyArray<LabStaff>, profiles: ReadonlyArray<StaffProfile>): HrPerson[] {
  const byId = new Map<number, HrPerson>();
  for (const s of staff) byId.set(s.id, { memberId: s.id, name: s.name, profile: null });
  for (const p of profiles) {
    const found = byId.get(p.memberId);
    if (found) found.profile = p;
    else byId.set(p.memberId, { memberId: p.memberId, name: p.memberName ?? `직원 ${p.memberId}`, profile: p });
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
}

export function toHrProfile(p: StaffProfile): HrProfile {
  return {
    memberId: p.memberId,
    hireDate: p.hireDate.slice(0, 10),
    jobType: p.jobType,
    birthYear: p.birthYear,
    licensePassedOn: p.licensePassedOn ? p.licensePassedOn.slice(0, 10) : null,
    officeWorker: p.officeWorker,
  };
}

export function toHrCert(c: StaffCert): HrCert {
  return { memberId: c.memberId, kind: c.kind, doneOn: c.doneOn.slice(0, 10), hours: c.hours };
}

// ---------- 직원 기준 입력 ----------

export interface ProfileDraft {
  memberId: number | null;
  hireDate: string;
  jobType: PayrollJobType | '';
  birthYear: string;
  licensePassedOn: string;
  officeWorker: boolean;
  note: string;
}

export function newProfileDraft(memberId: number | null = null): ProfileDraft {
  return { memberId, hireDate: '', jobType: '', birthYear: '', licensePassedOn: '', officeWorker: false, note: '' };
}

export function draftFromProfile(p: StaffProfile): ProfileDraft {
  return {
    memberId: p.memberId,
    hireDate: p.hireDate.slice(0, 10),
    jobType: p.jobType,
    birthYear: numberText(p.birthYear),
    licensePassedOn: p.licensePassedOn ? p.licensePassedOn.slice(0, 10) : '',
    officeWorker: p.officeWorker,
    note: p.note ?? '',
  };
}

/** 급여 기준에서 직종·입사일을 가져온다(비어 있던 칸만 채우지 않고 덮어쓴다 — 사용자가 단추를 눌렀을 때만 부른다) */
export function applyPayrollProfile(d: ProfileDraft, pay: PayrollProfile): ProfileDraft {
  return { ...d, jobType: pay.jobType, hireDate: pay.hireDate.slice(0, 10) };
}

export function parseBirthYear(text: string): number | null {
  const t = text.trim();
  if (!/^\d{4}$/.test(t)) return null;
  return Number(t);
}

export function profileProblems(d: ProfileDraft): string[] {
  const out: string[] = [];
  if (d.memberId === null) out.push('직원을 골라 주세요');
  if (!isValidYmd(d.hireDate)) out.push('입사일을 골라 주세요');
  if (d.jobType === '') out.push('직종을 골라 주세요');
  if (d.birthYear.trim() !== '') {
    const y = parseBirthYear(d.birthYear);
    if (y === null || y < BIRTH_YEAR_MIN || y > BIRTH_YEAR_MAX) out.push(`출생연도는 ${BIRTH_YEAR_MIN}~${BIRTH_YEAR_MAX} 사이 네 자리 숫자로 적어 주세요`);
  }
  if (d.licensePassedOn !== '' && !isValidYmd(d.licensePassedOn)) out.push('자격 합격일을 다시 골라 주세요');
  return out.filter((x) => x !== '');
}

export function profileInput(d: ProfileDraft): StaffProfileInput {
  return {
    memberId: d.memberId as number,
    hireDate: d.hireDate,
    jobType: d.jobType as PayrollJobType,
    birthYear: d.birthYear.trim() === '' ? null : parseBirthYear(d.birthYear),
    licensePassedOn: d.licensePassedOn === '' ? null : d.licensePassedOn,
    officeWorker: d.officeWorker,
    note: orNull(d.note)?.slice(0, HR_LIMITS.note) ?? null,
  };
}

export function profileSnapshot(d: ProfileDraft): string {
  return JSON.stringify(d);
}

// ---------- 이수·검진 기록 입력 ----------

export interface CertDraft {
  memberId: number | null;
  kind: StaffCertKind;
  doneOn: string;
  hours: string;
  institution: string;
  certNo: string;
}

export function newCertDraft(kind: StaffCertKind, doneOn: string, memberId: number | null = null): CertDraft {
  return { memberId, kind, doneOn, hours: '', institution: '', certNo: '' };
}

export function draftFromCert(c: StaffCert): CertDraft {
  return {
    memberId: c.memberId,
    kind: c.kind,
    doneOn: c.doneOn.slice(0, 10),
    hours: numberText(c.hours),
    institution: c.institution ?? '',
    certNo: c.certNo ?? '',
  };
}

export function certProblems(d: CertDraft, today: string): string[] {
  const out: string[] = [];
  const noun = d.kind === 'HEALTH_CHECK' ? '검진일' : '이수일';
  if (d.memberId === null) out.push('직원을 골라 주세요');
  if (!isValidYmd(d.doneOn)) out.push(`${noun}을 골라 주세요`);
  else if (d.doneOn > today) out.push(`${noun}은 오늘 이후로 적을 수 없습니다`);
  if (d.kind === 'CONTINUING_EDU') {
    const h = parseDecimal(d.hours);
    if (h === null || h < EDU_HOURS_MIN || h > EDU_HOURS_MAX) out.push(`이수 시간은 ${EDU_HOURS_MIN}~${EDU_HOURS_MAX}시간 사이로 적어 주세요`);
  }
  return out;
}

export function certInput(d: CertDraft): StaffCertInput {
  const hours = d.kind === 'CONTINUING_EDU' ? parseDecimal(d.hours) : null;
  return {
    memberId: d.memberId as number,
    kind: d.kind,
    doneOn: d.doneOn,
    hours: hours === null ? null : Math.round(hours * 10) / 10,
    institution: orNull(d.institution)?.slice(0, HR_LIMITS.institution) ?? null,
    certNo: d.kind === 'CONTINUING_EDU' ? (orNull(d.certNo)?.slice(0, HR_LIMITS.certNo) ?? null) : null,
    note: null,
  };
}

// ---------- 표시 글자 ----------

export const EDU_STATUS_LABEL: Record<ContinuingEduStatusKind, string> = {
  DONE: '완료',
  DUE: '진행 중',
  MISSED: '미이수',
  NOT_TARGET: '대상 아님',
  EXEMPT: '면제',
  UNKNOWN: '출생연도 없음',
  NOT_REQUIRED: '해당 직종 아님',
};

export const EDU_STATUS_TONE: Record<ContinuingEduStatusKind, Tone> = {
  DONE: 'ok',
  DUE: 'warn',
  MISSED: 'danger',
  NOT_TARGET: 'neutral',
  EXEMPT: 'neutral',
  UNKNOWN: 'warn',
  NOT_REQUIRED: 'neutral',
};

export const HEALTH_STATUS_LABEL: Record<HealthCheckStatusKind, string> = {
  OK: '정상',
  DUE_SOON: '30일 안 만료',
  OVERDUE: '지남',
  MISSING: '기록 없음',
};

export const HEALTH_STATUS_TONE: Record<HealthCheckStatusKind, Tone> = { OK: 'ok', DUE_SOON: 'warn', OVERDUE: 'danger', MISSING: 'danger' };

/** 건강검진 표 정렬 — 급한 것부터 */
export const HEALTH_STATUS_ORDER: Record<HealthCheckStatusKind, number> = { OVERDUE: 0, MISSING: 1, DUE_SOON: 2, OK: 3 };

export function percentText(rate: number | null): string {
  return rate === null ? '해당없음' : `${rate}%`;
}

export function scoreText(score: number | null): string {
  return score === null ? '해당없음' : `${score}점`;
}

/** 근속 개월을 "2년 3개월"로 */
export function tenureText(months: number): string {
  if (months < 12) return `${months}개월`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m === 0 ? `${y}년` : `${y}년 ${m}개월`;
}

export function certTitle(kind: StaffCertKind): string {
  return kind === 'HEALTH_CHECK' ? '건강검진' : kind === 'CONTINUING_EDU' ? '보수교육' : '기타';
}
