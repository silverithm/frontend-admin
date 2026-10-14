/**
 * 평가 지표 자동 근거 중 7차에 더한 여덟 — 프로그램 연간계획·의견수렴·신체 주 3회·사회적응 월 1회·월간 계획표 제공, 사업계획서, 식사 만족도 반기, 퇴직금 추계.
 * EvalAutoEvidence의 collect가 이 함수를 불러 같은 모양({lines})의 근거를 받는다. 규칙은 lib/lab의 programPlanRules·businessPlanRules·satisfactionRules·severanceRules가 맡는다.
 */
import { getBusinessPlan, getProgramSchedule, listPayrollLinesByYear, listPayrollProfiles, listProgramFeedback, listProgramPlans, listPrograms, listSatisfaction } from '@/lib/lab/labApi';
import { businessPlanIssues } from '@/lib/lab/businessPlanRules';
import { annualPlanStatus, feedbackStatus, planCategoryLabel, socialMonthlyStatus, weeklyCategoryStatus } from '@/lib/lab/programPlanRules';
import { recentWeeklyStatuses } from '@/lib/lab/programRules';
import { mealSurveyHalfStatus } from '@/lib/lab/satisfactionRules';
import { averageWageMonths, severanceLiability } from '@/lib/lab/severanceRules';
import type { SeveranceLine } from '@/lib/lab/severanceRules';
import type { EvalAutoSource } from '@/lib/lab/evalIndicators';
import { dotDate, monthLabel, shiftMonth } from './labFormat';

export interface ProgramEvidence {
  lines: string[];
}

const SOURCES: readonly EvalAutoSource[] = ['PROGRAM_ANNUAL_PLAN', 'PROGRAM_FEEDBACK', 'PROGRAM_PHYSICAL_WEEKLY', 'PROGRAM_SOCIAL_MONTHLY', 'MONTHLY_SCHEDULE_SHARED', 'BUSINESS_PLAN', 'MEAL_SURVEY_HALF', 'SEVERANCE_READY'];

/** 이 파일이 맡는 자동 근거인가 */
export function isProgramEvidenceSource(source: EvalAutoSource): boolean {
  return SOURCES.includes(source);
}

const won = (value: number) => `${value.toLocaleString('ko-KR')}원`;

/** 끝난 최근 세 달(오래된 달부터) */
function lastThreeMonths(asOf: string): string[] {
  const thisMonth = asOf.slice(0, 7);
  return [-3, -2, -1].map((d) => shiftMonth(thisMonth, d));
}

async function annualPlan(asOf: string): Promise<ProgramEvidence> {
  const year = Number(asOf.slice(0, 4));
  const statuses = annualPlanStatus(await listProgramPlans(year), year);
  const ok = statuses.filter((s) => s.ok).length;
  return {
    lines: [
      `${year}년 프로그램 연간계획(신체기능·인지기능·사회적응) 중 갖춘 것: ${ok}/${statuses.length}개 (${asOf} 기준)`,
      ...statuses.map((s) => {
        const name = planCategoryLabel(s.category);
        if (s.issue === 'MISSING' || !s.plan) return `· ${name}: 연간계획 없음`;
        if (s.issue === 'WRITTEN_OUTSIDE_YEAR') return `· ${name}: 작성일 ${dotDate(s.plan.writtenOn)} — 그 해(또는 직전 해 12월)에 쓴 계획이 아니라 인정되지 않을 수 있음`;
        return `· ${name}: 작성일 ${dotDate(s.plan.writtenOn)} · ${s.plan.frequency}`;
      }),
    ],
  };
}

async function feedback(asOf: string): Promise<ProgramEvidence> {
  const year = Number(asOf.slice(0, 4));
  const status = feedbackStatus(await listProgramFeedback(year), year);
  const month = Number(asOf.slice(5, 7));
  const half = (done: boolean, h: 1 | 2) => (done ? '수렴함' : h === 2 && month <= 6 ? '아직 아님' : h === 1 && month <= 6 ? '진행 중' : '기록 없음');
  return {
    lines: [
      `${year}년 프로그램 의견수렴: 상반기(1~6월) ${half(status.h1, 1)} · 하반기(7~12월) ${half(status.h2, 2)}`,
      `수렴한 의견을 프로그램에 반영한 기록(연 1회 이상): ${status.reflected ? '있음' : '없음'} (${asOf} 기준)`,
      '의견수렴과 반영 기록만 센 것입니다. 반영 전·후 계획서 비교는 따로 확인해 주세요 (대조 필요)',
    ],
  };
}

async function programsOf(months: string[]) {
  return (await Promise.all(months.map((m) => listPrograms(m)))).flat();
}

async function physicalWeekly(asOf: string): Promise<ProgramEvidence> {
  // 끝난 최근 4주가 두세 달에 걸칠 수 있어, 그 주들이 닿는 달을 모두 불러온다
  const weeks = recentWeeklyStatuses([], asOf, 4);
  const months = [...new Set(weeks.flatMap((w) => [w.weekStart.slice(0, 7), w.weekEnd.slice(0, 7)]))];
  const programs = await programsOf(months);
  const statuses = weeks.map((w) => ({ ...w, ...weeklyCategoryStatus(programs, w.weekStart, 'PHYSICAL') }));
  const met = statuses.filter((s) => s.met).length;
  const first = statuses[0];
  const last = statuses[statuses.length - 1];
  return {
    lines: [
      `최근 ${statuses.length}주(${dotDate(first.weekStart)} ~ ${dotDate(last.weekEnd)}) 중 신체기능 프로그램을 주 3회 이상 운영한 주: ${met}/${statuses.length}주`,
      ...statuses.map((w) => `· ${dotDate(w.weekStart)} ~ ${dotDate(w.weekEnd)} 주: 신체기능 프로그램 ${w.count}회 (${w.met ? '충족' : '미충족'})`),
      `진행 중인 이번 주는 제외했습니다 (${asOf} 기준)`,
    ],
  };
}

async function socialMonthly(asOf: string): Promise<ProgramEvidence> {
  const months = lastThreeMonths(asOf);
  const programs = await programsOf(months);
  const statuses = months.map((m) => ({ month: m, ...socialMonthlyStatus(programs, m) }));
  const met = statuses.filter((s) => s.met).length;
  const leisure = programs.filter((p) => p.category === 'LEISURE').length;
  return {
    lines: [
      `최근 ${months.length}개월 중 사회적응 프로그램을 월 1회 이상 운영한 달: ${met}/${months.length}개월`,
      ...statuses.map((s) => `· ${monthLabel(s.month)}: 사회적응 프로그램 ${s.count}회 (${s.met ? '충족' : '미충족'})`),
      `여가·취미 프로그램 ${leisure}회는 세지 않았습니다 — 사회적응으로 인정되는 범위는 대조 필요`,
      `진행 중인 이번 달은 제외했습니다 (${asOf} 기준)`,
    ],
  };
}

async function scheduleShared(asOf: string): Promise<ProgramEvidence> {
  const months = lastThreeMonths(asOf);
  const schedules = await Promise.all(months.map((m) => getProgramSchedule(m)));
  const rows = months.map((m, i) => ({ month: m, schedule: schedules[i] }));
  const shared = rows.filter((r) => r.schedule?.sharedOn).length;
  return {
    lines: [
      `최근 ${months.length}개월 중 월간 프로그램 계획표를 보호자에게 제공한 달: ${shared}/${months.length}개월`,
      ...rows.map((r) => {
        if (!r.schedule) return `· ${monthLabel(r.month)}: 계획표 없음`;
        if (!r.schedule.sharedOn) return `· ${monthLabel(r.month)}: 계획표는 있으나 제공일 기록 없음`;
        return `· ${monthLabel(r.month)}: ${dotDate(r.schedule.sharedOn)} 제공`;
      }),
      `진행 중인 이번 달은 제외했습니다. 식단표·기관 소식 제공은 따로 확인해 주세요 (${asOf} 기준)`,
    ],
  };
}

async function businessPlan(asOf: string): Promise<ProgramEvidence> {
  const year = Number(asOf.slice(0, 4));
  const plan = await getBusinessPlan(year);
  if (!plan) return { lines: [`${year}년 사업계획서가 아직 없습니다 (${asOf} 기준)`] };
  const issues = businessPlanIssues(plan);
  if (issues.length === 0) return { lines: [`${year}년 사업계획서: 세 분야·항목 여섯 칸·총수입·총지출을 모두 채웠습니다 (${asOf} 기준)`, '필수 칸을 센 것입니다. 계획서의 내용과 결재·공유 여부는 따로 확인해 주세요'] };
  const shown = issues.slice(0, 5).map((i) => `· ${i.message}`);
  return {
    lines: [
      `${year}년 사업계획서: 채워야 할 곳 ${issues.length}건 (${asOf} 기준)`,
      ...shown,
      ...(issues.length > shown.length ? [`· 그 밖에 ${issues.length - shown.length}건`] : []),
    ],
  };
}

async function mealSurvey(asOf: string): Promise<ProgramEvidence> {
  const year = Number(asOf.slice(0, 4));
  const responses = await listSatisfaction({ kind: 'MEAL', from: `${year}-01-01`, to: asOf });
  const status = mealSurveyHalfStatus(responses, year);
  const month = Number(asOf.slice(5, 7));
  const half = (n: number, h: 1 | 2) => (n > 0 ? `${n}건 실시` : h === 1 && month <= 6 ? '아직 없음(진행 중)' : h === 2 && month <= 6 ? '아직 아님' : '실시 기록 없음');
  return {
    lines: [
      `${year}년 식사 만족도 조사: 상반기(1~6월) ${half(status.h1, 1)} · 하반기(7~12월) ${half(status.h2, 2)}`,
      `반기마다 1건 이상 실시한 반기: ${[status.met.h1, status.met.h2].filter(Boolean).length}/2 (${asOf} 기준)`,
      '응답이 있는 반기만 센 것입니다. 모든 수급자를 대상으로 했는지는 따로 확인해 주세요 (대조 필요)',
    ],
  };
}

async function severance(asOf: string): Promise<ProgramEvidence> {
  const profiles = await listPayrollProfiles();
  if (profiles.length === 0) return { lines: ['등록된 직원 급여 기준이 없어 퇴직금 추계를 셀 수 없습니다'] };
  // 평균임금은 퇴직일 직전 석 달의 급여대장으로 계산한다 — 그 달들이 걸친 해의 급여대장을 받는다
  const wageMonths = averageWageMonths(asOf);
  const years = [...new Set(wageMonths.map((m) => Number(m.slice(0, 4))))];
  const lines = (await Promise.all(years.map((y) => listPayrollLinesByYear(y)))).flat().filter((l) => wageMonths.includes(l.payMonth));
  const byMember: Record<number, SeveranceLine[]> = {};
  for (const l of lines) (byMember[l.memberId] ??= []).push(l);
  const liability = severanceLiability(profiles, byMember, asOf);
  const eligible = liability.members.filter((m) => m.eligible);
  const noLines = eligible.filter((m) => (byMember[m.memberId] ?? []).length === 0).length;
  return {
    lines: [
      `직원 ${profiles.length}명 중 계속근로 1년 이상·주 15시간 이상이라 퇴직금 대상인 직원: ${eligible.length}명 (${asOf} 기준)`,
      `${dotDate(asOf)}에 모두 퇴직한다고 가정한 추계 합계: ${won(liability.total)}`,
      ...(noLines > 0 ? [`대상자 중 ${noLines}명은 직전 석 달 급여대장이 없어 통상임금으로만 계산했습니다`] : []),
      '퇴직금 제도 운영과 실제 지급 준비(적립) 여부는 따로 확인해 주세요. 상여·연차수당 가산은 대조 필요',
    ],
  };
}

export async function collectProgramEvidence(source: EvalAutoSource, asOf: string): Promise<ProgramEvidence> {
  if (source === 'PROGRAM_ANNUAL_PLAN') return annualPlan(asOf);
  if (source === 'PROGRAM_FEEDBACK') return feedback(asOf);
  if (source === 'PROGRAM_PHYSICAL_WEEKLY') return physicalWeekly(asOf);
  if (source === 'PROGRAM_SOCIAL_MONTHLY') return socialMonthly(asOf);
  if (source === 'MONTHLY_SCHEDULE_SHARED') return scheduleShared(asOf);
  if (source === 'BUSINESS_PLAN') return businessPlan(asOf);
  if (source === 'MEAL_SURVEY_HALF') return mealSurvey(asOf);
  return severance(asOf);
}
