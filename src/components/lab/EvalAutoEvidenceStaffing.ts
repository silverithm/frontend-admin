/**
 * 평가 지표 자동 근거 중 8차에 더한 둘 — 인력배치기준(STAFFING_STANDARD), 진료 동행 기록(MEDICAL_VISIT_RECORDS).
 * EvalAutoEvidence의 collect가 이 함수를 불러 같은 모양({lines})의 근거를 받는다. 규칙은 lib/lab의 staffingRules·medicalVisitRules가 맡는다.
 */
import { listMedicalVisits, listStaffingMonths } from '@/lib/lab/labApi';
import { visitStats } from '@/lib/lab/medicalVisitRules';
import { monthlyUsers, previousMonth, staffGroupLabel, staffingCheck, standardMonthlyHours } from '@/lib/lab/staffingRules';
import type { StaffingCheck } from '@/lib/lab/staffingRules';
import type { StaffingMonth } from '@/lib/lab/labTypes';
import type { EvalAutoSource } from '@/lib/lab/evalIndicators';
import { monthLabel } from './labFormat';

export interface StaffingEvidence {
  lines: string[];
}

const SOURCES: readonly EvalAutoSource[] = ['STAFFING_STANDARD', 'MEDICAL_VISIT_RECORDS'];

/** 이 파일이 맡는 자동 근거인가 */
export function isStaffingEvidenceSource(source: EvalAutoSource): boolean {
  return SOURCES.includes(source);
}

/** 저장된 달 하나를 규칙으로 다시 계산한다 */
function recheck(m: StaffingMonth, previousViolated: boolean): StaffingCheck {
  return staffingCheck({
    users: monthlyUsers(m.usersSum, m.serviceDays),
    staff: m.staff,
    standardHours: standardMonthlyHours(m.staffingMonth, m.holidays),
    previousViolated,
  });
}

async function staffing(asOf: string): Promise<StaffingEvidence> {
  const year = Number(asOf.slice(0, 4));
  const months = [...(await listStaffingMonths(year))].sort((a, b) => a.staffingMonth.localeCompare(b.staffingMonth));
  if (months.length === 0) return { lines: [`${year}년 인력배치 점검 기록 없음 (${asOf} 기준)`, '월 인력배치 점검을 저장하면 결원·감산 위험을 여기서 다시 계산해 보여 드립니다'] };
  // 연속 위반 배수는 바로 앞 달이 저장돼 있고 위반이었을 때만 적용한다 — 앞 달부터 차례로 다시 계산한다
  const violated = new Map<string, boolean>();
  let latest: { month: StaffingMonth; check: StaffingCheck } | null = null;
  for (const m of months) {
    const prev = previousMonth(m.staffingMonth);
    const check = recheck(m, prev !== null && violated.get(prev) === true);
    violated.set(m.staffingMonth, check.violated);
    latest = { month: m, check };
  }
  const { month, check } = latest!;
  const users = monthlyUsers(month.usersSum, month.serviceDays);
  const label = monthLabel(month.staffingMonth);
  const short = check.rows.filter((r) => r.shortfall > 0).map((r) => `${staffGroupLabel(r.group)} ${r.shortfall}명`);
  return {
    lines: [
      `최근 저장한 ${label} 인력배치 점검(입소자 ${users}명): ${check.violated ? '배치 기준 위반(결원 있음)' : '배치 기준 위반 없음'}`,
      check.violated ? `결원 직종: ${short.join(' · ')}` : '결원 직종 없음',
      `감산 위험: 감액률 ${check.penaltyRate}% (감산점수 ${check.adjustedScoreSum}점${check.multiplier > 1 ? `, 연속 위반 ${check.multiplier}배` : ''}) (${asOf} 기준)`,
      ...(check.bonusHints.length > 0 ? check.bonusHints.map((h) => `가산 안내: ${h}`) : ['가산 안내: 해당 없음']),
      `올해 점검을 저장한 달: ${months.length}개월. 평가는 신고 인력과 공단 수가 감액·가산 이력으로 보며 감산·가산 점수표는 원문 대조 필요`,
    ],
  };
}

async function medicalVisits(asOf: string): Promise<StaffingEvidence> {
  const year = Number(asOf.slice(0, 4));
  // 진료 동행은 조회 조건이 하나 필요하므로 올해 1월부터 이번 달까지 달마다 받는다
  const thisMonth = Number(asOf.slice(5, 7));
  const months = Array.from({ length: thisMonth }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
  const visits = (await Promise.all(months.map((m) => listMedicalVisits({ month: m })))).flat();
  const stats = visitStats(visits, year);
  if (stats.total === 0) return { lines: [`${year}년에 기록된 진료 동행이 없습니다 (${asOf} 기준). 종사자가 동행한 진료가 없었다면 채울 내용도 없습니다`] };
  const escortRate = Math.round((stats.escorted / stats.total) * 100);
  return {
    lines: [
      `${year}년 진료 동행 ${stats.total}건 중 동행 직원을 적은 기록: ${stats.escorted}/${stats.total}건 (${escortRate}%)`,
      `보호자 알림을 남긴 기록: ${stats.guardianNotified}/${stats.total}건 (${stats.notifyRate ?? 0}%) (${asOf} 기준)`,
      '진료 내용 기록의 필수 항목은 규정에 없어 기관 서식입니다. 건수와 기재 여부만 센 것입니다 (대조 필요)',
    ],
  };
}

export async function collectStaffingEvidence(source: EvalAutoSource, asOf: string): Promise<StaffingEvidence> {
  if (source === 'STAFFING_STANDARD') return staffing(asOf);
  return medicalVisits(asOf);
}
