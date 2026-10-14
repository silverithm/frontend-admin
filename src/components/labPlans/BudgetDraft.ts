/** 예산 편집 상태 — 줄마다 화면 안에서만 쓰는 key를 달아 추가·삭제해도 입력칸이 섞이지 않게 한다. */
import { MAX_BUDGET_NOTE, budgetInputIssues } from '@/lib/lab/budgetRules';
import type { Budget, BudgetInput, BudgetLine, LedgerDirection } from '@/lib/lab/labTypes';

export const MAX_REVISION = 9;

export const DIRECTION_NAME: Record<LedgerDirection, string> = { INCOME: '세입', EXPENSE: '세출' };

export function revisionLabel(revision: number): string {
  return revision === 0 ? '본예산' : `${revision}차 추경`;
}

export interface LineDraft {
  key: number;
  direction: LedgerDirection;
  accountCode: string;
  amount: number | null;
  note: string;
}

export interface BudgetDraft {
  /** 서버에 저장된 예산이면 id, 아직 저장 전이면 null */
  id: number | null;
  fiscalYear: number;
  revision: number;
  decidedOn: string;
  note: string;
  status: Budget['status'] | null;
  lines: LineDraft[];
}

let lineKey = 0;
export function nextLineKey(): number {
  lineKey += 1;
  return lineKey;
}

export function newLine(direction: LedgerDirection, accountCode = '', amount: number | null = null, note = ''): LineDraft {
  return { key: nextLineKey(), direction, accountCode, amount, note };
}

export function emptyBudgetDraft(fiscalYear: number, revision: number): BudgetDraft {
  return { id: null, fiscalYear, revision, decidedOn: '', note: '', status: null, lines: [] };
}

function linesOf(lines: ReadonlyArray<BudgetLine>): LineDraft[] {
  return lines.map((l) => newLine(l.direction, l.accountCode, l.amount, l.note ?? ''));
}

export function draftOfBudget(b: Budget): BudgetDraft {
  return { id: b.id, fiscalYear: b.fiscalYear, revision: b.revision, decidedOn: b.decidedOn ?? '', note: b.note ?? '', status: b.status, lines: linesOf(b.lines) };
}

/** 앞 차수를 복사해 다음 차수 초안을 만든다(저장 전). 확정 상태·결정일은 가져오지 않는다. */
export function supplementaryOf(prev: Budget): BudgetDraft {
  return { id: null, fiscalYear: prev.fiscalYear, revision: prev.revision + 1, decidedOn: '', note: '', status: null, lines: linesOf(prev.lines) };
}

export function inputOfBudgetDraft(d: BudgetDraft): BudgetInput {
  return {
    fiscalYear: d.fiscalYear,
    revision: d.revision,
    decidedOn: d.decidedOn === '' ? null : d.decidedOn,
    note: d.note.trim() === '' ? null : d.note.trim(),
    lines: d.lines.map((l) => ({ direction: l.direction, accountCode: l.accountCode, amount: l.amount ?? 0, note: l.note.trim() === '' ? null : l.note.trim() })),
  };
}

/** 합계·집행 계산용 줄(금액이 비어 있으면 0) */
export function plainLines(d: BudgetDraft): Array<Pick<BudgetLine, 'direction' | 'accountCode' | 'amount'>> {
  return d.lines.filter((l) => l.accountCode !== '').map((l) => ({ direction: l.direction, accountCode: l.accountCode, amount: l.amount ?? 0 }));
}

/** 저장 전 점검 — 규칙의 budgetInputIssues를 그대로 쓰고, 계정을 고르지 않은 줄은 먼저 알려 준다 */
export function draftIssues(d: BudgetDraft): string[] {
  const input = inputOfBudgetDraft(d);
  const blankAt = d.lines.map((l, i) => (l.accountCode === '' ? `${i + 1}번째 줄: ` : null)).filter((m): m is string => m !== null);
  const blank = blankAt.map((at) => `${at}계정을 골라 주세요`);
  // 계정을 고르지 않은 줄에는 "목록에 없음"·"두 번 있음"이 따라 붙으므로 위 안내 하나만 남긴다
  const rest = budgetInputIssues({ fiscalYear: input.fiscalYear, revision: input.revision, note: input.note, lines: input.lines }).filter((m) => !blankAt.some((at) => m.startsWith(at)));
  return [...blank, ...rest];
}

/** 저장하지 않은 변경이 있는지 비교하려는 글자 — 화면용 key는 뺀다 */
export function fingerprint(d: BudgetDraft): string {
  return JSON.stringify({ r: d.revision, y: d.fiscalYear, d: d.decidedOn, n: d.note, l: d.lines.map((l) => [l.direction, l.accountCode, l.amount, l.note]) });
}

export { MAX_BUDGET_NOTE };
