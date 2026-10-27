// 목록·메타에 찍는 날짜 표기 하나. 화면마다 6가지로 갈리던 것을 여기로 모은다.
// 올해면 `MM.dd HH:mm`, 다른 해면 `yyyy.MM.dd HH:mm`.
function pad(n: number): string {
  return String(n).padStart(2, '0');
}

type DateInput = Date | string | number | null | undefined;

function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatListDateTime(value: DateInput, now: Date = new Date()): string {
  const d = toDate(value);
  if (!d) return '';
  const md = `${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return d.getFullYear() === now.getFullYear() ? `${md} ${hm}` : `${d.getFullYear()}.${md} ${hm}`;
}

export function formatListDate(value: DateInput, now: Date = new Date()): string {
  const d = toDate(value);
  if (!d) return '';
  const md = `${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
  return d.getFullYear() === now.getFullYear() ? md : `${d.getFullYear()}.${md}`;
}
