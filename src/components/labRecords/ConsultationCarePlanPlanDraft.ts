/** 욕구사정·급여제공계획 입력 초안 — 서비스 줄에는 화면용 키를 붙인다 */
import type { CarePlan, CarePlanInput, CarePlanNeeds, CarePlanService, Consultation, NeedsAssessmentKey, RiskLatest } from '@/lib/lab/labTypes';
import { carePlanGaps } from '@/lib/lab/carePlanRules';
import { NEEDS_ITEMS } from '@/lib/lab/needsRules';
import { riskLevelLabel } from '@/lib/lab/riskScales';
import { orNull } from './recordsFormat';
import { methodLabel } from './ConsultationCarePlanConsultDraft';
import { mergeAiSuggestions } from './recordsFormat';

export const NEEDS_MAX = 1000;
export const GOALS_MAX = 2000;
export const MAX_SERVICES = 30;
export const AREA_MAX = 30;
export const SERVICE_CONTENT_MAX = 300;
export const FREQUENCY_MAX = 30;
/** 서버 AI 입력 한도(필드마다 3000자)보다 조금 아래로 잡는다 */
const AI_TEXT_BUDGET = 2900;

export type NeedsKey = keyof CarePlanNeeds;

/** 욕구사정 칸의 화면 이름 — 열 칸(NEEDS_ITEMS)은 평가 문구 그대로, 기피식품과 옛 '기타 요구'를 뒤에 붙인다 */
export const NEEDS_LABEL: Readonly<Record<NeedsKey, string>> = {
  physical: '신체상태',
  disease: '질병상태',
  cognition: '인지상태',
  communication: '의사소통',
  oral: '구강상태',
  nutrition: '영양상태',
  family: '가족 및 환경상태',
  subjective: '주관적 욕구',
  resources: '자원이용 욕구',
  summary: '총평',
  avoidFoods: '기피식품',
  other: '기타 요구',
};

/** 화면 순서: 열 칸 → 기피식품 → 기타 요구(옛 기록에 적힌 글을 잃지 않으려고 남긴 칸) */
export const NEEDS_KEYS: NeedsKey[] = [...NEEDS_ITEMS.map((i) => i.key as NeedsKey), 'avoidFoods', 'other'];

/** AI가 채울 수 있는 칸(열 칸 + 기피식품) — 'other'는 채우지 않는다 */
export const NEEDS_AI_KEYS: NeedsAssessmentKey[] = NEEDS_KEYS.filter((k): k is NeedsAssessmentKey => k !== 'other');
export const NEEDS_AI_LIMITS = Object.fromEntries(NEEDS_AI_KEYS.map((k) => [k, NEEDS_MAX])) as Record<NeedsAssessmentKey, number>;
/** 면담 메모 입력 한도 — 서버 본문 상한(3,500자)보다 아래 */
export const NEEDS_MEMO_MAX = 3000;
export const COMMON_AREAS: readonly string[] = ['신체활동지원', '인지활동', '기능회복훈련', '건강·간호관리', '식사·영양관리', '배설·위생 지원', '정서·사회참여', '송영서비스'];

export interface ServiceRow {
  key: number;
  area: string;
  content: string;
  frequency: string;
  /** AI 제안으로 들어온 줄(직원이 고치면 풀린다) */
  fromAi?: boolean;
}

let rowCounter = 0;
export const nextRowKey = (): number => {
  rowCounter += 1;
  return rowCounter;
};

export const rowsFromServices = (services: ReadonlyArray<CarePlanService>, fromAi = false): ServiceRow[] =>
  services.map((s) => ({ key: nextRowKey(), area: s.area, content: s.content, frequency: s.frequency, ...(fromAi ? { fromAi: true } : {}) }));

export const isBlankRow = (r: Pick<ServiceRow, 'area' | 'content' | 'frequency'>): boolean => r.area.trim() === '' && r.content.trim() === '' && r.frequency.trim() === '';

export interface PlanDraft {
  assessedOn: string;
  needs: CarePlanNeeds;
  goals: string;
  goalsFromAi: boolean;
  services: ServiceRow[];
  guardianAgreedOn: string;
  writer: string;
  aiUsed: boolean;
  /** 면담 메모 AI 정리가 채운 칸 — 직원이 고치면 풀린다 */
  needsAi: Partial<Record<NeedsAssessmentKey, true>>;
}

export const emptyNeeds = (): CarePlanNeeds => ({ physical: '', cognition: '', nutrition: '', communication: '', family: '', other: '', disease: '', oral: '', subjective: '', resources: '', summary: '', avoidFoods: '' });

export function newDraft(today: string, writer: string): PlanDraft {
  return { assessedOn: today, needs: emptyNeeds(), goals: '', goalsFromAi: false, services: [], guardianAgreedOn: '', writer, aiUsed: false, needsAi: {} };
}

export function draftFromPlan(p: CarePlan): PlanDraft {
  return {
    assessedOn: p.assessedOn.slice(0, 10),
    needs: { ...emptyNeeds(), ...p.needs },
    goals: p.goals ?? '',
    goalsFromAi: false,
    services: rowsFromServices(p.services),
    guardianAgreedOn: p.guardianAgreedOn?.slice(0, 10) ?? '',
    writer: p.writerName ?? '',
    aiUsed: false,
    needsAi: {},
  };
}

export function snapshotOf(d: PlanDraft): string {
  return JSON.stringify([d.assessedOn, d.needs, d.goals, d.services.map((s) => [s.area, s.content, s.frequency]), d.guardianAgreedOn, d.writer]);
}

/** 저장할 서비스 줄(빈 줄은 뺀다) */
export function cleanServices(rows: ReadonlyArray<ServiceRow>): CarePlanService[] {
  return rows.filter((r) => !isBlankRow(r)).map((r) => ({ area: r.area.trim(), content: r.content.trim(), frequency: r.frequency.trim() }));
}

export function needsFilled(needs: CarePlanNeeds): boolean {
  return NEEDS_KEYS.some((k) => needs[k].trim() !== '');
}

/** 계획서 점검 — 욕구사정·목표·서비스에 비어 있는 곳 */
export function gapsOfDraft(d: PlanDraft): string[] {
  return carePlanGaps({ needs: d.needs, goals: d.goals, services: cleanServices(d.services) });
}

export function validate(d: PlanDraft): string | null {
  if (!d.assessedOn) return '욕구사정을 한 날짜를 골라 주세요';
  const open = d.services.findIndex((r) => !isBlankRow(r) && r.content.trim() === '');
  if (open !== -1) return `서비스 ${open + 1}번 줄의 내용을 적어 주세요`;
  if (d.services.filter((r) => !isBlankRow(r)).length > MAX_SERVICES) return `서비스는 ${MAX_SERVICES}개까지 적을 수 있습니다`;
  if (!needsFilled(d.needs) && d.goals.trim() === '' && cleanServices(d.services).length === 0) return '욕구사정·목표·서비스 중 한 가지 이상 적어 주세요';
  if (d.writer.trim() === '') return '작성자 이름을 적어 주세요';
  return null;
}

export function toInput(d: PlanDraft, elderlyId: number, planYear: number, aiAssisted: boolean): CarePlanInput {
  const needs = { ...emptyNeeds() };
  for (const k of NEEDS_KEYS) needs[k] = d.needs[k].trim();
  return {
    elderlyId,
    planYear,
    assessedOn: d.assessedOn,
    needs,
    goals: orNull(d.goals),
    services: cleanServices(d.services),
    guardianAgreedOn: d.guardianAgreedOn === '' ? null : d.guardianAgreedOn,
    writerName: orNull(d.writer),
    aiAssisted,
  };
}

/**
 * AI로 보낼 욕구사정 — 영역별 글을 합쳐도 서버 한도(3000자)를 넘지 않게 영역마다 같은 몫으로 자른다.
 * truncated가 true면 일부만 보냈다는 뜻이라 화면에서 알려 준다.
 */
export function needsForAi(needs: CarePlanNeeds): { needs: Partial<CarePlanNeeds>; truncated: boolean } {
  const filled = NEEDS_KEYS.filter((k) => needs[k].trim() !== '');
  if (filled.length === 0) return { needs: {}, truncated: false };
  const overhead = filled.reduce((sum, k) => sum + NEEDS_LABEL[k].length + 2, 0) + (filled.length - 1);
  const perField = Math.max(50, Math.floor((AI_TEXT_BUDGET - overhead) / filled.length));
  const out: Partial<CarePlanNeeds> = {};
  let truncated = false;
  for (const k of filled) {
    const text = needs[k].trim();
    if (Array.from(text).length > perField) truncated = true;
    out[k] = Array.from(text).slice(0, perField).join('');
  }
  return { needs: out, truncated };
}

/** 최근 상담(최신순 목록) 세 건을 날짜·방법·내용·후속 조치로 줄여 쓴다. 이름은 넣지 않는다. */
export function consultationsForAi(list: ReadonlyArray<Consultation>): string | undefined {
  const lines = list.slice(0, 3).map((c) => {
    const content = (c.content ?? '').trim().slice(0, 350);
    const follow = (c.followUp ?? '').trim().slice(0, 150);
    return `${c.consultedOn.slice(0, 10)} ${methodLabel(c.method)} 상담: ${content}${follow ? ` / 후속 조치: ${follow}` : ''}`;
  });
  const text = lines.join('\n').slice(0, 1800);
  return text.trim() === '' ? undefined : text;
}

/** 위험도 평가 단계만 한 줄로 — 점수·이름은 넣지 않는다 */
export function riskSummaryForAi(risk: RiskLatest | undefined): string | undefined {
  if (!risk) return undefined;
  const parts: string[] = [];
  if (risk.braden) parts.push(`욕창 위험 ${riskLevelLabel(risk.braden.riskLevel)}`);
  if (risk.morse) parts.push(`낙상 위험 ${riskLevelLabel(risk.morse.riskLevel)}`);
  if (risk.cognitive) parts.push(`인지기능 ${riskLevelLabel(risk.cognitive.riskLevel)}`);
  return parts.length > 0 ? parts.join(', ') : undefined;
}

/**
 * 면담 메모 AI 정리 결과를 욕구사정 칸에 합친다 — 빈 칸과 이전 AI 제안 칸만 채우고, 직접 쓴 칸은 덮지 않는다.
 * 반드시 setState 갱신 함수 안에서 부른다. kept는 직접 쓴 칸이라 남겨 둔 수, filled는 이번에 채운 수.
 */
export function mergeNeedsAi(d: PlanDraft, suggestions: Partial<Record<NeedsAssessmentKey, string | null | undefined>>): { draft: PlanDraft; kept: number; filled: number } {
  const current = Object.fromEntries(NEEDS_AI_KEYS.map((k) => [k, d.needs[k]])) as Record<NeedsAssessmentKey, string>;
  const m = mergeAiSuggestions(current, d.needsAi, suggestions, NEEDS_AI_LIMITS);
  const filled = NEEDS_AI_KEYS.filter((k) => m.fields[k] !== current[k]).length;
  return { draft: { ...d, needs: { ...d.needs, ...m.fields }, needsAi: m.ai, aiUsed: true }, kept: m.kept, filled };
}
