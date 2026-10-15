/**
 * 감염병 유행·발생·국가 위기 대응 기록 점검 — 2026 감염관리 기준③(research-10 §4, 2023 공단 안전·감염관리 매뉴얼).
 * 유행 = 같은 증상 2명 이상(또는 심각한 감염병 1건), 확진·의심 즉시 보건소 통보와 지자체·공단 보고. 전부 브라우저 안에서 도는 순수 함수다.
 * 확인 못 한 것(대조 필요): 신고 기한(며칠 안)은 평가 문구에 없어 날짜가 비었는지만 본다.
 */
import { daysBetween, isValidYmd } from './labDate.ts';
import type { Outbreak, OutbreakActionKey } from './labTypes.ts';

export const OUTBREAK_ACTIONS: ReadonlyArray<{ key: OutbreakActionKey; label: string }> = [
  { key: 'VISIT_LIMIT', label: '면회 제한' },
  { key: 'FEVER_CHECK', label: '직원·방문객 발열 확인' },
  { key: 'EXTRA_DISINFECT', label: '추가 소독' },
  { key: 'HYGIENE_SUPPLY', label: '위생용품 비치' },
  { key: 'EXTRA_TRAINING', label: '예방 추가 교육' },
  { key: 'FLU_VACCINE', label: '독감 예방접종' },
  { key: 'MASK_HAND', label: '손소독·마스크' },
  { key: 'SYMPTOM_WATCH', label: '수급자 증상 관찰' },
  { key: 'ISOLATION', label: '일시 격리' },
  { key: 'HOSPITAL_TRANSFER', label: '병원 이송' },
  { key: 'ACTIVITY_STOP', label: '단체 활동 중단·휴업' },
];

export type OutbreakGap = 'GUARDIAN' | 'HEALTH_CENTER' | 'AUTHORITY';

export const OUTBREAK_GAP_LABEL: Readonly<Record<OutbreakGap, string>> = {
  GUARDIAN: '보호자 안내일',
  HEALTH_CENTER: '보건소 신고일',
  AUTHORITY: '지자체·공단 보고일',
};

export interface OutbreakCheck {
  /** OUTBREAK·CASE만 — 비어 있는 안내·신고·보고, 이 순서. NATIONAL은 [] */
  missing: OutbreakGap[];
  /** 종료일이 없음 */
  open: boolean;
  /** 진행 중이면 asOf − 시작일, 종료됐으면 종료일 − 시작일(0 아래로 내려가지 않음) */
  daysOpen: number;
}

const has = (value: string | null | undefined): boolean => typeof value === 'string' && isValidYmd(value);

type OutbreakLike = Pick<Outbreak, 'kind' | 'startedOn' | 'endedOn' | 'guardianNotifiedOn' | 'healthCenterReportedOn' | 'authorityReportedOn' | 'actions'>;

export function outbreakCheck(o: OutbreakLike, asOf: string): OutbreakCheck {
  const missing: OutbreakGap[] = [];
  if (o.kind !== 'NATIONAL') {
    if (!has(o.guardianNotifiedOn)) missing.push('GUARDIAN');
    if (!has(o.healthCenterReportedOn)) missing.push('HEALTH_CENTER');
    if (!has(o.authorityReportedOn)) missing.push('AUTHORITY');
  }
  const open = !has(o.endedOn);
  const span = daysBetween(o.startedOn, open ? asOf : (o.endedOn as string));
  return { missing, open, daysOpen: span === null ? 0 : Math.max(0, span) };
}

export interface OutbreakSummary {
  /** 시작일이 [from, to] 안인 기록 수 */
  total: number;
  open: number;
  /** 빠진 신고·안내가 없는 기록 수 */
  complete: number;
  /** 조치를 하나 이상 적은 기록 수 */
  withActions: number;
}

export function outbreakSummary(outbreaks: readonly OutbreakLike[], from: string, to: string, asOf: string): OutbreakSummary {
  const inRange = outbreaks.filter((o) => isValidYmd(o.startedOn) && o.startedOn.slice(0, 10) >= from && o.startedOn.slice(0, 10) <= to);
  const checks = inRange.map((o) => outbreakCheck(o, asOf));
  return {
    total: inRange.length,
    open: checks.filter((c) => c.open).length,
    complete: checks.filter((c) => c.missing.length === 0).length,
    withActions: inRange.filter((o) => Array.isArray(o.actions) && o.actions.length > 0).length,
  };
}
