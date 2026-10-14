/** 입소 상담 편집 상태 — 서버 입력으로 바꾸기, 저장 전 막는 것, 연락처 가리기. */
import { NO_CONSENT_MESSAGE } from '@/lib/lab/intakeRules';
import { isValidYmd } from '@/lib/lab/labDate';
import type { IntakeCareGrade, IntakeDeclineReason, IntakeInquiry, IntakeInquiryInput, IntakeRelation, IntakeSource, IntakeStatus } from '@/lib/lab/labTypes';

export const MAX_NAME = 50;
export const MAX_PHONE = 20;
export const MAX_DAYS = 60;
export const MAX_NEEDS = 2000;
export const MAX_DECLINE_NOTE = 500;

export interface IntakeDraft {
  id: number | null;
  inquiryDate: string;
  applicantName: string;
  contactName: string;
  contactPhone: string;
  relation: IntakeRelation | '';
  careGrade: IntakeCareGrade | '';
  desiredDays: string;
  needs: string;
  source: IntakeSource;
  status: IntakeStatus;
  declineReason: IntakeDeclineReason | '';
  declineNote: string;
  consentOn: string;
  nextContactOn: string;
  elderlyId: number | null;
  counselorName: string;
  aiAssisted: boolean;
}

export function emptyIntakeDraft(today: string, counselorName: string): IntakeDraft {
  return {
    id: null, inquiryDate: today, applicantName: '', contactName: '', contactPhone: '', relation: '', careGrade: '', desiredDays: '', needs: '',
    source: 'PHONE', status: 'NEW', declineReason: '', declineNote: '', consentOn: '', nextContactOn: '', elderlyId: null, counselorName, aiAssisted: false,
  };
}

export function draftOfIntake(q: IntakeInquiry): IntakeDraft {
  return {
    id: q.id,
    inquiryDate: q.inquiryDate.slice(0, 10),
    applicantName: q.applicantName ?? '',
    contactName: q.contactName ?? '',
    contactPhone: q.contactPhone ?? '',
    relation: q.relation ?? '',
    careGrade: q.careGrade ?? '',
    desiredDays: q.desiredDays ?? '',
    needs: q.needs ?? '',
    source: q.source,
    status: q.status,
    declineReason: q.declineReason ?? '',
    declineNote: q.declineNote ?? '',
    consentOn: q.consentOn ? q.consentOn.slice(0, 10) : '',
    nextContactOn: q.nextContactOn ? q.nextContactOn.slice(0, 10) : '',
    elderlyId: q.elderlyId,
    counselorName: q.counselorName ?? '',
    aiAssisted: q.aiAssisted,
  };
}

const orNull = (t: string): string | null => (t.trim() === '' ? null : t.trim());

/** 이용 불가가 아니면 거절 사유를, 계약 완료가 아니면 어르신 연결을 비워 보낸다(서버도 같게 처리한다) */
export function inputOfIntake(d: IntakeDraft): IntakeInquiryInput {
  const declined = d.status === 'DECLINED';
  return {
    inquiryDate: d.inquiryDate,
    applicantName: d.applicantName.trim(),
    contactName: orNull(d.contactName),
    contactPhone: orNull(d.contactPhone),
    relation: d.relation === '' ? null : d.relation,
    careGrade: d.careGrade === '' ? null : d.careGrade,
    desiredDays: orNull(d.desiredDays),
    needs: orNull(d.needs),
    source: d.source,
    status: d.status,
    declineReason: declined && d.declineReason !== '' ? d.declineReason : null,
    declineNote: declined ? orNull(d.declineNote) : null,
    consentOn: d.consentOn === '' ? null : d.consentOn,
    nextContactOn: d.nextContactOn === '' ? null : d.nextContactOn,
    elderlyId: d.status === 'CONTRACTED' ? d.elderlyId : null,
    counselorName: d.counselorName.trim(),
    aiAssisted: d.aiAssisted,
  };
}

export function fingerprint(d: IntakeDraft): string {
  return JSON.stringify({ id: d.id, ...inputOfIntake(d) });
}

/** 저장을 막는 이유(저장 단추 아래에 그대로 보여 준다) */
export function intakeBlockers(d: IntakeDraft): string[] {
  const out: string[] = [];
  if (d.applicantName.trim() === '') out.push('신청 어르신 이름을 적어 주세요');
  if (!isValidYmd(d.inquiryDate)) out.push('문의일을 골라 주세요');
  if (d.counselorName.trim() === '') out.push('상담자 이름을 적어 주세요');
  if (d.contactPhone.trim() !== '' && d.consentOn === '') out.push(`${NO_CONSENT_MESSAGE} (개인정보 보호법 제15조: 연락처를 받으려면 목적·항목·보유기간·거부할 수 있다는 점을 알리고 동의를 받아야 합니다)`);
  if (d.status === 'DECLINED' && d.declineReason === '') out.push('이용 불가로 하려면 사유를 골라 주세요 (노인장기요양보험법 제35조)');
  if (d.status === 'CONTRACTED' && d.elderlyId === null) out.push('계약 완료로 하려면 기존 어르신 중 한 분을 연결해 주세요');
  return out;
}

/** 010-1234-5678 → 010-****-5678. 자릿수가 모자라면 전부 가린다. 목록·알림에는 이 값만 보여 준다. */
export function maskPhone(phone: string | null | undefined): string {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (digits === '') return '';
  if (digits.length < 8) return '****';
  const tail = digits.slice(-4);
  if (digits.length === 10 && !digits.startsWith('02')) return `${digits.slice(0, 3)}-***-${tail}`;
  const head = digits.slice(0, digits.length - 8);
  return head === '' ? `****-${tail}` : `${head}-****-${tail}`;
}

/** 전화번호 칸 글자 정리 — 숫자·하이픈·공백·괄호·+만 남긴다 */
export function sanitizePhone(text: string): string {
  return text.replace(/[^0-9\-+() ]/g, '').slice(0, MAX_PHONE);
}
