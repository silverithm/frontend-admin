/**
 * 기능회복훈련(신체·인지기능 훈련, 물리·작업치료) 규칙 — 종류 이름, 어르신별 월간 요약, 급여제공기록 '기능회복훈련' 칸 문장.
 *
 * 근거(research-5.md): 장기요양급여 제공기록지(별지 제15호, 주야간보호)의 기능회복훈련 분류 — 신체기능 훈련 · 기본동작훈련 · 일상생활동작훈련 ·
 * 인지기능향상훈련 · 물리치료 · 작업치료. 2026 평가 '기능회복훈련' 지표는 계획(연 1회)을 보며 월간 계획은 요구하지 않는다.
 * 라벨은 계약의 표기(띄어쓰기 포함)를 따르고, 별지의 칸 이름과는 띄어쓰기·"~의" 정도만 다르다.
 */
import type { RehabKind, RehabSession } from './labTypes.ts';

export const REHAB_KINDS: ReadonlyArray<{ value: RehabKind; label: string }> = [
  { value: 'PHYSICAL_FUNCTION', label: '신체기능 훈련' },
  { value: 'BASIC_MOTION', label: '기본동작 훈련' },
  { value: 'ADL', label: '일상생활동작 훈련' },
  { value: 'PHYSIO', label: '물리치료' },
  { value: 'OCCUPATIONAL', label: '작업치료' },
  { value: 'COGNITIVE', label: '인지기능 향상 훈련' },
];

export function rehabKindLabel(kind: string): string {
  return REHAB_KINDS.find((k) => k.value === kind)?.label ?? kind;
}

export function isRehabKind(value: unknown): value is RehabKind {
  return typeof value === 'string' && REHAB_KINDS.some((k) => k.value === value);
}

/** 서버와 같은 한도 */
export const MAX_REHAB_MINUTES = 240;
export const MAX_REHAB_ITEMS = 10;
export const MAX_REHAB_ITEM_LENGTH = 40;

export interface RehabMonthlyRow {
  elderlyId: number;
  elderlyName: string;
  sessions: number;
  minutes: number;
  byKind: Record<RehabKind, { count: number; minutes: number }>;
  /** 서로 다른 날 수 */
  days: number;
}

function emptyByKind(): Record<RehabKind, { count: number; minutes: number }> {
  return Object.fromEntries(REHAB_KINDS.map((k) => [k.value, { count: 0, minutes: 0 }])) as Record<RehabKind, { count: number; minutes: number }>;
}

function minutesOf(s: { minutes: number }): number {
  return Number.isFinite(s.minutes) && s.minutes > 0 ? Math.trunc(s.minutes) : 0;
}

/** 'YYYY-MM' 달의 어르신별 요약(이름 가나다순, 같으면 id 순). 모든 종류 칸을 0으로 채워 둔다. */
export function rehabMonthly(sessions: ReadonlyArray<Pick<RehabSession, 'elderlyId' | 'elderlyName' | 'sessionDate' | 'kind' | 'minutes'>>, month: string): RehabMonthlyRow[] {
  const rows = new Map<number, RehabMonthlyRow & { dates: Set<string> }>();
  for (const s of sessions) {
    if (typeof s.sessionDate !== 'string' || s.sessionDate.slice(0, 7) !== month) continue;
    let row = rows.get(s.elderlyId);
    if (!row) {
      row = { elderlyId: s.elderlyId, elderlyName: s.elderlyName, sessions: 0, minutes: 0, byKind: emptyByKind(), days: 0, dates: new Set() };
      rows.set(s.elderlyId, row);
    }
    const minutes = minutesOf(s);
    row.sessions += 1;
    row.minutes += minutes;
    row.dates.add(s.sessionDate);
    if (s.kind in row.byKind) {
      row.byKind[s.kind].count += 1;
      row.byKind[s.kind].minutes += minutes;
    }
  }
  return [...rows.values()]
    .map(({ dates, ...row }) => ({ ...row, days: dates.size }))
    .sort((a, b) => a.elderlyName.localeCompare(b.elderlyName, 'ko') || a.elderlyId - b.elderlyId);
}

/**
 * 한 어르신 하루 세션을 급여제공기록 '기능회복훈련' 칸 문장으로 만든다.
 * 종류별로 묶어 "신체기능 훈련 30분(평행봉 걷기, 계단 오르기), 작업치료 20분" — 같은 종류는 분을 더하고 항목은 중복 없이 합친다.
 * 종류·항목은 처음 나온 순서, 항목이 없으면 괄호를 쓰지 않는다. 세션이 없으면 ''.
 */
export function rehabCareRecordText(sessions: ReadonlyArray<Pick<RehabSession, 'kind' | 'minutes' | 'items'>>): string {
  const groups = new Map<string, { minutes: number; items: string[] }>();
  for (const s of sessions) {
    let g = groups.get(s.kind);
    if (!g) groups.set(s.kind, (g = { minutes: 0, items: [] }));
    g.minutes += minutesOf(s);
    for (const raw of s.items ?? []) {
      const item = typeof raw === 'string' ? raw.trim() : '';
      if (item !== '' && !g.items.includes(item)) g.items.push(item);
    }
  }
  return [...groups.entries()]
    .map(([kind, g]) => `${rehabKindLabel(kind)} ${g.minutes}분${g.items.length > 0 ? `(${g.items.join(', ')})` : ''}`)
    .join(', ');
}
