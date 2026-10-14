/**
 * 진료 동행 기록 규칙(순수 함수).
 *
 * 근거(research-8.md 4절, 2026 주야간보호 평가 30 외부기관연계 기준①)
 *  - 수급자가 급여제공시간 내에 종사자와 동행해 의료기관에서 진료받은 내용을 급여제공기록지·간호일지·상담일지 등에 기록했는가.
 *
 * ⚠ 대조 필요: 매뉴얼은 진료일·병원·진료과·진료 내용·처방·동행 직원·보호자 통보 같은 필수 기재 항목을 정하지 않았다.
 * 이 모듈의 항목은 규정 요구가 아니라 기관 서식(제품 설계 선택)이다. 보호자가 직접 동행한 진료를 기록 대상으로 보는지도 확인하지 못했다.
 */
import type { MedicalVisit } from './labTypes.ts';

export const NO_DEPARTMENT_LABEL = '미기재';
export const MAX_VISIT_HOSPITAL = 100;
export const MAX_VISIT_DEPARTMENT = 40;
export const MAX_VISIT_REASON = 1000;
export const MAX_VISIT_RESULT = 2000;
export const MAX_VISIT_PRESCRIPTION = 1000;
export const MAX_VISIT_ESCORT = 50;
export const MAX_VISIT_GUARDIAN_NOTE = 100;
/** 급여제공기록 특이사항에 넣는 진료 내용 요약 길이 */
export const CARE_RECORD_SUMMARY_CHARS = 60;

export type VisitStatsLike = Pick<MedicalVisit, 'visitDate'> & Partial<Pick<MedicalVisit, 'department' | 'escortName' | 'guardianNotified'>>;

export interface VisitStats {
  total: number;
  byDepartment: Record<string, number>;
  /** 동행 직원 이름이 적힌 기록 수 */
  escorted: number;
  guardianNotified: number;
  /** 보호자 알림 비율(%, 소수 첫째 자리 반올림). 기록이 없으면 null */
  notifyRate: number | null;
}

/** 그 해 진료 동행 통계 */
export function visitStats(visits: readonly VisitStatsLike[], year: number): VisitStats {
  const prefix = `${year}-`;
  const inYear = visits.filter((v) => typeof v.visitDate === 'string' && v.visitDate.startsWith(prefix));
  const byDepartment: Record<string, number> = {};
  let escorted = 0;
  let notified = 0;
  for (const v of inYear) {
    const dept = (v.department ?? '').trim() || NO_DEPARTMENT_LABEL;
    byDepartment[dept] = (byDepartment[dept] ?? 0) + 1;
    if ((v.escortName ?? '').trim() !== '') escorted += 1;
    if (v.guardianNotified === true) notified += 1;
  }
  const total = inYear.length;
  // 정수 연산으로 반올림 — 66.65 같은 경계에서 부동소수 오차가 나지 않게 한다
  const notifyRate = total === 0 ? null : Math.floor((2 * notified * 1000 + total) / (2 * total)) / 10;
  return { total, byDepartment, escorted, guardianNotified: notified, notifyRate };
}

export type FollowUpLike = Pick<MedicalVisit, 'followUpOn' | 'followUpDone'>;

/** 후속 확인 날짜가 오늘이거나 지났는데 아직 확인하지 않은 기록, 날짜가 오래된 것부터 */
export function followUpsDue<T extends FollowUpLike>(visits: readonly T[], today: string): T[] {
  return visits
    .filter((v) => typeof v.followUpOn === 'string' && v.followUpOn !== '' && v.followUpOn <= today && !v.followUpDone)
    .sort((a, b) => (a.followUpOn! < b.followUpOn! ? -1 : a.followUpOn! > b.followUpOn! ? 1 : 0));
}

function oneLine(text: string | null | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

function firstChars(text: string, max: number): string {
  const chars = Array.from(text);
  return chars.length <= max ? text : `${chars.slice(0, max).join('').trim()}…`;
}

export type VisitTextLike = Partial<Pick<MedicalVisit, 'startTime' | 'endTime' | 'hospital' | 'department' | 'escortName' | 'result'>>;

/**
 * 급여제공기록 특이사항에 넣을 한 줄. 예) "10:00~11:30 서울정형외과 정형외과 진료 동행(직원 박요양) — 무릎 X-ray 이상 없음…"
 * 시각이 없으면 시각 부분을 빼고, 진료 내용은 앞 60자만 싣는다.
 */
export function visitCareRecordText(visit: VisitTextLike): string {
  const start = oneLine(visit.startTime);
  const end = oneLine(visit.endTime);
  const time = start && end ? `${start}~${end}` : start ? `${start}부터` : end ? `${end}까지` : '';
  const hospital = oneLine(visit.hospital);
  const department = oneLine(visit.department);
  const escort = oneLine(visit.escortName);
  const result = firstChars(oneLine(visit.result), CARE_RECORD_SUMMARY_CHARS);
  const place = [hospital, department].filter(Boolean).join(' ');
  const head = [time, place ? `${place} 진료 동행` : '진료 동행'].filter(Boolean).join(' ');
  const withEscort = escort ? `${head}(직원 ${escort})` : head;
  return result ? `${withEscort} — ${result}` : withEscort;
}
