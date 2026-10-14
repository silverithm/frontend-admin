/**
 * 실험실 API 계약 타입 — 필드 이름은 서버가 내려주는 JSON 그대로다(camelCase).
 * 이름을 "더 예쁘게" 바꾸면 서버·화면 사이 변환 코드가 생기고 그 변환에서 값이 샌다. 그대로 쓴다.
 */
import type { CareGrade as LtcCareGrade, CopayClass, DaycareUnit, HourBand } from '../ltc2026.ts';

export type { LtcCareGrade, CopayClass, DaycareUnit, HourBand };

export type RiskKind = 'BRADEN' | 'MORSE';
/** BRADEN: VERY_HIGH·HIGH·MODERATE·MILD·NONE / MORSE: LOW·MODERATE·HIGH */
export type RiskLevel = 'VERY_HIGH' | 'HIGH' | 'MODERATE' | 'MILD' | 'NONE' | 'LOW';
export type CopayStatus = 'UNPAID' | 'PARTIAL' | 'PAID';
export type DeliveryMethod = 'VISIT' | 'MAIL' | 'FAX' | 'ELECTRONIC';
export type EvalStatus = 'READY' | 'PARTIAL' | 'MISSING' | 'NOT_APPLICABLE';

/** GET /access */
export interface LabAccess {
  enabled: boolean;
}

// ---------- 급여제공기록 ----------

export interface CareRecord {
  id: number;
  elderlyId: number;
  elderlyName: string;
  recordDate: string;
  physical: string | null;
  cognitive: string | null;
  meal: string | null;
  toilet: string | null;
  bath: string | null;
  nursing: string | null;
  training: string | null;
  specialNote: string | null;
  rawNote: string | null;
  providerName: string | null;
  aiAssisted: boolean;
  updatedAt: string | null;
}

/** 본문 글자 수 한도는 서버와 같다: 서술 2000자, 식사·배설·목욕 200자, 제공자 50자. */
export type CareRecordInput = Omit<CareRecord, 'id' | 'elderlyName' | 'updatedAt'>;

export interface CareDelivery {
  id: number;
  elderlyId: number;
  elderlyName: string;
  month: string;
  deliveredOn: string;
  method: DeliveryMethod;
  recipient: string | null;
  note: string | null;
}

export interface CareDeliveryInput {
  elderlyId: number;
  month: string;
  deliveredOn: string;
  method: DeliveryMethod;
  recipient: string | null;
  note: string | null;
}

// ---------- 본인부담금 ----------

export interface NonCoveredItem {
  label: string;
  amount: number;
}

export interface CopayBill {
  id: number;
  elderlyId: number;
  elderlyName: string;
  billMonth: string;
  careGrade: LtcCareGrade;
  copayClass: CopayClass;
  daycareUnit: DaycareUnit;
  hourBand: HourBand;
  days: number;
  dailyFee: number;
  coveredTotal: number;
  copayAmount: number;
  overLimitAmount: number;
  nonCoveredItems: NonCoveredItem[];
  nonCoveredAmount: number;
  previousUnpaid: number;
  totalDue: number;
  paidAmount: number;
  lastPaidOn: string | null;
  payerName: string | null;
  status: CopayStatus;
}

export interface CopayBillInput {
  elderlyId: number;
  billMonth: string;
  careGrade: LtcCareGrade;
  copayClass: CopayClass;
  daycareUnit: DaycareUnit;
  hourBand: HourBand;
  days: number;
  dailyFee: number;
  coveredTotal: number;
  copayAmount: number;
  overLimitAmount: number;
  nonCoveredItems: NonCoveredItem[];
  previousUnpaid: number;
}

export interface CopayPaymentInput {
  amount: number;
  paidOn: string;
  payerName: string | null;
}

// ---------- 위험도 평가 ----------

export interface RiskAssessment {
  id: number;
  elderlyId: number;
  elderlyName: string;
  kind: RiskKind;
  scores: Record<string, number>;
  total: number;
  riskLevel: RiskLevel;
  assessedOn: string;
  assessorName: string;
  note: string | null;
  aiAssisted: boolean;
  createdAt: string | null;
}

export interface RiskAssessmentInput {
  elderlyId: number;
  kind: RiskKind;
  scores: Record<string, number>;
  assessedOn: string;
  assessorName: string;
  note: string | null;
  aiAssisted: boolean;
}

export interface RiskLatestEntry {
  assessedOn: string;
  total: number;
  riskLevel: RiskLevel;
}

export interface RiskLatest {
  elderlyId: number;
  elderlyName: string;
  braden: RiskLatestEntry | null;
  morse: RiskLatestEntry | null;
}

// ---------- 평가 준비 ----------

export interface EvalCheck {
  indicatorCode: string;
  status: EvalStatus;
  evidence: string | null;
  aiComment: string | null;
  updatedBy: string | null;
  updatedAt: string | null;
}

export interface EvalCheckInput {
  status: EvalStatus;
  evidence: string | null;
  aiComment: string | null;
}

// ---------- AI (Next.js /api/v1/lab-ai/<task>) ----------

export type CareRecordTextField =
  | 'physical'
  | 'cognitive'
  | 'meal'
  | 'toilet'
  | 'bath'
  | 'nursing'
  | 'training'
  | 'specialNote';

/** 'note'는 칸이 아니라 메모 전체에 대한 경고(어느 칸에 넣을지 모호한 문구). */
export type CareRecordWarningField = CareRecordTextField | 'note';

export interface CareRecordWarning {
  field: CareRecordWarningField;
  phrase: string;
  suggestion: string;
}

export interface CareNoteStructured {
  physical: string;
  cognitive: string;
  meal: string;
  toilet: string;
  bath: string;
  nursing: string;
  training: string;
  specialNote: string;
  warnings: CareRecordWarning[];
}

export interface RiskScoreSuggestion {
  value: number;
  reason: string;
}

export interface RiskSuggestion {
  scores: Record<string, RiskScoreSuggestion>;
}

/** 모델이 제안할 수 있는 상태. 해당없음(NOT_APPLICABLE)은 기관이 정하는 것이라 제안하지 않는다. */
export type EvalSuggestedStatus = 'READY' | 'PARTIAL' | 'MISSING';

export interface EvalReviewInput {
  indicatorCode: string;
  title: string;
  requirements: string[];
  evidence: string;
}

export interface EvalReviewResult {
  suggestedStatus: EvalSuggestedStatus;
  missing: string[];
  comment: string;
}
