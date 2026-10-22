/**
 * 본인부담금 한 달치를 계약·출석으로 한 번에 채우는 계획 — 누구를 채우고 누구를 건너뛸지만 정한다(입력칸을 바꾸는 일은 화면이 한다).
 *
 * 왜: 청구서는 어르신마다 등급·감경 구분·이용일수를 손으로 채워야 해서, 어르신이 스무 명이면 같은 일을 스무 번 해야 했다.
 * 케어포는 일정·출석에서 청구를 만든다. 여기서는 계약(등급·감경 구분)과 출석일수로 채우되 아래는 절대 덮어쓰지 않는다.
 *  - 이미 저장된 청구서(BILLED) — 수납이 붙어 있을 수 있다
 *  - 직원이 이미 손으로 고친 칸(EDITED)
 * 계약이 없는 어르신(NO_CONTRACT)은 건너뛴다. 이용일수는 출석 기록이 있을 때만 넣고 없으면 비워 둔다(needsDays로 알린다).
 */
import type { CopayClass, LtcCareGrade } from './labTypes.ts';

export type BatchSkip = 'BILLED' | 'EDITED' | 'NO_CONTRACT';

export interface BatchContract {
  careGrade: LtcCareGrade;
  copayClass: CopayClass;
}

export interface BatchRow {
  elderId: number;
  /** FILL이면 grade·copayClass가 있고, days는 출석이 있으면 일수 아니면 null */
  action: 'FILL' | 'SKIP';
  skip: BatchSkip | null;
  grade: LtcCareGrade | null;
  copayClass: CopayClass | null;
  days: number | null;
}

export interface BatchPlan {
  rows: BatchRow[];
  /** 채울 어르신 수 */
  fillCount: number;
  /** 채우지만 출석 기록이 없어 이용일수를 직원이 적어야 하는 수 */
  needsDays: number;
  skipped: Record<BatchSkip, number>;
}

export interface BatchInput {
  elders: ReadonlyArray<{ id: number }>;
  /** 어르신 번호 → 진행 중 계약 */
  contracts: ReadonlyMap<number, BatchContract>;
  /** 이 달 청구서가 이미 저장된 어르신 */
  billed: ReadonlySet<number>;
  /** 직원이 이 화면에서 이미 고친 어르신 */
  edited: ReadonlySet<number>;
  /** 어르신 번호 → 출석일수. 출석 정보를 못 불러왔으면 null */
  presentDays: ReadonlyMap<number, number> | null;
}

export function planBatchFill(input: BatchInput): BatchPlan {
  const skipped: Record<BatchSkip, number> = { BILLED: 0, EDITED: 0, NO_CONTRACT: 0 };
  let fillCount = 0;
  let needsDays = 0;
  const rows: BatchRow[] = input.elders.map((elder) => {
    const skip = (reason: BatchSkip): BatchRow => {
      skipped[reason] += 1;
      return { elderId: elder.id, action: 'SKIP', skip: reason, grade: null, copayClass: null, days: null };
    };
    if (input.billed.has(elder.id)) return skip('BILLED');
    if (input.edited.has(elder.id)) return skip('EDITED');
    const contract = input.contracts.get(elder.id);
    if (!contract) return skip('NO_CONTRACT');
    const present = input.presentDays?.get(elder.id) ?? 0;
    const days = present > 0 ? present : null;
    fillCount += 1;
    if (days === null) needsDays += 1;
    return { elderId: elder.id, action: 'FILL', skip: null, grade: contract.careGrade, copayClass: contract.copayClass, days };
  });
  return { rows, fillCount, needsDays, skipped };
}

/** 계획을 한 줄 안내 문장으로 */
export function batchSummary(plan: BatchPlan): string {
  const parts = [`${plan.fillCount}명을 계약으로 채웠습니다`];
  if (plan.needsDays > 0) parts.push(`${plan.needsDays}명은 출석 기록이 없어 이용일수를 적어야 합니다`);
  if (plan.skipped.NO_CONTRACT > 0) parts.push(`계약이 없는 ${plan.skipped.NO_CONTRACT}명은 건너뛰었습니다`);
  if (plan.skipped.BILLED > 0) parts.push(`이미 저장된 청구서 ${plan.skipped.BILLED}건은 그대로 두었습니다`);
  if (plan.skipped.EDITED > 0) parts.push(`직접 고친 ${plan.skipped.EDITED}명은 그대로 두었습니다`);
  return parts.join(' · ');
}
