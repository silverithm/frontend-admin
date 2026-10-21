/**
 * 투약 규칙 — 오늘 먹여야 할 약, 투약 기록 상태, 투약의뢰서 점검, 약품 사용기한, 분기 보관 점검.
 *
 * 근거(research-6.md): 2026 평가 주야간보호 '투약 및 약품관리' — ① 약품보관함 잠금(냉장고에 두면 냉장고도 잠금), ② 일반 의약품 사용기한·보관상태를
 * 분기별 1회 이상 점검(일자·의약품명·효능·사용기한·점검자명·폐기일자, 사용기한이 지난 약을 보관하면 불인정), ③ 간호(조무)사 면담으로 투약 6원칙 확인.
 * 투약의뢰서 서식 항목·투약 기록 서식·비상약 관리대장 서식은 공개 규정에서 정해진 것을 못 찾았다 — 이 모듈의 항목은 기관 자체 기록이며 대조 필요.
 *
 * 이 모듈은 "무엇을 확인해야 하는가"만 알려준다. 복용 가부·용량 판단은 하지 않는다(의사 처방과 간호(조무)사의 몫).
 * 날짜는 모두 'YYYY-MM-DD' 문자열(서울 날짜)이고 계산은 UTC 달력으로 해 시간대 영향이 없다.
 */
import type {
  MedicationDose,
  MedicationItem,
  MedicationRequest,
  MedicationRoute,
  MedicationSlot,
  MedicationTiming,
  MedicineCheck,
  MedicineStock,
} from './labTypes.ts';
import { addDays, isValidYmd } from './labDate.ts';

export const SLOTS: ReadonlyArray<{ value: MedicationSlot; label: string }> = [
  { value: 'MORNING', label: '아침' },
  { value: 'LUNCH', label: '점심' },
  { value: 'EVENING', label: '저녁' },
  { value: 'BEDTIME', label: '자기 전' },
];

export const ROUTES: ReadonlyArray<{ value: MedicationRoute; label: string }> = [
  { value: 'ORAL', label: '먹는 약(경구)' },
  { value: 'TOPICAL', label: '바르는 약(외용)' },
  { value: 'EYE', label: '안약(점안)' },
  { value: 'INHALE', label: '흡입' },
  { value: 'OTHER', label: '그 밖' },
];

export const TIMINGS: ReadonlyArray<{ value: MedicationTiming; label: string }> = [
  { value: 'BEFORE_MEAL', label: '식전' },
  { value: 'AFTER_MEAL', label: '식후' },
  { value: 'WITH_MEAL', label: '식사 중' },
  { value: 'ANYTIME', label: '시간 무관' },
];

export const RELATIONS: ReadonlyArray<{ value: MedicationRequest['requesterRelation']; label: string }> = [
  { value: 'SELF', label: '본인' },
  { value: 'SPOUSE', label: '배우자' },
  { value: 'CHILD', label: '자녀' },
  { value: 'OTHER_FAMILY', label: '그 밖의 가족' },
  { value: 'OTHER', label: '그 밖' },
];

/** 서버와 같은 한도 */
export const MAX_MEDICINES = 15;
export const MAX_MEDICINE_NAME = 60;
export const MAX_MEDICINE_DOSE = 40;
export const MAX_MEDICINE_NOTE = 100;

/**
 * 투약 6원칙(2026 평가 '투약 및 약품관리' 면담 항목). 평가매뉴얼 표기는 "정확한 약물·용량·대상자·경로·시간·기록"이고
 * 현장에서는 대상자부터 확인하는 순서로 가르치므로 그 순서로 적는다.
 */
export const SIX_RIGHTS: readonly string[] = [
  '정확한 대상자 — 이름을 부르거나 확인해 의뢰서의 수급자가 맞는지 본다',
  '정확한 약물 — 약 이름이 의뢰서와 같은지 본다',
  '정확한 용량 — 의뢰서에 적힌 용량(알 수·양) 그대로인지 본다',
  '정확한 경로 — 먹는 약·바르는 약·안약 등 의뢰서의 투여 경로가 맞는지 본다',
  '정확한 시간 — 의뢰서의 시간대(아침·점심·저녁·자기 전, 식전·식후)가 맞는지 본다',
  '정확한 기록 — 투약한 직후 시각·투약자를 적고, 먹은 뒤 상태를 확인해 기록한다',
];

/** 요일 칸 — ISO 번호(1=월 … 7=일). 화면은 월요일부터 보인다 */
export const WEEKDAYS: ReadonlyArray<{ value: number; label: string }> = [
  { value: 1, label: '월' },
  { value: 2, label: '화' },
  { value: 3, label: '수' },
  { value: 4, label: '목' },
  { value: 5, label: '금' },
  { value: 6, label: '토' },
  { value: 7, label: '일' },
];

/** 요일 목록을 사람이 읽는 말로: 비었거나 일곱 요일이면 '매일', 아니면 '월·수만' */
export function describeWeekdays(weekdays: ReadonlyArray<number> | null | undefined): string {
  const days = (weekdays ?? []).filter((d) => Number.isInteger(d) && d >= 1 && d <= 7);
  const unique = Array.from(new Set(days)).sort((a, b) => a - b);
  if (unique.length === 0 || unique.length === 7) return '매일';
  return `${unique.map((d) => WEEKDAYS[d - 1].label).join('·')}만`;
}

/** yyyy-MM-dd의 ISO 요일(1=월 … 7=일). 올바른 날짜가 아니면 null */
export function isoWeekday(date: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (!m || !isValidYmd(date.slice(0, 10))) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12));
  if (Number.isNaN(d.getTime())) return null;
  return d.getUTCDay() === 0 ? 7 : d.getUTCDay();
}

/** 이 날 먹이는 약인가 — 요일이 없거나 비면 매일. 날짜를 읽을 수 없으면 먹이는 것으로 본다(빠뜨리는 것보다 낫다) */
export function givenOnDate(item: Pick<MedicationItem, 'weekdays'>, date: string): boolean {
  const days = item.weekdays;
  if (!Array.isArray(days) || days.length === 0) return true;
  const wd = isoWeekday(date);
  return wd === null || days.includes(wd);
}

/**
 * 메모 속 요일 표현("월·수만", "(화/목마다)", "월수금 요일")을 요일 목록으로 읽고, 그 부분을 뺀 메모를 돌려준다.
 * "만·마다·요일"이 붙은 때만 읽는다 — "월 1회" 같은 말을 요일로 오해하지 않기 위해서다.
 */
export function weekdaysFromNote(note: string): { weekdays: number[]; rest: string } {
  const re = /[(（]?\s*([월화수목금토일](?:\s*[·,/\s]?\s*[월화수목금토일])*)\s*(?:요일)?\s*(?:만|마다)\s*[)）]?|[(（]?\s*([월화수목금토일](?:\s*[·,/\s]?\s*[월화수목금토일])*)\s*요일\s*[)）]?/u;
  const m = re.exec(note);
  if (!m) return { weekdays: [], rest: note };
  const letters = (m[1] ?? m[2] ?? '').replace(/[^월화수목금토일]/gu, '');
  const days = Array.from(new Set(Array.from(letters).map((c) => '월화수목금토일'.indexOf(c) + 1))).sort((a, b) => a - b);
  const rest = (note.slice(0, m.index) + ' ' + note.slice(m.index + m[0].length)).replace(/\s{2,}/g, ' ').trim();
  return { weekdays: days, rest };
}

export function slotLabel(slot: string): string {
  return SLOTS.find((s) => s.value === slot)?.label ?? slot;
}

export function routeLabel(route: string): string {
  return ROUTES.find((r) => r.value === route)?.label ?? route;
}

export function timingLabel(timing: string): string {
  return TIMINGS.find((t) => t.value === timing)?.label ?? timing;
}

export function relationLabel(relation: string): string {
  return RELATIONS.find((r) => r.value === relation)?.label ?? relation;
}

export function isSlot(value: unknown): value is MedicationSlot {
  return typeof value === 'string' && SLOTS.some((s) => s.value === value);
}

export function isRoute(value: unknown): value is MedicationRoute {
  return typeof value === 'string' && ROUTES.some((r) => r.value === value);
}

export function isTiming(value: unknown): value is MedicationTiming {
  return typeof value === 'string' && TIMINGS.some((t) => t.value === value);
}

function slotIndex(slot: string): number {
  return SLOTS.findIndex((s) => s.value === slot);
}

function dayOf(value: string | null | undefined): string | null {
  return typeof value === 'string' && isValidYmd(value) ? value.slice(0, 10) : null;
}

// ---------- 오늘 투약 ----------

export interface DoseDue {
  requestId: number;
  elderlyId: number;
  /** 어느 날의 투약인가 — doseStatus가 투약 기록과 날짜까지 맞춰 본다 */
  date: string;
  slot: MedicationSlot;
  /** 그 시간대에 먹는 약만 */
  medicines: MedicationItem[];
}

type RequestForDue = Pick<MedicationRequest, 'id' | 'elderlyId' | 'status' | 'startDate' | 'endDate' | 'medicines'>;

/** 그 날짜가 의뢰 기간 안인가: 시작일 이상, 끝난 날이 있으면 끝난 날 이하. 끝난 날 없이 ENDED인 의뢰는 기간을 알 수 없어 오늘 이후로 보지 않는다. */
function requestCovers(request: Pick<MedicationRequest, 'status' | 'startDate' | 'endDate'>, date: string): boolean {
  const start = dayOf(request.startDate);
  if (start === null || date < start) return false;
  const end = dayOf(request.endDate);
  if (end !== null) return date <= end;
  return request.status === 'ACTIVE';
}

/**
 * 그 날짜에 먹여야 할 약 — 의뢰마다 시간대(slot)별로 하나. 진행 중이거나, 끝난 의뢰라도 날짜가 기간 안이면 센다.
 * presentElderIds를 주면 그 어르신만(오늘 출석한 어르신). 빈 배열이면 아무도 없다.
 * 정렬: 어르신 번호 → 시간대(아침·점심·저녁·자기 전) → 의뢰 번호.
 */
export function dosesDue(requests: ReadonlyArray<RequestForDue>, date: string, presentElderIds?: ReadonlyArray<number>): DoseDue[] {
  const day = dayOf(date);
  if (day === null) return [];
  const present = presentElderIds ? new Set(presentElderIds) : null;
  const out: DoseDue[] = [];
  for (const request of requests) {
    if (present && !present.has(request.elderlyId)) continue;
    if (!requestCovers(request, day)) continue;
    for (const slot of SLOTS) {
      const medicines = request.medicines.filter((m) => Array.isArray(m.slots) && m.slots.includes(slot.value) && givenOnDate(m, day));
      if (medicines.length > 0) out.push({ requestId: request.id, elderlyId: request.elderlyId, date: day, slot: slot.value, medicines });
    }
  }
  return out.sort((a, b) => a.elderlyId - b.elderlyId || slotIndex(a.slot) - slotIndex(b.slot) || a.requestId - b.requestId);
}

export type DoseState = 'DONE' | 'SKIPPED' | 'REFUSED' | 'PENDING';

/** 투약 기록과 맞춰 본다: 같은 의뢰·같은 날짜·같은 시간대의 기록이 있으면 그 상태(GIVEN은 DONE), 없으면 PENDING(아직). */
export function doseStatus<D extends Pick<MedicationDose, 'requestId' | 'givenOn' | 'slot' | 'status'>>(due: ReadonlyArray<DoseDue>, doses: ReadonlyArray<D>): Array<DoseDue & { dose: D | null; state: DoseState }> {
  const byKey = new Map<string, D>();
  for (const d of doses) byKey.set(`${d.requestId}|${d.givenOn.slice(0, 10)}|${d.slot}`, d);
  return due.map((item) => {
    const dose = byKey.get(`${item.requestId}|${item.date}|${item.slot}`) ?? null;
    const state: DoseState = !dose ? 'PENDING' : dose.status === 'GIVEN' ? 'DONE' : dose.status === 'SKIPPED' ? 'SKIPPED' : 'REFUSED';
    return { ...item, dose, state };
  });
}

// ---------- 투약의뢰서 점검 ----------

/** 의뢰서에서 고쳐야 할 점(문장 목록). 없으면 빈 배열. 모두 사실 확인이며 약의 적합성은 판단하지 않는다. */
export function requestIssues(
  request: Pick<MedicationRequest, 'prescriptionChecked' | 'status' | 'endDate' | 'requesterName' | 'medicines'>,
  today: string,
): string[] {
  const issues: string[] = [];
  if (!request.prescriptionChecked) issues.push('의사 처방을 확인하지 않았습니다. 처방전이나 약봉투로 확인해 체크해 주세요');
  const end = dayOf(request.endDate);
  if (request.status === 'ACTIVE' && end !== null && isValidYmd(today) && end < today.slice(0, 10)) {
    issues.push(`끝나는 날(${end})이 지났는데 아직 진행 중입니다. 끝내거나 기간을 고쳐 주세요`);
  }
  const noSlot = request.medicines.filter((m) => !Array.isArray(m.slots) || m.slots.length === 0);
  if (noSlot.length > 0) {
    const names = noSlot.map((m) => (m.name.trim() === '' ? '이름 없는 약' : m.name.trim())).join(', ');
    issues.push(`먹는 시간대가 없는 약이 있습니다(${names}). 시간대를 고르지 않으면 오늘 투약에 나타나지 않습니다`);
  }
  if (request.requesterName.trim() === '') issues.push('의뢰한 사람의 이름이 없습니다');
  return issues;
}

// ---------- 약품 사용기한 ----------

export interface ExpiringStock<S> {
  /** 폐기하지 않았는데 사용기한이 오늘보다 앞인 약(사용기한 순) */
  expired: S[];
  /** 오늘부터 days일 뒤까지 사용기한이 오는 약(사용기한 순) */
  soon: S[];
}

/** 사용기한 지난 약과 곧 지나는 약. 폐기한 약은 어느 쪽에도 넣지 않는다. 사용기한이 올바른 날짜가 아닌 약은 센 수 없어 건너뛴다. */
export function expiringStock<S extends Pick<MedicineStock, 'expiresOn' | 'disposedOn'>>(stock: ReadonlyArray<S>, today: string, days = 30): ExpiringStock<S> {
  const base = dayOf(today);
  const span = Number.isInteger(days) && days >= 0 ? days : 30;
  const limit = base === null ? null : addDays(base, span);
  if (base === null || limit === null) return { expired: [], soon: [] };
  const live = stock
    .filter((s) => !s.disposedOn && dayOf(s.expiresOn) !== null)
    .sort((a, b) => (a.expiresOn.slice(0, 10) < b.expiresOn.slice(0, 10) ? -1 : a.expiresOn.slice(0, 10) > b.expiresOn.slice(0, 10) ? 1 : 0));
  return {
    expired: live.filter((s) => s.expiresOn.slice(0, 10) < base),
    soon: live.filter((s) => s.expiresOn.slice(0, 10) >= base && s.expiresOn.slice(0, 10) <= limit),
  };
}

// ---------- 분기 점검 ----------

export interface QuarterCheck {
  quarter: 1 | 2 | 3 | 4;
  done: boolean;
  /** 그 분기 안에서 가장 늦은 점검일 */
  checkedOn: string | null;
  /** 보관함 잠금(냉장 약이 있으면 냉장고 잠금까지)을 확인했는가. 점검이 없으면 null */
  lockedOk: boolean | null;
}

/** 그 해 분기(1~3월·4~6월·7~9월·10~12월)마다 점검을 했는가. 분기 안 점검이 여럿이면 가장 늦은 것을 본다. 해 밖 점검은 세지 않는다. */
export function quarterChecks(checks: ReadonlyArray<Pick<MedicineCheck, 'checkedOn' | 'cabinetLocked' | 'fridgeLocked'>>, year: number): QuarterCheck[] {
  const result: QuarterCheck[] = ([1, 2, 3, 4] as const).map((quarter) => ({ quarter, done: false, checkedOn: null, lockedOk: null }));
  for (const check of checks) {
    const day = dayOf(check.checkedOn);
    if (day === null || Number(day.slice(0, 4)) !== year) continue;
    const slot = result[Math.floor((Number(day.slice(5, 7)) - 1) / 3)];
    if (slot.checkedOn === null || day > slot.checkedOn) {
      slot.done = true;
      slot.checkedOn = day;
      slot.lockedOk = check.cabinetLocked === true && check.fridgeLocked !== false;
    }
  }
  return result;
}

/** 올해 지난(끝난) 분기 중 점검을 빠뜨린 분기. 진행 중인 분기는 아직 기한이 안 끝났으므로 넣지 않는다. */
export function missedQuarters(checks: ReadonlyArray<Pick<MedicineCheck, 'checkedOn' | 'cabinetLocked' | 'fridgeLocked'>>, today: string): Array<1 | 2 | 3 | 4> {
  const day = dayOf(today);
  if (day === null) return [];
  const year = Number(day.slice(0, 4));
  const current = Math.floor((Number(day.slice(5, 7)) - 1) / 3) + 1;
  return quarterChecks(checks, year)
    .filter((q) => q.quarter < current && !q.done)
    .map((q) => q.quarter);
}
