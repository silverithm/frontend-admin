/**
 * 실험실 API 호출 — 모든 요청은 authorizedFetch(토큰 갱신·GET 재시도 포함)를 거쳐 Next 프록시로 나간다.
 *  · /api/v1/lab/...     → 백엔드 /api/v1/lab/... (route: app/api/v1/lab/[[...path]])
 *  · /api/v1/lab-ai/...  → Next 서버의 Gemini 라우트 (실험실 권한을 확인한 뒤 모델 호출)
 * 에러는 서버 JSON의 message를 그대로 Error 메시지로 던진다. 서버가 메시지를 주지 않으면 한국어 기본 문구.
 */
import { authorizedFetch } from '../apiService';
import { redactDeep, rememberElderNames, rememberStaffNames, replaceNames } from './nameRedaction.ts';
import type {
  BankAccount,
  BankAccountInput,
  BankStatement,
  BankStatementInput,
  StaffCert,
  StaffCertInput,
  StaffProfile,
  StaffProfileInput,
  CommitteeMeeting,
  CommitteeMeetingInput,
  CommitteeMember,
  CommitteeMemberInput,
  ElderDocument,
  ElderDocumentInput,
  MedicalVisit,
  MedicalVisitAiResult,
  MedicalVisitInput,
  MeetingMinutesAiInput,
  MeetingMinutesAiResult,
  StaffingMonth,
  StaffingMonthInput,
  BusinessPlan,
  BusinessPlanAiInput,
  BusinessPlanAiResult,
  BusinessPlanInput,
  IntakeInquiry,
  IntakeInquiryInput,
  IntakeNoteAiResult,
  IntakeStatus,
  ProgramFeedback,
  ProgramFeedbackInput,
  ProgramPlan,
  ProgramPlanInput,
  ProgramSchedule,
  ProgramScheduleAiInput,
  ProgramScheduleAiResult,
  ProgramScheduleInput,
  SatisfactionKind,
  SatisfactionResponse,
  SatisfactionResponseInput,
  SurveySummaryAiInput,
  SurveySummaryAiResult,
  BathLog,
  BathLogInput,
  BathNoteAiInput,
  BathNoteAiResult,
  ClaimReview,
  ClaimReviewBatchInput,
  ClaimReviewInput,
  ContractStatus,
  DischargeReferral,
  DischargeReferralAiInput,
  DischargeReferralAiResult,
  DischargeReferralInput,
  ElderContract,
  ElderContractInput,
  MedicationDose,
  MedicationDoseInput,
  MedicationRequest,
  MedicationRequestAiInput,
  MedicationRequestAiResult,
  MedicationRequestInput,
  MedicationRequestStatus,
  MedicineCheck,
  MedicineCheckInput,
  MedicineStock,
  MedicineStockInput,
  Budget,
  BudgetDraftAiInput,
  BudgetDraftAiResult,
  BudgetInput,
  CareDelivery,
  CareEvent,
  CareEventAiInput,
  CareEventAiResult,
  CareEventInput,
  CareEventStatus,
  CareDeliveryInput,
  CareNoteStructured,
  CareRecord,
  CarePlan,
  CarePlanChange,
  CarePlanChangeInput,
  CarePlanNeeds,
  NeedsAssessmentAiInput,
  NeedsAssessmentAiResult,
  Outbreak,
  OutbreakInput,
  StaffWelfare,
  StaffWelfareInput,
  BonusFund,
  BonusFundInput,
  GrievanceSummary,
  CarePlanAiInput,
  CarePlanInput,
  CarePlanResult,
  CareRecordInput,
  Consultation,
  ConsultationAiInput,
  ConsultationInput,
  ConsultationResult,
  CopayBill,
  CopayBillInput,
  CopayPaymentInput,
  Donation,
  DonationInput,
  EvalCheck,
  EvalCheckInput,
  EvalReviewInput,
  EvalReviewResult,
  GuardianNotice,
  GuardianNoticeAiInput,
  GuardianNoticeAiResult,
  GuardianNoticeInput,
  GuardianNoticeSentInput,
  LabAccess,
  LedgerClassifyAiInput,
  LedgerClassifyResult,
  LedgerEntry,
  LedgerEntryInput,
  LabStaff,
  MealPlan,
  MealPlanAiInput,
  MealPlanInput,
  MealPlanResult,
  NursingLog,
  NursingLogInput,
  NursingSummaryInput,
  NursingSummaryResult,
  PayrollLine,
  PayrollLineInput,
  PayrollProfile,
  PayrollProfileInput,
  Program,
  ProgramInput,
  ProgramLogAiInput,
  ProgramLogResult,
  RehabLogAiInput,
  RehabLogAiResult,
  RehabSession,
  RehabSessionBatchInput,
  RehabSessionInput,
  ResourceLink,
  ResourceLinkInput,
  ResourceSuggestAiInput,
  ResourceSuggestAiResult,
  RiskAssessment,
  RiskAssessmentInput,
  RiskLatest,
  RiskSuggestion,
  SafetyActionsAiInput,
  SafetyActionsResult,
  SafetyCheck,
  SafetyCheckInput,
  SafetyKind,
  ScaleKind,
  StaffTraining,
  StaffTrainingInput,
  TrainingLogAiInput,
  TrainingLogResult,
  VolunteerLog,
  VolunteerLogInput,
  CaseMeeting,
  CaseMeetingAiInput,
  CaseMeetingAiResult,
  CaseMeetingInput,
  GuideDelivery,
  GuideDeliveryBatchInput,
  GuideKind,
  PolicyCheckAiInput,
  PolicyCheckAiResult,
  PolicyDoc,
  PolicyDocInput,
  TransportLog,
  TransportLogInput,
  TransportLogQuery,
  TransportVehicle,
  TransportVehicleInput,
  Vaccination,
  VaccinationInput,
  VaccinationQuery,
} from './labTypes.ts';

const LAB = '/api/v1/lab';
const LAB_AI = '/api/v1/lab-ai';

export class LabApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'LabApiError';
    this.status = status;
  }
}

// authorizedFetch는 서버 메시지가 없을 때 "API 오류: 500 ..." 같은 영어 섞인 문구를 만든다. 그건 화면에 못 보여 주므로 기본 문구로 바꾼다.
const GENERIC_ERROR = /^API 오류:/;

async function request<T>(path: string, init: RequestInit | undefined, fallback: string): Promise<T> {
  try {
    return (await authorizedFetch(path, init)) as T;
  } catch (error) {
    const raw = error instanceof Error ? error.message : '';
    const status = (error as { status?: number } | null)?.status;
    throw new LabApiError(raw && !GENERIC_ERROR.test(raw) ? raw : fallback, status);
  }
}

function json(method: 'POST' | 'PUT', body: unknown): RequestInit {
  return { method, body: JSON.stringify(body) };
}

const q = encodeURIComponent;

// ---------- 접근 ----------

export function getLabAccess(): Promise<LabAccess> {
  return request<LabAccess>(`${LAB}/access`, undefined, '실험실 사용 권한을 확인하지 못했습니다');
}

// ---------- 급여제공기록 ----------

export function listCareRecordsByDate(date: string): Promise<CareRecord[]> {
  return request<CareRecord[]>(`${LAB}/care-records?date=${q(date)}`, undefined, '급여제공기록을 불러오지 못했습니다');
}

export function listCareRecordsByElder(elderlyId: number, month: string): Promise<CareRecord[]> {
  return request<CareRecord[]>(`${LAB}/care-records?elderlyId=${q(String(elderlyId))}&month=${q(month)}`, undefined, '월간 급여제공기록을 불러오지 못했습니다');
}

export function saveCareRecord(input: CareRecordInput): Promise<CareRecord> {
  return request<CareRecord>(`${LAB}/care-records`, json('PUT', input), '급여제공기록을 저장하지 못했습니다');
}

export async function deleteCareRecord(id: number): Promise<void> {
  await request<null>(`${LAB}/care-records/${q(String(id))}`, { method: 'DELETE' }, '급여제공기록을 삭제하지 못했습니다');
}

// ---------- 제공대장 ----------

export function listCareDeliveries(month: string): Promise<CareDelivery[]> {
  return request<CareDelivery[]>(`${LAB}/care-deliveries?month=${q(month)}`, undefined, '제공대장을 불러오지 못했습니다');
}

export function saveCareDelivery(input: CareDeliveryInput): Promise<CareDelivery> {
  return request<CareDelivery>(`${LAB}/care-deliveries`, json('PUT', input), '제공대장을 저장하지 못했습니다');
}

export async function deleteCareDelivery(id: number): Promise<void> {
  await request<null>(`${LAB}/care-deliveries/${q(String(id))}`, { method: 'DELETE' }, '제공대장 기록을 삭제하지 못했습니다');
}

// ---------- 본인부담금 ----------

export function listCopayBills(month: string): Promise<CopayBill[]> {
  return request<CopayBill[]>(`${LAB}/copay-bills?month=${q(month)}`, undefined, '청구서를 불러오지 못했습니다');
}

export function saveCopayBill(input: CopayBillInput): Promise<CopayBill> {
  return request<CopayBill>(`${LAB}/copay-bills`, json('PUT', input), '청구서를 저장하지 못했습니다');
}

export function addCopayPayment(id: number, payment: CopayPaymentInput): Promise<CopayBill> {
  return request<CopayBill>(`${LAB}/copay-bills/${q(String(id))}/payments`, json('POST', payment), '수납을 기록하지 못했습니다');
}

export async function deleteCopayBill(id: number): Promise<void> {
  await request<null>(`${LAB}/copay-bills/${q(String(id))}`, { method: 'DELETE' }, '청구서를 삭제하지 못했습니다');
}

/** 그 해 모든 청구서 — 연간 납부 내역(의료비 공제 증빙) 만들기용 */
export function listCopayBillsByYear(year: number): Promise<CopayBill[]> {
  return request<CopayBill[]>(`${LAB}/copay-bills?year=${q(String(year))}`, undefined, '연간 청구서를 불러오지 못했습니다');
}

// ---------- 위험도 평가 ----------

export function listRiskAssessments(elderlyId: number): Promise<RiskAssessment[]> {
  return request<RiskAssessment[]>(`${LAB}/risk-assessments?elderlyId=${q(String(elderlyId))}`, undefined, '위험도 평가 이력을 불러오지 못했습니다');
}

export function listRiskLatest(): Promise<RiskLatest[]> {
  return request<RiskLatest[]>(`${LAB}/risk-assessments/latest`, undefined, '위험도 평가 현황을 불러오지 못했습니다');
}

export function saveRiskAssessment(input: RiskAssessmentInput): Promise<RiskAssessment> {
  return request<RiskAssessment>(`${LAB}/risk-assessments`, json('POST', input), '위험도 평가를 저장하지 못했습니다');
}

export async function deleteRiskAssessment(id: number): Promise<void> {
  await request<null>(`${LAB}/risk-assessments/${q(String(id))}`, { method: 'DELETE' }, '위험도 평가를 삭제하지 못했습니다');
}

// ---------- 평가 준비 ----------

export function listEvalChecks(): Promise<EvalCheck[]> {
  return request<EvalCheck[]>(`${LAB}/eval-checks`, undefined, '평가 준비 현황을 불러오지 못했습니다');
}

export function saveEvalCheck(indicatorCode: string, input: EvalCheckInput): Promise<EvalCheck> {
  return request<EvalCheck>(`${LAB}/eval-checks/${q(indicatorCode)}`, json('PUT', input), '평가 준비 상태를 저장하지 못했습니다');
}

// =====================================================================
// 2차
// =====================================================================

// ---------- 간호일지 ----------

export function listNursingLogsByDate(date: string): Promise<NursingLog[]> {
  return request<NursingLog[]>(`${LAB}/nursing-logs?date=${q(date)}`, undefined, '간호일지를 불러오지 못했습니다');
}

export function listNursingLogsByElder(elderlyId: number, month: string): Promise<NursingLog[]> {
  return request<NursingLog[]>(`${LAB}/nursing-logs?elderlyId=${q(String(elderlyId))}&month=${q(month)}`, undefined, '월간 간호일지를 불러오지 못했습니다');
}

/** 어르신 + 날짜로 덮어쓴다(upsert) */
export function saveNursingLog(input: NursingLogInput): Promise<NursingLog> {
  return request<NursingLog>(`${LAB}/nursing-logs`, json('PUT', input), '간호일지를 저장하지 못했습니다');
}

export async function deleteNursingLog(id: number): Promise<void> {
  await request<null>(`${LAB}/nursing-logs/${q(String(id))}`, { method: 'DELETE' }, '간호일지를 삭제하지 못했습니다');
}

// ---------- 프로그램 일지 ----------

export function listPrograms(month: string): Promise<Program[]> {
  return request<Program[]>(`${LAB}/programs?month=${q(month)}`, undefined, '프로그램 일지를 불러오지 못했습니다');
}

export function createProgram(input: ProgramInput): Promise<Program> {
  return request<Program>(`${LAB}/programs`, json('POST', input), '프로그램 일지를 저장하지 못했습니다');
}

export function updateProgram(id: number, input: ProgramInput): Promise<Program> {
  return request<Program>(`${LAB}/programs/${q(String(id))}`, json('PUT', input), '프로그램 일지를 수정하지 못했습니다');
}

export async function deleteProgram(id: number): Promise<void> {
  await request<null>(`${LAB}/programs/${q(String(id))}`, { method: 'DELETE' }, '프로그램 일지를 삭제하지 못했습니다');
}

// ---------- 직원 교육·회의 ----------

export function listStaffTrainings(year: number): Promise<StaffTraining[]> {
  return request<StaffTraining[]>(`${LAB}/staff-trainings?year=${q(String(year))}`, undefined, '직원 교육·회의 기록을 불러오지 못했습니다');
}

export function createStaffTraining(input: StaffTrainingInput): Promise<StaffTraining> {
  return request<StaffTraining>(`${LAB}/staff-trainings`, json('POST', input), '직원 교육·회의 기록을 저장하지 못했습니다');
}

export function updateStaffTraining(id: number, input: StaffTrainingInput): Promise<StaffTraining> {
  return request<StaffTraining>(`${LAB}/staff-trainings/${q(String(id))}`, json('PUT', input), '직원 교육·회의 기록을 수정하지 못했습니다');
}

export async function deleteStaffTraining(id: number): Promise<void> {
  await request<null>(`${LAB}/staff-trainings/${q(String(id))}`, { method: 'DELETE' }, '직원 교육·회의 기록을 삭제하지 못했습니다');
}

/** 참석자 고르기용 같은 기관 직원 */
export async function listLabStaff(): Promise<LabStaff[]> {
  const staff = await request<LabStaff[]>(`${LAB}/staff`, undefined, '직원 목록을 불러오지 못했습니다');
  // AI로 보내는 글에서 직원 이름을 지우려고 이름만 기억해 둔다(nameRedaction)
  rememberStaffNames(staff.map((s) => s.name));
  return staff;
}

// ---------- 상담일지 ----------

export function listConsultationsByElder(elderlyId: number): Promise<Consultation[]> {
  return request<Consultation[]>(`${LAB}/consultations?elderlyId=${q(String(elderlyId))}`, undefined, '상담일지를 불러오지 못했습니다');
}

export function listConsultationsByMonth(month: string): Promise<Consultation[]> {
  return request<Consultation[]>(`${LAB}/consultations?month=${q(month)}`, undefined, '월간 상담일지를 불러오지 못했습니다');
}

export function createConsultation(input: ConsultationInput): Promise<Consultation> {
  return request<Consultation>(`${LAB}/consultations`, json('POST', input), '상담일지를 저장하지 못했습니다');
}

export function updateConsultation(id: number, input: ConsultationInput): Promise<Consultation> {
  return request<Consultation>(`${LAB}/consultations/${q(String(id))}`, json('PUT', input), '상담일지를 수정하지 못했습니다');
}

export async function deleteConsultation(id: number): Promise<void> {
  await request<null>(`${LAB}/consultations/${q(String(id))}`, { method: 'DELETE' }, '상담일지를 삭제하지 못했습니다');
}

// ---------- 욕구사정·급여제공계획 ----------

const NEEDS_KEYS: ReadonlyArray<keyof CarePlanNeeds> = ['physical', 'cognition', 'nutrition', 'communication', 'family', 'other', 'disease', 'oral', 'subjective', 'resources', 'summary', 'avoidFoods'];

/** 11차 이전에 저장된 욕구사정에는 새 칸이 없다 — 받을 때 모든 칸을 글로 채운다(없거나 글이 아니면 ''). */
export function normalizeCarePlanNeeds(raw: unknown): CarePlanNeeds {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const out = {} as CarePlanNeeds;
  for (const key of NEEDS_KEYS) out[key] = typeof src[key] === 'string' ? (src[key] as string) : '';
  return out;
}

export function normalizeCarePlan(plan: CarePlan): CarePlan {
  return { ...plan, needs: normalizeCarePlanNeeds(plan.needs) };
}

export async function listCarePlans(year: number): Promise<CarePlan[]> {
  const plans = await request<CarePlan[]>(`${LAB}/care-plans?year=${q(String(year))}`, undefined, '급여제공계획을 불러오지 못했습니다');
  return Array.isArray(plans) ? plans.map(normalizeCarePlan) : plans;
}

/** 어르신 + 연도로 덮어쓴다(upsert) */
export async function saveCarePlan(input: CarePlanInput): Promise<CarePlan> {
  return normalizeCarePlan(await request<CarePlan>(`${LAB}/care-plans`, json('PUT', input), '급여제공계획을 저장하지 못했습니다'));
}

export async function deleteCarePlan(id: number): Promise<void> {
  await request<null>(`${LAB}/care-plans/${q(String(id))}`, { method: 'DELETE' }, '급여제공계획을 삭제하지 못했습니다');
}

// ---------- AI (어르신 이름은 보내지 않는다: 메모·관찰·증빙 글만, 그래도 적힌 이름은 redactDeep가 보내기 직전에 지운다) ----------

export function aiStructureCareNote(note: string): Promise<CareNoteStructured> {
  return request<CareNoteStructured>(`${LAB_AI}/care-record`, json('POST', redactDeep({ note })), 'AI가 메모를 정리하지 못했습니다. 잠시 후 다시 시도해 주세요');
}

export function aiSuggestRiskScores(kind: ScaleKind, observations: string): Promise<RiskSuggestion> {
  return request<RiskSuggestion>(`${LAB_AI}/risk`, json('POST', redactDeep({ kind, observations })), 'AI가 점수를 제안하지 못했습니다. 잠시 후 다시 시도해 주세요');
}

export function aiReviewEvalEvidence(input: EvalReviewInput): Promise<EvalReviewResult> {
  return request<EvalReviewResult>(`${LAB_AI}/eval-review`, json('POST', redactDeep(input)), 'AI가 증빙을 검토하지 못했습니다. 잠시 후 다시 시도해 주세요');
}

// ---------- 2차 AI 작업 — 직원이 고칠 수 있는 제안만 돌려준다. 이름은 보내지 않는다 ----------

const AI_RETRY = '잠시 후 다시 시도해 주세요';

export function aiSummarizeNursing(input: NursingSummaryInput): Promise<NursingSummaryResult> {
  return request<NursingSummaryResult>(`${LAB_AI}/nursing-summary`, json('POST', redactDeep(input)), `AI가 바이탈을 요약하지 못했습니다. ${AI_RETRY}`);
}

export function aiDraftProgramLog(input: ProgramLogAiInput): Promise<ProgramLogResult> {
  return request<ProgramLogResult>(`${LAB_AI}/program-log`, json('POST', redactDeep(input)), `AI가 프로그램 일지를 정리하지 못했습니다. ${AI_RETRY}`);
}

export function aiDraftTrainingLog(input: TrainingLogAiInput): Promise<TrainingLogResult> {
  return request<TrainingLogResult>(`${LAB_AI}/training-log`, json('POST', redactDeep(input)), `AI가 교육·회의 기록을 정리하지 못했습니다. ${AI_RETRY}`);
}

export function aiDraftConsultation(input: ConsultationAiInput): Promise<ConsultationResult> {
  return request<ConsultationResult>(`${LAB_AI}/consultation`, json('POST', redactDeep(input)), `AI가 상담 내용을 정리하지 못했습니다. ${AI_RETRY}`);
}

export function aiDraftCarePlan(input: CarePlanAiInput): Promise<CarePlanResult> {
  return request<CarePlanResult>(`${LAB_AI}/care-plan`, json('POST', redactDeep(input)), `AI가 급여제공계획 초안을 만들지 못했습니다. ${AI_RETRY}`);
}

// =====================================================================
// 3차
// =====================================================================

// ---------- 주간 식단표 ----------

/** 그 주(월요일 weekStart)의 식단표. 아직 안 만들었으면 서버가 404를 주므로 null로 돌려준다. */
export async function getMealPlan(weekStart: string): Promise<MealPlan | null> {
  // ?weekStart=로 물으면 아직 식단이 없는 주마다 404가 나고, 공용 요청 도우미가 그것을 오류로 기록한다.
  // 새 주를 여는 것은 정상 흐름이므로, 그 주가 걸친 달을 한 번에 받아 그 주를 찾는다(요청 수는 같다).
  const plans = await listMealPlans(weekStart.slice(0, 7));
  return plans.find((p) => p.weekStart === weekStart) ?? null;
}

/** 그 달에 걸친 주들의 식단표(월요일이 전달이어도 그 달 날짜가 있는 주 포함) */
export function listMealPlans(month: string): Promise<MealPlan[]> {
  return request<MealPlan[]>(`${LAB}/meal-plans?month=${q(month)}`, undefined, '월간 식단표를 불러오지 못했습니다');
}

/** 기관 + 주 시작일로 덮어쓴다(upsert). weekStart는 월요일이어야 한다. */
export function saveMealPlan(input: MealPlanInput): Promise<MealPlan> {
  return request<MealPlan>(`${LAB}/meal-plans`, json('PUT', input), '주간 식단표를 저장하지 못했습니다');
}

export async function deleteMealPlan(id: number): Promise<void> {
  await request<null>(`${LAB}/meal-plans/${q(String(id))}`, { method: 'DELETE' }, '주간 식단표를 삭제하지 못했습니다');
}

// ---------- 위생·안전·시설 점검 ----------

export function listSafetyChecks(month: string, kind?: SafetyKind): Promise<SafetyCheck[]> {
  const kindQuery = kind ? `&kind=${q(kind)}` : '';
  return request<SafetyCheck[]>(`${LAB}/safety-checks?month=${q(month)}${kindQuery}`, undefined, '점검 기록을 불러오지 못했습니다');
}

/** 그 해 점검 기록 — 재난훈련(연 2회) 현황용 */
export function listSafetyChecksByYear(year: number, kind: SafetyKind): Promise<SafetyCheck[]> {
  return request<SafetyCheck[]>(`${LAB}/safety-checks?year=${q(String(year))}&kind=${q(kind)}`, undefined, '연간 점검 기록을 불러오지 못했습니다');
}

/** 종류 + 점검일로 덮어쓴다(upsert) */
export function saveSafetyCheck(input: SafetyCheckInput): Promise<SafetyCheck> {
  return request<SafetyCheck>(`${LAB}/safety-checks`, json('PUT', input), '점검 기록을 저장하지 못했습니다');
}

export async function deleteSafetyCheck(id: number): Promise<void> {
  await request<null>(`${LAB}/safety-checks/${q(String(id))}`, { method: 'DELETE' }, '점검 기록을 삭제하지 못했습니다');
}

// ---------- 3차 AI 작업 — 제안만 돌려준다. 이번 묶음은 원래 개인정보가 없지만 2차처럼 보내기 직전에 이름을 지운다 ----------

export function aiDraftMealPlan(input: MealPlanAiInput): Promise<MealPlanResult> {
  return request<MealPlanResult>(`${LAB_AI}/meal-plan`, json('POST', redactDeep(input)), `AI가 식단 초안을 만들지 못했습니다. ${AI_RETRY}`);
}

export function aiDraftSafetyActions(input: SafetyActionsAiInput): Promise<SafetyActionsResult> {
  return request<SafetyActionsResult>(`${LAB_AI}/safety-actions`, json('POST', redactDeep(input)), `AI가 조치 계획을 만들지 못했습니다. ${AI_RETRY}`);
}

// =====================================================================
// 4차 — 직원 급여대장 · 회계 장부 · 후원금
// =====================================================================

// ---------- 직원 급여 기준 ----------

export function listPayrollProfiles(): Promise<PayrollProfile[]> {
  return request<PayrollProfile[]>(`${LAB}/payroll-profiles`, undefined, '직원 급여 기준을 불러오지 못했습니다');
}

/** memberId로 덮어쓴다(upsert) */
export function savePayrollProfile(input: PayrollProfileInput): Promise<PayrollProfile> {
  return request<PayrollProfile>(`${LAB}/payroll-profiles`, json('PUT', input), '직원 급여 기준을 저장하지 못했습니다');
}

export async function deletePayrollProfile(id: number): Promise<void> {
  await request<null>(`${LAB}/payroll-profiles/${q(String(id))}`, { method: 'DELETE' }, '직원 급여 기준을 삭제하지 못했습니다');
}

// ---------- 월 급여대장 ----------

export function listPayrollLines(month: string): Promise<PayrollLine[]> {
  return request<PayrollLine[]>(`${LAB}/payroll-lines?month=${q(month)}`, undefined, '월 급여대장을 불러오지 못했습니다');
}

/** 그 해 급여대장 전체 — 인건비 지출비율(연 단위)용 */
export function listPayrollLinesByYear(year: number): Promise<PayrollLine[]> {
  return request<PayrollLine[]>(`${LAB}/payroll-lines?year=${q(String(year))}`, undefined, '연간 급여대장을 불러오지 못했습니다');
}

/** memberId+payMonth로 덮어쓴다(upsert). 확정된 줄은 서버가 409를 준다. */
export function savePayrollLine(input: PayrollLineInput): Promise<PayrollLine> {
  return request<PayrollLine>(`${LAB}/payroll-lines`, json('PUT', input), '급여를 저장하지 못했습니다');
}

/** 그 달 초안(DRAFT) 줄을 모두 확정한다 */
export function confirmPayrollMonth(month: string): Promise<{ confirmed: number }> {
  return request<{ confirmed: number }>(`${LAB}/payroll-lines/confirm`, json('POST', { month }), '급여를 확정하지 못했습니다');
}

/** 그 달 확정(CONFIRMED) 줄을 모두 초안으로 되돌린다 */
export function unconfirmPayrollMonth(month: string): Promise<{ unconfirmed: number }> {
  return request<{ unconfirmed: number }>(`${LAB}/payroll-lines/unconfirm`, json('POST', { month }), '확정을 풀지 못했습니다');
}

/** 초안(DRAFT) 줄만 지운다. 확정된 줄은 서버가 409를 준다. */
export async function deletePayrollLine(id: number): Promise<void> {
  await request<null>(`${LAB}/payroll-lines/${q(String(id))}`, { method: 'DELETE' }, '급여 줄을 삭제하지 못했습니다');
}

// ---------- 현금출납부 ----------

export function listLedgerEntries(month: string): Promise<LedgerEntry[]> {
  return request<LedgerEntry[]>(`${LAB}/ledger?month=${q(month)}`, undefined, '현금출납부를 불러오지 못했습니다');
}

/** 그 해 장부 전체 — 연간 관·항·목 요약용 */
export function listLedgerEntriesByYear(year: number): Promise<LedgerEntry[]> {
  return request<LedgerEntry[]>(`${LAB}/ledger?year=${q(String(year))}`, undefined, '연간 장부를 불러오지 못했습니다');
}

export function createLedgerEntry(input: LedgerEntryInput): Promise<LedgerEntry> {
  return request<LedgerEntry>(`${LAB}/ledger`, json('POST', input), '장부에 기록하지 못했습니다');
}

export function updateLedgerEntry(id: number, input: LedgerEntryInput): Promise<LedgerEntry> {
  return request<LedgerEntry>(`${LAB}/ledger/${q(String(id))}`, json('PUT', input), '장부 기록을 고치지 못했습니다');
}

export async function deleteLedgerEntry(id: number): Promise<void> {
  await request<null>(`${LAB}/ledger/${q(String(id))}`, { method: 'DELETE' }, '장부 기록을 삭제하지 못했습니다');
}

// ---------- 후원금 ----------

/** 그 해 후원금(usedAmount = 연결된 지출 합, 서버 계산) */
export function listDonations(year: number): Promise<Donation[]> {
  return request<Donation[]>(`${LAB}/donations?year=${q(String(year))}`, undefined, '후원금을 불러오지 못했습니다');
}

export function createDonation(input: DonationInput): Promise<Donation> {
  return request<Donation>(`${LAB}/donations`, json('POST', input), '후원금을 기록하지 못했습니다');
}

export function updateDonation(id: number, input: DonationInput): Promise<Donation> {
  return request<Donation>(`${LAB}/donations/${q(String(id))}`, json('PUT', input), '후원금을 고치지 못했습니다');
}

/** 연결된 지출이 있으면 서버가 409를 준다 */
export async function deleteDonation(id: number): Promise<void> {
  await request<null>(`${LAB}/donations/${q(String(id))}`, { method: 'DELETE' }, '후원금을 삭제하지 못했습니다');
}

// ---------- 4차 AI 작업 — 계정 제안만 돌려준다. 내역 문구에 이름이 적혀 있으면 보내기 직전에 지운다 ----------

export function aiClassifyLedger(input: LedgerClassifyAiInput): Promise<LedgerClassifyResult> {
  return request<LedgerClassifyResult>(`${LAB_AI}/ledger-classify`, json('POST', redactDeep(input)), `AI가 계정을 제안하지 못했습니다. ${AI_RETRY}`);
}

// =====================================================================
// 5차 — 상태변화·사고 · 기능회복훈련 · 보호자 월간 안내 · 봉사·자원연계 · 예산·결산
// =====================================================================

// ---------- 상태변화·사고 ----------

/** 월별(최신순) · 어르신별 · 열린 것만 중 하나로 묻는다 */
export function listCareEvents(params: { month: string } | { elderlyId: number } | { status: CareEventStatus }): Promise<CareEvent[]> {
  const query =
    'month' in params ? `month=${q(params.month)}` : 'elderlyId' in params ? `elderlyId=${q(String(params.elderlyId))}` : `status=${q(params.status)}`;
  return request<CareEvent[]>(`${LAB}/care-events?${query}`, undefined, '상태변화·사고 기록을 불러오지 못했습니다');
}

export function createCareEvent(input: CareEventInput): Promise<CareEvent> {
  return request<CareEvent>(`${LAB}/care-events`, json('POST', input), '상태변화·사고 기록을 저장하지 못했습니다');
}

/** 닫을 때 후속 조치·보호자 연락이 없으면 서버가 400을 준다 */
export function updateCareEvent(id: number, input: CareEventInput): Promise<CareEvent> {
  return request<CareEvent>(`${LAB}/care-events/${q(String(id))}`, json('PUT', input), '상태변화·사고 기록을 고치지 못했습니다');
}

export async function deleteCareEvent(id: number): Promise<void> {
  await request<null>(`${LAB}/care-events/${q(String(id))}`, { method: 'DELETE' }, '상태변화·사고 기록을 삭제하지 못했습니다');
}

// ---------- 기능회복훈련 ----------

/** 날짜별 · 월별 · 어르신의 월별 중 하나로 묻는다 */
export function listRehabSessions(params: { date: string } | { month: string } | { elderlyId: number; month: string }): Promise<RehabSession[]> {
  const query =
    'date' in params ? `date=${q(params.date)}` : 'elderlyId' in params ? `elderlyId=${q(String(params.elderlyId))}&month=${q(params.month)}` : `month=${q(params.month)}`;
  return request<RehabSession[]>(`${LAB}/rehab-sessions?${query}`, undefined, '기능회복훈련 기록을 불러오지 못했습니다');
}

export function createRehabSession(input: RehabSessionInput): Promise<RehabSession> {
  return request<RehabSession>(`${LAB}/rehab-sessions`, json('POST', input), '기능회복훈련을 기록하지 못했습니다');
}

/** 하나라도 같은 기관 어르신이 아니면 서버는 아무것도 저장하지 않는다 */
export function createRehabSessionsBatch(input: RehabSessionBatchInput): Promise<RehabSession[]> {
  return request<RehabSession[]>(`${LAB}/rehab-sessions/batch`, json('POST', input), '기능회복훈련을 한 번에 기록하지 못했습니다');
}

export function updateRehabSession(id: number, input: RehabSessionInput): Promise<RehabSession> {
  return request<RehabSession>(`${LAB}/rehab-sessions/${q(String(id))}`, json('PUT', input), '기능회복훈련 기록을 고치지 못했습니다');
}

export async function deleteRehabSession(id: number): Promise<void> {
  await request<null>(`${LAB}/rehab-sessions/${q(String(id))}`, { method: 'DELETE' }, '기능회복훈련 기록을 삭제하지 못했습니다');
}

// ---------- 보호자 월간 안내 ----------

export function listGuardianNotices(month: string): Promise<GuardianNotice[]> {
  return request<GuardianNotice[]>(`${LAB}/guardian-notices?month=${q(month)}`, undefined, '보호자 안내를 불러오지 못했습니다');
}

/** elderlyId+noticeMonth로 덮어쓴다(upsert). 이미 보낸 안내면 서버가 409를 준다. */
export function saveGuardianNotice(input: GuardianNoticeInput): Promise<GuardianNotice> {
  return request<GuardianNotice>(`${LAB}/guardian-notices`, json('PUT', input), '보호자 안내를 저장하지 못했습니다');
}

export function markGuardianNoticeSent(id: number, input: GuardianNoticeSentInput): Promise<GuardianNotice> {
  return request<GuardianNotice>(`${LAB}/guardian-notices/${q(String(id))}/sent`, json('POST', input), '보냄으로 표시하지 못했습니다');
}

export function markGuardianNoticeUnsent(id: number): Promise<GuardianNotice> {
  return request<GuardianNotice>(`${LAB}/guardian-notices/${q(String(id))}/unsent`, { method: 'POST' }, '보냄 표시를 풀지 못했습니다');
}

export async function deleteGuardianNotice(id: number): Promise<void> {
  await request<null>(`${LAB}/guardian-notices/${q(String(id))}`, { method: 'DELETE' }, '보호자 안내를 삭제하지 못했습니다');
}

// ---------- 봉사자 활동 ----------

export function listVolunteerLogs(params: { month: string } | { year: number }): Promise<VolunteerLog[]> {
  const query = 'month' in params ? `month=${q(params.month)}` : `year=${q(String(params.year))}`;
  return request<VolunteerLog[]>(`${LAB}/volunteer-logs?${query}`, undefined, '봉사자 일지를 불러오지 못했습니다');
}

export function createVolunteerLog(input: VolunteerLogInput): Promise<VolunteerLog> {
  return request<VolunteerLog>(`${LAB}/volunteer-logs`, json('POST', input), '봉사자 일지를 기록하지 못했습니다');
}

export function updateVolunteerLog(id: number, input: VolunteerLogInput): Promise<VolunteerLog> {
  return request<VolunteerLog>(`${LAB}/volunteer-logs/${q(String(id))}`, json('PUT', input), '봉사자 일지를 고치지 못했습니다');
}

export async function deleteVolunteerLog(id: number): Promise<void> {
  await request<null>(`${LAB}/volunteer-logs/${q(String(id))}`, { method: 'DELETE' }, '봉사자 일지를 삭제하지 못했습니다');
}

// ---------- 외부기관·지역자원 연계 ----------

export function listResourceLinks(params: { year: number } | { elderlyId: number }): Promise<ResourceLink[]> {
  const query = 'year' in params ? `year=${q(String(params.year))}` : `elderlyId=${q(String(params.elderlyId))}`;
  return request<ResourceLink[]>(`${LAB}/resource-links?${query}`, undefined, '자원연계 기록을 불러오지 못했습니다');
}

export function createResourceLink(input: ResourceLinkInput): Promise<ResourceLink> {
  return request<ResourceLink>(`${LAB}/resource-links`, json('POST', input), '자원연계를 기록하지 못했습니다');
}

export function updateResourceLink(id: number, input: ResourceLinkInput): Promise<ResourceLink> {
  return request<ResourceLink>(`${LAB}/resource-links/${q(String(id))}`, json('PUT', input), '자원연계 기록을 고치지 못했습니다');
}

export async function deleteResourceLink(id: number): Promise<void> {
  await request<null>(`${LAB}/resource-links/${q(String(id))}`, { method: 'DELETE' }, '자원연계 기록을 삭제하지 못했습니다');
}

// ---------- 예산(본예산·추경) ----------

/** 그 해 예산 전체(차수 순, 줄 포함) */
export function listBudgets(year: number): Promise<Budget[]> {
  return request<Budget[]>(`${LAB}/budgets?year=${q(String(year))}`, undefined, '예산을 불러오지 못했습니다');
}

/** fiscalYear+revision으로 덮어쓰고 줄은 통째로 바꾼다. 확정된 예산이면 서버가 409를 준다. */
export function saveBudget(input: BudgetInput): Promise<Budget> {
  return request<Budget>(`${LAB}/budgets`, json('PUT', input), '예산을 저장하지 못했습니다');
}

export function confirmBudget(id: number): Promise<Budget> {
  return request<Budget>(`${LAB}/budgets/${q(String(id))}/confirm`, { method: 'POST' }, '예산을 확정하지 못했습니다');
}

export function unconfirmBudget(id: number): Promise<Budget> {
  return request<Budget>(`${LAB}/budgets/${q(String(id))}/unconfirm`, { method: 'POST' }, '예산 확정을 풀지 못했습니다');
}

/** 초안만 지운다. 뒤 차수가 있으면 서버가 409를 준다. */
export async function deleteBudget(id: number): Promise<void> {
  await request<null>(`${LAB}/budgets/${q(String(id))}`, { method: 'DELETE' }, '예산을 삭제하지 못했습니다');
}

// ---------- 5차 AI 작업 — 제안만 돌려준다. 보내기 직전에 이름을 지운다 ----------

export function aiStructureCareEvent(input: CareEventAiInput): Promise<CareEventAiResult> {
  return request<CareEventAiResult>(`${LAB_AI}/care-event`, json('POST', redactDeep(input)), `AI가 사고 기록을 정리하지 못했습니다. ${AI_RETRY}`);
}

export function aiStructureRehabLog(input: RehabLogAiInput): Promise<RehabLogAiResult> {
  return request<RehabLogAiResult>(`${LAB_AI}/rehab-log`, json('POST', redactDeep(input)), `AI가 훈련 기록을 정리하지 못했습니다. ${AI_RETRY}`);
}

export function aiDraftGuardianNotice(input: GuardianNoticeAiInput): Promise<GuardianNoticeAiResult> {
  return request<GuardianNoticeAiResult>(`${LAB_AI}/guardian-notice`, json('POST', redactDeep(input)), `AI가 안내 초안을 만들지 못했습니다. ${AI_RETRY}`);
}

export function aiSuggestResources(input: ResourceSuggestAiInput): Promise<ResourceSuggestAiResult> {
  return request<ResourceSuggestAiResult>(`${LAB_AI}/resource-suggest`, json('POST', redactDeep(input)), `AI가 자원 종류를 제안하지 못했습니다. ${AI_RETRY}`);
}

export function aiDraftBudget(input: BudgetDraftAiInput): Promise<BudgetDraftAiResult> {
  return request<BudgetDraftAiResult>(`${LAB_AI}/budget-draft`, json('POST', redactDeep(input)), `AI가 예산 초안을 만들지 못했습니다. ${AI_RETRY}`);
}

// =====================================================================
// 6차 — 투약·약품 · 목욕 제공 일지 · 수급자 계약·인정 · 퇴소 연계기록지 · 공단 청구 대조
// =====================================================================

// ---------- 투약의뢰서 ----------

/** 진행 중/끝난 의뢰(status) 또는 어르신별(elderlyId) 중 하나로 묻는다. 시작일 최신순. */
export function listMedicationRequests(params: { status: MedicationRequestStatus } | { elderlyId: number }): Promise<MedicationRequest[]> {
  const query = 'status' in params ? `status=${q(params.status)}` : `elderlyId=${q(String(params.elderlyId))}`;
  return request<MedicationRequest[]>(`${LAB}/medication-requests?${query}`, undefined, '투약의뢰서를 불러오지 못했습니다');
}

export function createMedicationRequest(input: MedicationRequestInput): Promise<MedicationRequest> {
  return request<MedicationRequest>(`${LAB}/medication-requests`, json('POST', input), '투약의뢰서를 저장하지 못했습니다');
}

export function updateMedicationRequest(id: number, input: MedicationRequestInput): Promise<MedicationRequest> {
  return request<MedicationRequest>(`${LAB}/medication-requests/${q(String(id))}`, json('PUT', input), '투약의뢰서를 고치지 못했습니다');
}

/** 투약 기록이 있는 의뢰서는 서버가 409를 준다(끝내기로 처리) */
export async function deleteMedicationRequest(id: number): Promise<void> {
  await request<null>(`${LAB}/medication-requests/${q(String(id))}`, { method: 'DELETE' }, '투약의뢰서를 삭제하지 못했습니다');
}

// ---------- 투약 기록 ----------

/** 날짜별 또는 어르신의 월별 */
export function listMedicationDoses(params: { date: string } | { elderlyId: number; month: string }): Promise<MedicationDose[]> {
  const query = 'date' in params ? `date=${q(params.date)}` : `elderlyId=${q(String(params.elderlyId))}&month=${q(params.month)}`;
  return request<MedicationDose[]>(`${LAB}/medication-doses?${query}`, undefined, '투약 기록을 불러오지 못했습니다');
}

/** requestId+givenOn+slot으로 덮어쓴다(upsert). 의뢰 기간 밖 날짜·의뢰에 없는 시간대·미래 날짜는 서버가 400을 준다. */
export function saveMedicationDose(input: MedicationDoseInput): Promise<MedicationDose> {
  return request<MedicationDose>(`${LAB}/medication-doses`, json('PUT', input), '투약 기록을 저장하지 못했습니다');
}

export async function deleteMedicationDose(id: number): Promise<void> {
  await request<null>(`${LAB}/medication-doses/${q(String(id))}`, { method: 'DELETE' }, '투약 기록을 삭제하지 못했습니다');
}

// ---------- 약품 관리대장 ----------

/** 사용기한 순. 폐기한 약은 includeDisposed=true일 때만 */
export function listMedicineStock(includeDisposed = false): Promise<MedicineStock[]> {
  return request<MedicineStock[]>(`${LAB}/medicine-stock?includeDisposed=${includeDisposed ? 'true' : 'false'}`, undefined, '약품 관리대장을 불러오지 못했습니다');
}

export function createMedicineStock(input: MedicineStockInput): Promise<MedicineStock> {
  return request<MedicineStock>(`${LAB}/medicine-stock`, json('POST', input), '약품을 등록하지 못했습니다');
}

export function updateMedicineStock(id: number, input: MedicineStockInput): Promise<MedicineStock> {
  return request<MedicineStock>(`${LAB}/medicine-stock/${q(String(id))}`, json('PUT', input), '약품 정보를 고치지 못했습니다');
}

export async function deleteMedicineStock(id: number): Promise<void> {
  await request<null>(`${LAB}/medicine-stock/${q(String(id))}`, { method: 'DELETE' }, '약품을 삭제하지 못했습니다');
}

// ---------- 약품 보관 점검 ----------

export function listMedicineChecks(year: number): Promise<MedicineCheck[]> {
  return request<MedicineCheck[]>(`${LAB}/medicine-checks?year=${q(String(year))}`, undefined, '약품 보관 점검을 불러오지 못했습니다');
}

/** checkedOn으로 덮어쓴다(upsert). 폐기(DISPOSE)로 표시한 약품은 서버가 폐기일을 점검일로 채운다. */
export function saveMedicineCheck(input: MedicineCheckInput): Promise<MedicineCheck> {
  return request<MedicineCheck>(`${LAB}/medicine-checks`, json('PUT', input), '약품 보관 점검을 저장하지 못했습니다');
}

export async function deleteMedicineCheck(id: number): Promise<void> {
  await request<null>(`${LAB}/medicine-checks/${q(String(id))}`, { method: 'DELETE' }, '약품 보관 점검을 삭제하지 못했습니다');
}

// ---------- 목욕 제공 일지 ----------

/** 월별 또는 어르신의 월별(날짜순) */
export function listBathLogs(params: { month: string } | { elderlyId: number; month: string }): Promise<BathLog[]> {
  const query = 'elderlyId' in params ? `elderlyId=${q(String(params.elderlyId))}&month=${q(params.month)}` : `month=${q(params.month)}`;
  return request<BathLog[]>(`${LAB}/bath-logs?${query}`, undefined, '목욕 일지를 불러오지 못했습니다');
}

/** 끝 시각이 시작보다 늦지 않거나 180분을 넘으면 서버가 400을 준다 */
export function createBathLog(input: BathLogInput): Promise<BathLog> {
  return request<BathLog>(`${LAB}/bath-logs`, json('POST', input), '목욕 일지를 저장하지 못했습니다');
}

export function updateBathLog(id: number, input: BathLogInput): Promise<BathLog> {
  return request<BathLog>(`${LAB}/bath-logs/${q(String(id))}`, json('PUT', input), '목욕 일지를 고치지 못했습니다');
}

export async function deleteBathLog(id: number): Promise<void> {
  await request<null>(`${LAB}/bath-logs/${q(String(id))}`, { method: 'DELETE' }, '목욕 일지를 삭제하지 못했습니다');
}

// ---------- 수급자 계약·인정 ----------

/** 진행 중(status=ACTIVE)·어르신별(elderlyId) 중 하나로 묻고, 아무것도 안 주면 전부 */
export function listElderContracts(params?: { status: ContractStatus } | { elderlyId: number }): Promise<ElderContract[]> {
  const query = !params ? '' : 'status' in params ? `?status=${q(params.status)}` : `?elderlyId=${q(String(params.elderlyId))}`;
  return request<ElderContract[]>(`${LAB}/elder-contracts${query}`, undefined, '계약 정보를 불러오지 못했습니다');
}

/** 같은 어르신의 진행 중 계약이 이미 있으면 서버가 409를 준다 */
export function createElderContract(input: ElderContractInput): Promise<ElderContract> {
  return request<ElderContract>(`${LAB}/elder-contracts`, json('POST', input), '계약 정보를 저장하지 못했습니다');
}

export function updateElderContract(id: number, input: ElderContractInput): Promise<ElderContract> {
  return request<ElderContract>(`${LAB}/elder-contracts/${q(String(id))}`, json('PUT', input), '계약 정보를 고치지 못했습니다');
}

export async function deleteElderContract(id: number): Promise<void> {
  await request<null>(`${LAB}/elder-contracts/${q(String(id))}`, { method: 'DELETE' }, '계약 정보를 삭제하지 못했습니다');
}

// ---------- 퇴소 연계기록지 ----------

/** 퇴소 연도별 또는 어르신별 */
export function listDischargeReferrals(params: { year: number } | { elderlyId: number }): Promise<DischargeReferral[]> {
  const query = 'year' in params ? `year=${q(String(params.year))}` : `elderlyId=${q(String(params.elderlyId))}`;
  return request<DischargeReferral[]>(`${LAB}/discharge-referrals?${query}`, undefined, '퇴소 연계기록지를 불러오지 못했습니다');
}

/** 제공대장 네 칸을 일부만 적으면 서버가 400을 준다 */
export function createDischargeReferral(input: DischargeReferralInput): Promise<DischargeReferral> {
  return request<DischargeReferral>(`${LAB}/discharge-referrals`, json('POST', input), '퇴소 연계기록지를 저장하지 못했습니다');
}

export function updateDischargeReferral(id: number, input: DischargeReferralInput): Promise<DischargeReferral> {
  return request<DischargeReferral>(`${LAB}/discharge-referrals/${q(String(id))}`, json('PUT', input), '퇴소 연계기록지를 고치지 못했습니다');
}

export async function deleteDischargeReferral(id: number): Promise<void> {
  await request<null>(`${LAB}/discharge-referrals/${q(String(id))}`, { method: 'DELETE' }, '퇴소 연계기록지를 삭제하지 못했습니다');
}

// ---------- 공단 청구 대조 ----------

export function listClaimReviews(month: string): Promise<ClaimReview[]> {
  return request<ClaimReview[]>(`${LAB}/claim-reviews?month=${q(month)}`, undefined, '청구 대조 결과를 불러오지 못했습니다');
}

/** elderlyId+claimMonth로 덮어쓴다(upsert) */
export function saveClaimReview(input: ClaimReviewInput): Promise<ClaimReview> {
  return request<ClaimReview>(`${LAB}/claim-reviews`, json('PUT', input), '청구 대조 결과를 저장하지 못했습니다');
}

/** 최대 200줄. 하나라도 틀리면 서버는 아무것도 저장하지 않는다 */
export function saveClaimReviewsBatch(input: ClaimReviewBatchInput): Promise<ClaimReview[]> {
  return request<ClaimReview[]>(`${LAB}/claim-reviews/batch`, json('PUT', input), '청구 대조 결과를 한 번에 저장하지 못했습니다');
}

export async function deleteClaimReview(id: number): Promise<void> {
  await request<null>(`${LAB}/claim-reviews/${q(String(id))}`, { method: 'DELETE' }, '청구 대조 결과를 삭제하지 못했습니다');
}

// ---------- 6차 AI 작업 — 제안만 돌려준다. 보내기 직전에 이름을 지운다 ----------

export function aiStructureMedicationRequest(input: MedicationRequestAiInput): Promise<MedicationRequestAiResult> {
  return request<MedicationRequestAiResult>(`${LAB_AI}/medication-request`, json('POST', redactDeep(input)), `AI가 약 목록을 정리하지 못했습니다. ${AI_RETRY}`);
}

export function aiDraftDischargeReferral(input: DischargeReferralAiInput): Promise<DischargeReferralAiResult> {
  return request<DischargeReferralAiResult>(`${LAB_AI}/discharge-referral`, json('POST', redactDeep(input)), `AI가 연계기록지 초안을 만들지 못했습니다. ${AI_RETRY}`);
}

export function aiStructureBathNote(input: BathNoteAiInput): Promise<BathNoteAiResult> {
  return request<BathNoteAiResult>(`${LAB_AI}/bath-note`, json('POST', redactDeep(input)), `AI가 목욕 메모를 정리하지 못했습니다. ${AI_RETRY}`);
}

// ---------- 프로그램 연간계획 ----------

export function listProgramPlans(year: number): Promise<ProgramPlan[]> {
  return request<ProgramPlan[]>(`${LAB}/program-plans?year=${q(String(year))}`, undefined, '프로그램 연간계획을 불러오지 못했습니다');
}

/** planYear+category로 덮어쓴다(upsert) */
export function saveProgramPlan(input: ProgramPlanInput): Promise<ProgramPlan> {
  return request<ProgramPlan>(`${LAB}/program-plans`, json('PUT', input), '프로그램 연간계획을 저장하지 못했습니다');
}

export async function deleteProgramPlan(id: number): Promise<void> {
  await request<null>(`${LAB}/program-plans/${q(String(id))}`, { method: 'DELETE' }, '프로그램 연간계획을 삭제하지 못했습니다');
}

// ---------- 월간 프로그램 계획표 ----------

/** 그 달의 계획표. 아직 만들지 않았으면 null. */
export async function getProgramSchedule(month: string): Promise<ProgramSchedule | null> {
  // ?month=로 물으면 아직 계획표가 없는 달마다 404가 나고, 공용 요청 도우미가 그것을 오류로 기록한다(식단표와 같은 이유).
  // 그 해 목록을 받아 그 달을 찾는다.
  const list = await listProgramSchedules(Number(month.slice(0, 4)));
  return list.find((x) => x.scheduleMonth === month) ?? null;
}

/** 그 해 열두 달의 계획표(만든 달만) */
export function listProgramSchedules(year: number): Promise<ProgramSchedule[]> {
  return request<ProgramSchedule[]>(`${LAB}/program-schedules?year=${q(String(year))}`, undefined, '월간 프로그램 계획표를 불러오지 못했습니다');
}

/** scheduleMonth로 덮어쓴다(upsert). 그 달 밖 날짜·허용 밖 분류가 있으면 서버가 400을 준다 */
export function saveProgramSchedule(input: ProgramScheduleInput): Promise<ProgramSchedule> {
  return request<ProgramSchedule>(`${LAB}/program-schedules`, json('PUT', input), '월간 프로그램 계획표를 저장하지 못했습니다');
}

export async function deleteProgramSchedule(id: number): Promise<void> {
  await request<null>(`${LAB}/program-schedules/${q(String(id))}`, { method: 'DELETE' }, '월간 프로그램 계획표를 삭제하지 못했습니다');
}

// ---------- 프로그램 의견수렴·반영 ----------

export function listProgramFeedback(year: number): Promise<ProgramFeedback[]> {
  return request<ProgramFeedback[]>(`${LAB}/program-feedback?year=${q(String(year))}`, undefined, '프로그램 의견수렴 기록을 불러오지 못했습니다');
}

export function createProgramFeedback(input: ProgramFeedbackInput): Promise<ProgramFeedback> {
  return request<ProgramFeedback>(`${LAB}/program-feedback`, json('POST', input), '프로그램 의견수렴 기록을 저장하지 못했습니다');
}

export function updateProgramFeedback(id: number, input: ProgramFeedbackInput): Promise<ProgramFeedback> {
  return request<ProgramFeedback>(`${LAB}/program-feedback/${q(String(id))}`, json('PUT', input), '프로그램 의견수렴 기록을 고치지 못했습니다');
}

export async function deleteProgramFeedback(id: number): Promise<void> {
  await request<null>(`${LAB}/program-feedback/${q(String(id))}`, { method: 'DELETE' }, '프로그램 의견수렴 기록을 삭제하지 못했습니다');
}

// ---------- 사업계획 ----------

/** 그 해 사업계획서. 아직 없으면 서버가 404를 주므로 null로 돌려준다. */
export async function getBusinessPlan(year: number): Promise<BusinessPlan | null> {
  try {
    return await request<BusinessPlan>(`${LAB}/business-plans?year=${q(String(year))}`, undefined, '사업계획서를 불러오지 못했습니다');
  } catch (error) {
    if (error instanceof LabApiError && error.status === 404) return null;
    throw error;
  }
}

/** planYear로 덮어쓴다(upsert) */
export function saveBusinessPlan(input: BusinessPlanInput): Promise<BusinessPlan> {
  return request<BusinessPlan>(`${LAB}/business-plans`, json('PUT', input), '사업계획서를 저장하지 못했습니다');
}

export async function deleteBusinessPlan(id: number): Promise<void> {
  await request<null>(`${LAB}/business-plans/${q(String(id))}`, { method: 'DELETE' }, '사업계획서를 삭제하지 못했습니다');
}

// ---------- 급여 만족도 ----------

/** from·to는 'YYYY-MM-DD'(필수, 최대 1년). kind를 빼면 모든 종류 */
export function listSatisfaction(params: { kind?: SatisfactionKind; from: string; to: string }): Promise<SatisfactionResponse[]> {
  const kind = params.kind ? `kind=${q(params.kind)}&` : '';
  return request<SatisfactionResponse[]>(`${LAB}/satisfaction?${kind}from=${q(params.from)}&to=${q(params.to)}`, undefined, '만족도 응답을 불러오지 못했습니다');
}

/** 미래 날짜는 서버가 400을 준다 */
export function createSatisfaction(input: SatisfactionResponseInput): Promise<SatisfactionResponse> {
  return request<SatisfactionResponse>(`${LAB}/satisfaction`, json('POST', input), '만족도 응답을 저장하지 못했습니다');
}

export function updateSatisfaction(id: number, input: SatisfactionResponseInput): Promise<SatisfactionResponse> {
  return request<SatisfactionResponse>(`${LAB}/satisfaction/${q(String(id))}`, json('PUT', input), '만족도 응답을 고치지 못했습니다');
}

export async function deleteSatisfaction(id: number): Promise<void> {
  await request<null>(`${LAB}/satisfaction/${q(String(id))}`, { method: 'DELETE' }, '만족도 응답을 삭제하지 못했습니다');
}

// ---------- 입소 상담·대기 ----------

/** status를 빼면 전부(문의일 최신순) */
export function listIntake(status?: IntakeStatus): Promise<IntakeInquiry[]> {
  return request<IntakeInquiry[]>(`${LAB}/intake${status ? `?status=${q(status)}` : ''}`, undefined, '입소 상담 기록을 불러오지 못했습니다');
}

/** 연락처를 적었는데 동의일이 없으면 서버가 400을, 계약 완료(CONTRACTED)인데 어르신이 없으면 400을 준다 */
export function createIntake(input: IntakeInquiryInput): Promise<IntakeInquiry> {
  return request<IntakeInquiry>(`${LAB}/intake`, json('POST', input), '입소 상담을 저장하지 못했습니다');
}

export function updateIntake(id: number, input: IntakeInquiryInput): Promise<IntakeInquiry> {
  return request<IntakeInquiry>(`${LAB}/intake/${q(String(id))}`, json('PUT', input), '입소 상담을 고치지 못했습니다');
}

export async function deleteIntake(id: number): Promise<void> {
  await request<null>(`${LAB}/intake/${q(String(id))}`, { method: 'DELETE' }, '입소 상담을 삭제하지 못했습니다');
}

// ---------- 7차 AI 작업 — 제안만 돌려준다. 보내기 직전에 이름을 지운다 ----------

export function aiDraftProgramSchedule(input: ProgramScheduleAiInput): Promise<ProgramScheduleAiResult> {
  return request<ProgramScheduleAiResult>(`${LAB_AI}/program-schedule`, json('POST', redactDeep(input)), `AI가 계획표 초안을 만들지 못했습니다. ${AI_RETRY}`);
}

export function aiDraftBusinessPlan(input: BusinessPlanAiInput): Promise<BusinessPlanAiResult> {
  return request<BusinessPlanAiResult>(`${LAB_AI}/business-plan`, json('POST', redactDeep(input)), `AI가 사업계획 초안을 만들지 못했습니다. ${AI_RETRY}`);
}

export function aiSummarizeSurvey(input: SurveySummaryAiInput): Promise<SurveySummaryAiResult> {
  return request<SurveySummaryAiResult>(`${LAB_AI}/survey-summary`, json('POST', redactDeep(input)), `AI가 의견을 요약하지 못했습니다. ${AI_RETRY}`);
}

/**
 * 상담 메모 정리. names(신청 어르신·문의자 이름)는 알려진 이름으로 기억한 뒤 메모에서 지운다 — 이름은 서버로 보내지 않는다.
 */
export function aiStructureIntakeNote(note: string, names: ReadonlyArray<string | null | undefined> = []): Promise<IntakeNoteAiResult> {
  rememberElderNames(names.filter((n): n is string => typeof n === 'string'));
  return request<IntakeNoteAiResult>(`${LAB_AI}/intake-note`, json('POST', redactDeep({ note })), `AI가 상담 메모를 정리하지 못했습니다. ${AI_RETRY}`);
}

// ---------- 8차: 월 인력배치 점검 ----------

/** 그 달 인력배치 점검. 아직 저장하지 않았으면 null. */
export async function getStaffingMonth(month: string): Promise<StaffingMonth | null> {
  // 지난달·새 달처럼 기록이 없는 달을 여는 것은 정상 흐름이다 — ?month=의 404가 오류로 기록되지 않게 그 해 목록에서 찾는다.
  const list = await listStaffingMonths(Number(month.slice(0, 4)));
  return list.find((x) => x.staffingMonth === month) ?? null;
}

/** 그 해 저장한 달들의 인력배치 점검 */
export function listStaffingMonths(year: number): Promise<StaffingMonth[]> {
  return request<StaffingMonth[]>(`${LAB}/staffing?year=${q(String(year))}`, undefined, '인력배치 점검 목록을 불러오지 못했습니다');
}

/** staffingMonth로 덮어쓴다(upsert) */
export function saveStaffingMonth(input: StaffingMonthInput): Promise<StaffingMonth> {
  return request<StaffingMonth>(`${LAB}/staffing`, json('PUT', input), '인력배치 점검을 저장하지 못했습니다');
}

export async function deleteStaffingMonth(id: number): Promise<void> {
  await request<null>(`${LAB}/staffing/${q(String(id))}`, { method: 'DELETE' }, '인력배치 점검을 삭제하지 못했습니다');
}

// ---------- 수급자 서류함 ----------

/** elderlyId를 빼면 기관 전체 */
export function listElderDocuments(elderlyId?: number): Promise<ElderDocument[]> {
  return request<ElderDocument[]>(`${LAB}/elder-documents${elderlyId === undefined ? '' : `?elderlyId=${q(String(elderlyId))}`}`, undefined, '수급자 서류 목록을 불러오지 못했습니다');
}

/** 만료일이 발급일보다 앞이면 서버가 400을 준다 */
export function createElderDocument(input: ElderDocumentInput): Promise<ElderDocument> {
  return request<ElderDocument>(`${LAB}/elder-documents`, json('POST', input), '서류 기록을 저장하지 못했습니다');
}

export function updateElderDocument(id: number, input: ElderDocumentInput): Promise<ElderDocument> {
  return request<ElderDocument>(`${LAB}/elder-documents/${q(String(id))}`, json('PUT', input), '서류 기록을 고치지 못했습니다');
}

export async function deleteElderDocument(id: number): Promise<void> {
  await request<null>(`${LAB}/elder-documents/${q(String(id))}`, { method: 'DELETE' }, '서류 기록을 삭제하지 못했습니다');
}

// ---------- 진료 동행 기록 ----------

/** 조건은 하나만 쓴다 — month('YYYY-MM') · elderlyId · followUpDue(후속 확인일이 오늘 이전이고 확인 전). 모두 빼면 전부. 진료일 최신순 */
export function listMedicalVisits(params: { month?: string; elderlyId?: number; followUpDue?: boolean } = {}): Promise<MedicalVisit[]> {
  const parts: string[] = [];
  if (params.month) parts.push(`month=${q(params.month)}`);
  if (params.elderlyId !== undefined) parts.push(`elderlyId=${q(String(params.elderlyId))}`);
  if (params.followUpDue) parts.push('followUpDue=true');
  return request<MedicalVisit[]>(`${LAB}/medical-visits${parts.length > 0 ? `?${parts.join('&')}` : ''}`, undefined, '진료 동행 기록을 불러오지 못했습니다');
}

/** 진료일이 400일 넘게 미래이거나 끝 시각이 시작보다 앞이면 서버가 400을 준다 */
export function createMedicalVisit(input: MedicalVisitInput): Promise<MedicalVisit> {
  return request<MedicalVisit>(`${LAB}/medical-visits`, json('POST', input), '진료 동행 기록을 저장하지 못했습니다');
}

export function updateMedicalVisit(id: number, input: MedicalVisitInput): Promise<MedicalVisit> {
  return request<MedicalVisit>(`${LAB}/medical-visits/${q(String(id))}`, json('PUT', input), '진료 동행 기록을 고치지 못했습니다');
}

export async function deleteMedicalVisit(id: number): Promise<void> {
  await request<null>(`${LAB}/medical-visits/${q(String(id))}`, { method: 'DELETE' }, '진료 동행 기록을 삭제하지 못했습니다');
}

// ---------- 운영위원 ----------

export function listCommitteeMembers(): Promise<CommitteeMember[]> {
  return request<CommitteeMember[]>(`${LAB}/committee-members`, undefined, '운영위원 명단을 불러오지 못했습니다');
}

/** 임기가 시작일 + 3년을 넘으면 서버가 400을 준다 */
export function createCommitteeMember(input: CommitteeMemberInput): Promise<CommitteeMember> {
  return request<CommitteeMember>(`${LAB}/committee-members`, json('POST', input), '운영위원을 저장하지 못했습니다');
}

export function updateCommitteeMember(id: number, input: CommitteeMemberInput): Promise<CommitteeMember> {
  return request<CommitteeMember>(`${LAB}/committee-members/${q(String(id))}`, json('PUT', input), '운영위원을 고치지 못했습니다');
}

export async function deleteCommitteeMember(id: number): Promise<void> {
  await request<null>(`${LAB}/committee-members/${q(String(id))}`, { method: 'DELETE' }, '운영위원을 삭제하지 못했습니다');
}

// ---------- 운영위원회 회의 ----------

/** 그 해 회의(attendeeNames는 서버가 채운다) */
export function listCommitteeMeetings(year: number): Promise<CommitteeMeeting[]> {
  return request<CommitteeMeeting[]>(`${LAB}/committee-meetings?year=${q(String(year))}`, undefined, '운영위원회 회의 기록을 불러오지 못했습니다');
}

/** 참석자가 다른 기관 위원이면 서버가 400을 준다 */
export function createCommitteeMeeting(input: CommitteeMeetingInput): Promise<CommitteeMeeting> {
  return request<CommitteeMeeting>(`${LAB}/committee-meetings`, json('POST', input), '회의 기록을 저장하지 못했습니다');
}

export function updateCommitteeMeeting(id: number, input: CommitteeMeetingInput): Promise<CommitteeMeeting> {
  return request<CommitteeMeeting>(`${LAB}/committee-meetings/${q(String(id))}`, json('PUT', input), '회의 기록을 고치지 못했습니다');
}

export async function deleteCommitteeMeeting(id: number): Promise<void> {
  await request<null>(`${LAB}/committee-meetings/${q(String(id))}`, { method: 'DELETE' }, '회의 기록을 삭제하지 못했습니다');
}

// ---------- 직원 인사 기준 ----------

export function listStaffProfiles(): Promise<StaffProfile[]> {
  return request<StaffProfile[]>(`${LAB}/staff-profiles`, undefined, '직원 인사 기준을 불러오지 못했습니다');
}

/** memberId마다 하나(upsert). 입사일이 400일 넘게 미래이거나 출생연도가 1930~2010 밖이면 서버가 400을 준다 */
export function saveStaffProfile(input: StaffProfileInput): Promise<StaffProfile> {
  return request<StaffProfile>(`${LAB}/staff-profiles`, json('PUT', input), '직원 인사 기준을 저장하지 못했습니다');
}

export async function deleteStaffProfile(id: number): Promise<void> {
  await request<null>(`${LAB}/staff-profiles/${q(String(id))}`, { method: 'DELETE' }, '직원 인사 기준을 삭제하지 못했습니다');
}

// ---------- 이수·검진 기록 ----------

/** 조건은 하나만 쓴다 — memberId · year(그 해 기록). 모두 빼면 전부. 이수·검진일 최신순 */
export function listStaffCerts(params: { memberId?: number; year?: number } = {}): Promise<StaffCert[]> {
  const parts: string[] = [];
  if (params.memberId !== undefined) parts.push(`memberId=${q(String(params.memberId))}`);
  if (params.year !== undefined) parts.push(`year=${q(String(params.year))}`);
  return request<StaffCert[]>(`${LAB}/staff-certs${parts.length > 0 ? `?${parts.join('&')}` : ''}`, undefined, '이수·검진 기록을 불러오지 못했습니다');
}

/** 보수교육인데 시간이 없거나 0.5~40시간 밖이면, 날짜가 400일 넘게 미래이면 서버가 400을 준다 */
export function createStaffCert(input: StaffCertInput): Promise<StaffCert> {
  return request<StaffCert>(`${LAB}/staff-certs`, json('POST', input), '이수·검진 기록을 저장하지 못했습니다');
}

export function updateStaffCert(id: number, input: StaffCertInput): Promise<StaffCert> {
  return request<StaffCert>(`${LAB}/staff-certs/${q(String(id))}`, json('PUT', input), '이수·검진 기록을 고치지 못했습니다');
}

export async function deleteStaffCert(id: number): Promise<void> {
  await request<null>(`${LAB}/staff-certs/${q(String(id))}`, { method: 'DELETE' }, '이수·검진 기록을 삭제하지 못했습니다');
}

// ---------- 통장 ----------

export function listBankAccounts(): Promise<BankAccount[]> {
  return request<BankAccount[]>(`${LAB}/bank-accounts`, undefined, '통장 목록을 불러오지 못했습니다');
}

/** 계좌번호는 끝 4자리(숫자)만 보낸다 — 4자리 숫자가 아니면 서버가 400을 준다 */
export function createBankAccount(input: BankAccountInput): Promise<BankAccount> {
  return request<BankAccount>(`${LAB}/bank-accounts`, json('POST', input), '통장을 저장하지 못했습니다');
}

export function updateBankAccount(id: number, input: BankAccountInput): Promise<BankAccount> {
  return request<BankAccount>(`${LAB}/bank-accounts/${q(String(id))}`, json('PUT', input), '통장을 고치지 못했습니다');
}

/** 월말 잔액 기록이 있으면 서버가 409를 준다 */
export async function deleteBankAccount(id: number): Promise<void> {
  await request<null>(`${LAB}/bank-accounts/${q(String(id))}`, { method: 'DELETE' }, '통장을 삭제하지 못했습니다. 월말 잔액 기록이 있으면 먼저 지워야 합니다');
}

// ---------- 통장 월말 잔액 ----------

/** 조건은 하나만 쓴다 — month('YYYY-MM') · accountId. 모두 빼면 전부 */
export function listBankStatements(params: { month?: string; accountId?: number } = {}): Promise<BankStatement[]> {
  const parts: string[] = [];
  if (params.month) parts.push(`month=${q(params.month)}`);
  if (params.accountId !== undefined) parts.push(`accountId=${q(String(params.accountId))}`);
  return request<BankStatement[]>(`${LAB}/bank-statements${parts.length > 0 ? `?${parts.join('&')}` : ''}`, undefined, '통장 월말 잔액을 불러오지 못했습니다');
}

/** accountId + statementMonth마다 하나(upsert) */
export function saveBankStatement(input: BankStatementInput): Promise<BankStatement> {
  return request<BankStatement>(`${LAB}/bank-statements`, json('PUT', input), '통장 월말 잔액을 저장하지 못했습니다');
}

export async function deleteBankStatement(id: number): Promise<void> {
  await request<null>(`${LAB}/bank-statements/${q(String(id))}`, { method: 'DELETE' }, '통장 월말 잔액을 삭제하지 못했습니다');
}

// ---------- 8차 AI 작업 — 제안만 돌려준다. 보내기 직전에 이름을 지운다 ----------

/**
 * 진료 동행 메모 정리. elderNames(어르신)·staffNames(동행 직원)는 기억해 둔 뒤 메모에서 지운다 — 이름은 서버로 보내지 않는다.
 * 후속 날짜는 메모에 날짜가 있을 때만 채워진다('2주 뒤'는 null).
 */
export function aiStructureMedicalVisit(
  note: string,
  names: { elderNames?: ReadonlyArray<string | null | undefined>; staffNames?: ReadonlyArray<string | null | undefined> } = {},
): Promise<MedicalVisitAiResult> {
  rememberElderNames((names.elderNames ?? []).filter((n): n is string => typeof n === 'string'));
  rememberStaffNames((names.staffNames ?? []).filter((n): n is string => typeof n === 'string'));
  return request<MedicalVisitAiResult>(`${LAB_AI}/medical-visit`, json('POST', redactDeep({ note })), `AI가 진료 메모를 정리하지 못했습니다. ${AI_RETRY}`);
}

/**
 * 회의 메모를 회의록으로 정리. memberNames(운영위원 이름)는 '[위원]'으로 바꾼 뒤 보낸다 — 위원 이름은 서버로 가지 않는다.
 */
export function aiDraftMeetingMinutes(input: MeetingMinutesAiInput, memberNames: ReadonlyArray<string | null | undefined> = []): Promise<MeetingMinutesAiResult> {
  const note = replaceNames(input.note, memberNames.filter((n): n is string => typeof n === 'string'), '[위원]');
  return request<MeetingMinutesAiResult>(`${LAB_AI}/meeting-minutes`, json('POST', redactDeep({ ...input, note })), `AI가 회의록을 정리하지 못했습니다. ${AI_RETRY}`);
}

// =====================================================================
// 10차
// =====================================================================

// ---------- 예방접종 ----------

/** 연도 또는 어르신 중 하나는 꼭 있어야 한다(둘 다 없으면 서버가 400) — 함수 모양으로 강제한다 */
export function listVaccinations(query: VaccinationQuery): Promise<Vaccination[]> {
  const qs = 'year' in query ? `year=${q(String(query.year))}` : `elderlyId=${q(String(query.elderlyId))}`;
  return request<Vaccination[]>(`${LAB}/vaccinations?${qs}`, undefined, '예방접종 기록을 불러오지 못했습니다');
}

/** 어르신 + 연도 + 백신마다 하나(upsert). 접종이면 접종일·확인 방법, 거부·제외면 사유가 필요하고 미래 날짜는 서버가 400을 준다 */
export function saveVaccination(input: VaccinationInput): Promise<Vaccination> {
  return request<Vaccination>(`${LAB}/vaccinations`, json('PUT', input), '예방접종 기록을 저장하지 못했습니다');
}

export async function deleteVaccination(id: number): Promise<void> {
  await request<null>(`${LAB}/vaccinations/${q(String(id))}`, { method: 'DELETE' }, '예방접종 기록을 삭제하지 못했습니다');
}

// ---------- 사례관리 회의 ----------

/** 회의일 최신순 */
export function listCaseMeetings(year: number): Promise<CaseMeeting[]> {
  return request<CaseMeeting[]>(`${LAB}/case-meetings?year=${q(String(year))}`, undefined, '사례관리 회의를 불러오지 못했습니다');
}

export function createCaseMeeting(input: CaseMeetingInput): Promise<CaseMeeting> {
  return request<CaseMeeting>(`${LAB}/case-meetings`, json('POST', input), '사례관리 회의를 저장하지 못했습니다');
}

export function updateCaseMeeting(id: number, input: CaseMeetingInput): Promise<CaseMeeting> {
  return request<CaseMeeting>(`${LAB}/case-meetings/${q(String(id))}`, json('PUT', input), '사례관리 회의를 고치지 못했습니다');
}

export async function deleteCaseMeeting(id: number): Promise<void> {
  await request<null>(`${LAB}/case-meetings/${q(String(id))}`, { method: 'DELETE' }, '사례관리 회의를 삭제하지 못했습니다');
}

// ---------- 송영 운행일지 ----------

/** 날짜 또는 달('YYYY-MM') 중 하나는 꼭 있어야 한다 */
export function listTransportLogs(query: TransportLogQuery): Promise<TransportLog[]> {
  const qs = 'date' in query ? `date=${q(query.date)}` : `month=${q(query.month)}`;
  return request<TransportLog[]>(`${LAB}/transport-logs?${qs}`, undefined, '운행일지를 불러오지 못했습니다');
}

/** 운행일 + 방향 + 차량번호마다 하나(upsert). 운전원과 동승자가 같거나 도착이 출발보다 빠르면 서버가 400을 준다 */
export function saveTransportLog(input: TransportLogInput): Promise<TransportLog> {
  return request<TransportLog>(`${LAB}/transport-logs`, json('PUT', input), '운행일지를 저장하지 못했습니다');
}

export async function deleteTransportLog(id: number): Promise<void> {
  await request<null>(`${LAB}/transport-logs/${q(String(id))}`, { method: 'DELETE' }, '운행일지를 삭제하지 못했습니다');
}

// ---------- 송영 차량·보험 ----------

export function listTransportVehicles(): Promise<TransportVehicle[]> {
  return request<TransportVehicle[]>(`${LAB}/transport-vehicles`, undefined, '송영 차량 목록을 불러오지 못했습니다');
}

/** 같은 차량번호가 있으면 서버가 409를 준다 */
export function createTransportVehicle(input: TransportVehicleInput): Promise<TransportVehicle> {
  return request<TransportVehicle>(`${LAB}/transport-vehicles`, json('POST', input), '송영 차량을 저장하지 못했습니다');
}

export function updateTransportVehicle(id: number, input: TransportVehicleInput): Promise<TransportVehicle> {
  return request<TransportVehicle>(`${LAB}/transport-vehicles/${q(String(id))}`, json('PUT', input), '송영 차량을 고치지 못했습니다');
}

export async function deleteTransportVehicle(id: number): Promise<void> {
  await request<null>(`${LAB}/transport-vehicles/${q(String(id))}`, { method: 'DELETE' }, '송영 차량을 삭제하지 못했습니다');
}

// ---------- 수칙·운행표 제공 기록 ----------

/** 제공일 최신순. elderlyId를 주면 그 어르신만 */
export function listGuideDeliveries(kind: GuideKind, elderlyId?: number): Promise<GuideDelivery[]> {
  const extra = elderlyId === undefined ? '' : `&elderlyId=${q(String(elderlyId))}`;
  return request<GuideDelivery[]>(`${LAB}/guide-deliveries?kind=${q(kind)}${extra}`, undefined, '수칙·운행표 제공 기록을 불러오지 못했습니다');
}

/** 어르신 1~100명에게 같은 날·같은 방법으로 한꺼번에 기록한다 */
export function createGuideDeliveries(input: GuideDeliveryBatchInput): Promise<GuideDelivery[]> {
  return request<GuideDelivery[]>(`${LAB}/guide-deliveries/batch`, json('POST', input), '수칙·운행표 제공 기록을 저장하지 못했습니다');
}

export async function deleteGuideDelivery(id: number): Promise<void> {
  await request<null>(`${LAB}/guide-deliveries/${q(String(id))}`, { method: 'DELETE' }, '수칙·운행표 제공 기록을 삭제하지 못했습니다');
}

// ---------- 규정·지침 대장 ----------

export function listPolicyDocs(): Promise<PolicyDoc[]> {
  return request<PolicyDoc[]>(`${LAB}/policy-docs`, undefined, '규정·지침 대장을 불러오지 못했습니다');
}

/** 같은 종류(급여제공지침은 번호까지)가 이미 있으면 서버가 409를 준다 — 기타는 여러 개 가능 */
export function createPolicyDoc(input: PolicyDocInput): Promise<PolicyDoc> {
  return request<PolicyDoc>(`${LAB}/policy-docs`, json('POST', input), '규정·지침을 저장하지 못했습니다');
}

export function updatePolicyDoc(id: number, input: PolicyDocInput): Promise<PolicyDoc> {
  return request<PolicyDoc>(`${LAB}/policy-docs/${q(String(id))}`, json('PUT', input), '규정·지침을 고치지 못했습니다');
}

export async function deletePolicyDoc(id: number): Promise<void> {
  await request<null>(`${LAB}/policy-docs/${q(String(id))}`, { method: 'DELETE' }, '규정·지침을 삭제하지 못했습니다');
}

// ---------- 10차 AI 작업 — 제안만 돌려준다. 보내기 직전에 이름을 지운다 ----------

/**
 * 사례관리 회의 메모 정리. roles(참석 직종 이름)만 보낸다 — 어르신·직원 이름은 메모에서 지운 뒤 보내며 서버로 가지 않는다.
 * 의견은 그 직종 참석자가 한 명일 때만 화면이 그 칸에 제안한다.
 */
export function aiCaseMeeting(
  input: CaseMeetingAiInput,
  names: { elderNames?: ReadonlyArray<string | null | undefined>; staffNames?: ReadonlyArray<string | null | undefined> } = {},
): Promise<CaseMeetingAiResult> {
  rememberElderNames((names.elderNames ?? []).filter((n): n is string => typeof n === 'string'));
  rememberStaffNames((names.staffNames ?? []).filter((n): n is string => typeof n === 'string'));
  return request<CaseMeetingAiResult>(`${LAB_AI}/case-meeting`, json('POST', redactDeep(input)), `AI가 회의 메모를 정리하지 못했습니다. ${AI_RETRY}`);
}

/** 규정 원문에 항목이 있는지 점검한다. 원문은 이 요청에만 쓰이고 저장되지 않는다. 결과는 체크 제안이다 */
export function aiPolicyCheck(input: PolicyCheckAiInput): Promise<PolicyCheckAiResult> {
  return request<PolicyCheckAiResult>(`${LAB_AI}/policy-check`, json('POST', redactDeep(input)), `AI가 규정 항목을 점검하지 못했습니다. ${AI_RETRY}`);
}

// =====================================================================
// 11차
// =====================================================================

/**
 * 욕구사정 면담 메모를 열한 칸으로 정리한다. 메모의 어르신·직원 이름은 보내기 직전에 지운다(names로 이름을 알려 주면 더 확실하다).
 * 결과는 제안이다 — 화면이 빈 칸에만 'AI 제안'으로 채운다.
 */
export function aiNeedsAssessment(
  input: NeedsAssessmentAiInput,
  names: { elderNames?: ReadonlyArray<string | null | undefined>; staffNames?: ReadonlyArray<string | null | undefined> } = {},
): Promise<NeedsAssessmentAiResult> {
  rememberElderNames((names.elderNames ?? []).filter((n): n is string => typeof n === 'string'));
  rememberStaffNames((names.staffNames ?? []).filter((n): n is string => typeof n === 'string'));
  return request<NeedsAssessmentAiResult>(`${LAB_AI}/needs-assessment`, json('POST', redactDeep(input)), `AI가 욕구사정 메모를 정리하지 못했습니다. ${AI_RETRY}`);
}

// ---------- 감염병 유행·발생 기록 ----------

export function listOutbreaks(year: number): Promise<Outbreak[]> {
  return request<Outbreak[]>(`${LAB}/outbreaks?year=${q(String(year))}`, undefined, '감염병 유행·발생 기록을 불러오지 못했습니다');
}

export function createOutbreak(input: OutbreakInput): Promise<Outbreak> {
  return request<Outbreak>(`${LAB}/outbreaks`, json('POST', input), '감염병 유행·발생 기록을 저장하지 못했습니다');
}

export function updateOutbreak(id: number, input: OutbreakInput): Promise<Outbreak> {
  return request<Outbreak>(`${LAB}/outbreaks/${q(String(id))}`, json('PUT', input), '감염병 유행·발생 기록을 고치지 못했습니다');
}

export async function deleteOutbreak(id: number): Promise<void> {
  await request<null>(`${LAB}/outbreaks/${q(String(id))}`, { method: 'DELETE' }, '감염병 유행·발생 기록을 삭제하지 못했습니다');
}

// ---------- 직원 복지(포상) 제공대장 ----------

export function listStaffWelfare(year: number): Promise<StaffWelfare[]> {
  return request<StaffWelfare[]>(`${LAB}/staff-welfare?year=${q(String(year))}`, undefined, '직원 복지 제공대장을 불러오지 못했습니다');
}

export function createStaffWelfare(input: StaffWelfareInput): Promise<StaffWelfare> {
  return request<StaffWelfare>(`${LAB}/staff-welfare`, json('POST', input), '직원 복지 제공 기록을 저장하지 못했습니다');
}

export function updateStaffWelfare(id: number, input: StaffWelfareInput): Promise<StaffWelfare> {
  return request<StaffWelfare>(`${LAB}/staff-welfare/${q(String(id))}`, json('PUT', input), '직원 복지 제공 기록을 고치지 못했습니다');
}

export async function deleteStaffWelfare(id: number): Promise<void> {
  await request<null>(`${LAB}/staff-welfare/${q(String(id))}`, { method: 'DELETE' }, '직원 복지 제공 기록을 삭제하지 못했습니다');
}

// ---------- 평가 가산금 수령·사용 ----------

export function listBonusFunds(year: number): Promise<BonusFund[]> {
  return request<BonusFund[]>(`${LAB}/bonus-funds?year=${q(String(year))}`, undefined, '가산금 기록을 불러오지 못했습니다');
}

export function createBonusFund(input: BonusFundInput): Promise<BonusFund> {
  return request<BonusFund>(`${LAB}/bonus-funds`, json('POST', input), '가산금 기록을 저장하지 못했습니다');
}

export function updateBonusFund(id: number, input: BonusFundInput): Promise<BonusFund> {
  return request<BonusFund>(`${LAB}/bonus-funds/${q(String(id))}`, json('PUT', input), '가산금 기록을 고치지 못했습니다');
}

export async function deleteBonusFund(id: number): Promise<void> {
  await request<null>(`${LAB}/bonus-funds/${q(String(id))}`, { method: 'DELETE' }, '가산금 기록을 삭제하지 못했습니다');
}

// ---------- 급여제공계획 변경 이력 ----------

/** 어르신별(elderlyId) 또는 그 해(year) 변경 이력, 변경일 최신순. 하나는 꼭 줘야 한다 */
export function listCarePlanChanges(filter: { elderlyId: number } | { year: number }): Promise<CarePlanChange[]> {
  const query = 'elderlyId' in filter ? `elderlyId=${q(String(filter.elderlyId))}` : `year=${q(String(filter.year))}`;
  return request<CarePlanChange[]>(`${LAB}/care-plan-changes?${query}`, undefined, '급여제공계획 변경 이력을 불러오지 못했습니다');
}

export function createCarePlanChange(input: CarePlanChangeInput): Promise<CarePlanChange> {
  return request<CarePlanChange>(`${LAB}/care-plan-changes`, json('POST', input), '급여제공계획 변경 이력을 저장하지 못했습니다');
}

export function updateCarePlanChange(id: number, input: CarePlanChangeInput): Promise<CarePlanChange> {
  return request<CarePlanChange>(`${LAB}/care-plan-changes/${q(String(id))}`, json('PUT', input), '급여제공계획 변경 이력을 고치지 못했습니다');
}

export async function deleteCarePlanChange(id: number): Promise<void> {
  await request<null>(`${LAB}/care-plan-changes/${q(String(id))}`, { method: 'DELETE' }, '급여제공계획 변경 이력을 삭제하지 못했습니다');
}

// ---------- 고충 건수(내용은 서버가 내보내지 않는다) ----------

export function getGrievanceSummary(year: number): Promise<GrievanceSummary> {
  return request<GrievanceSummary>(`${LAB}/grievance-summary?year=${q(String(year))}`, undefined, '고충 처리 현황을 불러오지 못했습니다');
}
