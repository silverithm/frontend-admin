/**
 * 주간 식단표 규칙 — 월~토 6일, 하루에 점심 여섯 칸 + 오전·오후 간식 + 다진식·죽식 대체 메모.
 *
 * 평가는 "주간 식단표가 게시되어 있고 실제 급식과 맞다"를 본다. 그래서 식단표는 한 주 단위로 월요일에 묶고,
 * 같은 주찬이 한 주에 두 번 나오는 것(어르신 식단은 변화가 있어야 잘 드신다)을 화면이 바로 짚도록 규칙으로 뽑아 둔다.
 * 모든 날짜는 한국 달력(labDate)이고, 모든 함수는 입력을 바꾸지 않고 새 값을 돌려준다.
 */
import type { MealDay, MealLunch } from './labTypes.ts';
import { daysInMonth, formatYmd, isValidMonth, parseYmd, seoulDateString } from './labDate.ts';
import { addDays, mondayOf } from './programRules.ts';

/** 식단표가 다루는 요일 수(월~토). 일요일은 운영하지 않는 것을 기본으로 한다. */
export const MEAL_DAY_COUNT = 6;
export const MEAL_WEEKDAY_LABELS: readonly string[] = ['월', '화', '수', '목', '금', '토'];
/** 한 칸의 글자 수 한도(서버와 같다) */
export const MEAL_TEXT_LIMIT = 60;
/** 주간 메모 한도(서버와 같다) */
export const MEAL_NOTES_LIMIT = 1000;

export type MealSlotId = 'rice' | 'soup' | 'main' | 'side1' | 'side2' | 'kimchi' | 'amSnack' | 'pmSnack' | 'soft';

/** 표의 행 순서와 이름. 화면은 이 목록으로 행을 그린다. */
export const MEAL_SLOTS: ReadonlyArray<{ id: MealSlotId; label: string }> = [
  { id: 'rice', label: '밥' },
  { id: 'soup', label: '국' },
  { id: 'main', label: '주찬' },
  { id: 'side1', label: '부찬 1' },
  { id: 'side2', label: '부찬 2' },
  { id: 'kimchi', label: '김치' },
  { id: 'amSnack', label: '오전 간식' },
  { id: 'pmSnack', label: '오후 간식' },
  { id: 'soft', label: '다진식·죽식 대체' },
];

const LUNCH_SLOT_IDS: readonly MealSlotId[] = ['rice', 'soup', 'main', 'side1', 'side2', 'kimchi'];

export function emptyLunch(): MealLunch {
  return { rice: '', soup: '', main: '', side1: '', side2: '', kimchi: '' };
}

export function emptyDay(date: string): MealDay {
  return { date, lunch: emptyLunch(), amSnack: '', pmSnack: '', soft: '' };
}

/** 그 날이 속한 주의 월요일로 맞춘다(월요일이면 그대로). 잘못된 날짜면 null. */
function snapToMonday(weekStart: string): string | null {
  const p = parseYmd(weekStart);
  if (!p) return null;
  return mondayOf(formatYmd(p.year, p.month, p.day));
}

/** 월요일인지. 서버는 월요일이 아닌 weekStart를 400으로 막는다. */
export function isMonday(ymd: string): boolean {
  const p = parseYmd(ymd);
  return !!p && mondayOf(formatYmd(p.year, p.month, p.day)) === formatYmd(p.year, p.month, p.day);
}

/** weekStart부터 월~토 6개 날짜. 월요일이 아니면 그 주 월요일부터 센다. 잘못된 날짜면 빈 배열. */
export function weekDates(weekStart: string): string[] {
  const monday = snapToMonday(weekStart);
  if (!monday) return [];
  const out: string[] = [];
  for (let i = 0; i < MEAL_DAY_COUNT; i += 1) {
    const d = addDays(monday, i);
    if (d) out.push(d);
  }
  return out;
}

/** 빈 한 주(월~토 6일). 잘못된 날짜면 빈 배열. */
export function emptyWeek(weekStart: string): MealDay[] {
  return weekDates(weekStart).map(emptyDay);
}

/** 오늘(서울)이 속한 주의 월요일 */
export function currentWeekStart(now: Date = new Date()): string {
  return mondayOf(seoulDateString(now)) ?? seoulDateString(now);
}

/** 다음 주 월요일 — "다음 주 식단 만들기"의 기본값 */
export function nextWeekStart(now: Date = new Date()): string {
  const start = currentWeekStart(now);
  return addDays(start, 7) ?? start;
}

/** 'YYYY-MM-DD'의 요일 글자(월~일). 잘못된 날짜면 빈 글자. */
export function weekdayLabel(ymd: string): string {
  const p = parseYmd(ymd);
  if (!p) return '';
  const dow = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay(); // 일 0 ~ 토 6
  return ['일', '월', '화', '수', '목', '금', '토'][dow];
}

/**
 * 그 달에 걸친 주들의 월요일(오름차순). 월 1일이 수요일이면 그 주(월요일은 전달)도 포함한다 —
 * 서버의 `GET /meal-plans?month=`가 돌려주는 "그 달에 걸친 주"와 같은 기준이다. 잘못된 월이면 빈 배열.
 */
export function weekStartsInMonth(month: string): string[] {
  if (!isValidMonth(month)) return [];
  const year = Number(month.slice(0, 4));
  const mm = Number(month.slice(5, 7));
  const first = mondayOf(formatYmd(year, mm, 1));
  if (!first) return [];
  const last = formatYmd(year, mm, daysInMonth(year, mm));
  const out: string[] = [];
  for (let cursor: string | null = first; cursor !== null && cursor <= last; cursor = addDays(cursor, 7)) out.push(cursor);
  return out;
}

// ---------- 칸 읽고 쓰기 ----------

export function getSlot(day: MealDay, slot: MealSlotId): string {
  return LUNCH_SLOT_IDS.includes(slot) ? day.lunch[slot as keyof MealLunch] : (day[slot as 'amSnack' | 'pmSnack' | 'soft'] ?? '');
}

/** 한 칸을 바꾼 새 하루를 돌려준다(원본은 그대로). 글자 수 한도는 넘으면 자른다. */
export function withSlot(day: MealDay, slot: MealSlotId, text: string): MealDay {
  const value = Array.from(text).slice(0, MEAL_TEXT_LIMIT).join('');
  if (LUNCH_SLOT_IDS.includes(slot)) return { ...day, lunch: { ...day.lunch, [slot]: value } };
  return { ...day, [slot]: value };
}

// ---------- 주찬 중복 ----------

/** 비교용 열쇠: 공백을 모두 없애고 소문자로. "고등어 조림"·" 고등어조림 "·"고등어조림"이 같은 반찬으로 걸린다. */
export function dishKey(dish: string | null | undefined): string {
  return typeof dish === 'string' ? dish.normalize('NFC').replace(/\s+/g, '').toLowerCase() : '';
}

export interface MenuRepeat {
  /** 처음 나온 모양 그대로(앞뒤·겹친 공백만 정리) */
  dish: string;
  /** 겹친 날짜들, 식단표 순서 */
  dates: string[];
}

/** 같은 주에 같은 주찬이 두 번 이상이면 반찬마다 하나씩. 빈 칸은 겹침으로 세지 않는다. */
export function menuRepeats(days: ReadonlyArray<Pick<MealDay, 'date' | 'lunch'>>): MenuRepeat[] {
  const groups = new Map<string, MenuRepeat>();
  for (const day of days) {
    const key = dishKey(day.lunch?.main);
    if (key === '') continue;
    const found = groups.get(key);
    if (found) found.dates.push(day.date);
    else groups.set(key, { dish: String(day.lunch.main).replace(/\s+/g, ' ').trim(), dates: [day.date] });
  }
  return [...groups.values()].filter((g) => g.dates.length >= 2);
}

/** 겹치는 주찬이 있는 날짜 집합 — 표에서 해당 칸을 표시할 때 쓴다 */
export function repeatedMainDates(days: ReadonlyArray<Pick<MealDay, 'date' | 'lunch'>>): Set<string> {
  return new Set(menuRepeats(days).flatMap((r) => r.dates));
}

/** 이 주찬이 피해야 할 목록(지난주 주찬 등)에 있는지 */
export function isAvoidedDish(dish: string | null | undefined, avoid: ReadonlyArray<string>): boolean {
  const key = dishKey(dish);
  return key !== '' && avoid.some((a) => dishKey(a) === key);
}

/** 지난주 식단에서 피해야 할 주찬 목록(빈 칸·겹침 제외) — AI 입력의 avoid로 쓴다 */
export function mainsOf(days: ReadonlyArray<Pick<MealDay, 'lunch'>>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const day of days) {
    const key = dishKey(day.lunch?.main);
    if (key === '' || seen.has(key)) continue;
    seen.add(key);
    out.push(String(day.lunch.main).replace(/\s+/g, ' ').trim());
  }
  return out;
}

// ---------- 다진식·죽식 인원 ----------

export interface SoftDietCount {
  regular: number;
  chopped: number;
  porridge: number;
  mixed: number;
}

/** 어르신 식사 형태별 인원. 값이 없거나 모르는 값(식사 형태를 아직 안 적은 어르신)은 일반식으로 센다. */
export function softDietCount(elders: ReadonlyArray<{ mealType?: string | null }>): SoftDietCount {
  const count: SoftDietCount = { regular: 0, chopped: 0, porridge: 0, mixed: 0 };
  for (const e of elders) {
    if (e?.mealType === 'CHOPPED') count.chopped += 1;
    else if (e?.mealType === 'PORRIDGE') count.porridge += 1;
    else if (e?.mealType === 'MIXED') count.mixed += 1;
    else count.regular += 1;
  }
  return count;
}

/** 다진식·죽식으로 따로 준비할 인원(다진식 + 죽식). 혼합식은 따로 센다. */
export function softDietTotal(count: Pick<SoftDietCount, 'chopped' | 'porridge'>): number {
  return count.chopped + count.porridge;
}

// ---------- 지난주 복사 ----------

/**
 * 지난 식단을 새 주로 옮긴 사본. 앞에서부터 새 주 월요일 + 0·1·2… 날짜로 다시 매긴다(요일 위치가 그대로 이어진다).
 * 원본은 건드리지 않고 칸 안의 글도 깊은 복사다. newWeekStart가 월요일이 아니면 그 주 월요일로 맞추고, 잘못된 날짜면 빈 배열.
 * 주의: 주찬이 지난주와 똑같아지므로 화면은 복사 후 바로 "피해야 할 반복" 안내를 해야 한다.
 */
export function copyWeek(days: ReadonlyArray<MealDay>, newWeekStart: string): MealDay[] {
  const monday = snapToMonday(newWeekStart);
  if (!monday) return [];
  return days.map((day, i) => ({
    date: addDays(monday, i) ?? monday,
    lunch: { ...emptyLunch(), ...day.lunch },
    amSnack: day.amSnack ?? '',
    pmSnack: day.pmSnack ?? '',
    soft: day.soft ?? '',
  }));
}

/** 한 칸이라도 채워졌는지 — 빈 식단표를 저장하려는 실수를 막는 데 쓴다 */
export function hasAnyMenu(days: ReadonlyArray<MealDay>): boolean {
  return days.some((d) => MEAL_SLOTS.some((s) => getSlot(d, s.id).trim() !== ''));
}

/** 주찬이 비어 있는 날짜들 — 게시 전에 채울 곳을 알려 준다 */
export function daysMissingMain(days: ReadonlyArray<MealDay>): string[] {
  return days.filter((d) => dishKey(d.lunch?.main) === '').map((d) => d.date);
}
