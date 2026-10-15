/** 시설 관리 대장 공용 — 선택지, 상태 문구·색, D-day, 날짜 계산. */
import { addDays, daysBetween, isValidYmd } from '@/lib/lab/labDate';
import type { LedgerStatus } from '@/lib/lab/facilityLedgerRules';
import type { Tone } from '@/components/lab/LabUi';
import type { FacilityDoneBy, FacilityLogResult } from '@/lib/lab/labTypes';

export const MAX_VENDOR = 100;
export const MAX_ACTION = 500;
export const MAX_DOC_LOCATION = 200;
export const MAX_MANAGER = 50;
export const MAX_NOTE = 500;
export const MAX_AREA = 1_000_000;
export const MAX_LPG_KG = 100_000;
/** 소방 자체점검 결과는 점검이 끝난 날부터 이 일수 안에 소방서에 보고한다 */
export const FIRE_REPORT_DAYS = 15;
/** 대장에 쓰는 기록은 오늘 기준 이 해 수만큼 거슬러 읽는다(올해 포함) */
export const LOG_YEARS = 4;

export const SPRINKLER_OPTIONS = [
  { value: 'NONE', label: '없음' },
  { value: 'SIMPLE', label: '간이스프링클러' },
  { value: 'FULL', label: '스프링클러(일반)' },
  { value: 'UNKNOWN', label: '모름' },
];
export const POWER_OPTIONS = [
  { value: 'GENERAL', label: '일반용' },
  { value: 'SELF_USE', label: '자가용' },
  { value: 'UNKNOWN', label: '모름' },
];
export const GAS_OPTIONS = [
  { value: 'NONE', label: '없음' },
  { value: 'CITY', label: '도시가스' },
  { value: 'LPG', label: 'LPG' },
  { value: 'UNKNOWN', label: '모름' },
];
export const ELEVATOR_OPTIONS = [
  { value: 'NONE', label: '없음' },
  { value: 'CENTER', label: '센터 관리' },
  { value: 'BUILDING', label: '건물 관리' },
  { value: 'UNKNOWN', label: '모름' },
];
export const TANK_OPTIONS = [
  { value: 'NONE', label: '없음' },
  { value: 'LARGE', label: '대형건축물등' },
  { value: 'SMALL', label: '소규모' },
  { value: 'UNKNOWN', label: '모름' },
];
export const SEPTIC_OPTIONS = [
  { value: 'NONE', label: '없음' },
  { value: 'YES', label: '있음' },
  { value: 'UNKNOWN', label: '모름' },
];
export const DONE_BY_OPTIONS: { value: FacilityDoneBy; label: string }[] = [
  { value: 'SELF', label: '자체' },
  { value: 'VENDOR', label: '업체' },
  { value: 'AGENCY', label: '기관' },
];
export const RESULT_OPTIONS: { value: FacilityLogResult; label: string }[] = [
  { value: 'PASS', label: '적합' },
  { value: 'FIX_NEEDED', label: '조치 필요' },
  { value: 'FAIL', label: '부적합' },
];
export const OVERRIDE_OPTIONS = [
  { value: 'AUTO', label: '자동 판정' },
  { value: 'YES', label: '예(해당)' },
  { value: 'NO', label: '아니오(해당 없음)' },
];

export const doneByLabel = (v: string) => DONE_BY_OPTIONS.find((o) => o.value === v)?.label ?? v;
export const resultLabel = (v: string) => RESULT_OPTIONS.find((o) => o.value === v)?.label ?? v;
export const resultTone = (v: string): Tone => (v === 'PASS' ? 'ok' : v === 'FIX_NEEDED' ? 'warn' : 'danger');

export const STATUS_INFO: Record<LedgerStatus, { label: string; tone: Tone }> = {
  OK: { label: '이상 없음', tone: 'ok' },
  DUE: { label: '곧 도래', tone: 'warn' },
  IN_WINDOW: { label: '점검 기간', tone: 'warn' },
  OVERDUE: { label: '기한 지남', tone: 'danger' },
  NEVER: { label: '기록 없음', tone: 'neutral' },
  NEED_INFO: { label: '정보 필요', tone: 'info' },
  NA: { label: '해당 없음', tone: 'neutral' },
};

export const APPLIES_INFO = {
  YES: { label: '예', tone: 'ok' as Tone },
  NO: { label: '아니오', tone: 'neutral' as Tone },
  UNKNOWN: { label: '확인 필요', tone: 'warn' as Tone },
};

/** 기한까지 남은 일수 → 'D-12' · 'D-day' · 'D+3'(지남). 기한이 없으면 '-' */
export function ddayText(daysLeft: number | null): string {
  if (daysLeft === null) return '-';
  if (daysLeft === 0) return 'D-day';
  return daysLeft > 0 ? `D-${daysLeft}` : `D+${-daysLeft}`;
}

/** 행 강조 — 기한이 지났으면 위험, 30일 이내(곧 도래·점검 기간)면 주의 */
export function rowTone(applies: string, status: LedgerStatus, daysLeft: number | null): 'danger' | 'warn' | undefined {
  if (applies !== 'YES') return undefined;
  if (status === 'OVERDUE') return 'danger';
  if ((status === 'DUE' || status === 'IN_WINDOW') && daysLeft !== null && daysLeft <= 30) return 'warn';
  return undefined;
}

/** 실시일 + 15일 — 소방 결과 보고 기한 */
export function fireReportDeadline(doneOn: string): string | null {
  return isValidYmd(doneOn) ? addDays(doneOn, FIRE_REPORT_DAYS) : null;
}

/** 소방 결과 보고 상태 문구(경고가 없으면 null) */
export function fireReportWarning(doneOn: string, reportedOn: string, today: string): string | null {
  const deadline = fireReportDeadline(doneOn);
  if (!deadline) return null;
  if (isValidYmd(reportedOn)) {
    const late = daysBetween(deadline, reportedOn);
    return late !== null && late > 0 ? `보고 기한(실시일 + ${FIRE_REPORT_DAYS}일, ${deadline})을 ${late}일 넘겨 보고했습니다` : null;
  }
  const over = daysBetween(deadline, today);
  return over !== null && over > 0 ? `보고 기한(${deadline})이 지났는데 보고일이 비어 있습니다` : null;
}

export function orNull(text: string): string | null {
  return text.trim() === '' ? null : text.trim();
}
