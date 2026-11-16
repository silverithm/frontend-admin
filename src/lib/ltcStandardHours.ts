/**
 * 2026년 월별 '월 기준 근무시간'(근무인원 1명) — /ltc/monthly-standard-hours-2026 페이지의 원장.
 *
 * 날짜 하나가 틀리면 그달 숫자가 8시간씩 틀어진다. 목록을 고칠 때는 반드시 아래 원문을 다시 열어 대조한다.
 * - 규칙: 「장기요양급여 제공기준 및 급여비용 산정방법 등에 관한 고시」(보건복지부고시 제2026-189호, 2026.10.1. 시행)
 *   제49조제1항 "[해당 월에 공휴일, 근로자의 날 및 토요일을 제외한 근무가능일수 × 8시간]".
 *   '공휴일'은 같은 고시 제32조제3항제2호가 「관공서의 공휴일에 관한 규정」에 따른 공휴일·대체공휴일을 줄여 부른 말이다.
 * - 공휴일: 「관공서의 공휴일에 관한 규정」(대통령령 제36290호, 2026.4.30. 일부개정) 제2조·제3조.
 *   이 개정으로 노동절(5월 1일)이 공휴일이 됐고(2026.5.1. 시행), 제2조제2호가 「국경일에 관한 법률」에 따른 국경일 전부로 바뀌어
 *   제헌절(7월 17일, 국경일법 제2조제2호)도 공휴일이 됐다(2026.5.11. 시행). 인사혁신처 보도자료(2026.4.29. 게시)와 같다.
 * - 음력 명절의 양력 날짜: 한국천문연구원 월별 음양력(2026년 2월·5월·9월).
 * - 선거일: 중앙선거관리위원회 선거일정 — 제9회 전국동시지방선거 선거일투표 2026.6.3.(규정 제2조제10호의2).
 * - 임시공휴일(규정 제2조제11호): 인사혁신처 보도자료를 제목·본문으로 검색해 2026년 지정이 없음을 확인했다(2026-11-16).
 *   지정되면 이 목록에 넣고 대조일을 고친다.
 */

import { monthlyStandardHours } from './ltcStaffing.ts';

/** 원문을 마지막으로 대조한 날. 페이지의 "원문 대조"와 구조화 데이터 dateModified로 쓴다. */
export const STANDARD_HOURS_VERIFIED_AT = '2026-11-16';

export const STANDARD_HOURS_YEAR = 2026;

/** 하루 근무시간 — 고시 제49조제1항의 "× 8시간". */
export const HOURS_PER_DAY = 8;

export interface PublicHoliday {
  /** YYYY-MM-DD */
  date: string;
  name: string;
  /** 「관공서의 공휴일에 관한 규정」 근거 조항 */
  basis: string;
}

/** 2026년 관공서 공휴일(일요일 제외)과 대체공휴일. 토·일요일에 걸린 날도 넣는다 — 숫자에 영향이 없다는 것까지 보여 주려고. */
export const HOLIDAYS_2026: ReadonlyArray<PublicHoliday> = [
  { date: '2026-01-01', name: '1월 1일', basis: '제2조제3호' },
  { date: '2026-02-16', name: '설날 전날', basis: '제2조제4호' },
  { date: '2026-02-17', name: '설날', basis: '제2조제4호' },
  { date: '2026-02-18', name: '설날 다음 날', basis: '제2조제4호' },
  { date: '2026-03-01', name: '3·1절', basis: '제2조제2호' },
  { date: '2026-03-02', name: '3·1절 대체공휴일', basis: '제3조제1항제1호' },
  { date: '2026-05-01', name: '노동절(근로자의 날)', basis: '제2조제6호' },
  { date: '2026-05-05', name: '어린이날', basis: '제2조제7호' },
  { date: '2026-05-24', name: '부처님 오신 날', basis: '제2조제5호' },
  { date: '2026-05-25', name: '부처님 오신 날 대체공휴일', basis: '제3조제1항제1호' },
  { date: '2026-06-03', name: '전국동시지방선거 선거일', basis: '제2조제10호의2' },
  { date: '2026-06-06', name: '현충일', basis: '제2조제8호' },
  { date: '2026-07-17', name: '제헌절', basis: '제2조제2호' },
  { date: '2026-08-15', name: '광복절', basis: '제2조제2호' },
  { date: '2026-08-17', name: '광복절 대체공휴일', basis: '제3조제1항제1호' },
  { date: '2026-09-24', name: '추석 전날', basis: '제2조제9호' },
  { date: '2026-09-25', name: '추석', basis: '제2조제9호' },
  { date: '2026-09-26', name: '추석 다음 날', basis: '제2조제9호' },
  { date: '2026-10-03', name: '개천절', basis: '제2조제2호' },
  { date: '2026-10-05', name: '개천절 대체공휴일', basis: '제3조제1항제1호' },
  { date: '2026-10-09', name: '한글날', basis: '제2조제2호' },
  { date: '2026-12-25', name: '기독탄신일', basis: '제2조제10호' },
];

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const;

function parseDate(date: string): { year: number; month: number; day: number } {
  const [year, month, day] = date.split('-').map(Number);
  return { year, month, day };
}

/** 0 = 일요일 … 6 = 토요일 */
export function dayOfWeek(date: string): number {
  const { year, month, day } = parseDate(date);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function weekdayLabel(date: string): string {
  return WEEKDAY_LABELS[dayOfWeek(date)];
}

/** "2026-07-17" → "7월 17일(금)" */
export function formatMonthDay(date: string): string {
  const { month, day } = parseDate(date);
  return `${month}월 ${day}일(${weekdayLabel(date)})`;
}

export function isWeekend(date: string): boolean {
  const dow = dayOfWeek(date);
  return dow === 0 || dow === 6;
}

export interface StandardHoursRow {
  month: number;
  /** 그달 월~금 날수 */
  weekdays: number;
  /** 월~금에 걸려 근무가능일에서 빠지는 공휴일·대체공휴일·근로자의 날 */
  offWeekdays: ReadonlyArray<PublicHoliday>;
  /** 근무가능일수 = weekdays − offWeekdays */
  workableDays: number;
  /** 월 기준 근무시간 = workableDays × 8 */
  hours: number;
}

/** 2026년 1~12월 월 기준 근무시간 표. 시간 계산은 인력배치기준 페이지와 같은 함수(ltcStaffing.monthlyStandardHours)를 쓴다. */
export function standardHours2026(): StandardHoursRow[] {
  const rows: StandardHoursRow[] = [];
  for (let month = 1; month <= 12; month += 1) {
    const inMonth = HOLIDAYS_2026.filter((h) => parseDate(h.date).month === month);
    const offWeekdays = inMonth.filter((h) => !isWeekend(h.date));
    const weekdays = monthlyStandardHours(STANDARD_HOURS_YEAR, month, []) / HOURS_PER_DAY;
    const hours = monthlyStandardHours(
      STANDARD_HOURS_YEAR,
      month,
      offWeekdays.map((h) => parseDate(h.date).day),
    );
    rows.push({ month, weekdays, offWeekdays, workableDays: hours / HOURS_PER_DAY, hours });
  }
  return rows;
}

export interface PartTimeHeadcount {
  /** 가산산정 — 소수점 이하 버림 (고시 제51조제3항제1호) */
  forBonus: number;
  /** 감액산정 — 소수점 둘째자리 버림, 첫째자리가 4 이하면 첫째자리도 버림 (제51조제3항제2호) */
  forPenalty: number;
}

/**
 * 월 기준 근무시간에 못 미치는 같은 직종 직원들의 근무시간 합을 근무인원 수로 바꾼다 — 고시 제51조제3항.
 * 0.1 단위 정수로 셈해 부동소수 오차가 끼지 않게 한다.
 */
export function partTimeHeadcount(totalHours: number, standardHours: number): PartTimeHeadcount {
  if (!Number.isInteger(totalHours) || totalHours < 0 || !Number.isInteger(standardHours) || standardHours <= 0) {
    throw new RangeError(`근무시간은 0 이상의 정수, 기준 시간은 1 이상의 정수여야 한다: ${totalHours} / ${standardHours}`);
  }
  const tenths = Math.floor((totalHours * 10) / standardHours);
  const whole = Math.floor(tenths / 10);
  const firstDecimal = tenths % 10;
  return {
    forBonus: Math.floor(totalHours / standardHours),
    forPenalty: firstDecimal <= 4 ? whole : whole + firstDecimal / 10,
  };
}

export interface StandardHoursSource {
  name: string;
  url: string;
}

export const STANDARD_HOURS_SOURCES: ReadonlyArray<StandardHoursSource> = [
  {
    name: '장기요양급여 제공기준 및 급여비용 산정방법 등에 관한 고시 (보건복지부고시 제2026-189호, 2026.10.1. 시행) 제11조의7, 제32조제3항제2호, 제49조, 제51조, 제67조',
    url: 'https://www.law.go.kr/행정규칙/장기요양급여제공기준및급여비용산정방법등에관한고시',
  },
  {
    name: '관공서의 공휴일에 관한 규정 (대통령령 제36290호, 2026.4.30. 일부개정) 제2조(공휴일)·제3조(대체공휴일)·제4조(임시공휴일의 지정)',
    url: 'https://www.law.go.kr/법령/관공서의공휴일에관한규정',
  },
  {
    name: '국경일에 관한 법률 제2조(국경일의 종류) — 제헌절 7월 17일',
    url: 'https://www.law.go.kr/법령/국경일에관한법률',
  },
  {
    name: '한국천문연구원 천문우주정보 — 월별 음양력 (2026년 2월·5월·9월: 설날·부처님 오신 날·추석의 양력 날짜)',
    url: 'https://astro.kasi.re.kr/life/pageView/5',
  },
  {
    name: '중앙선거관리위원회 — 제9회 전국동시지방선거 선거일정 (선거일투표 2026년 6월 3일)',
    url: 'https://www.nec.go.kr/site/nec/main.do',
  },
  {
    name: '인사혁신처 보도자료 「올해부터 노동절, 제헌절 공휴일로」 (2026.4.29.)',
    url: 'https://www.mpm.go.kr/mpm/comm/newsPress/newsPressRelease/?boardId=bbs_0000000000000029&mode=view&cntId=4250',
  },
];
