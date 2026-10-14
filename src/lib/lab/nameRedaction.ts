/**
 * AI로 보내는 글에서 기관 사람 이름을 지운다.
 *
 * 화면마다 "메모에 이름을 적지 마세요"라고 안내하지만, 바쁜 직원은 "김말순 어르신 오늘 점심 절반"처럼 적는다.
 * 그래서 AI 호출 직전에 이 브라우저가 알고 있는 어르신·직원 이름을 "어르신"(직원은 "직원")으로 바꾼다.
 * 이름 목록은 실험실이 어르신·직원 목록을 불러올 때 기억해 둔다(서버로 다시 보내지 않는다).
 */

const elderNames = new Set<string>();
const staffNames = new Set<string>();

/** 이름으로 볼 만한 것만 기억한다 — 한 글자 이름은 일반 낱말과 겹쳐 글을 망가뜨린다 */
function usable(name: string): string | null {
  const trimmed = name.trim();
  return trimmed.length >= 2 && trimmed.length <= 20 ? trimmed : null;
}

export function rememberElderNames(names: Iterable<string>): void {
  for (const n of names) {
    const u = usable(n);
    if (u) elderNames.add(u);
  }
}

export function rememberStaffNames(names: Iterable<string>): void {
  for (const n of names) {
    const u = usable(n);
    if (u) staffNames.add(u);
  }
}

/** 시험용 — 기억한 이름을 비운다 */
export function forgetNames(): void {
  elderNames.clear();
  staffNames.clear();
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 글 안의 이름을 바꾼다. 어르신 이름 뒤에 붙은 "님"·" 어르신"·"어르신"은 함께 지워 "어르신 어르신"이 되지 않게 한다.
 * 긴 이름부터 바꿔 "김말순"이 "김말"에 먼저 걸리지 않게 한다.
 */
export function redactNames(text: string): string {
  if (!text) return text;
  let out = text;
  const elders = [...elderNames].sort((a, b) => b.length - a.length);
  for (const name of elders) {
    out = out.replace(new RegExp(`${escapeRegExp(name)}(\\s*어르신|\\s*님)?`, 'g'), '어르신');
  }
  const staff = [...staffNames].filter((n) => !elderNames.has(n)).sort((a, b) => b.length - a.length);
  for (const name of staff) {
    out = out.replace(new RegExp(`${escapeRegExp(name)}(\\s*선생님|\\s*님|\\s*씨)?`, 'g'), '직원');
  }
  return out;
}

/** 객체·배열 안의 모든 문자열에 redactNames를 적용한 사본을 만든다(숫자·날짜 키는 그대로) */
export function redactDeep<T>(value: T): T {
  if (typeof value === 'string') return redactNames(value) as unknown as T;
  if (Array.isArray(value)) return value.map((v) => redactDeep(v)) as unknown as T;
  if (value && typeof value === 'object') {
    const copy: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) copy[k] = redactDeep(v);
    return copy as T;
  }
  return value;
}
