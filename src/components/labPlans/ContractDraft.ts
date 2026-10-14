/** 계약·인정 편집기의 입력 상태와 점검 — 서버와 같은 한도로 미리 막는다. */
import { addDays, daysBetween, isValidYmd } from '@/lib/lab/labDate';
import type { ContractEndReason, ContractStatus, CopayClass, ElderContract, ElderContractInput, LtcCareGrade } from '@/lib/lab/labTypes';

export const MAX_RECOGNITION_NO = 20;
export const MAX_CONTRACT_NOTE = 1000;

export interface ContractDraft {
  /** 새로 적는 중이면 null */
  id: number | null;
  elderlyId: number | null;
  contractStart: string;
  contractEnd: string;
  careGrade: LtcCareGrade;
  recognitionNo: string;
  validFrom: string;
  validTo: string;
  /** 0=최초 인정, 1 이상=갱신 */
  renewalCount: number | null;
  copayClass: CopayClass;
  plannedDays: number | null;
  signedOn: string;
  copyGiven: boolean;
  contractNotifiedOn: string;
  planNotifiedOn: string;
  rightsGuidedOn: string;
  status: ContractStatus;
  endReason: ContractEndReason | '';
  note: string;
}

const GRADES: ReadonlyArray<string> = ['1', '2', '3', '4', '5', 'cognitive'];

/** 어르신 등급 글('3'·'cognitive' 등)이 계약 등급으로 쓸 수 있는 값이면 그 값, 아니면 3등급 */
export function gradeOrDefault(value: string | null | undefined): LtcCareGrade {
  return value && GRADES.includes(value) ? (value as LtcCareGrade) : '3';
}

export function emptyContractDraft(elderlyId: number | null = null, careGrade: string | null = null): ContractDraft {
  return {
    id: null,
    elderlyId,
    contractStart: '',
    contractEnd: '',
    careGrade: gradeOrDefault(careGrade),
    recognitionNo: '',
    validFrom: '',
    validTo: '',
    renewalCount: 0,
    copayClass: 'standard',
    plannedDays: null,
    signedOn: '',
    copyGiven: false,
    contractNotifiedOn: '',
    planNotifiedOn: '',
    rightsGuidedOn: '',
    status: 'ACTIVE',
    endReason: '',
    note: '',
  };
}

export function draftOfContract(c: ElderContract): ContractDraft {
  return {
    id: c.id,
    elderlyId: c.elderlyId,
    contractStart: c.contractStart,
    contractEnd: c.contractEnd ?? '',
    careGrade: c.careGrade,
    recognitionNo: c.recognitionNo ?? '',
    validFrom: c.validFrom,
    validTo: c.validTo,
    renewalCount: c.renewalCount,
    copayClass: c.copayClass,
    plannedDays: c.plannedDaysPerMonth,
    signedOn: c.signedOn ?? '',
    copyGiven: c.copyGiven,
    contractNotifiedOn: c.contractNotifiedOn ?? '',
    planNotifiedOn: c.planNotifiedOn ?? '',
    rightsGuidedOn: c.rightsGuidedOn ?? '',
    status: c.status,
    endReason: c.endReason ?? '',
    note: c.note ?? '',
  };
}

const orNull = (text: string): string | null => (text.trim() === '' ? null : text.trim());

/** 점검을 통과한 초안만 부른다(elderlyId는 있다고 본다) */
export function inputOfContractDraft(d: ContractDraft): ElderContractInput {
  const ended = d.status === 'ENDED';
  return {
    elderlyId: d.elderlyId as number,
    contractStart: d.contractStart,
    contractEnd: ended ? d.contractEnd : orNull(d.contractEnd),
    careGrade: d.careGrade,
    recognitionNo: orNull(d.recognitionNo),
    validFrom: d.validFrom,
    validTo: d.validTo,
    renewalCount: d.renewalCount ?? 0,
    copayClass: d.copayClass,
    plannedDaysPerMonth: d.plannedDays,
    signedOn: orNull(d.signedOn),
    copyGiven: d.copyGiven,
    contractNotifiedOn: orNull(d.contractNotifiedOn),
    planNotifiedOn: orNull(d.planNotifiedOn),
    rightsGuidedOn: orNull(d.rightsGuidedOn),
    status: d.status,
    endReason: ended && d.endReason !== '' ? d.endReason : null,
    note: orNull(d.note),
  };
}

/** 저장 전에 고쳐야 할 것(비어 있으면 저장할 수 있다). activeElderIds: 진행 중인 계약이 이미 있는 어르신 → 그 계약 번호 */
export function contractIssues(d: ContractDraft, activeOf: ReadonlyMap<number, number>): string[] {
  const out: string[] = [];
  if (d.elderlyId === null) out.push('어르신을 골라 주세요');
  if (!isValidYmd(d.contractStart)) out.push('계약 시작일을 골라 주세요');
  if (!isValidYmd(d.validFrom) || !isValidYmd(d.validTo)) out.push('장기요양 인정 유효기간의 시작일과 끝일을 골라 주세요');
  else if (d.validTo < d.validFrom) out.push('유효기간 끝일은 시작일보다 빠를 수 없습니다');
  if (d.renewalCount === null) out.push('갱신 횟수를 적어 주세요(처음 인정이면 0)');
  if (d.plannedDays !== null && (d.plannedDays < 1 || d.plannedDays > 31)) out.push('월 이용 계약 일수는 1~31일입니다');
  if (d.recognitionNo.trim().length > MAX_RECOGNITION_NO) out.push(`장기요양인정번호는 ${MAX_RECOGNITION_NO}자 이내입니다`);
  if (d.note.length > MAX_CONTRACT_NOTE) out.push(`메모는 ${MAX_CONTRACT_NOTE}자 이내입니다`);
  if (d.contractEnd !== '' && isValidYmd(d.contractStart) && isValidYmd(d.contractEnd) && d.contractEnd < d.contractStart) out.push('계약 종료일은 시작일보다 빠를 수 없습니다');
  if (d.status === 'ENDED') {
    if (!isValidYmd(d.contractEnd)) out.push('종료한 계약은 계약 종료일을 골라 주세요');
    if (d.endReason === '') out.push('종료한 계약은 종료 사유를 골라 주세요');
  }
  if (d.status === 'ACTIVE' && d.elderlyId !== null) {
    const other = activeOf.get(d.elderlyId);
    if (other !== undefined && other !== d.id) out.push('이 어르신의 진행 중인 계약이 이미 있습니다. 먼저 그 계약을 종료로 바꿔 주세요');
  }
  return out;
}

/** 저장은 되지만 확인이 필요한 것 — 경고 글 */
export function contractWarnings(d: ContractDraft): string[] {
  const out: string[] = [];
  if (isValidYmd(d.signedOn) && isValidYmd(d.contractStart) && d.signedOn > d.contractStart) out.push('계약서 체결일이 계약 시작일보다 늦습니다. 급여를 시작하기 전에 서면으로 계약해야 합니다');
  if (isValidYmd(d.planNotifiedOn) && isValidYmd(d.contractStart) && d.planNotifiedOn > d.contractStart) out.push('급여제공계획 통보일이 급여제공 시작일보다 늦습니다(평가는 시작일까지 통보를 봅니다)');
  if (isValidYmd(d.rightsGuidedOn) && isValidYmd(d.contractStart)) {
    const gap = daysBetween(d.contractStart, d.rightsGuidedOn);
    if (gap !== null && gap > 14) out.push('노인인권 지침 안내가 시작일부터 14일을 넘겼습니다');
  }
  return out;
}

/** 시작일부터 14일째 되는 날 — 노인인권 지침 안내 기한 */
export function rightsGuideDue(contractStart: string): string | null {
  return isValidYmd(contractStart) ? addDays(contractStart, 14) : null;
}
