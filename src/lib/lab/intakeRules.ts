/**
 * 입소 상담·대기 규칙 — 대기 순번, 확인 알림, 연간 통계.
 *
 * 근거(research-7.md 4절)
 *  - 노인장기요양보험법 제35조제1항: 장기요양기관은 급여 제공을 거부해서는 안 되며, 입소정원에 여유가 없는 경우 등 정당한 사유가 있으면 예외다.
 *    정당한 사유 없이 거부하면 제67조제3항에 따라 1년 이하 징역 또는 1천만 원 이하 벌금. 그래서 거절(DECLINED)에는 사유를 꼭 남긴다.
 *    '정당한 사유'의 구체 목록은 확인하지 못했다(대조 필요).
 *  - 개인정보 보호법 제15조: 연락처를 받으려면 수집·이용 동의(목적·항목·보유기간·거부권 고지)가 필요하다. 건강·등급 정보 별도 동의 여부는 제23조 대조 필요.
 *  - 대기자 관리 자체에 대한 공개 평가 요구는 확인되지 않았다 — 기관 운영용 도구다.
 */
import type { IntakeCareGrade, IntakeDeclineReason, IntakeInquiry, IntakeRelation, IntakeSource, IntakeStatus } from './labTypes.ts';
import { daysBetween, isValidYmd } from './labDate.ts';

export const INTAKE_STATUSES: ReadonlyArray<{ value: IntakeStatus; label: string }> = [
  { value: 'NEW', label: '새 문의' },
  { value: 'CONSULTED', label: '상담함' },
  { value: 'WAITING', label: '대기' },
  { value: 'CONTRACTED', label: '계약 완료' },
  { value: 'DECLINED', label: '이용 불가' },
  { value: 'WITHDRAWN', label: '문의 철회' },
];

export const INTAKE_SOURCES: ReadonlyArray<{ value: IntakeSource; label: string }> = [
  { value: 'PHONE', label: '전화' },
  { value: 'VISIT', label: '방문' },
  { value: 'REFERRAL', label: '소개' },
  { value: 'WEB', label: '온라인' },
  { value: 'OTHER', label: '기타' },
];

export const INTAKE_RELATIONS: ReadonlyArray<{ value: IntakeRelation; label: string }> = [
  { value: 'SELF', label: '본인' },
  { value: 'SPOUSE', label: '배우자' },
  { value: 'CHILD', label: '자녀' },
  { value: 'OTHER_FAMILY', label: '그 밖의 가족' },
  { value: 'OTHER', label: '기타' },
];

export const INTAKE_CARE_GRADES: ReadonlyArray<{ value: IntakeCareGrade; label: string }> = [
  { value: '1', label: '1등급' },
  { value: '2', label: '2등급' },
  { value: '3', label: '3등급' },
  { value: '4', label: '4등급' },
  { value: '5', label: '5등급' },
  { value: 'cognitive', label: '인지지원등급' },
  { value: 'APPLYING', label: '신청 중' },
  { value: 'NONE', label: '등급 없음' },
];

export const DECLINE_REASONS: ReadonlyArray<{ value: IntakeDeclineReason; label: string }> = [
  { value: 'CAPACITY', label: '정원 초과' },
  { value: 'OUT_OF_AREA', label: '이용 지역 밖' },
  { value: 'SERVICE_MISMATCH', label: '제공할 수 있는 서비스와 맞지 않음' },
  { value: 'OTHER', label: '기타' },
];

export const DECLINE_LAW_NOTE = '노인장기요양보험법 제35조: 정당한 사유 없이 급여 제공을 거부할 수 없습니다. 거절한 사유와 날짜를 꼭 남겨 주세요.';
export const NO_CONSENT_MESSAGE = '개인정보 수집·이용 동의일을 적어야 연락처를 저장할 수 있습니다';

/** NEW로 이만큼(일)을 넘게 지나면 오래된 새 문의로 알린다 */
export const STALE_NEW_DAYS = 7;

export function intakeStatusLabel(status: string): string {
  return INTAKE_STATUSES.find((s) => s.value === status)?.label ?? status;
}

type InquiryLike = Pick<IntakeInquiry, 'id' | 'inquiryDate' | 'status'>;

export interface WaitlistEntry<T extends InquiryLike = InquiryLike> {
  /** 1부터 */
  rank: number;
  inquiry: T;
}

/** 대기(WAITING)만, 문의일 오름차순(같으면 id 오름차순)으로 순번을 매긴다 */
export function waitlist<T extends InquiryLike>(inquiries: ReadonlyArray<T>): Array<WaitlistEntry<T>> {
  return inquiries
    .filter((q) => q.status === 'WAITING')
    .sort((a, b) => (a.inquiryDate < b.inquiryDate ? -1 : a.inquiryDate > b.inquiryDate ? 1 : a.id - b.id))
    .map((inquiry, i) => ({ rank: i + 1, inquiry }));
}

export type InquiryAlertCode = 'FOLLOW_UP_DUE' | 'NO_CONSENT' | 'DECLINE_REASON_MISSING' | 'STALE_NEW';

export interface InquiryAlert {
  inquiryId: number;
  code: InquiryAlertCode;
  message: string;
}

type AlertLike = InquiryLike & Pick<IntakeInquiry, 'contactPhone' | 'consentOn' | 'nextContactOn' | 'declineReason'>;

function hasText(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * 확인할 것. 연락 예정일이 오늘이거나 지났는데 아직 진행 중(NEW·CONSULTED·WAITING),
 * 연락처가 있는데 동의일이 없음(서버도 막지만 옛 기록 대비), 이용 불가인데 사유가 없음, 새 문의로 7일을 넘김.
 * 결과는 문의 id 순, 같은 문의 안에서는 위 순서.
 */
export function inquiryAlerts(inquiries: ReadonlyArray<AlertLike>, today: string): InquiryAlert[] {
  const out: InquiryAlert[] = [];
  const open = (s: IntakeStatus) => s === 'NEW' || s === 'CONSULTED' || s === 'WAITING';
  for (const q of [...inquiries].sort((a, b) => a.id - b.id)) {
    if (q.nextContactOn && isValidYmd(q.nextContactOn) && open(q.status) && q.nextContactOn.slice(0, 10) <= today) {
      out.push({ inquiryId: q.id, code: 'FOLLOW_UP_DUE', message: `연락 예정일(${q.nextContactOn.slice(0, 10)})이 되었습니다` });
    }
    if (hasText(q.contactPhone) && !q.consentOn) {
      out.push({ inquiryId: q.id, code: 'NO_CONSENT', message: '연락처가 있는데 개인정보 수집·이용 동의일이 없습니다' });
    }
    if (q.status === 'DECLINED' && !q.declineReason) {
      out.push({ inquiryId: q.id, code: 'DECLINE_REASON_MISSING', message: '이용 불가로 처리했는데 사유가 없습니다 (노인장기요양보험법 제35조)' });
    }
    if (q.status === 'NEW') {
      const days = daysBetween(q.inquiryDate, today);
      if (days !== null && days > STALE_NEW_DAYS) out.push({ inquiryId: q.id, code: 'STALE_NEW', message: `새 문의로 ${days}일이 지났습니다` });
    }
  }
  return out;
}

export interface IntakeStats {
  total: number;
  bySource: Record<IntakeSource, number>;
  byStatus: Record<IntakeStatus, number>;
  contracted: number;
  /** 계약 완료 ÷ 문의 수(%, 소수 첫째 자리 반올림). 문의가 없으면 null */
  conversionRate: number | null;
}

/** 그 해(문의일 기준) 문의 통계 */
export function intakeStats(inquiries: ReadonlyArray<Pick<IntakeInquiry, 'inquiryDate' | 'source' | 'status'>>, year: number): IntakeStats {
  const bySource: Record<IntakeSource, number> = { PHONE: 0, VISIT: 0, REFERRAL: 0, WEB: 0, OTHER: 0 };
  const byStatus: Record<IntakeStatus, number> = { NEW: 0, CONSULTED: 0, WAITING: 0, CONTRACTED: 0, DECLINED: 0, WITHDRAWN: 0 };
  const prefix = `${String(year).padStart(4, '0')}-`;
  let total = 0;
  for (const q of inquiries) {
    if (typeof q?.inquiryDate !== 'string' || !q.inquiryDate.startsWith(prefix)) continue;
    total += 1;
    if (q.source in bySource) bySource[q.source] += 1;
    if (q.status in byStatus) byStatus[q.status] += 1;
  }
  const contracted = byStatus.CONTRACTED;
  const conversionRate = total === 0 ? null : Math.floor((2000 * contracted + total) / (2 * total)) / 10;
  return { total, bySource, byStatus, contracted, conversionRate };
}
