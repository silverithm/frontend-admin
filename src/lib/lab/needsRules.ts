/**
 * 욕구사정 점검 — 2026 평가 지표 20(욕구사정)과 지표 22④(상태 변화의 계획 반영). 전부 브라우저 안에서 도는 순수 함수다.
 *
 * 근거(research-10 §5·§6): 욕구사정은 9개 항목(질병상태·신체·인지·영양·의사소통·가족·환경·구강상태·주관적 욕구·자원이용)과 서술형 총평을 갖추고
 * 기피식품을 기록한다(구강상태·기피식품은 2026.1월부터). 연 1회 이상, 신규 수급자는 급여제공 시작일까지 한다.
 * 상태가 바뀌면 계획을 고치거나 사유를 남긴다.
 * 확인 못 한 것(대조 필요): 신규 사정의 "시작일까지"를 얼마나 앞서 한 것까지 인정하는지(90일은 기관 기준), 연 1회가 회계연도인지 달력연도인지(달력연도로 셈).
 */
import { addDays, isValidYmd } from './labDate.ts';
import type { CareEvent, CarePlanChange, CarePlanNeeds, CareEventKind, CareEventSeverity, ContractStatus } from './labTypes.ts';

export type NeedsItemKey = 'physical' | 'disease' | 'cognition' | 'communication' | 'oral' | 'nutrition' | 'family' | 'subjective' | 'resources' | 'summary';

export const NEEDS_ITEMS: ReadonlyArray<{ key: NeedsItemKey; label: string }> = [
  { key: 'physical', label: '신체상태' },
  { key: 'disease', label: '질병상태' },
  { key: 'cognition', label: '인지상태' },
  { key: 'communication', label: '의사소통' },
  { key: 'oral', label: '구강상태' },
  { key: 'nutrition', label: '영양상태' },
  { key: 'family', label: '가족 및 환경상태' },
  { key: 'subjective', label: '주관적 욕구' },
  { key: 'resources', label: '자원이용 욕구' },
  { key: 'summary', label: '총평' },
];

/** 신규 수급자의 사정을 급여제공 시작일 며칠 전까지 인정하는가 — 기관 기준(대조 필요) */
export const NEW_ASSESSMENT_WINDOW_DAYS = 90;
/** 상태 변화 후 계획 반영 기한(일) */
export const PLAN_REFLECT_DAYS = 30;

const blank = (value: unknown): boolean => typeof value !== 'string' || value.trim() === '';

export interface NeedsCompleteResult {
  total: 10;
  filled: number;
  /** 공백만이거나 없는 칸의 키, NEEDS_ITEMS 순서 */
  missing: NeedsItemKey[];
  /** 기피식품 칸이 비지 않음 — '없음'도 기록으로 센다 */
  avoidFoodsRecorded: boolean;
  complete: boolean;
}

/** 욕구사정 열 칸이 모두 채워졌고 기피식품이 기록됐는가. 옛 여섯 칸 기록(새 칸 없음)은 새 칸이 빈 것으로 본다. */
export function needsComplete(needs: Partial<CarePlanNeeds> | null | undefined): NeedsCompleteResult {
  const src: Partial<CarePlanNeeds> = needs ?? {};
  const missing = NEEDS_ITEMS.filter((i) => blank(src[i.key])).map((i) => i.key);
  const avoidFoodsRecorded = !blank(src.avoidFoods);
  return { total: 10, filled: NEEDS_ITEMS.length - missing.length, missing, avoidFoodsRecorded, complete: missing.length === 0 && avoidFoodsRecorded };
}

export interface AssessmentContract {
  elderlyId: number;
  contractStart: string;
  contractEnd: string | null;
  status: ContractStatus;
}

export interface AssessmentPlan {
  elderlyId: number;
  planYear: number;
  assessedOn: string;
  needs: Partial<CarePlanNeeds>;
}

export interface AssessmentRow {
  elderlyId: number;
  /** 그 해 사정 있음 */
  annual: boolean;
  /** 가장 늦은 계약 시작이 그 해 안 */
  isNew: boolean;
  /** 신규이면 시작일 전 90일 안~시작일 사이 사정 있음, 신규가 아니면 true */
  newOk: boolean;
  /** 그 해 가장 늦은 사정이 열 칸+기피식품을 갖춤 */
  complete: boolean;
  ok: boolean;
}

export interface AssessmentCoverage {
  total: number;
  annual: number;
  newTotal: number;
  newOk: number;
  complete: number;
  ok: number;
  rows: AssessmentRow[];
}

/** 진행 중 계약 어르신의 욕구사정 점검 — 연 1회·신규 시점·열 칸 완결. rows는 어르신 번호순. */
export function assessmentCoverage(contracts: readonly AssessmentContract[], plans: readonly AssessmentPlan[], year: number, asOf: string): AssessmentCoverage {
  const latestStart = new Map<number, string>();
  for (const c of contracts) {
    if (c.status !== 'ACTIVE' || !isValidYmd(c.contractStart) || !isValidYmd(asOf)) continue;
    const start = c.contractStart.slice(0, 10);
    if (start > asOf.slice(0, 10)) continue;
    if (c.contractEnd && isValidYmd(c.contractEnd) && c.contractEnd.slice(0, 10) < asOf.slice(0, 10)) continue;
    const prev = latestStart.get(c.elderlyId);
    if (prev === undefined || start > prev) latestStart.set(c.elderlyId, start);
  }
  const yearPrefix = `${String(year).padStart(4, '0')}-`;
  const rows: AssessmentRow[] = [...latestStart.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([elderlyId, start]) => {
      const mine = plans.filter((p) => p.elderlyId === elderlyId && isValidYmd(p.assessedOn));
      const inYear = mine.filter((p) => p.assessedOn.slice(0, 10).startsWith(yearPrefix));
      const annual = inYear.length > 0;
      const isNew = start.startsWith(yearPrefix);
      const from = addDays(start, -NEW_ASSESSMENT_WINDOW_DAYS) as string;
      const newOk = isNew ? mine.some((p) => p.assessedOn.slice(0, 10) >= from && p.assessedOn.slice(0, 10) <= start) : true;
      const latest = inYear.reduce<AssessmentPlan | null>((best, p) => (best === null || p.assessedOn.slice(0, 10) > best.assessedOn.slice(0, 10) ? p : best), null);
      const complete = latest !== null && needsComplete(latest.needs).complete;
      return { elderlyId, annual, isNew, newOk, complete, ok: annual && newOk && complete };
    });
  return {
    total: rows.length,
    annual: rows.filter((r) => r.annual).length,
    newTotal: rows.filter((r) => r.isNew).length,
    newOk: rows.filter((r) => r.isNew && r.newOk).length,
    complete: rows.filter((r) => r.complete).length,
    ok: rows.filter((r) => r.ok).length,
    rows,
  };
}

// ---------- 상태 변화의 계획 반영 ----------

const REFLECT_KINDS: ReadonlySet<CareEventKind> = new Set<CareEventKind>(['CONDITION_CHANGE', 'FALL', 'INJURY', 'HOSPITAL', 'EMERGENCY']);
const REFLECT_SEVERITIES: ReadonlySet<CareEventSeverity> = new Set<CareEventSeverity>(['MODERATE', 'HIGH', 'CRITICAL']);

export type PlanReflectionState = 'PLAN_CHANGE' | 'FOLLOW_UP' | 'PENDING' | 'NONE';

export interface PlanReflectionRow {
  eventId: number;
  elderlyId: number;
  /** 사건일 + 30일 */
  due: string;
  state: PlanReflectionState;
}

export interface PlanReflection {
  total: number;
  planChange: number;
  followUpOnly: number;
  pending: number;
  none: number;
  rows: PlanReflectionRow[];
}

type ReflectEvent = Pick<CareEvent, 'id' | 'elderlyId' | 'kind' | 'severity' | 'occurredAt' | 'followUp'>;
type ReflectChange = Pick<CarePlanChange, 'elderlyId' | 'changedOn' | 'eventId'>;

/**
 * 계획 반영이 필요한 상태변화(상태 변화·낙상·부상·입원·응급 중 보통 이상) 점검. 사건일부터 30일 안에 같은 어르신의 계획 변경 이력이 있거나
 * 그 사건에 묶인 변경 이력이 있으면 PLAN_CHANGE, 없으면 후속 조치 글만 있어도 FOLLOW_UP(건별 사유 — 참고), 기한 안이면 PENDING, 지났으면 NONE.
 */
export function eventPlanReflection(events: readonly ReflectEvent[], changes: readonly ReflectChange[], asOf: string): PlanReflection {
  const rows: PlanReflectionRow[] = [];
  const asOfDay = isValidYmd(asOf) ? asOf.slice(0, 10) : null;
  for (const e of events) {
    if (!REFLECT_KINDS.has(e.kind) || !REFLECT_SEVERITIES.has(e.severity) || !isValidYmd(e.occurredAt)) continue;
    const d = e.occurredAt.slice(0, 10);
    const due = addDays(d, PLAN_REFLECT_DAYS) as string;
    const linked = changes.some((c) => c.elderlyId === e.elderlyId && (c.eventId === e.id || (isValidYmd(c.changedOn) && c.changedOn.slice(0, 10) >= d && c.changedOn.slice(0, 10) <= due)));
    let state: PlanReflectionState;
    if (linked) state = 'PLAN_CHANGE';
    else if (!blank(e.followUp)) state = 'FOLLOW_UP';
    else if (asOfDay !== null && asOfDay <= due) state = 'PENDING';
    else state = 'NONE';
    rows.push({ eventId: e.id, elderlyId: e.elderlyId, due, state });
  }
  rows.sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : a.eventId - b.eventId));
  const count = (s: PlanReflectionState) => rows.filter((r) => r.state === s).length;
  return { total: rows.length, planChange: count('PLAN_CHANGE'), followUpOnly: count('FOLLOW_UP'), pending: count('PENDING'), none: count('NONE'), rows };
}

export type ChangeRecordGap = 'REASON' | 'ITEMS' | 'GUARDIAN' | 'NOTIFIED';

export const CHANGE_GAP_LABEL: Readonly<Record<ChangeRecordGap, string>> = {
  REASON: '변경 사유',
  ITEMS: '변경 항목',
  GUARDIAN: '보호자 확인서명',
  NOTIFIED: '공단 통보',
};

/** 변경 이력에서 빠진 칸 — 사유·변경 항목·보호자 확인서명일·공단 통보일 */
export function changeRecordCheck(change: Pick<CarePlanChange, 'reasonNote' | 'changeItems' | 'guardianSignedOn' | 'notifiedOn'>): ChangeRecordGap[] {
  const missing: ChangeRecordGap[] = [];
  if (blank(change.reasonNote)) missing.push('REASON');
  if (!Array.isArray(change.changeItems) || change.changeItems.length === 0) missing.push('ITEMS');
  if (!change.guardianSignedOn || !isValidYmd(change.guardianSignedOn)) missing.push('GUARDIAN');
  if (!change.notifiedOn || !isValidYmd(change.notifiedOn)) missing.push('NOTIFIED');
  return missing;
}
