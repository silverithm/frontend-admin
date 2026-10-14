/** 인력배치 점검 입력 초안 — 서버 기록과 화면 입력 사이를 오가고, 저장 전 막을 것을 모은다. */
import { defaultHolidays, staffGroupOf } from '@/lib/lab/staffingRules';
import { parseDecimal } from '@/components/labRecords/recordsFormat';
import type { StaffJobType, StaffingMonth, StaffingMonthInput } from '@/lib/lab/labTypes';

export const MAX_STAFF = 100;
export const MAX_STAFF_NAME = 50;
export const MAX_HOURS = 400;
export const MAX_EXTRA_NOTE = 200;
export const MAX_NOTE = 500;
export const MAX_USERS_SUM = 100000;

export interface StaffDraftRow {
  /** 화면 안에서만 쓰는 열쇠 */
  key: string;
  memberId: number | null;
  name: string;
  jobType: StaffJobType;
  /** 입력 글자(소수 첫째 자리) */
  hoursText: string;
}

export interface StaffingDraft {
  month: string;
  /** 일자별 입소자 수의 합 중 출결·직접 입력한 부분 */
  baseSum: number | null;
  serviceDays: number | null;
  /** 미이용일 급여비용 대상 등 더한 인원(인·일) */
  extraSum: number | null;
  extraReason: string;
  holidays: string[];
  staff: StaffDraftRow[];
  note: string;
  writerName: string;
}

let seq = 0;
export const newRowKey = (): string => {
  seq += 1;
  return `s${seq}`;
};

export function emptyStaffingDraft(month: string, writerName: string): StaffingDraft {
  return { month, baseSum: null, serviceDays: null, extraSum: null, extraReason: '', holidays: defaultHolidays(month), staff: [], note: '', writerName };
}

/** 서버에는 더한 인원을 따로 두는 칸이 없어, 사유 칸 앞에 '+N명 · '으로 적어 두고 읽을 때 다시 떼어 낸다 */
const EXTRA_PREFIX = /^\+(\d{1,6})명(?: · )?/;

export function splitExtraNote(note: string | null): { extra: number | null; reason: string } {
  const text = note ?? '';
  const m = EXTRA_PREFIX.exec(text);
  if (!m) return { extra: null, reason: text };
  return { extra: Number(m[1]), reason: text.slice(m[0].length) };
}

export function joinExtraNote(extra: number | null, reason: string): string | null {
  const r = reason.trim();
  const e = extra !== null && extra > 0 ? `+${extra}명` : '';
  if (e === '' && r === '') return null;
  return e !== '' && r !== '' ? `${e} · ${r}` : e + r;
}

export function hoursOf(row: Pick<StaffDraftRow, 'hoursText'>): number | null {
  return parseDecimal(row.hoursText);
}

export const totalSum = (d: StaffingDraft): number => (d.baseSum ?? 0) + (d.extraSum ?? 0);

export function draftOfStaffing(m: StaffingMonth): StaffingDraft {
  const { extra, reason } = splitExtraNote(m.extraUsersNote);
  const extraSum = extra !== null && extra <= m.usersSum ? extra : null;
  const reasonText = extraSum === null && extra !== null ? m.extraUsersNote ?? '' : reason;
  return {
    month: m.staffingMonth,
    baseSum: m.usersSum - (extraSum ?? 0),
    serviceDays: m.serviceDays,
    extraSum,
    extraReason: reasonText,
    holidays: [...m.holidays],
    staff: m.staff.map((s) => ({ key: newRowKey(), memberId: s.memberId, name: s.name, jobType: s.jobType, hoursText: String(s.hours) })),
    note: m.note ?? '',
    writerName: m.writerName,
  };
}

export function inputOfStaffing(d: StaffingDraft): StaffingMonthInput {
  return {
    staffingMonth: d.month,
    serviceDays: d.serviceDays ?? 0,
    usersSum: totalSum(d),
    extraUsersNote: joinExtraNote(d.extraSum, d.extraReason),
    holidays: [...d.holidays].sort(),
    staff: d.staff.map((s) => ({ memberId: s.memberId, name: s.name.trim(), jobType: s.jobType, hours: hoursOf(s) ?? 0 })),
    note: d.note.trim() === '' ? null : d.note.trim(),
    writerName: d.writerName.trim(),
  };
}

export function fingerprintOfStaffing(d: StaffingDraft): string {
  return JSON.stringify([d.month, d.baseSum, d.serviceDays, d.extraSum, d.extraReason, d.holidays, d.staff.map((s) => [s.memberId, s.name, s.jobType, s.hoursText]), d.note, d.writerName]);
}

/** 저장하기 전에 막는 이유 */
export function staffingBlockers(d: StaffingDraft): string[] {
  const out: string[] = [];
  if (d.serviceDays === null || d.serviceDays < 1 || d.serviceDays > 31) out.push('급여제공일수를 1~31일로 적어 주세요');
  if (totalSum(d) > MAX_USERS_SUM) out.push('일자별 입소자 수의 합이 너무 큽니다');
  if (d.staff.length > MAX_STAFF) out.push(`직원은 ${MAX_STAFF}명까지 적을 수 있습니다`);
  if (d.staff.some((s) => s.name.trim() === '')) out.push('이름이 빈 직원 줄이 있습니다');
  for (const s of d.staff) {
    const h = hoursOf(s);
    if (s.hoursText.trim() !== '' && (h === null || h < 0 || h > MAX_HOURS)) {
      out.push(`${s.name.trim() || '이름 없는 직원'}의 근무시간은 0~${MAX_HOURS}시간으로 적어 주세요`);
      break;
    }
  }
  if (joinExtraNote(d.extraSum, d.extraReason) !== null && (joinExtraNote(d.extraSum, d.extraReason) ?? '').length > MAX_EXTRA_NOTE) out.push(`더한 인원 사유는 ${MAX_EXTRA_NOTE}자 안에서 적어 주세요`);
  if (d.writerName.trim() === '') out.push('작성자 이름을 적어 주세요');
  return out;
}

/** 근무시간이 적힌 직원 중 배치 기준에 세는 줄(직종 OTHER 제외)의 수 */
export const countedStaff = (d: StaffingDraft): number => d.staff.filter((s) => staffGroupOf(s.jobType) !== null).length;
