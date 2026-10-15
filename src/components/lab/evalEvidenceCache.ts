/**
 * 평가 지표 자동 근거를 이 화면 안에서 잠시 기억해 둔다 — 지표 칸을 열어 이미 계산한 근거를 묶음 인쇄가 다시 계산하지 않게 한다.
 * 브라우저 메모리에만 두고(새로고침하면 사라짐) 10분이 지나면 낡은 것으로 보고 버린다.
 */
const TTL_MS = 10 * 60 * 1000;

interface Entry {
  lines: string[];
  at: number;
}

const cache = new Map<string, Entry>();

const keyOf = (source: string, indicatorCode?: string) => `${source}|${indicatorCode ?? ''}`;

export function rememberEvidence(source: string, indicatorCode: string | undefined, lines: string[]): void {
  cache.set(keyOf(source, indicatorCode), { lines, at: Date.now() });
}

/** 10분 안에 계산한 근거. 없거나 낡았으면 null */
export function recallEvidence(source: string, indicatorCode?: string): string[] | null {
  const hit = cache.get(keyOf(source, indicatorCode));
  if (!hit) return null;
  if (Date.now() - hit.at > TTL_MS) {
    cache.delete(keyOf(source, indicatorCode));
    return null;
  }
  return hit.lines;
}

/** 모두 버린다 — 평가 준비 화면에 들어올 때 부른다(다른 도구에서 기록을 고치고 돌아온 경우 낡은 근거가 인쇄되지 않게) */
export function clearEvidence(): void {
  cache.clear();
}
