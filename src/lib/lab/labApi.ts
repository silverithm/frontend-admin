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
  CareRecordInput,
  CopayBill,
  CopayBillInput,
  CopayPaymentInput,
  EvalCheck,
  EvalCheckInput,
  EvalReviewInput,
  EvalReviewResult,
  LabAccess,
  RiskAssessment,
  RiskAssessmentInput,
  RiskKind,
  RiskLatest,
  RiskSuggestion,
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

// ---------- AI (어르신 이름은 보내지 않는다: 메모·관찰·증빙 글만) ----------

export function aiStructureCareNote(note: string): Promise<CareNoteStructured> {
  return request<CareNoteStructured>(`${LAB_AI}/care-record`, json('POST', { note }), 'AI가 메모를 정리하지 못했습니다. 잠시 후 다시 시도해 주세요');
}

export function aiSuggestRiskScores(kind: RiskKind, observations: string): Promise<RiskSuggestion> {
  return request<RiskSuggestion>(`${LAB_AI}/risk`, json('POST', { kind, observations }), 'AI가 점수를 제안하지 못했습니다. 잠시 후 다시 시도해 주세요');
}

export function aiReviewEvalEvidence(input: EvalReviewInput): Promise<EvalReviewResult> {
  return request<EvalReviewResult>(`${LAB_AI}/eval-review`, json('POST', input), 'AI가 증빙을 검토하지 못했습니다. 잠시 후 다시 시도해 주세요');
}
