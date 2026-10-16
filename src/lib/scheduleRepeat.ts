/**
 * 반복 일정 펼치기 — 서버에는 "반복" 개념이 없으므로, 반복 설정을 날짜 목록으로 풀어 일정을 날짜마다 하나씩 등록한다.
 * 날짜는 모두 'yyyy-MM-dd' 문자열이며 시간대에 흔들리지 않게 정오(UTC) 기준으로 셈한다.
 */
export type RepeatKind = 'NONE' | 'WEEKLY' | 'MONTHLY';

/** 한 번에 등록할 수 있는 최대 건수 — 실수로 수백 건을 만들지 않게 한다 */
export const MAX_REPEAT_COUNT = 60;

export interface RepeatRule {
  kind: RepeatKind;
  /** 매주일 때 반복할 요일 (0=일 … 6=토). 비면 시작일의 요일을 쓴다 */
  weekdays: number[];
  /** 마지막 날(포함) */
  until: string;
}

function parse(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

function fmt(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** 시작일부터 종료일까지 규칙에 맞는 날짜 목록(시작일 포함). 규칙이 없거나 종료일이 시작일보다 빠르면 시작일 하나. */
export function expandRepeatDates(start: string, rule: RepeatRule): string[] {
  if (rule.kind === 'NONE' || !rule.until || rule.until < start) return [start];
  const first = parse(start);
  const last = parse(rule.until);
  const out: string[] = [];

  if (rule.kind === 'WEEKLY') {
    const days = rule.weekdays.length > 0 ? rule.weekdays : [first.getUTCDay()];
    for (let t = first.getTime(); t <= last.getTime() && out.length < MAX_REPEAT_COUNT; t += 86400000) {
      const d = new Date(t);
      if (days.includes(d.getUTCDay())) out.push(fmt(d));
    }
    return out.length > 0 ? out : [start];
  }

  // 매월 — 같은 날짜. 그 달에 없는 날(31일 등)은 건너뛴다
  const day = first.getUTCDate();
  for (let i = 0; out.length < MAX_REPEAT_COUNT; i += 1) {
    const base = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + i, 1, 12));
    if (base.getTime() > last.getTime()) break;
    const cand = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), day, 12));
    if (cand.getUTCMonth() !== base.getUTCMonth()) continue;
    if (cand.getTime() > last.getTime()) break;
    out.push(fmt(cand));
  }
  return out.length > 0 ? out : [start];
}

/** 종료일(여러 날 일정)을 시작일에서 떨어진 일수만큼 그대로 옮긴다 */
export function shiftDate(date: string, fromStart: string, toStart: string): string {
  const diff = Math.round((parse(date).getTime() - parse(fromStart).getTime()) / 86400000);
  return fmt(new Date(parse(toStart).getTime() + diff * 86400000));
}

/** 반복 설정을 사람이 읽을 한 줄로 */
export function describeRepeat(kind: RepeatKind, weekdays: number[], count: number): string {
  const names = ['일', '월', '화', '수', '목', '금', '토'];
  if (kind === 'WEEKLY') return `매주 ${[...weekdays].sort().map((d) => names[d]).join('·')}요일마다 ${count}건`;
  if (kind === 'MONTHLY') return `매월 같은 날짜마다 ${count}건`;
  return '';
}
