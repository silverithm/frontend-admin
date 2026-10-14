/** 퇴소 연계기록지 편집기의 입력 상태와 점검 — 서버와 같은 한도. */
import { ledgerPartlyFilled, MAX_REFERRAL_COUNSEL, MAX_REFERRAL_FUNCTIONAL, MAX_REFERRAL_PLAN, MAX_REFERRAL_SERVICES } from '@/lib/lab/dischargeRules';
import { addDays, daysInMonth, isValidYmd, parseYmd } from '@/lib/lab/labDate';
import type { ContractEndReason, DischargeReason, DischargeReferral, DischargeReferralInput, LtcCareGrade, ReferralProvidedMethod } from '@/lib/lab/labTypes';
import { gradeOrDefault } from './ContractDraft';

export { MAX_REFERRAL_COUNSEL, MAX_REFERRAL_FUNCTIONAL, MAX_REFERRAL_PLAN, MAX_REFERRAL_SERVICES };
export const MAX_PERSON_NAME = 50;

export interface ReferralDraft {
  id: number | null;
  elderlyId: number | null;
  contractId: number | null;
  dischargeOn: string;
  reason: DischargeReason;
  writtenOn: string;
  careGrade: LtcCareGrade;
  functionalStatus: string;
  servicesProvided: string;
  afterPlan: string;
  counselNote: string;
  providedOn: string;
  providedMethod: ReferralProvidedMethod | '';
  providerName: string;
  recipientName: string;
  writerName: string;
  aiAssisted: boolean;
}

/** 계약 편집기에서 "퇴소 연계기록지 쓰기"로 넘어올 때 미리 채울 값 */
export interface ReferralSeed {
  /** 같은 값을 다시 보내도 새로 적기를 시작하도록 올려 가는 번호 */
  key: number;
  elderlyId: number;
  contractId: number | null;
  dischargeOn: string;
  reason: DischargeReason;
  careGrade: string;
}

export function emptyReferralDraft(writerName: string, today: string): ReferralDraft {
  return {
    id: null,
    elderlyId: null,
    contractId: null,
    dischargeOn: '',
    reason: 'SELF',
    writtenOn: today,
    careGrade: '3',
    functionalStatus: '',
    servicesProvided: '',
    afterPlan: '',
    counselNote: '',
    providedOn: '',
    providedMethod: '',
    providerName: '',
    recipientName: '',
    writerName,
    aiAssisted: false,
  };
}

export function draftOfSeed(seed: ReferralSeed, writerName: string, today: string): ReferralDraft {
  return { ...emptyReferralDraft(writerName, today), elderlyId: seed.elderlyId, contractId: seed.contractId, dischargeOn: seed.dischargeOn, reason: seed.reason, careGrade: gradeOrDefault(seed.careGrade) };
}

export function draftOfReferral(r: DischargeReferral): ReferralDraft {
  return {
    id: r.id,
    elderlyId: r.elderlyId,
    contractId: r.contractId,
    dischargeOn: r.dischargeOn,
    reason: r.reason,
    writtenOn: r.writtenOn,
    careGrade: r.careGrade,
    functionalStatus: r.functionalStatus,
    servicesProvided: r.servicesProvided,
    afterPlan: r.afterPlan,
    counselNote: r.counselNote ?? '',
    providedOn: r.providedOn ?? '',
    providedMethod: r.providedMethod ?? '',
    providerName: r.providerName ?? '',
    recipientName: r.recipientName ?? '',
    writerName: r.writerName,
    aiAssisted: r.aiAssisted,
  };
}

const orNull = (text: string): string | null => (text.trim() === '' ? null : text.trim());

export function inputOfReferralDraft(d: ReferralDraft): DischargeReferralInput {
  return {
    elderlyId: d.elderlyId as number,
    contractId: d.contractId,
    dischargeOn: d.dischargeOn,
    reason: d.reason,
    writtenOn: d.writtenOn,
    careGrade: d.careGrade,
    functionalStatus: d.functionalStatus.trim(),
    servicesProvided: d.servicesProvided.trim(),
    afterPlan: d.afterPlan.trim(),
    counselNote: orNull(d.counselNote),
    providedOn: orNull(d.providedOn),
    providedMethod: d.providedMethod === '' ? null : d.providedMethod,
    providerName: orNull(d.providerName),
    recipientName: orNull(d.recipientName),
    writerName: d.writerName.trim(),
    aiAssisted: d.aiAssisted,
  };
}

export function referralIssues(d: ReferralDraft): string[] {
  const out: string[] = [];
  if (d.elderlyId === null) out.push('어르신을 골라 주세요');
  if (!isValidYmd(d.dischargeOn)) out.push('퇴소일을 골라 주세요');
  if (!isValidYmd(d.writtenOn)) out.push('작성일을 골라 주세요');
  if (d.functionalStatus.trim() === '') out.push('심신기능 상태를 적어 주세요');
  if (d.servicesProvided.trim() === '') out.push('제공한 급여를 적어 주세요');
  if (d.afterPlan.trim() === '') out.push('퇴소 후 서비스 이용계획을 적어 주세요');
  if (d.functionalStatus.length > MAX_REFERRAL_FUNCTIONAL) out.push(`심신기능 상태는 ${MAX_REFERRAL_FUNCTIONAL}자 이내입니다`);
  if (d.servicesProvided.length > MAX_REFERRAL_SERVICES) out.push(`제공한 급여는 ${MAX_REFERRAL_SERVICES}자 이내입니다`);
  if (d.afterPlan.length > MAX_REFERRAL_PLAN) out.push(`퇴소 후 이용계획은 ${MAX_REFERRAL_PLAN}자 이내입니다`);
  if (d.counselNote.length > MAX_REFERRAL_COUNSEL) out.push(`종료 상담 메모는 ${MAX_REFERRAL_COUNSEL}자 이내입니다`);
  if (d.writerName.trim() === '') out.push('작성자 이름을 적어 주세요');
  if (ledgerPartlyFilled({ providedOn: orNull(d.providedOn), providedMethod: d.providedMethod === '' ? null : d.providedMethod, providerName: orNull(d.providerName), recipientName: orNull(d.recipientName) })) {
    out.push('제공대장 네 칸(제공일·방법·제공자·수령자)은 함께 적거나 모두 비워 두어야 합니다');
  }
  return out;
}

/** 퇴소일 앞 3개월의 첫날(같은 날짜, 달 끝이면 그 달 끝날). 날짜가 틀리면 null */
export function threeMonthsBefore(dischargeOn: string): string | null {
  const ymd = parseYmd(dischargeOn);
  if (!ymd) return null;
  let year = ymd.year;
  let month = ymd.month - 3;
  if (month < 1) {
    month += 12;
    year -= 1;
  }
  const day = Math.min(ymd.day, daysInMonth(year, month));
  const first = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return addDays(first, 1) ?? first;
}

/** 계약 종료 사유 → 연계기록지 사유. 사망·입원(퇴소 없음)은 쓰지 않으므로 null */
export function reasonOfEnd(reason: ContractEndReason | null | undefined): DischargeReason | null {
  return reason === 'TRANSFER' || reason === 'SELF' || reason === 'OTHER' ? reason : null;
}
