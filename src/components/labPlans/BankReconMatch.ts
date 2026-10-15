/** 붙여넣은 통장 거래와 그 달 장부를 맞춘 결과를 화면·인쇄용 모양으로 — 짝짓기 규칙은 bankRules.matchStatement. */
import { addDays } from '@/lib/lab/labDate';
import { matchStatement } from '@/lib/lab/bankRules';
import type { StatementLine } from '@/lib/lab/bankRules';
import type { LedgerEntry } from '@/lib/lab/labTypes';
import { monthRange } from '@/components/lab/labFormat';

/** 날짜 차이 허용 일수(인터넷뱅킹 처리일과 장부 기록일이 하루이틀 어긋나는 일이 흔하다) */
export const TOLERANCE_DAYS = 2;

export interface MatchedPair {
  line: StatementLine;
  entry: LedgerEntry;
}

export interface UnmatchedLine {
  /** 붙여넣은 줄 목록에서의 번호 — 줄마다 고유하다 */
  index: number;
  line: StatementLine;
}

export interface UnmatchedLine {
  /** 붙여넣은 줄 목록에서의 번호 — 줄마다 고유하다 */
  index: number;
  line: StatementLine;
}

export interface MatchView {
  /** 그 달 거래 줄 수 */
  inMonthCount: number;
  /** 그 달(앞뒤 허용일 포함)이 아니라 건너뛴 줄 수 */
  outsideCount: number;
  matched: MatchedPair[];
  /** 장부에 없는 통장 거래(그 달만) */
  unmatchedLines: UnmatchedLine[];
  /** 통장에 없는 장부 기록(그 달만) */
  unmatchedEntries: LedgerEntry[];
  depositSum: number;
  withdrawSum: number;
}

export function buildMatch(lines: ReadonlyArray<StatementLine>, entries: ReadonlyArray<LedgerEntry>, month: string): MatchView {
  const { start, end } = monthRange(month);
  const from = addDays(start, -TOLERANCE_DAYS) ?? start;
  const to = addDays(end, TOLERANCE_DAYS) ?? end;
  const inMonth = (d: string) => d >= start && d <= end;
  const winLines = lines.filter((l) => l.date >= from && l.date <= to);
  const winEntries = entries.filter((e) => e.entryDate >= from && e.entryDate <= to);
  const result = matchStatement(winLines, winEntries, TOLERANCE_DAYS);
  const entryById = new Map(winEntries.map((e) => [e.id, e]));
  const matched: MatchedPair[] = [];
  for (const m of result.matched) {
    const line = winLines[m.lineIndex];
    const entry = entryById.get(m.entryId);
    if (line && entry && (inMonth(line.date) || inMonth(entry.entryDate))) matched.push({ line, entry });
  }
  const monthLines = winLines.filter((l) => inMonth(l.date));
  let depositSum = 0;
  let withdrawSum = 0;
  for (const l of monthLines) {
    if (l.amount > 0) depositSum += l.amount;
    else withdrawSum += -l.amount;
  }
  return {
    inMonthCount: monthLines.length,
    outsideCount: lines.length - winLines.length,
    matched,
    unmatchedLines: result.unmatchedLines
      .map((i) => ({ index: lines.indexOf(winLines[i]), line: winLines[i] }))
      .filter((u) => u.line && inMonth(u.line.date)),
    unmatchedEntries: result.unmatchedEntries.map((id) => entryById.get(id)).filter((e): e is LedgerEntry => e !== undefined && inMonth(e.entryDate)),
    depositSum,
    withdrawSum,
  };
}
