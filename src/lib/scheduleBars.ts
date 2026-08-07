/**
 * 여러 날에 걸친 일정을 달력에서 "한 줄로 이어진 바"로 그리기 위한 레이아웃 계산.
 *
 * 날짜 칸마다 일정을 따로 그리면 3일짜리 행사가 세 번 반복돼, 한 건인지 세 건인지
 * 구분이 안 된다. 주 단위로 시작·끝 칸을 구해 하나의 바로 잇고, 주 경계를 넘어가면
 * 양끝에 "이어짐" 표시를 남긴다.
 *
 * 계산만 하는 순수 함수라 화면(월간일정·대시보드)마다 다른 크기로 그려 쓸 수 있다.
 */

/**
 * 일요일 열의 폭 배율. 대부분의 기관이 일요일은 쉬어 일정이 거의 없으므로 칸을 좁혀
 * 평일에 폭을 넘긴다. 월간일정과 대시보드 달력이 같은 비율을 써야 하므로 여기 모았다.
 *
 * 그리드는 WEEK_GRID_COLUMNS로 깔고, 여러 날 바의 좌표는 colStartRatio/colEndRatio로
 * 낸다. 균등 분할(1/7)로 좌표를 내면 바가 칸 경계와 어긋나므로 반드시 같이 써야 한다.
 */
export const SUNDAY_FR = 0.7;
const WEEK_FR_TOTAL = SUNDAY_FR + 6;

export const WEEK_GRID_COLUMNS = `minmax(0, ${SUNDAY_FR}fr) repeat(6, minmax(0, 1fr))`;

/** 주 안에서 col번째 칸이 시작되는 지점(0~1) */
export const colStartRatio = (col: number) => (col === 0 ? 0 : (SUNDAY_FR + (col - 1)) / WEEK_FR_TOTAL);
/** 주 안에서 col번째 칸이 끝나는 지점(0~1) */
export const colEndRatio = (col: number) => (SUNDAY_FR + col) / WEEK_FR_TOTAL;

/** 바를 그리는 데 필요한 최소 정보. Schedule/ScheduleItem 어느 쪽이든 받는다. */
export interface BarSource {
  id: string | number;
  /** 시작일이 없는 일정은 그릴 수 없으므로 건너뛴다 */
  startDate?: string;
  endDate?: string;
}

/** 한 주 안에서 일정 하나가 차지하는 구간 */
export interface ScheduleBar<T extends BarSource> {
  schedule: T;
  /** 그 주에서 시작하는 칸 (0=일요일) */
  startCol: number;
  /** 그 주에서 끝나는 칸 */
  endCol: number;
  /** 이전 주에서 이어져 온 일정인가 */
  continuesBefore: boolean;
  /** 다음 주로 이어지는 일정인가 */
  continuesAfter: boolean;
  /** 위에서부터 몇 번째 줄에 놓을 것인가 */
  lane: number;
}

export interface WeekBarLayout<T extends BarSource> {
  bars: ScheduleBar<T>[];
  /** 줄 수 제한에 걸려 감춘 일정 개수 (날짜별) */
  hiddenCounts: Record<string, number>;
  /** 이 주에서 실제로 쓰인 줄 수 */
  laneCount: number;
}

const dayPart = (value?: string) => (value ? value.substring(0, 10) : '');

/**
 * 주별 바 레이아웃을 계산한다.
 *
 * @param schedules 대상 일정
 * @param weeks     주별 날짜 배열. 각 원소는 'yyyy-MM-dd', 빈 칸은 null
 * @param maxLanes  한 주에 보여줄 최대 줄 수. 넘치면 hiddenCounts로 넘긴다
 */
export function buildWeekBarLayouts<T extends BarSource>(
  schedules: T[],
  weeks: (string | null)[][],
  maxLanes: number,
): WeekBarLayout<T>[] {
  // 시작일 빠른 순 → 기간 긴 순 → id 순. 주가 바뀌어도 같은 일정이 같은 줄에 오도록 고정한다.
  const sorted = [...schedules].sort((a, b) => {
    const sa = dayPart(a.startDate);
    const sb = dayPart(b.startDate);
    if (sa !== sb) return sa < sb ? -1 : 1;
    const ea = dayPart(a.endDate) || sa;
    const eb = dayPart(b.endDate) || sb;
    if (ea !== eb) return ea > eb ? -1 : 1;
    return String(a.id).localeCompare(String(b.id));
  });

  return weeks.map((keys) => {
    const bars: ScheduleBar<T>[] = [];
    const hiddenCounts: Record<string, number> = {};
    // laneEnds[i] = i번째 줄이 채워진 마지막 칸. 그보다 뒤에서 시작하면 같은 줄을 재사용한다.
    const laneEnds: number[] = [];

    sorted.forEach((schedule) => {
      const start = dayPart(schedule.startDate);
      if (!start) return;
      const end = dayPart(schedule.endDate) || start;
      if (end < start) return;

      let startCol = -1;
      let endCol = -1;
      keys.forEach((key, index) => {
        if (!key || key < start || key > end) return;
        if (startCol === -1) startCol = index;
        endCol = index;
      });
      if (startCol === -1) return;

      let lane = laneEnds.findIndex((laneEnd) => laneEnd < startCol);
      if (lane === -1) lane = laneEnds.length;
      laneEnds[lane] = endCol;

      if (lane < maxLanes) {
        bars.push({
          schedule,
          startCol,
          endCol,
          continuesBefore: start < keys[startCol]!,
          continuesAfter: end > keys[endCol]!,
          lane,
        });
      } else {
        for (let i = startCol; i <= endCol; i += 1) {
          const key = keys[i];
          if (key) hiddenCounts[key] = (hiddenCounts[key] || 0) + 1;
        }
      }
    });

    return { bars, hiddenCounts, laneCount: Math.min(laneEnds.length, maxLanes) };
  });
}
