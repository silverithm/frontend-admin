/** 한 달 출석 응답을 날짜별 출석자(PRESENT만)로 읽는다 — 응답 모양이 둘 이상이라 느슨하게 읽는다. */
import type { CognitiveAttendee } from '@/lib/lab/cognitiveProgramRules';

interface RawRow {
  elderlyId?: unknown;
  status?: unknown;
  date?: unknown;
}

/** 날짜가 없거나 출석이 아닌 줄은 건너뛴다. 등급은 어르신 목록(careGradeOf)에서 붙이고, 모르는 어르신은 뺀다. */
export function attendanceByDayOf(data: unknown, careGradeOf: ReadonlyMap<number, string | null>): Record<string, CognitiveAttendee[]> {
  const box = data as { attendances?: unknown; records?: unknown; content?: unknown } | null;
  const raw = Array.isArray(data) ? data : box?.attendances ?? box?.records ?? box?.content ?? [];
  const out: Record<string, CognitiveAttendee[]> = {};
  if (!Array.isArray(raw)) return out;
  for (const row of raw as RawRow[]) {
    const id = Number(row?.elderlyId);
    if (!Number.isInteger(id) || typeof row.date !== 'string') continue;
    if (row.status !== 'PRESENT' && row.status !== '출석') continue;
    if (!careGradeOf.has(id)) continue;
    const day = row.date.slice(0, 10);
    const list = out[day] ?? (out[day] = []);
    if (!list.some((a) => a.elderlyId === id)) list.push({ elderlyId: id, careGrade: careGradeOf.get(id) ?? null });
  }
  return out;
}
