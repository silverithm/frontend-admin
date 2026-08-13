/**
 * 달력 한 칸을 "왼쪽 일정 / 오른쪽 휴무자"로 나눠 보는 규칙.
 *
 * 근무표를 볼 때 실제로 필요한 건 "이날 무슨 일이 있나"와 "이날 누가 빠지나"를
 * 같이 보는 것이다. 두 달력을 오가지 않도록 한 칸을 세로로 갈라 왼쪽엔 일정,
 * 오른쪽엔 그날 휴무자를 쌓는다. 어느 한쪽만 보고 싶을 때가 있어 토글로 끈다.
 *
 * 월간일정 탭(ScheduleCalendar)과 대시보드 달력(AdminDashboard)이 같은 규칙을
 * 써야 하므로 비율·좌표 계산·저장 키를 여기 모았다.
 */

import { colStartRatio, colEndRatio } from '@/lib/scheduleBars';

export type CalendarPane = 'both' | 'schedule' | 'vacation';

/** 두 화면이 같은 선택을 공유한다 — 대시보드에서 고른 보기가 월간일정에서도 유지된다. */
const STORAGE_KEY = 'carev.calendarPane';

export const CALENDAR_PANE_OPTIONS: { value: CalendarPane; label: string }[] = [
  { value: 'both', label: '일정+휴무' },
  { value: 'schedule', label: '일정' },
  { value: 'vacation', label: '휴무' },
];

/** 둘 다 볼 때 일정 영역이 칸에서 차지하는 폭. 나머지가 휴무자 자리다. */
export const SCHEDULE_PANE_FRACTION = 0.6;

const isPane = (value: unknown): value is CalendarPane =>
  value === 'both' || value === 'schedule' || value === 'vacation';

export const loadCalendarPane = (): CalendarPane => {
  if (typeof window === 'undefined') return 'both';
  const saved = window.localStorage.getItem(STORAGE_KEY);
  return isPane(saved) ? saved : 'both';
};

export const saveCalendarPane = (pane: CalendarPane) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, pane);
};

export const showsSchedules = (pane: CalendarPane) => pane !== 'vacation';
export const showsVacations = (pane: CalendarPane) => pane !== 'schedule';

/** 칸 안에서 일정 영역이 차지하는 비율 (휴무자를 같이 보면 좁아진다) */
export const schedulePaneFraction = (pane: CalendarPane) =>
  pane === 'both' ? SCHEDULE_PANE_FRACTION : 1;

/** 칸 안에서 휴무자 영역이 차지하는 비율 (0이면 안 보인다) */
export const vacationPaneFraction = (pane: CalendarPane) =>
  pane === 'vacation' ? 1 : pane === 'both' ? 1 - SCHEDULE_PANE_FRACTION : 0;

interface BarLike {
  startCol: number;
  endCol: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
}

/** 화면에 실제로 그릴 바 한 토막 */
export interface BarSegment {
  startCol: number;
  endCol: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
  /** 주 폭 대비 왼쪽 위치(%) */
  leftPct: number;
  /** 주 폭 대비 폭(%) */
  widthPct: number;
}

/**
 * 여러 날 일정 바를 pane 모드에 맞는 토막으로 나눈다.
 *
 * 일정만 볼 때는 지금까지처럼 시작~끝을 한 줄로 잇는다. 휴무자를 같이 볼 때는
 * 칸의 오른쪽 40%가 휴무자 자리라 바가 그 위를 지나갈 수 없다. 그래서 하루씩
 * 끊고 양끝에 ◀▶를 남겨 "이어지는 일정"임을 표시한다.
 */
export function buildBarSegments(
  bar: BarLike,
  pane: CalendarPane,
  /**
   * 그 열(날짜)에 휴무자가 있는지. 없으면 그 칸은 휴무자 자리를 비워둘 이유가 없어
   * 바가 칸을 끝까지 쓴다 — 안 그러면 오른쪽 40%가 늘 빈 채로 남는다.
   */
  hasVacationAtCol?: (col: number) => boolean,
): BarSegment[] {
  const measure = (startCol: number, endCol: number, fraction: number) => {
    const left = colStartRatio(startCol);
    const lastStart = colStartRatio(endCol);
    const right = lastStart + (colEndRatio(endCol) - lastStart) * fraction;
    return { leftPct: left * 100, widthPct: (right - left) * 100 };
  };

  if (pane !== 'both') {
    return [{ ...bar, ...measure(bar.startCol, bar.endCol, schedulePaneFraction(pane)) }];
  }

  const segments: BarSegment[] = [];
  for (let col = bar.startCol; col <= bar.endCol; col += 1) {
    const fraction = hasVacationAtCol && !hasVacationAtCol(col) ? 1 : SCHEDULE_PANE_FRACTION;
    segments.push({
      startCol: col,
      endCol: col,
      continuesBefore: col > bar.startCol || bar.continuesBefore,
      continuesAfter: col < bar.endCol || bar.continuesAfter,
      ...measure(col, col, fraction),
    });
  }
  return segments;
}
