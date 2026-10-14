/**
 * 실험실 API 호출 — 모든 요청은 authorizedFetch(토큰 갱신·GET 재시도 포함)를 거쳐 Next 프록시로 나간다.
 *  · /api/v1/lab/...     → 백엔드 /api/v1/lab/... (route: app/api/v1/lab/[[...path]])
 *  · /api/v1/lab-ai/...  → Next 서버의 Gemini 라우트 (실험실 권한을 확인한 뒤 모델 호출)
 * 에러는 서버 JSON의 message를 그대로 Error 메시지로 던진다. 서버가 메시지를 주지 않으면 한국어 기본 문구.
 */
import { authorizedFetch } from '../apiService';
import type {
  CareDelivery,
  CareDeliveryInput,
  CareNoteStructured,
  CareRecord,
  CarePlan,
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
  EvalCheck,
  EvalCheckInput,
  EvalReviewInput,
  EvalReviewResult,
  LabAccess,
  LabStaff,
  NursingLog,
  NursingLogInput,
  NursingSummaryInput,
  NursingSummaryResult,
  Program,
  ProgramInput,
  ProgramLogAiInput,
  ProgramLogResult,
  RiskAssessment,
  RiskAssessmentInput,
  RiskLatest,
  RiskSuggestion,
  ScaleKind,
  StaffTraining,
  StaffTrainingInput,
  TrainingLogAiInput,
  TrainingLogResult,
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
export function listLabStaff(): Promise<LabStaff[]> {
  return request<LabStaff[]>(`${LAB}/staff`, undefined, '직원 목록을 불러오지 못했습니다');
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

export function listCarePlans(year: number): Promise<CarePlan[]> {
  return request<CarePlan[]>(`${LAB}/care-plans?year=${q(String(year))}`, undefined, '급여제공계획을 불러오지 못했습니다');
}

/** 어르신 + 연도로 덮어쓴다(upsert) */
export function saveCarePlan(input: CarePlanInput): Promise<CarePlan> {
  return request<CarePlan>(`${LAB}/care-plans`, json('PUT', input), '급여제공계획을 저장하지 못했습니다');
}

export async function deleteCarePlan(id: number): Promise<void> {
  await request<null>(`${LAB}/care-plans/${q(String(id))}`, { method: 'DELETE' }, '급여제공계획을 삭제하지 못했습니다');
}

// ---------- AI (어르신 이름은 보내지 않는다: 메모·관찰·증빙 글만) ----------

export function aiStructureCareNote(note: string): Promise<CareNoteStructured> {
  return request<CareNoteStructured>(`${LAB_AI}/care-record`, json('POST', { note }), 'AI가 메모를 정리하지 못했습니다. 잠시 후 다시 시도해 주세요');
}

export function aiSuggestRiskScores(kind: ScaleKind, observations: string): Promise<RiskSuggestion> {
  return request<RiskSuggestion>(`${LAB_AI}/risk`, json('POST', { kind, observations }), 'AI가 점수를 제안하지 못했습니다. 잠시 후 다시 시도해 주세요');
}

export function aiReviewEvalEvidence(input: EvalReviewInput): Promise<EvalReviewResult> {
  return request<EvalReviewResult>(`${LAB_AI}/eval-review`, json('POST', input), 'AI가 증빙을 검토하지 못했습니다. 잠시 후 다시 시도해 주세요');
}

// ---------- 2차 AI 작업 — 직원이 고칠 수 있는 제안만 돌려준다. 이름은 보내지 않는다 ----------

const AI_RETRY = '잠시 후 다시 시도해 주세요';

export function aiSummarizeNursing(input: NursingSummaryInput): Promise<NursingSummaryResult> {
  return request<NursingSummaryResult>(`${LAB_AI}/nursing-summary`, json('POST', input), `AI가 바이탈을 요약하지 못했습니다. ${AI_RETRY}`);
}

export function aiDraftProgramLog(input: ProgramLogAiInput): Promise<ProgramLogResult> {
  return request<ProgramLogResult>(`${LAB_AI}/program-log`, json('POST', input), `AI가 프로그램 일지를 정리하지 못했습니다. ${AI_RETRY}`);
}

export function aiDraftTrainingLog(input: TrainingLogAiInput): Promise<TrainingLogResult> {
  return request<TrainingLogResult>(`${LAB_AI}/training-log`, json('POST', input), `AI가 교육·회의 기록을 정리하지 못했습니다. ${AI_RETRY}`);
}

export function aiDraftConsultation(input: ConsultationAiInput): Promise<ConsultationResult> {
  return request<ConsultationResult>(`${LAB_AI}/consultation`, json('POST', input), `AI가 상담 내용을 정리하지 못했습니다. ${AI_RETRY}`);
}

export function aiDraftCarePlan(input: CarePlanAiInput): Promise<CarePlanResult> {
  return request<CarePlanResult>(`${LAB_AI}/care-plan`, json('POST', input), `AI가 급여제공계획 초안을 만들지 못했습니다. ${AI_RETRY}`);
}
