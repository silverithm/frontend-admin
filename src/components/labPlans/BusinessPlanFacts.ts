/** 지난해 실험실 기록을 숫자로만 요약한다(프로그램·교육·사고 건수, 어르신 수, 예산 합). 이름은 읽지도 보내지도 않는다. */
import { latestBudget, budgetTotals } from '@/lib/lab/budgetRules';
import { listBudgets, listCareEvents, listPrograms, listStaffTrainings } from '@/lib/lab/labApi';
import type { BusinessPlanFacts } from '@/lib/lab/labTypes';

export interface FactsResult {
  facts: BusinessPlanFacts;
  /** 일부를 못 읽었을 때의 안내(읽은 것만으로 요약했다는 뜻) */
  warnings: string[];
}

const months = (year: number) => Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);

export async function loadPlanFacts(year: number, elderCount: number | null): Promise<FactsResult> {
  const past = year - 1;
  const [programs, events, trainings, budgets] = await Promise.all([
    Promise.allSettled(months(past).map((m) => listPrograms(m))),
    Promise.allSettled(months(past).map((m) => listCareEvents({ month: m }))),
    Promise.allSettled([listStaffTrainings(past)]),
    Promise.allSettled([listBudgets(past)]),
  ]);
  const warnings: string[] = [];
  const countOf = (rs: PromiseSettledResult<unknown[]>[], name: string) => {
    let total = 0;
    let failed = 0;
    for (const r of rs) {
      if (r.status === 'fulfilled') total += r.value.length;
      else failed += 1;
    }
    if (failed > 0) warnings.push(`${past}년 ${name} ${failed}개 항목을 읽지 못해 읽은 것만 셌습니다`);
    return total;
  };
  const budgetResult = budgets[0];
  let budgetTotal: BusinessPlanFacts['budgetTotals'] = null;
  if (budgetResult.status === 'fulfilled') {
    const latest = latestBudget(budgetResult.value, past);
    if (latest) {
      const t = budgetTotals(latest);
      budgetTotal = { income: t.income, expense: t.expense };
    }
  } else warnings.push(`${past}년 예산을 읽지 못했습니다`);
  if (elderCount === null) warnings.push('어르신 수를 읽지 못했습니다');
  return {
    facts: {
      programs: countOf(programs, '프로그램'),
      trainings: countOf(trainings, '직원 교육'),
      events: countOf(events, '사고·응급 기록'),
      elders: elderCount ?? 0,
      budgetTotals: budgetTotal,
    },
    warnings,
  };
}
