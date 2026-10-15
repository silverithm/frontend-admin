/**
 * 평가 지표 자동 근거 중 10차에 더한 열(EvalAutoEvidenceGaps·EvalAutoEvidenceTransport)이 함께 쓰는 작은 도구 —
 * 진행 중 어르신 고르기, 날짜별 조회 묶음, 일부만 실패했을 때 그 부분만 "계산하지 못했습니다"로 두는 자리.
 */
import { addDays } from '@/lib/lab/labDate';

/** 진행 중 계약(ACTIVE이고 기준일에 계약 기간 안)이 있는 어르신 id — 중복 없이 */
export function activeElderIds(contracts: ReadonlyArray<{ elderlyId: number; status: string; contractStart: string; contractEnd: string | null }>, asOf: string): number[] {
  const day = asOf.slice(0, 10);
  const ids = new Set<number>();
  for (const c of contracts) {
    if (c.status !== 'ACTIVE' || c.contractStart.slice(0, 10) > day) continue;
    if (c.contractEnd && c.contractEnd.slice(0, 10) < day) continue;
    ids.add(c.elderlyId);
  }
  return [...ids];
}

/** 기준일을 포함해 최근 days일('YYYY-MM-DD', 오래된 날부터) */
export function lastDays(asOf: string, days: number): string[] {
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = addDays(asOf.slice(0, 10), -i);
    if (d !== null) out.push(d);
  }
  return out;
}

/** 날짜마다 한 번씩 부르되 동시에 6개까지만 — 한 날이라도 실패하면 전체가 실패한다(빠진 날을 적게 센 숫자가 나오지 않게) */
export async function perDate<T>(dates: readonly string[], fetchDay: (date: string) => Promise<T[]>): Promise<T[]> {
  const results: T[][] = new Array(dates.length);
  let next = 0;
  const worker = async () => {
    while (next < dates.length) {
      const i = next;
      next += 1;
      results[i] = await fetchDay(dates[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(6, dates.length) }, worker));
  return results.flat();
}

const memo = new Map<string, { at: number; value: Promise<unknown> }>();

/** 같은 조회를 1분 안에 다시 하면 앞의 결과를 쓴다(투약·바이탈 근거가 같은 30일 간호일지를 두 번 받지 않게). 실패한 조회는 남기지 않는다 */
export function briefly<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < 60_000) return hit.value as Promise<T>;
  const value = load();
  memo.set(key, { at: Date.now(), value });
  value.catch(() => {
    if (memo.get(key)?.value === value) memo.delete(key);
  });
  return value;
}

/** 묶어 둔 조회를 모두 버린다 — 평가 준비 화면에 들어올 때 evalEvidenceCache와 함께 비운다 */
export function clearBriefly(): void {
  memo.clear();
}

/** 일부 조회가 실패해도 나머지 근거는 보이게 — 실패하면 null */
export async function attempt<T>(load: () => Promise<T>): Promise<T | null> {
  try {
    return await load();
  } catch {
    return null;
  }
}

/** 모든 부분이 실패했으면 던진다(화면의 다시 시도 단추가 보이게). 그 밖에는 줄을 그대로 돌려준다 */
export function linesOrThrow(parts: ReadonlyArray<unknown>, lines: string[]): { lines: string[] } {
  if (parts.length > 0 && parts.every((p) => p === null)) throw new Error('근거를 계산하지 못했습니다');
  return { lines };
}

export const FAILED = '계산하지 못했습니다 — 잠시 뒤 다시 열어 주세요';
