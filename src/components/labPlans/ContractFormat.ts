/** 계약·인정 화면 공용 — 라벨 목록, 알림 색, 날짜 글. */
import { CARE_GRADES, COPAY_CLASSES } from '@/lib/ltc2026';
import type { ContractAlertLevel } from '@/lib/lab/contractRules';
import type { ContractEndReason, ContractStatus } from '@/lib/lab/labTypes';
import type { Tone } from '@/components/lab/LabUi';

export const GRADE_OPTIONS = CARE_GRADES.map((g) => ({ value: g.id as string, label: g.label }));
export const COPAY_OPTIONS = COPAY_CLASSES.map((c) => ({ value: c.id as string, label: c.label }));

export const STATUS_OPTIONS: ReadonlyArray<{ value: ContractStatus; label: string }> = [
  { value: 'ACTIVE', label: '진행 중' },
  { value: 'ENDED', label: '종료' },
];

export const END_REASON_OPTIONS: ReadonlyArray<{ value: ContractEndReason; label: string }> = [
  { value: 'TRANSFER', label: '다른 기관·시설로 옮김(전원)' },
  { value: 'SELF', label: '본인·보호자 희망으로 종료' },
  { value: 'HOSPITAL', label: '입원' },
  { value: 'DEATH', label: '사망' },
  { value: 'OTHER', label: '그 밖의 사유' },
];

export function endReasonLabel(reason: string | null | undefined): string {
  return END_REASON_OPTIONS.find((r) => r.value === reason)?.label ?? '';
}

/** 계약을 끝낼 때 퇴소 연계기록지를 써야 하는 사유인가(사망·입원만 한 경우는 쓰지 않는다) */
export function endNeedsReferral(reason: string | null | undefined): boolean {
  return reason === 'TRANSFER' || reason === 'SELF' || reason === 'OTHER';
}

export const ALERT_TONE: Record<ContractAlertLevel, Tone> = { DANGER: 'danger', WARN: 'warn', INFO: 'info' };
export const ALERT_LABEL: Record<ContractAlertLevel, string> = { DANGER: '위험', WARN: '주의', INFO: '안내' };

export function gradeText(grade: string): string {
  return CARE_GRADES.find((g) => g.id === grade)?.label ?? grade;
}

export function copayText(copayClass: string): string {
  return COPAY_CLASSES.find((c) => c.id === copayClass)?.label ?? copayClass;
}
