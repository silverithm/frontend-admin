/**
 * 규정·지침 대장 규칙 — 종류별 항목 체크리스트·대장 상태·운영규정 근거·감염병 대응 근거. 전부 브라우저 안에서 도는 순수 함수다.
 *
 * 근거(research-10): 운영규정은 평가 매뉴얼의 11개 항목(노인복지법 시행규칙 별표 10 제3호 나목의 항목과 다르다),
 * 급여제공지침 ⑩ 개인정보보호지침은 수집·이용 목적·수집 항목·보유·이용 기간, 감염병 대응계획은 국가 위기상황 대응체계와 기관 내 발생·확산 대응체계,
 * 고충처리지침은 접수 방법(익명 창구)·처리 과정·처리 기한.
 * 확인 못 한 것(대조 필요): 운영규정 "내용이 충실한가"의 판단 기준, 감염병 대응체계의 검토·개정 주기와 교육 횟수(평가 문구에 없어 기관 기준).
 */
import { daysBetween, isValidYmd } from './labDate.ts';
import { TRANSPORT_RULE_ITEMS } from './transportRules.ts';
import type { PolicyCheckKind, PolicyDocKind, StaffTrainingCategory, StaffTrainingKind } from './labTypes.ts';

export interface PolicyItem {
  key: string;
  label: string;
}

export const POLICY_ITEMS: Readonly<Record<PolicyCheckKind, readonly PolicyItem[]>> = {
  OPERATING_RULES: [
    { key: 'capacity', label: '이용정원·모집' },
    { key: 'contract', label: '이용계약' },
    { key: 'feeChange', label: '이용료 변경 절차' },
    { key: 'servicesFees', label: '서비스 내용·비용' },
    { key: 'liability', label: '배상책임·면책' },
    { key: 'revision', label: '개정 방법·절차' },
    { key: 'staffing', label: '인력관리' },
    { key: 'pay', label: '보수' },
    { key: 'welfare', label: '복리후생' },
    { key: 'safetyHealth', label: '안전·보건' },
    { key: 'grievance', label: '고충처리 절차' },
  ],
  PRIVACY_GUIDE: [
    { key: 'purpose', label: '수집·이용 목적' },
    { key: 'items', label: '수집 항목' },
    { key: 'retention', label: '보유·이용 기간' },
  ],
  INFECTION_PLAN: [
    { key: 'nationalCrisis', label: '국가 위기상황 대응체계' },
    { key: 'internalOutbreak', label: '기관 내 환자 발생·확산 대응체계' },
  ],
  TRANSPORT_RULES: TRANSPORT_RULE_ITEMS,
  GRIEVANCE_GUIDE: [
    { key: 'intake', label: '접수 방법(익명 창구)' },
    { key: 'process', label: '처리 과정' },
    { key: 'deadline', label: '처리 기한' },
  ],
};

/** 급여제공지침 중 개인정보보호지침의 번호 */
export const PRIVACY_GUIDE_NO = 10;

/** 대장 종류(와 급여제공지침 번호)로 항목 목록을 돌려준다. 급여제공지침은 ⑩만 항목이 있고 그 밖 종류는 빈 목록 */
export function itemsOf(kind: PolicyDocKind, guideNo: number | null): readonly PolicyItem[] {
  const check = aiKindOf(kind, guideNo);
  return check ? POLICY_ITEMS[check] : [];
}

/** 대장 종류 → AI 항목 점검 종류. 점검할 항목이 없는 종류는 null */
export function aiKindOf(kind: PolicyDocKind, guideNo: number | null): PolicyCheckKind | null {
  if (kind === 'CARE_GUIDE') return guideNo === PRIVACY_GUIDE_NO ? 'PRIVACY_GUIDE' : null;
  if (kind === 'OPERATING_RULES' || kind === 'INFECTION_PLAN' || kind === 'TRANSPORT_RULES' || kind === 'GRIEVANCE_GUIDE') return kind;
  return null;
}

export interface PolicyDocShape {
  kind: PolicyDocKind;
  guideNo: number | null;
  revisedOn: string | null;
  location: string | null;
  checks: Record<string, boolean>;
}

export interface DocStatus {
  itemsTotal: number;
  itemsChecked: number;
  /** 체크하지 않은 항목의 라벨(항목 순서대로) */
  missingItems: string[];
  complete: boolean;
  revisedWithin12m: boolean;
  state: 'READY' | 'PARTIAL';
}

/** 개정일이 기준일에서 이만큼(일) 안이면 '12개월 안' — 365일째까지 안, 366일째부터 밖 */
export const REVISED_WITHIN_DAYS = 365;

function revisedWithin(revisedOn: string | null, asOf: string): boolean {
  if (!revisedOn || !isValidYmd(revisedOn)) return false;
  const days = daysBetween(revisedOn, asOf.slice(0, 10));
  return days !== null && days <= REVISED_WITHIN_DAYS;
}

/** 대장 한 건의 상태. 항목이 없는 종류(기타 등)는 항목 체크가 필요 없어 complete다. READY = 항목 완비 + 개정일 + 비치 장소 */
export function docStatus(doc: PolicyDocShape, asOf: string): DocStatus {
  const items = itemsOf(doc.kind, doc.guideNo);
  const missingItems = items.filter((i) => doc.checks[i.key] !== true).map((i) => i.label);
  const complete = missingItems.length === 0;
  const hasLocation = typeof doc.location === 'string' && doc.location.trim() !== '';
  const hasRevised = !!doc.revisedOn && isValidYmd(doc.revisedOn);
  return {
    itemsTotal: items.length,
    itemsChecked: items.length - missingItems.length,
    missingItems,
    complete,
    revisedWithin12m: revisedWithin(doc.revisedOn, asOf),
    state: complete && hasRevised && hasLocation ? 'READY' : 'PARTIAL',
  };
}

export interface OperatingRulesEvidence {
  state: 'READY' | 'PARTIAL' | 'MISSING';
  missingItems: string[];
}

/** 같은 종류가 여럿이면(기타 외에는 서버가 막지만) 가장 나은 한 건으로 본다 */
function bestDoc<T extends PolicyDocShape>(docs: readonly T[], kind: PolicyDocKind, asOf: string): { doc: T; status: DocStatus } | null {
  let best: { doc: T; status: DocStatus } | null = null;
  for (const doc of docs) {
    if (doc.kind !== kind) continue;
    const status = docStatus(doc, asOf);
    if (!best || (status.state === 'READY' && best.status.state !== 'READY') || (status.state === best.status.state && status.itemsChecked > best.status.itemsChecked)) best = { doc, status };
  }
  return best;
}

/** 운영규정 근거: 대장에 운영규정이 없으면 MISSING(빠진 항목은 열한 개 전부), 있으면 그 문서의 상태 */
export function operatingRulesEvidence(docs: readonly PolicyDocShape[], asOf: string): OperatingRulesEvidence {
  const best = bestDoc(docs, 'OPERATING_RULES', asOf);
  if (!best) return { state: 'MISSING', missingItems: POLICY_ITEMS.OPERATING_RULES.map((i) => i.label) };
  return { state: best.status.state, missingItems: best.status.missingItems };
}

export interface InfectionTrainingShape {
  kind: StaffTrainingKind;
  category: StaffTrainingCategory;
  heldOn: string;
  attendeeIds: readonly number[];
}

export interface InfectionResponseEvidence {
  /** 감염병 대응계획의 두 체계를 모두 체크했는가 */
  plan: boolean;
  /** 그 계획의 개정일이 12개월(365일) 안인가 — 기관 기준(대조 필요) */
  revisedWithin12m: boolean;
  /** 최근 365일 안에 참석자가 있는 감염 교육 건수 */
  trainings12m: number;
  /** READY = 계획 + 교육 1건 이상, PARTIAL = 둘 중 하나, MISSING = 둘 다 없음 */
  state: 'READY' | 'PARTIAL' | 'MISSING';
}

export function infectionResponseEvidence(docs: readonly PolicyDocShape[], trainings: readonly InfectionTrainingShape[], asOf: string): InfectionResponseEvidence {
  const day = asOf.slice(0, 10);
  const best = bestDoc(docs, 'INFECTION_PLAN', day);
  const plan = best !== null && best.status.complete;
  const trainings12m = trainings.filter((t) => {
    if (t.kind !== 'TRAINING' || t.category !== 'INFECTION' || t.attendeeIds.length === 0 || !isValidYmd(t.heldOn)) return false;
    const days = daysBetween(t.heldOn, day);
    return days !== null && days >= 0 && days <= REVISED_WITHIN_DAYS;
  }).length;
  const hasTraining = trainings12m >= 1;
  return {
    plan,
    revisedWithin12m: best !== null && best.status.revisedWithin12m,
    trainings12m,
    state: plan && hasTraining ? 'READY' : plan || hasTraining ? 'PARTIAL' : 'MISSING',
  };
}
