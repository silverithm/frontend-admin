/**
 * 실험실 API 계약 타입 — 필드 이름은 서버가 내려주는 JSON 그대로다(camelCase).
 * 이름을 "더 예쁘게" 바꾸면 서버·화면 사이 변환 코드가 생기고 그 변환에서 값이 샌다. 그대로 쓴다.
 */
import type { CareGrade as LtcCareGrade, CopayClass, DaycareUnit, HourBand } from '../ltc2026.ts';

export type { LtcCareGrade, CopayClass, DaycareUnit, HourBand };

/** 항목별 점수를 합산하는 도구(욕창·낙상). 인지기능 평가는 항목 점수가 아니라 도구·점수·판정이라 따로 둔다. */
export type ScaleKind = 'BRADEN' | 'MORSE';
export type RiskKind = ScaleKind | 'COGNITIVE';
/** 인지기능 평가 도구: 한국판 간이정신상태검사·치매선별검사·외부기관 검사·치매 진단(진단서·소견서) */
export type CognitiveTool = 'KMMSE' | 'CIST' | 'EXTERNAL' | 'DIAGNOSIS';
/** 직원이 확정하는 인지기능 판정 */
export type CognitiveJudgment = 'NORMAL' | 'SUSPECTED' | 'IMPAIRED';
/**
 * BRADEN: VERY_HIGH·HIGH·MODERATE·MILD·NONE / MORSE: LOW·MODERATE·HIGH
 * COGNITIVE: 서버는 riskLevel에 판정(NORMAL·SUSPECTED·IMPAIRED)을 그대로 담는다.
 */
export type RiskLevel = 'VERY_HIGH' | 'HIGH' | 'MODERATE' | 'MILD' | 'NONE' | 'LOW' | CognitiveJudgment;
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

/** 인지기능 평가 scores — KMMSE·CIST는 score 필수(0~30), 외부기관은 institution 필수. */
export interface CognitiveScores {
  tool: CognitiveTool;
  score?: number | null;
  judgment: CognitiveJudgment;
  institution?: string | null;
}

interface RiskAssessmentBase {
  id: number;
  elderlyId: number;
  elderlyName: string;
  /** 인지기능은 점수(없으면 0) */
  total: number;
  riskLevel: RiskLevel;
  assessedOn: string;
  assessorName: string;
  note: string | null;
  aiAssisted: boolean;
  createdAt: string | null;
}

export interface ScaleRiskAssessment extends RiskAssessmentBase {
  kind: ScaleKind;
  scores: Record<string, number>;
}

export interface CognitiveRiskAssessment extends RiskAssessmentBase {
  kind: 'COGNITIVE';
  scores: CognitiveScores;
}

/** kind로 좁히면 scores 모양이 정해진다. */
export type RiskAssessment = ScaleRiskAssessment | CognitiveRiskAssessment;

interface RiskAssessmentInputBase {
  elderlyId: number;
  assessedOn: string;
  assessorName: string;
  note: string | null;
  aiAssisted: boolean;
}

export type RiskAssessmentInput =
  | (RiskAssessmentInputBase & { kind: ScaleKind; scores: Record<string, number> })
  | (RiskAssessmentInputBase & { kind: 'COGNITIVE'; scores: CognitiveScores });

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
  /** 2차에 추가. 규칙 함수는 옛 응답처럼 이 값이 빠져 있어도 "평가 기록 없음"으로 읽는다. */
  cognitive: RiskLatestEntry | null;
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

// =====================================================================
// 2차 — 간호일지 · 프로그램 일지 · 직원 교육·회의 · 상담일지 · 욕구사정·급여제공계획
// =====================================================================

// ---------- 간호일지 ----------

/** 투약 여부: 투약함 · 건너뜀 · 해당 없음(그 시간대 약 없음) */
export type MedStatus = 'GIVEN' | 'SKIPPED' | 'NA';

export interface NursingLog {
  id: number;
  elderlyId: number;
  elderlyName: string;
  logDate: string;
  /** 서버 허용 범위: 수축기 50~260, 이완기 30~160(수축기 < 이완기면 400), 맥박 30~200, 체온 34.0~42.0, 혈당 20~600, 체중 20.0~200.0 */
  systolic: number | null;
  diastolic: number | null;
  pulse: number | null;
  temperature: number | null;
  bloodSugar: number | null;
  weight: number | null;
  medMorning: MedStatus | null;
  medLunch: MedStatus | null;
  medEvening: MedStatus | null;
  treatment: string | null;
  note: string | null;
  recorderName: string | null;
  aiAssisted: boolean;
  updatedAt: string | null;
}

export type NursingLogInput = Omit<NursingLog, 'id' | 'elderlyName' | 'updatedAt'>;

// ---------- 프로그램 일지 ----------

export type ProgramCategory = 'COGNITIVE' | 'PHYSICAL' | 'LEISURE' | 'SOCIAL' | 'OTHER';

export interface Program {
  id: number;
  programDate: string;
  /** 'HH:MM' */
  startTime: string | null;
  category: ProgramCategory;
  title: string;
  goal: string | null;
  content: string | null;
  reaction: string | null;
  instructorName: string | null;
  /** 참여 어르신(같은 기관, 최대 100명) */
  participantIds: number[];
  participantNames: string[];
  aiAssisted: boolean;
  updatedAt: string | null;
}

export type ProgramInput = Omit<Program, 'id' | 'participantNames' | 'updatedAt'>;

// ---------- 직원 교육·회의 ----------

export type StaffTrainingKind = 'TRAINING' | 'MEETING';
/** 법정 교육 다섯 범주 — 직원 연간 이수 점검(trainingCoverage)의 기준 */
export type LegalTrainingCategory = 'ELDER_ABUSE' | 'SEXUAL_HARASSMENT' | 'INFECTION' | 'SAFETY' | 'PRIVACY';
export type TrainingCategory = LegalTrainingCategory | 'DISABILITY_AWARENESS' | 'JOB' | 'OTHER';
export type MeetingCategory = 'CASE' | 'STAFF' | 'OTHER';
/** kind=TRAINING이면 TrainingCategory, kind=MEETING이면 MeetingCategory (맞지 않으면 서버가 400) */
export type StaffTrainingCategory = TrainingCategory | MeetingCategory;

export interface StaffTraining {
  id: number;
  kind: StaffTrainingKind;
  heldOn: string;
  category: StaffTrainingCategory;
  topic: string;
  instructor: string | null;
  /** 참석 직원 Member id(같은 기관, 최대 200명) */
  attendeeIds: number[];
  attendeeNames: string[];
  content: string | null;
  aiAssisted: boolean;
  updatedAt: string | null;
}

export type StaffTrainingInput = Omit<StaffTraining, 'id' | 'attendeeNames' | 'updatedAt'>;

/** GET /staff — 참석자 고르기용 같은 기관 직원 */
export interface LabStaff {
  id: number;
  name: string;
  role: string | null;
  position: string | null;
}

// ---------- 상담일지 ----------

export type ConsultCounterpart = 'SELF' | 'GUARDIAN' | 'FAMILY' | 'OTHER';
export type ConsultMethod = 'VISIT' | 'PHONE' | 'ONLINE' | 'OTHER';

export interface Consultation {
  id: number;
  elderlyId: number;
  elderlyName: string;
  consultedOn: string;
  counterpart: ConsultCounterpart;
  /** 상담 상대 이름(평문 50자 이하, 서버에서 암호화) — AI에는 절대 보내지 않는다 */
  counterpartName: string | null;
  method: ConsultMethod;
  content: string | null;
  followUp: string | null;
  consultantName: string | null;
  aiAssisted: boolean;
  createdAt: string | null;
}

export type ConsultationInput = Omit<Consultation, 'id' | 'elderlyName' | 'createdAt'>;

// ---------- 욕구사정 · 급여제공계획 ----------

/** 욕구사정 여섯 영역(각 1000자 이하) */
export interface CarePlanNeeds {
  physical: string;
  cognition: string;
  nutrition: string;
  communication: string;
  family: string;
  other: string;
}

export interface CarePlanService {
  area: string;
  content: string;
  frequency: string;
}

export interface CarePlan {
  id: number;
  elderlyId: number;
  elderlyName: string;
  planYear: number;
  assessedOn: string;
  needs: CarePlanNeeds;
  goals: string | null;
  /** 최대 30개 */
  services: CarePlanService[];
  /** 보호자(수급자) 동의일 — 비어 있으면 급여제공계획 점검에서 "동의 필요" */
  guardianAgreedOn: string | null;
  writerName: string | null;
  aiAssisted: boolean;
  updatedAt: string | null;
}

export type CarePlanInput = Omit<CarePlan, 'id' | 'elderlyName' | 'updatedAt'>;

// ---------- 2차 AI (Next.js /api/v1/lab-ai/<task>) — 이름은 보내지 않는다 ----------

/** 바이탈 한 줄(날짜와 숫자만). 값이 없는 항목은 생략하거나 null. */
export interface VitalReading {
  systolic?: number | null;
  diastolic?: number | null;
  pulse?: number | null;
  temperature?: number | null;
  bloodSugar?: number | null;
  weight?: number | null;
}

export interface VitalSeriesEntry extends VitalReading {
  date: string;
}

export interface NursingSummaryInput {
  /** 최근 14일 값(날짜·수치만) */
  readings: VitalSeriesEntry[];
  /** 처치·투약 메모(직원이 쓴 글, 이름 없이) */
  treatment?: string;
}

export type VitalFlagMetric = 'bloodPressure' | 'pulse' | 'temperature' | 'bloodSugar' | 'weight';
/** 규칙 판정 다섯 항목 + 모델이 짚을 수 있는 추이·처치·기타 */
export type NursingFlagMetric = VitalFlagMetric | 'trend' | 'treatment' | 'other';

export interface NursingSummaryFlag {
  metric: NursingFlagMetric;
  message: string;
}

export interface NursingSummaryResult {
  summary: string;
  flags: NursingSummaryFlag[];
}

export interface ProgramLogAiInput {
  note: string;
  category: ProgramCategory;
}

export interface ProgramLogResult {
  title: string;
  goal: string;
  content: string;
  reaction: string;
}

export interface TrainingLogAiInput {
  note: string;
  kind: StaffTrainingKind;
  category: StaffTrainingCategory;
}

export interface TrainingLogResult {
  topic: string;
  content: string;
  keyPoints: string[];
}

export interface ConsultationAiInput {
  note: string;
}

export interface ConsultationResult {
  content: string;
  followUp: string;
  /** 급여계획에 반영할 만한 욕구 신호(짧은 구절) */
  needSignals: string[];
}

export interface CarePlanAiInput {
  /** 장기요양 등급(예: '3등급', '인지지원등급') */
  grade?: string;
  /** 욕구사정 — 글 한 덩어리 또는 영역별 글 */
  needs: string | Partial<CarePlanNeeds>;
  recentConsultations?: string;
  riskSummary?: string;
}

export interface CarePlanResult {
  goals: string;
  services: CarePlanService[];
}

// =====================================================================
// 3차 — 주간 식단표 · 위생·안전·시설 점검
// =====================================================================

// ---------- 주간 식단표 ----------

/** 점심 한 끼의 여섯 칸. 칸마다 60자 이하(서버와 같다). */
export interface MealLunch {
  rice: string;
  soup: string;
  /** 주찬 — 한 주 안에서 겹치면 안 되는 칸(menuRepeats) */
  main: string;
  side1: string;
  side2: string;
  kimchi: string;
}

/** 하루 식단(월~토 6일 중 하루). date는 'YYYY-MM-DD' */
export interface MealDay {
  date: string;
  lunch: MealLunch;
  amSnack: string;
  pmSnack: string;
  /** 다진식·죽식 어르신을 위한 대체 메모(예: "다진식: 생선살 발라 으깸") */
  soft: string;
}

export interface MealPlan {
  id: number;
  /** 월요일 'YYYY-MM-DD' */
  weekStart: string;
  /** 월~토 6일, 날짜 오름차순 */
  days: MealDay[];
  /** 주간 메모(1000자 이하) */
  notes: string | null;
  writerName: string | null;
  aiAssisted: boolean;
  updatedAt: string | null;
}

/** 저장 본문 — companyId+weekStart로 덮어쓴다(upsert) */
export type MealPlanInput = Omit<MealPlan, 'id' | 'updatedAt'>;

// ---------- 위생·안전·시설 점검 ----------

export type SafetyKind = 'KITCHEN' | 'HYGIENE' | 'FIRE' | 'FACILITY' | 'VEHICLE' | 'INFECTION' | 'DRILL';
/** 점검 주기: 운영일마다 · 주 1회 · 월 1회 · 연 2회(반기마다 1회) */
export type SafetyCadence = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'TWICE_YEARLY';

/** 점검 항목 한 줄. ok: 적합 true · 부적합 false · 아직 안 봄 null. code는 ^[A-Z0-9_]{2,30}$, note 200자 이하 */
export interface SafetyItem {
  code: string;
  ok: boolean | null;
  note: string;
}

export interface SafetyCheck {
  id: number;
  checkDate: string;
  kind: SafetyKind;
  /** 최대 60개 */
  items: SafetyItem[];
  /** 부적합 항목에 대한 조치 내용(2000자 이하) */
  actions: string | null;
  inspectorName: string | null;
  aiAssisted: boolean;
  updatedAt: string | null;
}

/** 저장 본문 — kind+checkDate로 덮어쓴다(upsert) */
export type SafetyCheckInput = Omit<SafetyCheck, 'id' | 'updatedAt'>;

// ---------- 3차 AI (Next.js /api/v1/lab-ai/<task>) — 이번 묶음은 원래 개인정보가 없고, 이름은 그래도 보내지 않는다 ----------

export interface MealPlanAiInput {
  /** 월요일 'YYYY-MM-DD' */
  weekStart: string;
  /** 센터가 원하는 방향(예: "국물은 싱겁게, 이번 주는 생선을 많이") */
  preferences?: string;
  /** 쓰지 말아야 할 주찬 — 보통 지난주 주찬 목록 */
  avoid?: string[];
  /** 다진식·죽식 어르신 수(대체 메모의 분량을 정하는 데만 쓴다) */
  softCount?: number;
}

export interface MealPlanResult {
  /** 월~토 6일, 날짜는 weekStart에서 계산해 채운다 */
  days: MealDay[];
}

export interface SafetyFailedItem {
  /** 점검표에 적힌 항목 문장 */
  label: string;
  /** 점검원이 적은 상황 메모(비어 있을 수 있다) */
  note: string;
}

export interface SafetyActionsAiInput {
  kind: SafetyKind;
  failed: SafetyFailedItem[];
}

export interface SafetyActionsResult {
  /** 부적합 항목별 조치 계획(줄바꿈으로 나뉜 문장들, 2000자 이하) */
  actions: string;
}
