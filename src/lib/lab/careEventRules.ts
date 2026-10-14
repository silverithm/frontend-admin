/**
 * 상태변화·사고·응급 기록 규칙 — 보호자 연락 필요 판정, 기록 체크리스트, 닫기 조건, 월 통계,
 * 상태변화 주 1회 기록 점검(2026 평가), 낙상 후 재평가 대상.
 *
 * 근거와 한계(research-5.md)
 *  - 2026 평가 '응급상황대응'에는 사고 보고서 필수 항목·보호자 통보 시한이 없다. 낙상 응급대처에 "가장 가까운 가족 및 보호자에게
 *    사고 사실을 반드시 알린다"만 있고 시점 수치는 없다 → 같은 날 연락 여부는 우리 기준이며 "대조 필요"로 표시한다.
 *  - 급여제공 결과평가의 "상태변화 주 1회 이상 기록": '특이사항없음'·'양호함'·'지난주와 동일'·단순 급여 내용만 쓰면 불인정.
 *  - 서버 닫기 규칙(follow_up 필수, 필요한 사고는 보호자 연락 필수)과 canClose는 같은 문구·같은 조건이다.
 */
import type { CareEvent, CareEventKind, CareEventSeverity, CareRecord, RiskLatest } from './labTypes.ts';
import { findVaguePhrases } from './careRecordQuality.ts';
import { formatYmd, parseYmd } from './labDate.ts';

export const EVENT_KINDS: ReadonlyArray<{ value: CareEventKind; label: string }> = [
  { value: 'CONDITION_CHANGE', label: '상태변화' },
  { value: 'FALL', label: '낙상' },
  { value: 'INJURY', label: '부상' },
  { value: 'EMERGENCY', label: '응급상황' },
  { value: 'HOSPITAL', label: '병원 진료·이송' },
  { value: 'MEDICATION', label: '투약 사고' },
  { value: 'BEHAVIOR', label: '행동 변화' },
  { value: 'OTHER', label: '기타' },
];

export const EVENT_SEVERITIES: ReadonlyArray<{ value: CareEventSeverity; label: string }> = [
  { value: 'LOW', label: '경미' },
  { value: 'MODERATE', label: '보통' },
  { value: 'HIGH', label: '심각' },
  { value: 'CRITICAL', label: '위급' },
];

export function eventKindLabel(kind: string): string {
  return EVENT_KINDS.find((k) => k.value === kind)?.label ?? kind;
}

export function eventSeverityLabel(severity: string): string {
  return EVENT_SEVERITIES.find((s) => s.value === severity)?.label ?? severity;
}

/** 서버와 같은 한도 */
export const MAX_EVENT_TEXT = 2000;
export const MAX_EVENT_RESPONSE = 1000;

/** 보호자에게 반드시 알려야 하는 사고인가 — 낙상·부상·응급·병원·투약 사고이거나 심각 이상이면 true */
export function requiresGuardianNotice(kind: CareEventKind | string, severity: CareEventSeverity | string): boolean {
  return kind === 'FALL' || kind === 'INJURY' || kind === 'EMERGENCY' || kind === 'HOSPITAL' || kind === 'MEDICATION' || severity === 'HIGH' || severity === 'CRITICAL';
}

type EventLike = Partial<Pick<CareEvent, 'occurredAt' | 'immediateAction' | 'guardianNotifiedAt' | 'guardianMethod' | 'followUp' | 'prevention'>> &
  Pick<CareEvent, 'kind' | 'severity'>;

export interface ChecklistItem {
  code: 'ACTION' | 'GUARDIAN' | 'GUARDIAN_SAME_DAY' | 'FOLLOW_UP' | 'PREVENTION' | 'RISK_REASSESS';
  ok: boolean;
  message: string;
}

function filled(text: string | null | undefined): boolean {
  return typeof text === 'string' && text.trim() !== '';
}

/** 'YYYY-MM-DD' 또는 'YYYY-MM-DDTHH:MM'의 날짜 부분. 형식이 틀리면 null */
function dateOf(value: string | null | undefined): string | null {
  const ymd = parseYmd(value);
  return ymd ? formatYmd(ymd.year, ymd.month, ymd.day) : null;
}

/**
 * 기록 체크리스트. 보호자 연락이 필요 없는 사고에는 GUARDIAN 항목을 넣지 않고, 연락 기록이 없으면 GUARDIAN_SAME_DAY도 넣지 않는다.
 * PREVENTION은 낙상·부상만, RISK_REASSESS는 낙상만(사고 날짜 이후 — 같은 날 포함 — Morse 평가가 있어야 ok).
 */
export function eventChecklist(event: EventLike, opts: { latestMorseOn?: string | null } = {}): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  items.push({
    code: 'ACTION',
    ok: filled(event.immediateAction),
    message: filled(event.immediateAction) ? '즉시 조치를 적었습니다' : '사고 직후 한 조치(안정, 활력징후 확인, 응급처치, 보고)를 적어 주세요',
  });
  if (requiresGuardianNotice(event.kind, event.severity)) {
    const ok = filled(event.guardianNotifiedAt);
    items.push({ code: 'GUARDIAN', ok, message: ok ? '보호자 연락을 기록했습니다' : '보호자에게 알린 시각과 방법을 기록해 주세요 (낙상 응급대처: 가장 가까운 가족·보호자에게 반드시 알림)' });
  }
  if (filled(event.guardianNotifiedAt)) {
    const sameDay = dateOf(event.guardianNotifiedAt) !== null && dateOf(event.guardianNotifiedAt) === dateOf(event.occurredAt);
    items.push({
      code: 'GUARDIAN_SAME_DAY',
      ok: sameDay,
      message: sameDay ? '사고 당일에 보호자에게 알렸습니다' : '보호자 연락이 사고 당일이 아닙니다 (공개 규정에 통보 시한이 없어 대조 필요 — 가능하면 당일 연락)',
    });
  }
  items.push({
    code: 'FOLLOW_UP',
    ok: filled(event.followUp),
    message: filled(event.followUp) ? '후속 조치를 적었습니다' : '후속 조치(경과 관찰, 병원 진료, 보호자 협의)를 적어야 닫을 수 있습니다',
  });
  if (event.kind === 'FALL' || event.kind === 'INJURY') {
    items.push({
      code: 'PREVENTION',
      ok: filled(event.prevention),
      message: filled(event.prevention) ? '재발 방지 대책을 적었습니다' : '재발 방지 대책(환경 정비, 보행 보조, 근력 운동 등)을 적어 주세요',
    });
  }
  if (event.kind === 'FALL') {
    const fallDate = dateOf(event.occurredAt);
    const morse = dateOf(opts.latestMorseOn);
    const ok = fallDate !== null && morse !== null && morse >= fallDate;
    items.push({ code: 'RISK_REASSESS', ok, message: ok ? '낙상 후 낙상 위험도(Morse)를 다시 평가했습니다' : '낙상 후 위험도 평가에서 낙상(Morse) 재평가를 해 주세요' });
  }
  return items;
}

/** 서버 닫기 규칙과 같다: 후속 조치가 있어야 하고, 보호자 연락이 필요한 사고는 연락 기록도 있어야 한다. */
export function canClose(event: EventLike): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (!filled(event.followUp)) reasons.push('후속 조치를 적어야 닫을 수 있습니다');
  if (requiresGuardianNotice(event.kind, event.severity) && !filled(event.guardianNotifiedAt)) reasons.push('보호자 연락을 기록해야 닫을 수 있습니다');
  return { ok: reasons.length === 0, reasons };
}

export interface EventStats {
  total: number;
  open: number;
  byKind: Record<CareEventKind, number>;
  guardianRequired: number;
  guardianNotified: number;
  /** 보호자 연락 필요 사고 중 연락을 기록한 비율(%, 소수 첫째 자리 반올림). 필요한 사고가 없으면 null */
  notifyRate: number | null;
}

/** 'YYYY-MM' 달에 일어난 사고만 센다 */
export function eventStats(events: ReadonlyArray<Pick<CareEvent, 'occurredAt' | 'kind' | 'severity' | 'status'> & Partial<Pick<CareEvent, 'guardianNotifiedAt'>>>, month: string): EventStats {
  const byKind = Object.fromEntries(EVENT_KINDS.map((k) => [k.value, 0])) as Record<CareEventKind, number>;
  let total = 0;
  let open = 0;
  let required = 0;
  let notified = 0;
  for (const e of events) {
    if (typeof e.occurredAt !== 'string' || e.occurredAt.slice(0, 7) !== month) continue;
    total += 1;
    if (e.status === 'OPEN') open += 1;
    if (e.kind in byKind) byKind[e.kind] += 1;
    if (requiresGuardianNotice(e.kind, e.severity)) {
      required += 1;
      if (filled(e.guardianNotifiedAt)) notified += 1;
    }
  }
  return { total, open, byKind, guardianRequired: required, guardianNotified: notified, notifyRate: required === 0 ? null : Math.round((notified * 1000) / required) / 10 };
}

// ---------- 날짜 ----------

const DAY_MS = 86_400_000;

function utcDay(ymd: string): number {
  const p = parseYmd(ymd);
  return p ? Date.UTC(p.year, p.month - 1, p.day) : NaN;
}

/** 그 날짜가 속한 주의 월요일 'YYYY-MM-DD' */
export function mondayOf(ymd: string): string {
  const t = utcDay(ymd);
  const dow = new Date(t).getUTCDay(); // 0=일
  const d = new Date(t - ((dow + 6) % 7) * DAY_MS);
  return formatYmd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** 'YYYY-MM'과 겹치는 월~일 주의 월요일 목록(오름차순) */
export function weeksOverlapping(month: string): string[] {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return [];
  const first = `${m[1]}-${m[2]}-01`;
  if (parseYmd(first) === null) return [];
  const lastDay = new Date(Date.UTC(Number(m[1]), Number(m[2]), 0)).getUTCDate();
  const out: string[] = [];
  for (let t = utcDay(mondayOf(first)); t <= utcDay(`${m[1]}-${m[2]}-${String(lastDay).padStart(2, '0')}`); t += 7 * DAY_MS) {
    const d = new Date(t);
    out.push(formatYmd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()));
  }
  return out;
}

export interface WeeklyGap {
  elderlyId: number;
  /** 상태변화 기록이 없는 주의 월요일 */
  missingWeeks: string[];
}

/**
 * 2026 평가(결과평가) "상태변화 주 1회 이상 기록" 점검.
 * 주 = 그 달과 겹치는 월~일 주. attendance가 있으면 그 어르신이 출석한(그 달 안 날짜) 주만 따지고, 맵에 없는 어르신은 따질 주가 없다.
 * 채운 주 = 그 주(그 달 안)에 형식적 문구가 아닌 특이사항이 있는 급여제공기록이나 사고·상태변화 기록이 있는 주.
 */
export function conditionWeeklyGaps(params: {
  elderIds: ReadonlyArray<number>;
  month: string;
  careRecords: ReadonlyArray<Pick<CareRecord, 'elderlyId' | 'recordDate' | 'specialNote'>>;
  events: ReadonlyArray<Pick<CareEvent, 'elderlyId' | 'occurredAt'>>;
  attendance?: Readonly<Record<number, ReadonlyArray<string>>>;
}): WeeklyGap[] {
  const { month } = params;
  const allWeeks = weeksOverlapping(month);
  const inMonth = (date: string | null | undefined): string | null => {
    const d = dateOf(date);
    return d !== null && d.slice(0, 7) === month ? d : null;
  };
  const filledWeeks = new Map<number, Set<string>>();
  const mark = (elderlyId: number, date: string) => {
    let set = filledWeeks.get(elderlyId);
    if (!set) filledWeeks.set(elderlyId, (set = new Set()));
    set.add(mondayOf(date));
  };
  for (const r of params.careRecords) {
    const d = inMonth(r.recordDate);
    if (d === null || !filled(r.specialNote) || findVaguePhrases({ specialNote: r.specialNote }).length > 0) continue;
    mark(r.elderlyId, d);
  }
  for (const e of params.events) {
    const d = inMonth(e.occurredAt);
    if (d !== null) mark(e.elderlyId, d);
  }
  const out: WeeklyGap[] = [];
  for (const elderlyId of [...new Set(params.elderIds)].sort((a, b) => a - b)) {
    let weeks = allWeeks;
    if (params.attendance) {
      const days = params.attendance[elderlyId] ?? [];
      weeks = [...new Set(days.map(inMonth).filter((d): d is string => d !== null).map(mondayOf))].sort();
    }
    const have = filledWeeks.get(elderlyId);
    const missingWeeks = weeks.filter((w) => !have?.has(w));
    if (missingWeeks.length > 0) out.push({ elderlyId, missingWeeks });
  }
  return out;
}

/**
 * 가장 최근 낙상 날짜보다 최근 Morse 평가일이 이르거나(같은 날은 괜찮다) 평가가 없는 어르신 id(중복 없음, 오름차순).
 * 낙상 뒤 재평가는 평가 매뉴얼의 필수 항목이 아니라 낙상 후 관리 차원의 권장이다.
 */
export function fallsNeedingReassessment(events: ReadonlyArray<Pick<CareEvent, 'elderlyId' | 'occurredAt' | 'kind'>>, riskLatest: ReadonlyArray<Pick<RiskLatest, 'elderlyId'> & { morse: { assessedOn: string } | null }>): number[] {
  const lastFall = new Map<number, string>();
  for (const e of events) {
    if (e.kind !== 'FALL') continue;
    const d = dateOf(e.occurredAt);
    if (d === null) continue;
    const prev = lastFall.get(e.elderlyId);
    if (prev === undefined || d > prev) lastFall.set(e.elderlyId, d);
  }
  const morseOn = new Map<number, string | null>();
  for (const r of riskLatest) morseOn.set(r.elderlyId, dateOf(r.morse?.assessedOn));
  const out: number[] = [];
  for (const [elderlyId, fallDate] of lastFall) {
    const morse = morseOn.get(elderlyId) ?? null;
    if (morse === null || morse < fallDate) out.push(elderlyId);
  }
  return out.sort((a, b) => a - b);
}
