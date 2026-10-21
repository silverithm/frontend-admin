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
  /** [12차] 별지 제15호서식 칸. 옛 기록·옛 서버 응답은 null(labApi가 채운다) */
  form: CareRecordFormView | null;
  updatedAt: string | null;
}

/**
 * 본문 글자 수 한도는 서버와 같다: 서술 2000자, 식사·배설·목욕 200자, 제공자 50자.
 * [12차] form은 선택이다 — 빠지면 labApi가 null로 보낸다(서버는 null을 "비움"으로 저장하므로 화면은 늘 현재 값을 보낸다).
 */
export type CareRecordInput = Omit<CareRecord, 'id' | 'elderlyName' | 'updatedAt' | 'form'> & { form?: CareRecordForm | null };

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
  /** [12차] 메모에 분명히 적힌 서식 칸 열두 개(없으면 null·false) */
  form: CareNoteForm;
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
  /** [12차] 진행 시간(분, 10~480). 옛 일지는 null */
  durationMinutes: number | null;
  /** [12차] 인지활동형 프로그램 여부(5등급·인지지원 급여비용 산정 조건, 고시 제32조⑩) */
  cognitiveActivity: boolean;
  /** [12차] 제공자 유형. cognitiveActivity가 true이면 필수 */
  providerKind: CognitiveProviderKind | null;
  updatedAt: string | null;
}

/** [12차] 새 필드 셋은 선택이다 — 빠지면 labApi가 null·false·null로 채워 보낸다. */
export type ProgramInput = Omit<Program, 'id' | 'participantNames' | 'updatedAt' | 'durationMinutes' | 'cognitiveActivity' | 'providerKind'> & {
  durationMinutes?: number | null;
  cognitiveActivity?: boolean;
  providerKind?: CognitiveProviderKind | null;
};

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

/**
 * 욕구사정 칸(각 1000자 이하). 11차에 disease·oral·subjective·resources·summary·avoidFoods를 더했다.
 * 옛 기록에는 새 칸이 없을 수 있어 받을 때 labApi가 ''로 채운다(normalizeCarePlanNeeds).
 */
export interface CarePlanNeeds {
  physical: string;
  cognition: string;
  nutrition: string;
  communication: string;
  family: string;
  other: string;
  /** 질병상태 */
  disease: string;
  /** 구강상태 */
  oral: string;
  /** 주관적 욕구 */
  subjective: string;
  /** 자원이용 욕구 */
  resources: string;
  /** 총평 — 서술형 종합소견 */
  summary: string;
  /** 기피식품(식사 유의사항) — '없음'도 기록으로 센다 */
  avoidFoods: string;
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

// =====================================================================
// 4차 — 직원 급여대장 · 인건비 지출비율 · 회계 장부 · 후원금
// 금액은 모두 정수 원이다(소수 금액 없음). 날짜는 'YYYY-MM-DD', 월은 'YYYY-MM'.
// =====================================================================

// ---------- 직원 급여 ----------

export type PayrollJobType =
  | 'CAREGIVER'
  | 'SOCIAL_WORKER'
  | 'NURSE'
  | 'NURSE_AIDE'
  | 'THERAPIST'
  | 'COOK'
  | 'NUTRITIONIST'
  | 'DRIVER'
  | 'SANITATION'
  | 'OFFICE'
  | 'DIRECTOR'
  | 'OTHER';
export type PayrollPayType = 'MONTHLY' | 'HOURLY';
/** 원천징수 선택 비율(%) — 간이세액표 금액의 80·100·120% */
export type WithholdingRate = 80 | 100 | 120;
export type PayrollStatus = 'DRAFT' | 'CONFIRMED';

/** 직원별 급여 기준. 같은 기관 직원(memberId)마다 하나(upsert). */
export interface PayrollProfile {
  id: number;
  memberId: number;
  memberName: string | null;
  jobType: PayrollJobType;
  payType: PayrollPayType;
  /** 월급 또는 시급(원), 1~20,000,000 */
  baseAmount: number;
  /** 주 소정근로시간, 1~52 (소수 한 자리) */
  weeklyHours: number;
  /** 공제대상가족 수(본인 포함), 1~11 */
  dependents: number;
  /** 8세 이상 20세 이하 자녀 수, 0~10 */
  children: number;
  withholdingRate: WithholdingRate;
  /** 비과세 식대(원), 0~200,000 */
  mealAllowance: number;
  hireDate: string;
  /** 선임 요양보호사 수당 대상 */
  seniorCaregiver: boolean;
  npsEnrolled: boolean;
  healthEnrolled: boolean;
  employmentEnrolled: boolean;
  updatedAt: string | null;
}

export type PayrollProfileInput = Omit<PayrollProfile, 'id' | 'memberName' | 'updatedAt'>;

/** 기타 수당 한 줄(최대 10줄). taxable=false이면 비과세 수당이라 4대보험·소득세 기준에서 뺀다. */
export interface PayrollOtherAllowance {
  label: string;
  amount: number;
  taxable: boolean;
}

/** 기타 공제 한 줄(최대 10줄) */
export interface PayrollOtherDeduction {
  label: string;
  amount: number;
}

export type PayrollLineStatus = PayrollStatus;

/** 월 급여대장 한 줄. 같은 (직원, 월)마다 하나(upsert). */
export interface PayrollLine {
  id: number;
  memberId: number;
  memberName: string | null;
  payMonth: string;
  regularHours: number;
  overtimeHours: number;
  nightHours: number;
  holidayHours: number;
  /** 휴일근로 8시간 초과분 시간 */
  holidayOver8Hours: number;
  basePay: number;
  overtimePay: number;
  nightPay: number;
  /** 휴일근로 수당(8시간 이내 + 8시간 초과 합) */
  holidayPay: number;
  longServiceAward: number;
  seniorAllowance: number;
  otherAllowances: PayrollOtherAllowance[];
  /** 비과세 식대 */
  mealAllowance: number;
  grossPay: number;
  taxablePay: number;
  nps: number;
  health: number;
  ltc: number;
  employment: number;
  incomeTax: number;
  localTax: number;
  otherDeductions: PayrollOtherDeduction[];
  netPay: number;
  employerNps: number;
  employerHealth: number;
  employerLtc: number;
  employerEmployment: number;
  status: PayrollLineStatus;
  confirmedAt: string | null;
  updatedAt: string | null;
}

/** 저장 본문 — memberId+payMonth로 덮어쓴다(upsert). 확정된 줄은 서버가 409를 준다. */
export type PayrollLineInput = Omit<PayrollLine, 'id' | 'memberName' | 'status' | 'confirmedAt' | 'updatedAt'>;

/** 한 달 근로시간 입력(시간, 소수 한 자리) */
export interface PayrollHours {
  regularHours: number;
  overtimeHours: number;
  nightHours: number;
  holidayHours: number;
  holidayOver8Hours: number;
}

export interface PayrollExtras {
  otherAllowances: PayrollOtherAllowance[];
  otherDeductions: PayrollOtherDeduction[];
}

/** 기관 형태 — 장기근속장려금 금액이 다르다. HOME=재가·방문형, RESIDENTIAL=입소형 */
export type LongServiceFacility = 'HOME' | 'RESIDENTIAL';

// ---------- 회계 장부 ----------

export type LedgerDirection = 'INCOME' | 'EXPENSE';
export type LedgerEvidenceType = 'RECEIPT' | 'CARD' | 'TAX_INVOICE' | 'TRANSFER' | 'OTHER';

/** 현금출납부 한 줄. accountCode는 3~4자리 숫자 문자열(예: '133', 네 자리 목 '1011'). */
export interface LedgerEntry {
  id: number;
  entryDate: string;
  direction: LedgerDirection;
  accountCode: string;
  description: string;
  amount: number;
  counterparty: string | null;
  evidenceType: LedgerEvidenceType | null;
  /** 이 지출이 쓰인 후원금(같은 기관 후원금만) */
  donationId: number | null;
  aiAssisted: boolean;
  updatedAt: string | null;
}

export type LedgerEntryInput = Omit<LedgerEntry, 'id' | 'updatedAt'>;

// ---------- 후원금 ----------

export type DonorType = 'INDIVIDUAL' | 'CORPORATE' | 'GROUP';
export type DonationKind = 'CASH' | 'GOODS';

export interface Donation {
  id: number;
  receivedOn: string;
  donorName: string;
  donorType: DonorType;
  kind: DonationKind;
  /** 현금은 받은 금액, 물품은 환산액(원) */
  amount: number;
  goodsDescription: string | null;
  /** 지정 후원이면 그 용도, 비지정이면 null */
  designatedPurpose: string | null;
  receiptNo: string | null;
  /** 이 후원금에 연결된 지출의 합 — 서버가 계산한다 */
  usedAmount: number;
  updatedAt: string | null;
}

export type DonationInput = Omit<Donation, 'id' | 'usedAmount' | 'updatedAt'>;

// ---------- 4차 AI — 계정 제안 ----------

export interface LedgerClassifyLine {
  description: string;
  amount: number;
  direction: LedgerDirection;
}

export interface LedgerClassifyAiInput {
  /** 최대 50줄 */
  lines: LedgerClassifyLine[];
}

/** index는 입력 줄 번호(0부터). accountCode는 그 방향의 계정 목록 안의 코드이고, 알 수 없으면 null. */
export interface LedgerSuggestion {
  index: number;
  accountCode: string | null;
  reason: string;
}

export interface LedgerClassifyResult {
  items: LedgerSuggestion[];
}

// =====================================================================
// 5차 — 상태변화·사고 · 기능회복훈련 · 보호자 월간 안내 · 봉사·자원연계 · 예산·결산
// 필드 이름은 서버 DTO와 같아야 한다(계약 개정 8). 날짜시간은 'YYYY-MM-DDTHH:MM'(초 없음, 서울 시각).
// =====================================================================

// ---------- 상태변화·사고·응급 ----------

export type CareEventKind = 'CONDITION_CHANGE' | 'FALL' | 'INJURY' | 'EMERGENCY' | 'HOSPITAL' | 'MEDICATION' | 'BEHAVIOR' | 'OTHER';
export type CareEventSeverity = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
export type CareEventStatus = 'OPEN' | 'CLOSED';
export type GuardianContactMethod = 'PHONE' | 'SMS' | 'VISIT' | 'OTHER';

export interface CareEvent {
  id: number;
  elderlyId: number;
  elderlyName: string;
  /** 'YYYY-MM-DDTHH:MM' (서울 시각) */
  occurredAt: string;
  kind: CareEventKind;
  severity: CareEventSeverity;
  place: string | null;
  /** 필수, 2000자 이내 */
  description: string;
  immediateAction: string | null;
  /** 'YYYY-MM-DDTHH:MM'. guardianMethod와 같이 있거나 같이 없어야 한다 */
  guardianNotifiedAt: string | null;
  guardianMethod: GuardianContactMethod | null;
  guardianResponse: string | null;
  hospitalName: string | null;
  followUp: string | null;
  prevention: string | null;
  status: CareEventStatus;
  closedOn: string | null;
  reporterName: string;
  aiAssisted: boolean;
  updatedAt: string | null;
}

export type CareEventInput = Omit<CareEvent, 'id' | 'elderlyName' | 'updatedAt'>;

// ---------- 기능회복훈련 ----------

export type RehabKind = 'PHYSICAL_FUNCTION' | 'BASIC_MOTION' | 'ADL' | 'PHYSIO' | 'OCCUPATIONAL' | 'COGNITIVE';

export interface RehabSession {
  id: number;
  elderlyId: number;
  elderlyName: string;
  sessionDate: string;
  kind: RehabKind;
  /** 1~240 */
  minutes: number;
  /** 훈련 항목, 최대 10개·각 40자 */
  items: string[];
  content: string | null;
  reaction: string | null;
  therapistName: string;
  aiAssisted: boolean;
  updatedAt: string | null;
}

export type RehabSessionInput = Omit<RehabSession, 'id' | 'elderlyName' | 'updatedAt'>;

/** 여러 어르신(1~50명)에게 같은 훈련을 한 번에 기록한다. 반응은 어르신마다 달라 batch에는 없다. */
export interface RehabSessionBatchInput {
  elderlyIds: number[];
  sessionDate: string;
  kind: RehabKind;
  minutes: number;
  items: string[];
  content: string | null;
  therapistName: string;
  aiAssisted: boolean;
}

// ---------- 보호자 월간 안내 ----------

export type GuardianNoticeStatus = 'DRAFT' | 'SENT';
export type GuardianNoticeMethod = 'SMS' | 'KAKAO' | 'PRINT' | 'EMAIL' | 'VISIT' | 'OTHER';

export interface GuardianNotice {
  id: number;
  elderlyId: number;
  elderlyName: string;
  /** 'YYYY-MM' */
  noticeMonth: string;
  title: string;
  body: string;
  /** 초안에 쓴 사실 묶음(NoticeFacts)의 JSON 문자열 */
  facts: string | null;
  status: GuardianNoticeStatus;
  sentOn: string | null;
  method: GuardianNoticeMethod | null;
  recipient: string | null;
  writerName: string;
  aiAssisted: boolean;
  updatedAt: string | null;
}

export type GuardianNoticeInput = Omit<GuardianNotice, 'id' | 'elderlyName' | 'status' | 'updatedAt'>;

export interface GuardianNoticeSentInput {
  sentOn: string;
  method: GuardianNoticeMethod;
  recipient: string | null;
}

/** 안내 초안에 쓸 사실 묶음 — 사람 이름은 들어 있지 않다 */
export interface NoticeFacts {
  month: string;
  attendanceDays: number;
  vitals: {
    bp: { avgSys: number; avgDia: number; count: number } | null;
    bloodSugar: { avg: number; min: number; max: number; count: number } | null;
    weight: { first: number; last: number; change: number } | null;
  };
  programs: { total: number; byCategory: Record<string, number> };
  rehab: { sessions: number; minutes: number; kinds: string[] };
  events: Array<{ date: string; kindLabel: string; severityLabel: string }>;
  specialNotes: string[];
  copay: { totalDue: number; status: CopayStatus } | null;
}

// ---------- 봉사자 활동 ----------

export type VolunteerActivityType = 'MEAL' | 'PROGRAM' | 'COMPANION' | 'CLEANING' | 'TALENT' | 'OTHER';

export interface VolunteerLog {
  id: number;
  activityDate: string;
  volunteerName: string;
  organization: string | null;
  /** 'HH:MM' */
  startTime: string;
  endTime: string;
  /** 서버가 시작·끝으로 계산한다(끝 ≤ 시작이면 400, 720분 초과 400) */
  minutes: number;
  activityType: VolunteerActivityType;
  content: string | null;
  /** 1365·VMS 실적 등록 여부 */
  vmsRegistered: boolean;
  confirmerName: string;
  updatedAt: string | null;
}

export type VolunteerLogInput = Omit<VolunteerLog, 'id' | 'minutes' | 'updatedAt'>;

// ---------- 외부기관·지역자원 연계 ----------

export type ResourceType = 'MEDICAL' | 'HEALTH_CENTER' | 'DEMENTIA_CENTER' | 'WELFARE' | 'COMMUNITY' | 'GOODS' | 'EDUCATION' | 'OTHER';

export interface ResourceLink {
  id: number;
  /** 기관 전체 연계면 null */
  elderlyId: number | null;
  elderlyName: string | null;
  linkedOn: string;
  resourceType: ResourceType;
  institution: string;
  contactPerson: string | null;
  content: string;
  outcome: string | null;
  followUpOn: string | null;
  /** 연계기록지 제공 여부 — 2026 평가 '외부기관연계' */
  referralGiven: boolean;
  writerName: string;
  aiAssisted: boolean;
  updatedAt: string | null;
}

export type ResourceLinkInput = Omit<ResourceLink, 'id' | 'elderlyName' | 'updatedAt'>;

// ---------- 예산(본예산·추경) ----------

export type BudgetStatus = 'DRAFT' | 'CONFIRMED';

export interface BudgetLine {
  direction: LedgerDirection;
  accountCode: string;
  /** 0~10,000,000,000 정수 */
  amount: number;
  note: string | null;
}

export interface Budget {
  id: number;
  fiscalYear: number;
  /** 0 = 본예산, 1~9 = 추경 차수 */
  revision: number;
  decidedOn: string | null;
  status: BudgetStatus;
  note: string | null;
  confirmedAt: string | null;
  lines: BudgetLine[];
  updatedAt: string | null;
}

export type BudgetInput = Omit<Budget, 'id' | 'status' | 'confirmedAt' | 'updatedAt'>;

// ---------- 5차 AI ----------

export interface CareEventAiInput {
  note: string;
}

export interface CareEventAiResult {
  kind: CareEventKind;
  severity: CareEventSeverity;
  description: string;
  immediateAction: string;
  followUp: string;
  prevention: string;
  /** 보호자에게 보낼 연락 문장. 이름 자리는 '[어르신]' */
  guardianMessage: string;
}

export interface RehabLogAiInput {
  note: string;
  kind?: RehabKind;
}

export interface RehabLogAiResult {
  kind: RehabKind | null;
  minutes: number | null;
  items: string[];
  content: string;
  reaction: string;
}

export interface GuardianNoticeAiInput {
  month: string;
  facts: NoticeFacts;
  tone: 'WARM' | 'BRIEF';
}

export interface GuardianNoticeAiResult {
  title: string;
  body: string;
}

export interface ResourceSuggestAiInput {
  needs: string;
}

export interface ResourceSuggestion {
  resourceType: ResourceType;
  reason: string;
  howTo: string;
}

export interface ResourceSuggestAiResult {
  suggestions: ResourceSuggestion[];
}

export interface BudgetDraftAccount {
  direction: LedgerDirection;
  accountCode: string;
  accountName: string;
  /** 전년 실적(0 가능) */
  lastYear: number;
}

export interface BudgetDraftAiInput {
  year: number;
  /** 최대 300 */
  accounts: BudgetDraftAccount[];
  notes?: string;
}

export interface BudgetDraftLine {
  direction: LedgerDirection;
  accountCode: string;
  amount: number;
  reason: string;
}

export interface BudgetDraftAiResult {
  lines: BudgetDraftLine[];
}

// =====================================================================
// 6차 — 투약·약품 · 목욕 제공 일지 · 수급자 계약·인정 · 퇴소 연계기록지 · 공단 청구 대조
// =====================================================================

// ---------- 투약의뢰서·투약 기록 ----------

export type MedicationSlot = 'MORNING' | 'LUNCH' | 'EVENING' | 'BEDTIME';
/** 경구·외용·점안·흡입·그 밖 */
export type MedicationRoute = 'ORAL' | 'TOPICAL' | 'EYE' | 'INHALE' | 'OTHER';
export type MedicationTiming = 'BEFORE_MEAL' | 'AFTER_MEAL' | 'WITH_MEAL' | 'ANYTIME';
export type RequesterRelation = 'SELF' | 'SPOUSE' | 'CHILD' | 'OTHER_FAMILY' | 'OTHER';
export type MedicationRequestStatus = 'ACTIVE' | 'ENDED';
export type MedicationDoseStatus = 'GIVEN' | 'SKIPPED' | 'REFUSED';

/** 의뢰서의 약 한 가지. 이름 60자·용량 40자·메모 100자, 시간대(slots)는 1개 이상(서버 검증) */
export interface MedicationItem {
  name: string;
  dose: string;
  route: MedicationRoute;
  slots: MedicationSlot[];
  timing: MedicationTiming;
  note: string;
  /** 먹이는 요일(ISO 1=월 … 7=일). 비었거나 없으면 매일 — 요일 칸이 없던 옛 의뢰서도 매일로 읽는다 */
  weekdays?: number[];
}

/** 보호자가 맡긴 약(투약의뢰서). 약은 1~15개 */
export interface MedicationRequest {
  id: number;
  elderlyId: number;
  elderlyName: string;
  requestedOn: string;
  requesterName: string;
  requesterRelation: RequesterRelation;
  medicines: MedicationItem[];
  startDate: string;
  /** 시작일 이상 */
  endDate: string | null;
  /** 의사 처방 확인 */
  prescriptionChecked: boolean;
  status: MedicationRequestStatus;
  note: string | null;
  writerName: string;
  aiAssisted: boolean;
  updatedAt: string | null;
}

export type MedicationRequestInput = Omit<MedicationRequest, 'id' | 'elderlyName' | 'updatedAt'>;

/** 투약 기록 — requestId+givenOn+slot이 하나뿐이다(upsert). 시각(givenAt)은 GIVEN이면 필수 */
export interface MedicationDose {
  id: number;
  elderlyId: number;
  elderlyName: string;
  requestId: number;
  givenOn: string;
  slot: MedicationSlot;
  status: MedicationDoseStatus;
  /** 'HH:MM' */
  givenAt: string | null;
  giverName: string;
  /** 투약 후 상태, 500자 이내 */
  observation: string | null;
  updatedAt: string | null;
}

export type MedicationDoseInput = Omit<MedicationDose, 'id' | 'elderlyName' | 'updatedAt'>;

// ---------- 약품 관리대장·분기 점검 ----------

export type MedicineStorage = 'ROOM' | 'FRIDGE';
export type MedicineCheckAction = 'NONE' | 'DISPOSE' | 'REORDER' | 'MOVE';

/** 일반·비상 의약품 관리대장 — 개인정보가 없다 */
export interface MedicineStock {
  id: number;
  name: string;
  efficacy: string;
  /** 0~100000 */
  quantity: number;
  unit: string;
  storage: MedicineStorage;
  expiresOn: string;
  openedOn: string | null;
  disposedOn: string | null;
  note: string | null;
  updatedAt: string | null;
}

export type MedicineStockInput = Omit<MedicineStock, 'id' | 'updatedAt'>;

export interface MedicineCheckItem {
  stockId: number;
  ok: boolean;
  action: MedicineCheckAction;
  note: string;
}

/** 약품 보관 점검 — checkedOn마다 하나(upsert). 냉장 보관 약이 없으면 fridgeLocked는 null */
export interface MedicineCheck {
  id: number;
  checkedOn: string;
  inspectorName: string;
  cabinetLocked: boolean;
  fridgeLocked: boolean | null;
  items: MedicineCheckItem[];
  note: string | null;
  updatedAt: string | null;
}

export type MedicineCheckInput = Omit<MedicineCheck, 'id' | 'updatedAt'>;

// ---------- 목욕 제공 일지 ----------

/** 전신입욕·목욕의자·침상 */
export type BathMethod = 'FULL_BATH' | 'BATH_CHAIR' | 'BED';

export interface BathLog {
  id: number;
  elderlyId: number;
  elderlyName: string;
  bathDate: string;
  /** 'HH:MM' */
  startTime: string;
  endTime: string;
  /** 서버가 계산한다(끝 ≤ 시작이거나 180분 초과면 400) */
  minutes: number;
  method: BathMethod;
  /** 몸을 씻기는 요양보호사 */
  providerName: string;
  /** 목욕 전 상태, 100자 이내 */
  preCheck: string | null;
  /** 피부·상처 관찰, 500자 이내 */
  skinNote: string | null;
  note: string | null;
  updatedAt: string | null;
}

export type BathLogInput = Omit<BathLog, 'id' | 'elderlyName' | 'minutes' | 'updatedAt'>;

// ---------- 급여 계약·장기요양 인정 ----------

export type ContractStatus = 'ACTIVE' | 'ENDED';
export type ContractEndReason = 'TRANSFER' | 'HOSPITAL' | 'DEATH' | 'SELF' | 'OTHER';

export interface ElderContract {
  id: number;
  elderlyId: number;
  elderlyName: string;
  contractStart: string;
  contractEnd: string | null;
  careGrade: LtcCareGrade;
  recognitionNo: string | null;
  validFrom: string;
  /** 유효기간 끝, validFrom 이상 */
  validTo: string;
  /** 0=최초 인정, 1 이상=갱신 */
  renewalCount: number;
  copayClass: CopayClass;
  /** 1~31. 15 이상이면 미이용일 급여비용 대상 */
  plannedDaysPerMonth: number | null;
  signedOn: string | null;
  /** 계약서 2부 중 1부를 수급자에게 교부했는가 */
  copyGiven: boolean;
  contractNotifiedOn: string | null;
  planNotifiedOn: string | null;
  rightsGuidedOn: string | null;
  status: ContractStatus;
  /** ENDED면 필수 */
  endReason: ContractEndReason | null;
  note: string | null;
  updatedAt: string | null;
}

export type ElderContractInput = Omit<ElderContract, 'id' | 'elderlyName' | 'updatedAt'>;

// ---------- 퇴소 연계기록지 ----------

/** 사망·퇴소 없는 입원은 작성 대상이 아니라 고르는 칸에 없다 */
export type DischargeReason = 'TRANSFER' | 'HOSPITAL' | 'SELF' | 'OTHER';
export type ReferralProvidedMethod = 'VISIT' | 'MAIL' | 'FAX' | 'ELECTRONIC' | 'OTHER';

export interface DischargeReferral {
  id: number;
  elderlyId: number;
  elderlyName: string;
  contractId: number | null;
  dischargeOn: string;
  reason: DischargeReason;
  writtenOn: string;
  careGrade: LtcCareGrade;
  /** 심신기능 상태, 2000자 이내 */
  functionalStatus: string;
  /** 제공한 급여, 2000자 이내 */
  servicesProvided: string;
  /** 퇴소 후 서비스 이용계획·희망급여, 1000자 이내 */
  afterPlan: string;
  counselNote: string | null;
  /** 제공대장 네 칸(제공일자·방법·제공자·수령자)은 같이 있거나 같이 없어야 한다 */
  providedOn: string | null;
  providedMethod: ReferralProvidedMethod | null;
  providerName: string | null;
  recipientName: string | null;
  writerName: string;
  aiAssisted: boolean;
  updatedAt: string | null;
}

export type DischargeReferralInput = Omit<DischargeReferral, 'id' | 'elderlyName' | 'updatedAt'>;

/** 퇴소 연계기록지 초안에 쓸 사실 묶음 — 기간은 from~to, 사람 이름은 들어 있지 않다 */
export interface DischargeFacts {
  period: { from: string; to: string };
  /** 출석 일수를 아는 경우만. 모르면 null */
  attendanceDays: number | null;
  vitals: NoticeFacts['vitals'];
  programs: NoticeFacts['programs'];
  rehab: NoticeFacts['rehab'];
  bath: { count: number };
  events: NoticeFacts['events'];
  specialNotes: string[];
}

// ---------- 공단 청구 대조 ----------

/** 청구 시간 구간 — 고시 표의 다섯 구간과 3시간 미만 */
export type ClaimBand = HourBand | 'under3';
export type ClaimReviewStatus = 'MATCH' | 'MISMATCH' | 'RESOLVED';

export interface ClaimReview {
  id: number;
  elderlyId: number;
  elderlyName: string;
  claimMonth: string;
  claimedDays: number;
  attendedDays: number;
  billedDays: number | null;
  claimedBand: ClaimBand | null;
  status: ClaimReviewStatus;
  note: string | null;
  reviewerName: string;
  updatedAt: string | null;
}

export type ClaimReviewInput = Omit<ClaimReview, 'id' | 'elderlyName' | 'updatedAt'>;

/** PUT /claim-reviews/batch — 최대 200줄, 하나라도 틀리면 아무것도 저장하지 않는다 */
export interface ClaimReviewBatchInput {
  month: string;
  rows: ClaimReviewInput[];
}

// ---------- 6차 AI ----------

export interface MedicationRequestAiInput {
  /** 보호자 메모·약봉투 글을 직원이 옮겨 적은 것 */
  text: string;
}

export interface MedicationRequestAiResult {
  medicines: MedicationItem[];
}

export interface DischargeReferralAiInput {
  facts: DischargeFacts;
  reason: DischargeReason;
  /** 사실 묶음이 다루는 이용 기간(개월) */
  months: number;
}

export interface DischargeReferralAiResult {
  functionalStatus: string;
  servicesProvided: string;
  afterPlan: string;
}

export interface BathNoteAiInput {
  note: string;
}

export interface BathNoteAiResult {
  method: BathMethod | null;
  preCheck: string;
  skinNote: string;
  note: string;
}

// ---------- 7차: 프로그램 연간계획·월간 계획표·의견수렴 ----------

/** 연간계획 세 분야 — 2026 평가 24 신체기능·25 인지기능·26 사회적응 */
export type PlanCategory = 'PHYSICAL' | 'COGNITIVE' | 'SOCIAL';

/** 연간계획 한 장. 기관마다 해·분야당 하나(planYear+category upsert). 개인정보는 없다. */
export interface ProgramPlan {
  id: number;
  planYear: number;
  category: PlanCategory;
  /** 목표, 500자 이내(필수) */
  goal: string;
  /** 세부 프로그램·방법, 3000자 이내(필수) */
  content: string;
  /** 횟수 문구(예: '주 3회'), 40자 이내(필수) */
  frequency: string;
  target: string | null;
  /** 원, 0~1,000,000,000 */
  budget: number | null;
  /** 작성일 — 그 해 안이거나 직전 해 12월이어야 평가에서 인정된다 */
  writtenOn: string;
  writerName: string;
  aiAssisted: boolean;
  updatedAt: string | null;
}

export type ProgramPlanInput = Omit<ProgramPlan, 'id' | 'updatedAt'>;

export type ScheduleCategory = 'COGNITIVE' | 'PHYSICAL' | 'LEISURE' | 'SOCIAL' | 'OTHER';
export type ScheduleSharedMethod = 'PRINT' | 'SMS' | 'KAKAO' | 'BOARD' | 'OTHER';

/** 월간 계획표의 한 칸(그 달 안의 날짜) */
export interface ScheduleItem {
  date: string;
  /** 'HH:MM' */
  startTime: string | null;
  category: ScheduleCategory;
  /** 40자 이내(필수) */
  title: string;
  /** 30자 이내 */
  instructor: string | null;
}

/** 월간 프로그램 계획표 — 평가 17 소통노력 기준③(월 1회 보호자 제공)의 증빙 */
export interface ProgramSchedule {
  id: number;
  scheduleMonth: string;
  /** 최대 200개 */
  items: ScheduleItem[];
  notes: string | null;
  /** 보호자에게 제공한 날 — sharedMethod와 같이 있거나 같이 없다 */
  sharedOn: string | null;
  sharedMethod: ScheduleSharedMethod | null;
  aiAssisted: boolean;
  updatedAt: string | null;
}

export type ProgramScheduleInput = Omit<ProgramSchedule, 'id' | 'updatedAt'>;

export type FeedbackMethod = 'SURVEY' | 'INTERVIEW' | 'MEETING' | 'OTHER';

/** 프로그램 의견수렴·반영 — 반기별 수렴, 연 1회 반영(평가 24~26 기준③) */
export interface ProgramFeedback {
  id: number;
  /** 'YYYY-H1' | 'YYYY-H2' */
  half: string;
  /** 그 반기 안의 날짜 */
  collectedOn: string;
  method: FeedbackMethod;
  /** 0~500 */
  participants: number;
  /** 의견 요약(서버 암호화), 2000자 이내(필수) */
  summary: string;
  /** 반영 내용(서버 암호화), 2000자 이내 — reflectedOn과 같이 있거나 같이 없다 */
  reflection: string | null;
  /** collectedOn 이후 */
  reflectedOn: string | null;
  writerName: string;
  aiAssisted: boolean;
  updatedAt: string | null;
}

export type ProgramFeedbackInput = Omit<ProgramFeedback, 'id' | 'updatedAt'>;

// ---------- 7차: 사업계획 ----------

export type BusinessSection = 'operation' | 'service' | 'staff';

/** 사업계획 한 항목 — 평가 2 확인사항 여섯 칸 */
export interface BusinessPlanItem {
  /** 세부사업명, 60자 이내 */
  name: string;
  /** 사업목표, 300자 이내 */
  goal: string;
  /** 사업내용, 1000자 이내 */
  content: string;
  /** 사업대상, 100자 이내 */
  target: string;
  /** 사업예산(원, 0 이상 정수). 편집 중 비어 있는 칸은 null */
  budget: number | null;
  /** 추진일정, 100자 이내 */
  schedule: string;
}

export interface BusinessPlanSections {
  operation: BusinessPlanItem[];
  service: BusinessPlanItem[];
  staff: BusinessPlanItem[];
}

/** 연간 사업계획서. 분야마다 최대 20개 항목. 개인정보는 없다. */
export interface BusinessPlan {
  id: number;
  planYear: number;
  sections: BusinessPlanSections;
  /** 원, 0~10,000,000,000 */
  totalIncome: number | null;
  totalExpense: number | null;
  writtenOn: string | null;
  writerName: string;
  aiAssisted: boolean;
  updatedAt: string | null;
}

export type BusinessPlanInput = Omit<BusinessPlan, 'id' | 'updatedAt'>;

// ---------- 7차: 급여 만족도 ----------

export type SatisfactionKind = 'MEAL' | 'PROGRAM' | 'TRANSPORT' | 'GENERAL';
export type SatisfactionRespondent = 'SELF' | 'GUARDIAN';

/** 급여 만족도 응답 한 건. elderlyId가 null이면 익명 응답. */
export interface SatisfactionResponse {
  id: number;
  surveyDate: string;
  kind: SatisfactionKind;
  elderlyId: number | null;
  elderlyName: string | null;
  respondent: SatisfactionRespondent;
  /** {문항코드: 1~5}, 20개 이내 */
  scores: Record<string, number>;
  /** 서버 암호화, 1000자 이내 */
  comment: string | null;
  interviewerName: string;
  updatedAt: string | null;
}

export type SatisfactionResponseInput = Omit<SatisfactionResponse, 'id' | 'elderlyName' | 'updatedAt'>;

// ---------- 7차: 입소 상담·대기 ----------

export type IntakeRelation = 'SELF' | 'SPOUSE' | 'CHILD' | 'OTHER_FAMILY' | 'OTHER';
export type IntakeCareGrade = '1' | '2' | '3' | '4' | '5' | 'cognitive' | 'NONE' | 'APPLYING';
export type IntakeSource = 'PHONE' | 'VISIT' | 'REFERRAL' | 'WEB' | 'OTHER';
export type IntakeStatus = 'NEW' | 'CONSULTED' | 'WAITING' | 'CONTRACTED' | 'DECLINED' | 'WITHDRAWN';
/** 노인장기요양보험법 제35조 — 정당한 사유 없는 급여 제공 거부는 금지된다 */
export type IntakeDeclineReason = 'CAPACITY' | 'OUT_OF_AREA' | 'SERVICE_MISMATCH' | 'OTHER';

/** 이용 문의·입소 상담·대기 한 건 */
export interface IntakeInquiry {
  id: number;
  inquiryDate: string;
  /** 신청 어르신 이름(서버 암호화), 50자 이내(필수) */
  applicantName: string;
  /** 문의한 분(서버 암호화), 50자 이내 */
  contactName: string | null;
  /** 서버 암호화, 20자 이내 — 저장하려면 consentOn이 있어야 한다 */
  contactPhone: string | null;
  relation: IntakeRelation | null;
  careGrade: IntakeCareGrade | null;
  /** 60자 이내 */
  desiredDays: string | null;
  /** 서버 암호화, 2000자 이내 */
  needs: string | null;
  source: IntakeSource;
  status: IntakeStatus;
  /** DECLINED이면 필수 */
  declineReason: IntakeDeclineReason | null;
  /** 500자 이내 */
  declineNote: string | null;
  /** 개인정보 수집·이용 동의일 */
  consentOn: string | null;
  nextContactOn: string | null;
  /** CONTRACTED이면 필수(같은 기관 어르신) */
  elderlyId: number | null;
  elderlyName: string | null;
  counselorName: string;
  aiAssisted: boolean;
  updatedAt: string | null;
}

export type IntakeInquiryInput = Omit<IntakeInquiry, 'id' | 'elderlyName' | 'updatedAt'>;

// ---------- 7차 AI ----------

export interface ProgramScheduleAiInput {
  month: string;
  /** 계획표에 쓸 수 있는 날짜(그 달 운영일) */
  operatingDays: string[];
  annualPlans?: Array<{ category: PlanCategory; goal: string; frequency: string }>;
  recentTitles?: string[];
}

export interface ProgramScheduleAiResult {
  items: ScheduleItem[];
}

/** 사업계획 초안에 쓸 숫자 요약 — 사람 이름은 없다 */
export interface BusinessPlanFacts {
  programs: number;
  trainings: number;
  events: number;
  elders: number;
  budgetTotals: { income: number; expense: number } | null;
}

export interface BusinessPlanAiInput {
  year: number;
  facts: BusinessPlanFacts;
  notes?: string;
}

export interface BusinessPlanAiResult {
  sections: BusinessPlanSections;
}

export interface SurveySummaryAiInput {
  kind: SatisfactionKind;
  comments: string[];
}

export interface SurveyTheme {
  theme: string;
  count: number;
  example: string;
}

export interface SurveySummaryAiResult {
  themes: SurveyTheme[];
  suggestions: string[];
}

export interface IntakeNoteAiInput {
  note: string;
}

export interface IntakeNoteAiResult {
  needs: string;
  desiredDays: string;
  careGrade: IntakeCareGrade | null;
  summary: string;
}

// ---------- 8차: 인력배치 · 수급자 서류함 · 진료 동행 · 운영위원회 ----------

/** 직종. NURSE·NURSE_AIDE·THERAPIST는 배치 기준에서 '간호(조무)사·물리(작업)치료사' 한 묶음으로 합산하고, OTHER는 세지 않는다 */
export type StaffJobType = 'DIRECTOR' | 'SOCIAL_WORKER' | 'NURSE' | 'NURSE_AIDE' | 'THERAPIST' | 'CAREGIVER' | 'OFFICE' | 'COOK' | 'DRIVER' | 'OTHER';

/** 월 인력배치 점검의 직원 한 줄 */
export interface StaffingStaff {
  /** 같은 기관 직원이면 id, 직접 적은 사람이면 null */
  memberId: number | null;
  /** 50자 이내 */
  name: string;
  jobType: StaffJobType;
  /** 그 달 실근무시간 0~400, 소수 첫째 자리 */
  hours: number;
}

/** 월 인력배치 점검(staffingMonth로 덮어쓴다) */
export interface StaffingMonth {
  id: number;
  /** 'YYYY-MM' */
  staffingMonth: string;
  /** 그 달 급여제공일수 1~31 */
  serviceDays: number;
  /** 일자별 입소자 수(그날 가장 많은 시간대)의 합 0~100,000 */
  usersSum: number;
  /** 미이용일 급여비용 대상 등 더한 사유, 200자 이내 */
  extraUsersNote: string | null;
  /** 'YYYY-MM-DD' 최대 31개, 그 달 날짜 */
  holidays: string[];
  /** 서버 암호화, 최대 100명 */
  staff: StaffingStaff[];
  /** 500자 이내 */
  note: string | null;
  writerName: string;
  updatedAt: string | null;
}

export type StaffingMonthInput = Omit<StaffingMonth, 'id' | 'updatedAt'>;

export type ElderDocType = 'CONTRACT' | 'RECOGNITION' | 'USE_PLAN' | 'NEEDS_ASSESSMENT' | 'CARE_PLAN' | 'PRIVACY_CONSENT' | 'RIGHTS_GUIDE' | 'RISK_ASSESSMENT' | 'OTHER';

/** 수급자 서류함 한 건 — 개인정보는 제목·위치에 적지 않는다(암호화하지 않음) */
export interface ElderDocument {
  id: number;
  elderlyId: number;
  elderlyName: string;
  docType: ElderDocType;
  /** 100자 이내(필수) */
  title: string;
  issuedOn: string | null;
  /** issuedOn 이상 */
  expiresOn: string | null;
  /** 보관 위치, 100자 이내 */
  location: string | null;
  checkedOn: string | null;
  /** 500자 이내 */
  note: string | null;
  updatedAt: string | null;
}

export type ElderDocumentInput = Omit<ElderDocument, 'id' | 'elderlyName' | 'updatedAt'>;

/** 진료 동행 기록(2026 평가 30 기준①) */
export interface MedicalVisit {
  id: number;
  elderlyId: number;
  elderlyName: string;
  /** 미래 400일까지 */
  visitDate: string;
  /** 'HH:MM' */
  startTime: string | null;
  /** 'HH:MM', 둘 다 있으면 시작보다 뒤 */
  endTime: string | null;
  /** 100자 이내(필수) */
  hospital: string;
  /** 40자 이내 */
  department: string | null;
  /** 서버 암호화, 1000자 이내 */
  reason: string | null;
  /** 서버 암호화, 진료 내용 2000자 이내(필수) */
  result: string;
  /** 서버 암호화, 1000자 이내 */
  prescription: string | null;
  /** 동행한 직원, 50자 이내(필수) */
  escortName: string;
  guardianNotified: boolean;
  /** 서버 암호화, 100자 이내 */
  guardianNote: string | null;
  followUpOn: string | null;
  followUpDone: boolean;
  aiAssisted: boolean;
  updatedAt: string | null;
}

export type MedicalVisitInput = Omit<MedicalVisit, 'id' | 'elderlyName' | 'updatedAt'>;

export type CommitteeRole = 'CHAIR' | 'FACILITY_HEAD' | 'STAFF' | 'USER' | 'GUARDIAN' | 'EXPERT' | 'LOCAL' | 'PUBLIC_OFFICIAL' | 'OTHER';

/** 운영위원 */
export interface CommitteeMember {
  id: number;
  /** 서버 암호화, 50자 이내(필수) */
  name: string;
  role: CommitteeRole;
  termStart: string;
  /** termStart보다 뒤, 3년을 넘을 수 없다 */
  termEnd: string;
  active: boolean;
  /** 200자 이내 */
  note: string | null;
  updatedAt: string | null;
}

export type CommitteeMemberInput = Omit<CommitteeMember, 'id' | 'updatedAt'>;

export type CommitteeMeetingKind = 'REGULAR' | 'SPECIAL';

/** 운영위원회 회의 */
export interface CommitteeMeeting {
  id: number;
  heldOn: string;
  kind: CommitteeMeetingKind;
  /** 같은 기관 운영위원 id, 30명 이내 */
  attendeeIds: number[];
  /** 서버가 채운다(읽기 전용) */
  attendeeNames: string[];
  /** 2000자 이내(필수) */
  agenda: string;
  /** 서버 암호화, 회의 내용 5000자 이내 */
  minutes: string;
  /** 20개 이내, 각 200자 이내 */
  decisions: string[];
  nextOn: string | null;
  writerName: string;
  aiAssisted: boolean;
  updatedAt: string | null;
}

export type CommitteeMeetingInput = Omit<CommitteeMeeting, 'id' | 'attendeeNames' | 'updatedAt'>;

// ---------- 8차 AI ----------

export interface MedicalVisitAiInput {
  note: string;
}

export interface MedicalVisitAiResult {
  /** 병원 이름 100자 이내 — 메모에 적힌 것만 */
  hospital: string;
  /** 40자 이내 */
  department: string;
  /** 500자 이내 */
  reason: string;
  /** 1000자 이내 */
  result: string;
  /** 500자 이내 */
  prescription: string;
  /** 메모에 날짜가 적혀 있을 때만 date를 채운다 — '2주 뒤' 같은 상대 표현은 달력 날짜로 바꾸지 않고 null */
  followUp: { date: string | null; note: string };
}

export interface MeetingMinutesAiInput {
  note: string;
  kind: CommitteeMeetingKind;
}

export interface MeetingMinutesAiResult {
  /** 10개 이내 */
  agenda: string[];
  /** 2000자 이내, 사람 이름은 '[위원]' */
  minutes: string;
  /** 10개 이내 */
  decisions: string[];
}

// =====================================================================
// 9차 — 직원 인사(경력직·보수교육·건강검진) · 통장 대사
// 금액은 정수 원, 날짜는 'YYYY-MM-DD', 월은 'YYYY-MM'. 통장 거래 글은 AI로 보내지 않는다.
// =====================================================================

// ---------- 직원 인사 ----------

/** 급여 기준(PayrollJobType)과 같은 값 */
export type StaffProfileJobType = PayrollJobType;

/** 직원 인사 기준. 같은 기관 직원(memberId)마다 하나(upsert). */
export interface StaffProfile {
  id: number;
  memberId: number;
  /** 서버가 채운다(읽기 전용) */
  memberName: string | null;
  /** 기관 입사일 */
  hireDate: string;
  jobType: StaffProfileJobType;
  /** 1930~2010 — 보수교육 홀수·짝수년생 대상 판단 */
  birthYear: number | null;
  /** 요양보호사 자격시험 합격일 — 2년 미만 보수교육 면제 */
  licensePassedOn: string | null;
  /** 산업안전보건법상 사무직 — 건강검진 2년 */
  officeWorker: boolean;
  /** 200자 이내 */
  note: string | null;
  updatedAt: string | null;
}

export type StaffProfileInput = Omit<StaffProfile, 'id' | 'memberName' | 'updatedAt'>;

export type StaffCertKind = 'CONTINUING_EDU' | 'HEALTH_CHECK' | 'OTHER';

/** 이수·검진 기록 */
export interface StaffCert {
  id: number;
  memberId: number;
  /** 서버가 채운다(읽기 전용) */
  memberName: string | null;
  kind: StaffCertKind;
  /** 미래 400일 넘으면 400 */
  doneOn: string;
  /** CONTINUING_EDU면 필수 0.5~40(소수 첫째 자리) */
  hours: number | null;
  /** 100자 이내 */
  institution: string | null;
  /** 40자 이내 */
  certNo: string | null;
  /** 200자 이내 */
  note: string | null;
  updatedAt: string | null;
}

export type StaffCertInput = Omit<StaffCert, 'id' | 'memberName' | 'updatedAt'>;

// ---------- 통장 ----------

export type BankAccountPurpose = 'OPERATING' | 'DONATION' | 'DEPOSIT' | 'OTHER';

/** 통장. 계좌번호는 끝 4자리만 저장한다. */
export interface BankAccount {
  id: number;
  /** 필수 50자 이내 */
  name: string;
  purpose: BankAccountPurpose;
  /** 30자 이내 */
  bankName: string;
  /** 숫자 4자리가 아니면 400 */
  accountTail: string | null;
  /** −10,000,000,000 ~ 10,000,000,000 */
  openingBalance: number;
  openingDate: string;
  active: boolean;
  updatedAt: string | null;
}

export type BankAccountInput = Omit<BankAccount, 'id' | 'updatedAt'>;

/** 통장 월말 잔액 (통장 + 달마다 하나, upsert) */
export interface BankStatement {
  id: number;
  accountId: number;
  /** 서버가 채운다(읽기 전용) */
  accountName: string | null;
  statementMonth: string;
  closingBalance: number;
  /** 200자 이내 */
  note: string | null;
  updatedAt: string | null;
}

export type BankStatementInput = Omit<BankStatement, 'id' | 'accountName' | 'updatedAt'>;

// =====================================================================
// 10차 — 예방접종 · 사례관리 회의 · 송영 일지(수칙·운행표 제공, 차량 보험) · 규정·지침 대장
// 날짜는 'YYYY-MM-DD', 시각(departTime·arriveTime·boardTime·alightTime)은 JSON에서 'HH:mm'. 필드 이름은 서버 계약과 같다.
// =====================================================================

// ---------- 예방접종 ----------

export type VaccineKind = 'INFLUENZA' | 'PNEUMOCOCCAL' | 'COVID19';
export type VaccinationStatus = 'DONE' | 'REFUSED' | 'EXCLUDED' | 'UNKNOWN';
export type VaccineVerifiedBy = 'CERT' | 'GUARDIAN' | 'NIP' | 'OTHER';

/** 수급자 연도별 예방접종. elderlyId + seasonYear + vaccine마다 하나(upsert). */
export interface Vaccination {
  id: number;
  elderlyId: number;
  /** 서버가 채운다(읽기 전용) */
  elderlyName: string;
  /** 접종 연도(달력 연도), 2020~2100 */
  seasonYear: number;
  vaccine: VaccineKind;
  status: VaccinationStatus;
  /** DONE이면 필수(seasonYear와 같은 해, 미래 400), 그 밖이면 비운다 */
  givenOn: string | null;
  institution: string | null;
  /** DONE이면 필수 */
  verifiedBy: VaccineVerifiedBy | null;
  /** REFUSED·EXCLUDED면 필수, 200자 */
  reason: string | null;
  note: string | null;
  writerName: string | null;
  updatedAt: string | null;
}

export type VaccinationInput = Omit<Vaccination, 'id' | 'elderlyName' | 'writerName' | 'updatedAt'>;

/** GET /vaccinations — 연도 또는 어르신 중 하나는 꼭 필요하다(없으면 400) */
export type VaccinationQuery = { year: number } | { elderlyId: number };

// ---------- 사례관리 회의 ----------

export type CaseReflectMethod = 'CARE_PLAN' | 'CARE_RECORD' | 'RESOURCE' | 'INTERNAL';

export interface CaseAttendee {
  memberId: number;
  memberName: string;
}

export interface CaseOpinion {
  memberId: number;
  memberName: string;
  /** null = '의견 없음' 으로 기록, 300자 */
  opinion: string | null;
}

export interface CaseTarget {
  elderlyId: number;
  elderlyName: string;
  /** 선정 사유(필수 300자) */
  reason: string;
  /** 사례관리 계획(필수 500자) */
  plan: string;
  ownerMemberId: number | null;
  ownerName: string | null;
  /** 회의일 이상 */
  reflectedOn: string | null;
  /** reflectedOn이 있으면 필수 */
  reflectMethod: CaseReflectMethod | null;
  reflectNote: string | null;
  /** reflectedOn 이상(반영 없이 평가 400) */
  evaluatedOn: string | null;
  /** evaluatedOn이 있으면 필수 */
  evaluatorName: string | null;
  /** evaluatedOn이 있으면 필수 */
  resolved: boolean | null;
  /** resolved=false면 필수 */
  nextAction: string | null;
}

export interface CaseMeeting {
  id: number;
  heldOn: string;
  attendees: CaseAttendee[];
  opinions: CaseOpinion[];
  targets: CaseTarget[];
  minutes: string | null;
  writerName: string | null;
  aiAssisted: boolean;
  updatedAt: string | null;
}

export type CaseTargetInput = Omit<CaseTarget, 'elderlyName' | 'ownerName'>;

export interface CaseMeetingInput {
  heldOn: string;
  /** 같은 기관 직원 1~30명, 중복 없음 */
  attendeeIds: number[];
  opinions: Array<{ memberId: number; opinion: string | null }>;
  /** 1~10명 */
  targets: CaseTargetInput[];
  minutes: string | null;
  aiAssisted: boolean;
}

// ---------- 송영 ----------

export type TransportDirection = 'PICKUP' | 'DROPOFF';

export interface TransportRider {
  elderlyId: number;
  elderlyName: string;
  boarded: boolean;
  boardTime: string | null;
  alightTime: string | null;
  note: string | null;
}

/** 송영 운행일지(고시 제34조④). runDate + direction + vehicleNo마다 하나(upsert). */
export interface TransportLog {
  id: number;
  runDate: string;
  direction: TransportDirection;
  vehicleNo: string;
  driverMemberId: number;
  driverName: string;
  escortMemberId: number | null;
  escortName: string | null;
  departTime: string | null;
  arriveTime: string | null;
  riders: TransportRider[];
  note: string | null;
  writerName: string | null;
  updatedAt: string | null;
}

export type TransportRiderInput = Omit<TransportRider, 'elderlyName'>;
export type TransportLogInput = Omit<TransportLog, 'id' | 'driverName' | 'escortName' | 'riders' | 'writerName' | 'updatedAt'> & {
  riders: TransportRiderInput[];
};

export interface TransportVehicle {
  id: number;
  vehicleNo: string;
  label: string | null;
  insurer: string | null;
  policyNo: string | null;
  insuranceFrom: string | null;
  insuranceTo: string | null;
  /** 자동차종합보험 — 책임보험만이면 false */
  comprehensive: boolean;
  active: boolean;
  note: string | null;
  updatedAt: string | null;
}

export type TransportVehicleInput = Omit<TransportVehicle, 'id' | 'updatedAt'>;

/** GET /transport-logs — 날짜 또는 달 중 하나 */
export type TransportLogQuery = { date: string } | { month: string };

export type GuideKind = 'TRANSPORT_RULES' | 'TIMETABLE';
export type GuideMethod = 'FACE' | 'PAPER' | 'SMS' | 'SNS' | 'OTHER';

export interface GuideDelivery {
  id: number;
  elderlyId: number;
  elderlyName: string;
  kind: GuideKind;
  deliveredOn: string;
  method: GuideMethod;
  note: string | null;
  updatedAt: string | null;
}

/** POST /guide-deliveries/batch */
export interface GuideDeliveryBatchInput {
  kind: GuideKind;
  deliveredOn: string;
  method: GuideMethod;
  note: string | null;
  /** 1~100명 */
  elderlyIds: number[];
}

// ---------- 규정·지침 대장 ----------

export type PolicyDocKind = 'OPERATING_RULES' | 'CARE_GUIDE' | 'PRIVACY_POLICY' | 'INFECTION_PLAN' | 'TRANSPORT_RULES' | 'GRIEVANCE_GUIDE' | 'OTHER';

export interface PolicyDoc {
  id: number;
  kind: PolicyDocKind;
  /** CARE_GUIDE면 1~12 필수, 그 밖이면 null */
  guideNo: number | null;
  title: string;
  revisedOn: string | null;
  /** 비치 장소 */
  location: string | null;
  /** 항목 키 → 체크, 키 30개·키 40자 이내·영문·숫자·_ */
  checks: Record<string, boolean>;
  trainedOn: string | null;
  note: string | null;
  updatedAt: string | null;
}

export type PolicyDocInput = Omit<PolicyDoc, 'id' | 'updatedAt'>;

// ---------- AI 결과 ----------

export interface CaseMeetingAiInput {
  /** 회의 메모 3,000자. 사람 이름은 보내지 않는다 */
  note: string;
  /** 참석 직종 이름(예: '시설장'), 10개 이내 */
  roles: string[];
}

export interface CaseMeetingAiResult {
  /** 300자 이내 */
  reason: string;
  /** roles 중 하나인 직종만, 10개 이내 */
  opinions: Array<{ role: string; opinion: string }>;
  /** 500자 이내 */
  plan: string;
  /** 1,500자 이내 */
  minutes: string;
  /** 사례관리로 인정되지 않는 예에 가까우면 이유 한 줄, 아니면 null */
  warning: string | null;
}

/** AI 항목 점검을 받는 규정 종류(대장의 CARE_GUIDE ⑩은 PRIVACY_GUIDE로 보낸다) */
export type PolicyCheckKind = 'OPERATING_RULES' | 'PRIVACY_GUIDE' | 'INFECTION_PLAN' | 'TRANSPORT_RULES' | 'GRIEVANCE_GUIDE';

export interface PolicyCheckAiInput {
  kind: PolicyCheckKind;
  /** 규정 원문 20,000자. 요청에만 쓰고 저장하지 않는다 */
  text: string;
}

export interface PolicyCheckItem {
  key: string;
  present: boolean;
  /** 원문에 그대로 있는 근거 구절 200자, 없으면 null */
  quote: string | null;
}

export interface PolicyCheckAiResult {
  items: PolicyCheckItem[];
  /** 500자 이내 */
  advice: string;
}

// =====================================================================
// 11차 — 욕구사정 열 칸 · 계획 변경 이력 · 직원 복지(포상)·가산금·고충 · 감염병 유행·발생 대응
// =====================================================================

// ---------- 욕구사정 AI ----------

/** 욕구사정 열 칸 + 기피식품 (other는 AI가 채우지 않는다) */
export type NeedsAssessmentKey = 'physical' | 'disease' | 'cognition' | 'communication' | 'oral' | 'nutrition' | 'family' | 'subjective' | 'resources' | 'summary' | 'avoidFoods';

export interface NeedsAssessmentAiInput {
  /** 욕구사정 면담 메모 3,500자. 사람 이름은 보내지 않는다 */
  note: string;
}

export interface NeedsAssessmentAiResult {
  /** 열한 칸, 각 500자 이내. 메모에 없는 칸은 '' */
  needs: Record<NeedsAssessmentKey, string>;
}

// ---------- 급여제공계획 변경 이력 ----------

export type CarePlanChangeReason = 'FUNCTION_CHANGE' | 'ELDER_WISH' | 'GUARDIAN_REQUEST' | 'GRADE_CHANGE' | 'OTHER';
export type CarePlanChangeItem = 'CONTENT' | 'TIME' | 'FREQUENCY';

export interface CarePlanChange {
  id: number;
  elderlyId: number;
  elderlyName: string;
  changedOn: string;
  reason: CarePlanChangeReason;
  /** 필수 300자 */
  reasonNote: string;
  /** 1~3개, 중복 없음 */
  changeItems: CarePlanChangeItem[];
  /** 필수 1,000자 */
  changeDetail: string;
  /** 같은 어르신의 상태변화·사고 기록 */
  eventId: number | null;
  guardianExplainedOn: string | null;
  guardianSignedOn: string | null;
  /** 공단 통보일 */
  notifiedOn: string | null;
  writerName: string | null;
  updatedAt: string | null;
}

export type CarePlanChangeInput = Omit<CarePlanChange, 'id' | 'elderlyName' | 'writerName' | 'updatedAt'>;

// ---------- 직원 복지(포상) 제공대장 · 가산금 ----------

export type WelfareKind =
  | 'GIFT_CARD'
  | 'BOOKS'
  | 'TRAINING'
  | 'CLUB'
  | 'MEDICAL'
  | 'VACATION_PAY'
  | 'TRANSPORT'
  | 'CLOTHING'
  | 'VACCINE'
  | 'INSURANCE'
  | 'REWARD_LEAVE'
  | 'BONUS'
  | 'HOLIDAY_GIFT'
  | 'SPECIAL_ALLOWANCE'
  | 'OTHER'
  | 'DINNER'
  | 'PLAQUE_ONLY'
  | 'DONATED_GOODS';

export interface StaffWelfare {
  id: number;
  givenOn: string;
  memberId: number;
  memberName: string;
  kind: WelfareKind;
  /** 포상품·내용(필수 100자) */
  item: string;
  /** 0~100,000,000 */
  amount: number;
  /** 수령인 서명을 받았는가 */
  signed: boolean;
  /** 대표자 본인에게 준 것인가 */
  recipientIsOwner: boolean;
  /** 같은 기관 회계 장부 기록 */
  evidenceLedgerId: number | null;
  /** 영수증·이체내역 보관 위치(200자) */
  evidenceNote: string | null;
  note: string | null;
  updatedAt: string | null;
}

export type StaffWelfareInput = Omit<StaffWelfare, 'id' | 'memberName' | 'updatedAt'>;

export type BonusFundKind = 'RECEIVED' | 'SPENT';

export interface BonusFund {
  id: number;
  kind: BonusFundKind;
  occurredOn: string;
  /** 1~1,000,000,000 */
  amount: number;
  /** SPENT 대상 직원. null이면 여러 직원 */
  memberId: number | null;
  memberName: string | null;
  /** 필수 100자 */
  purpose: string;
  /** 대표자 겸 시설장·직원에게 쓴 금액 — 사용 비율에서 뺀다 */
  ownerUse: boolean;
  evidenceLedgerId: number | null;
  note: string | null;
  updatedAt: string | null;
}

export type BonusFundInput = Omit<BonusFund, 'id' | 'memberName' | 'updatedAt'>;

// ---------- 고충 건수(내용은 가져오지 않는다) ----------

export interface GrievanceSummary {
  year: number;
  total: number;
  anonymous: number;
  received: number;
  inReview: number;
  resolved: number;
  onHold: number;
  replied: number;
  /** 답한 건의 (답한 날 − 만든 날) 일수 중앙값, 소수 첫째 자리. 없으면 null */
  medianReplyDays: number | null;
  /** 조치완료가 아닌 건 중 가장 오래된 것의 경과 일수. 없으면 null */
  oldestOpenDays: number | null;
}

// ---------- 감염병 유행·발생·국가 위기 기록 ----------

export type OutbreakKind = 'OUTBREAK' | 'CASE' | 'NATIONAL';
export type OutbreakAlertLevel = 'BLUE' | 'YELLOW' | 'ORANGE' | 'RED';
export type OutbreakActionKey =
  | 'VISIT_LIMIT'
  | 'FEVER_CHECK'
  | 'EXTRA_DISINFECT'
  | 'HYGIENE_SUPPLY'
  | 'EXTRA_TRAINING'
  | 'FLU_VACCINE'
  | 'MASK_HAND'
  | 'SYMPTOM_WATCH'
  | 'ISOLATION'
  | 'HOSPITAL_TRANSFER'
  | 'ACTIVITY_STOP';

export interface Outbreak {
  id: number;
  kind: OutbreakKind;
  /** 병명·증상(필수 50자) */
  disease: string;
  startedOn: string;
  /** 0~500 */
  elderCases: number;
  /** 0~500 */
  staffCases: number;
  guardianNotifiedOn: string | null;
  healthCenterReportedOn: string | null;
  /** 지자체·공단 보고일 */
  authorityReportedOn: string | null;
  /** NATIONAL이면 필수, 그 밖이면 null */
  alertLevel: OutbreakAlertLevel | null;
  actions: OutbreakActionKey[];
  endedOn: string | null;
  note: string | null;
  writerName: string | null;
  updatedAt: string | null;
}

export type OutbreakInput = Omit<Outbreak, 'id' | 'writerName' | 'updatedAt'>;

// =====================================================================
// 12차 — 급여제공기록지 법정 서식 칸 · 인지활동형 프로그램 · 시설 관리 대장
// =====================================================================

// ---------- 급여제공기록지 서식 칸 (별지 제15호서식) ----------

export type CareFormSectionKey = 'PHYSICAL' | 'COGNITIVE' | 'HEALTH' | 'REHAB';
export type CareFormBathMethod = 'FULL' | 'SHOWER';
export type CareFormMealKind = 'NORMAL' | 'PORRIDGE' | 'LIQUID';
export type CareFormMealIntake = 'FULL' | 'HALF_OR_MORE' | 'LESS_THAN_HALF';
/** 고시가 기록지에 적으라고 정한 사유: 자정 넘김(제30조④) · 13시간 초과(제30조⑧) · 미이용일(제32조③) · 인지활동형 누락(제32조⑩⑪) */
export type CareFormReasonKind = 'AFTER_MIDNIGHT' | 'OVER_13H' | 'UNUSED_DAY' | 'COG_PROGRAM_MISSED';

export interface CareFormReason {
  kind: CareFormReasonKind;
  /** 1~300자 */
  text: string;
}

/** 서버·웹 같은 모양. 비우거나 없는 칸은 null 또는 false다. */
export interface CareRecordForm {
  /** 'HH:mm' */
  startTime: string | null;
  endTime: string | null;
  transport: boolean;
  /** 20자 이내 */
  vehicleNo: string | null;
  washHelp: boolean;
  /** 0~180 */
  bathMinutes: number | null;
  bathMethod: CareFormBathMethod | null;
  mealKind: CareFormMealKind | null;
  mealIntake: CareFormMealIntake | null;
  /** 0~30 */
  toiletCount: number | null;
  mobilityHelp: boolean;
  cogSupport: boolean;
  commHelp: boolean;
  /** 50~260 — 이완기와 둘 다 있거나 둘 다 null */
  bpSystolic: number | null;
  /** 30~160 */
  bpDiastolic: number | null;
  /** 34.0~42.0, 소수 첫째 자리 */
  temperature: number | null;
  /** 0~600 */
  healthCareMinutes: number | null;
  nursingCareMinutes: number | null;
  emergency: boolean;
  /** 200자 이내 */
  programNames: string | null;
  rehabPhysical: boolean;
  rehabCogActivity: boolean;
  rehabCogTraining: boolean;
  rehabPtOt: boolean;
  /** 영역별 실제 제공 직원의 member id(같은 기관 직원만) */
  writers: Record<CareFormSectionKey, number | null>;
  reasons: CareFormReason[];
}

/** 서버 응답의 form — 영역별 제공 직원 이름이 더해진다. 저장할 때 writerNames는 서버가 무시한다. */
export type CareRecordFormView = CareRecordForm & {
  writerNames?: Record<CareFormSectionKey, string | null>;
};

/** care-record AI가 메모에서 채우는 서식 칸 열두 개 */
export interface CareNoteForm {
  washHelp: boolean;
  bathMinutes: number | null;
  bathMethod: CareFormBathMethod | null;
  mealKind: CareFormMealKind | null;
  mealIntake: CareFormMealIntake | null;
  toiletCount: number | null;
  mobilityHelp: boolean;
  cogSupport: boolean;
  commHelp: boolean;
  bpSystolic: number | null;
  bpDiastolic: number | null;
  temperature: number | null;
}

// ---------- 인지활동형 프로그램 ----------

export type CognitiveProviderKind = 'PROGRAM_MANAGER' | 'DEMENTIA_CAREGIVER' | 'EXTERNAL_INSTRUCTOR' | 'OTHER';

// ---------- 시설 관리 대장 ----------

export const FACILITY_ITEM_CODES = [
  'FIRE_OPERATION',
  'FIRE_COMPREHENSIVE',
  'FIRE_DRILL_LEGAL',
  'FIRE_MANAGER_TRAINING',
  'ELEC_GENERAL',
  'ELEC_SELF_USE',
  'GAS_CITY_REGULATOR',
  'GAS_CITY_SPECIAL',
  'GAS_LPG_INSPECT',
  'ELEV_SELF_MONTHLY',
  'ELEV_ANNUAL',
  'TANK_CLEAN',
  'TANK_HYGIENE',
  'TANK_WATER_QUALITY',
  'SEPTIC_CLEAN',
  'DISINFECT_QUARTERLY',
  'SOCIAL_SAFETY_HALF',
  'INSURANCE_FACILITY',
  'INSURANCE_PROFESSIONAL',
] as const;
/** 서버 FACILITY_ITEM_CODES와 같은 19개 */
export type FacilityItemCode = (typeof FACILITY_ITEM_CODES)[number];

export type FacilitySprinkler = 'NONE' | 'SIMPLE' | 'FULL' | 'UNKNOWN';
/** GENERAL = 일반용(저압 75kW 미만) */
export type FacilityPowerKind = 'GENERAL' | 'SELF_USE' | 'UNKNOWN';
export type FacilityGasKind = 'NONE' | 'CITY' | 'LPG' | 'UNKNOWN';
/** CENTER = 센터가 관리주체, BUILDING = 건물 관리주체 */
export type FacilityElevator = 'NONE' | 'CENTER' | 'BUILDING' | 'UNKNOWN';
/** LARGE = 수도법 대형건축물등 */
export type FacilityWaterTank = 'NONE' | 'LARGE' | 'SMALL' | 'UNKNOWN';
export type FacilitySeptic = 'NONE' | 'YES' | 'UNKNOWN';
export type FacilityApplies = 'YES' | 'NO';
export type FacilityDoneBy = 'SELF' | 'VENDOR' | 'AGENCY';
export type FacilityLogResult = 'PASS' | 'FIX_NEEDED' | 'FAIL';

/** 기관당 한 줄. 아직 저장한 적이 없으면 id가 null이고 모든 칸이 기본값(UNKNOWN·null)이다. */
export interface FacilityProfile {
  id: number | null;
  /** 사용승인일 */
  approvedOn: string | null;
  /** 1~1,000,000 */
  grossAreaM2: number | null;
  sprinkler: FacilitySprinkler;
  powerKind: FacilityPowerKind;
  gasKind: FacilityGasKind;
  /** 0~100,000. LPG가 아니면 비운다 */
  lpgCapacityKg: number | null;
  elevator: FacilityElevator;
  waterTank: FacilityWaterTank;
  septic: FacilitySeptic;
  /** 항목 코드별 직접 지정(적용 판정보다 우선) */
  appliesOverride: Partial<Record<FacilityItemCode, FacilityApplies>>;
  fireManagerName: string | null;
  note: string | null;
  writerName: string | null;
  updatedAt: string | null;
}

export type FacilityProfileInput = Omit<FacilityProfile, 'id' | 'writerName' | 'updatedAt'>;

export interface FacilityLog {
  id: number;
  itemCode: FacilityItemCode;
  /** 미래면 서버가 400 */
  doneOn: string;
  doneBy: FacilityDoneBy;
  vendorName: string | null;
  result: FacilityLogResult;
  /** 조치 내용 */
  actionNote: string | null;
  /** 소방 자체점검 결과 보고일 — FIRE_OPERATION·FIRE_COMPREHENSIVE에서만 저장 */
  reportedOn: string | null;
  /** 보험 만기 — INSURANCE_*에서 필수(실시일보다 뒤) */
  validUntil: string | null;
  /** 결과서·증명서 보관 위치 */
  docLocation: string | null;
  writerName: string | null;
  updatedAt: string | null;
}

export type FacilityLogInput = Omit<FacilityLog, 'id' | 'writerName' | 'updatedAt'>;


// ---------- 종류별 기록(업무수행일지·시설운영일지·안전관리 설명·현금영수증) ----------

export type RecordLogKind = 'PROGRAM_MANAGER_LOG' | 'SENIOR_CAREGIVER_LOG' | 'FACILITY_DIARY' | 'SAFETY_BRIEFING' | 'CASH_RECEIPT';

/** 종류별 기록 한 줄. checks는 종류마다 허용 값이 다른 확인 항목 코드(recordLogRules의 RECORD_LOG_KINDS) */
export interface RecordLog {
  id: number;
  kind: RecordLogKind;
  entryDate: string;
  elderlyId: number | null;
  elderlyName: string;
  authorName: string;
  checks: string[];
  body: string | null;
  action: string | null;
  /** 현금영수증 승인번호 */
  extra: string | null;
  /** 현금영수증 금액(원) */
  amount: number | null;
  updatedAt: string;
}

export type RecordLogInput = Omit<RecordLog, 'id' | 'elderlyName' | 'updatedAt'>;
