/** 봉사 일지 한 건의 입력 상태 — 시간은 'HH:MM' 두 칸이고 분은 volunteerMinutes로 바로 계산한다. */
import { MAX_VOLUNTEER_MINUTES, VOLUNTEER_ACTIVITY_TYPES, volunteerMinutes } from '@/lib/lab/communityRules';
import type { VolunteerActivityType, VolunteerLog, VolunteerLogInput } from '@/lib/lab/labTypes';
import { parseYmd } from '@/lib/lab/labDate';

export const MAX_VOLUNTEER_NAME = 50;
export const MAX_VOLUNTEER_ORG = 100;
export const MAX_VOLUNTEER_CONTENT = 1000;
export const MAX_CONFIRMER_NAME = 50;

export const ACTIVITY_OPTIONS = VOLUNTEER_ACTIVITY_TYPES.map((t) => ({ value: t.value, label: t.label }));

export function activityLabel(type: string): string {
  return VOLUNTEER_ACTIVITY_TYPES.find((t) => t.value === type)?.label ?? type;
}

export interface VolunteerDraft {
  id: number | null;
  date: string;
  name: string;
  organization: string;
  start: string;
  end: string;
  activityType: VolunteerActivityType;
  content: string;
  vmsRegistered: boolean;
  confirmer: string;
}

export function emptyVolunteerDraft(date: string, confirmer: string): VolunteerDraft {
  return { id: null, date, name: '', organization: '', start: '09:00', end: '12:00', activityType: 'PROGRAM', content: '', vmsRegistered: false, confirmer };
}

export function draftOfVolunteer(log: VolunteerLog): VolunteerDraft {
  return {
    id: log.id,
    date: log.activityDate,
    name: log.volunteerName,
    organization: log.organization ?? '',
    start: log.startTime,
    end: log.endTime,
    activityType: log.activityType,
    content: log.content ?? '',
    vmsRegistered: log.vmsRegistered,
    confirmer: log.confirmerName,
  };
}

const orNull = (text: string): string | null => (text.trim() === '' ? null : text.trim());

export function inputOfVolunteerDraft(d: VolunteerDraft): VolunteerLogInput {
  return {
    activityDate: d.date,
    volunteerName: d.name.trim(),
    organization: orNull(d.organization),
    startTime: d.start,
    endTime: d.end,
    activityType: d.activityType,
    content: orNull(d.content),
    vmsRegistered: d.vmsRegistered,
    confirmerName: d.confirmer.trim(),
  };
}

/** 저장 전 점검 — 서버 규칙(끝 ≤ 시작 400, 720분 초과 400)과 같다 */
export function volunteerIssues(d: VolunteerDraft, today: string): string[] {
  const issues: string[] = [];
  if (!parseYmd(d.date)) issues.push('활동 날짜를 골라 주세요');
  else if (d.date > today) issues.push('오늘 이후 날짜는 기록할 수 없습니다');
  if (d.name.trim() === '') issues.push('봉사자 이름을 적어 주세요');
  if (d.start === '' || d.end === '') issues.push('시작과 끝 시간을 모두 넣어 주세요');
  else {
    const minutes = volunteerMinutes(d.start, d.end);
    if (minutes === null) issues.push('끝나는 시간은 시작 시간보다 뒤여야 합니다');
    else if (minutes > MAX_VOLUNTEER_MINUTES) issues.push('활동 1건은 12시간까지만 기록할 수 있습니다. 나눠서 적어 주세요');
  }
  if (d.confirmer.trim() === '') issues.push('확인자 이름을 적어 주세요');
  return issues;
}

/** 90 → '1시간 30분', 45 → '45분', 120 → '2시간' */
export function minutesText(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return '0분';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes - h * 60);
  if (h === 0) return `${m}분`;
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}
