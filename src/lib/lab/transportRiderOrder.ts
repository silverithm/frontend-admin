/**
 * 운행일지 탑승자 줄 순서 — 시각을 다 적은 분은 위로 모으고, 아직 안 적은 분을 그 아래 이어 둔다.
 *
 * 버그제보방 2026-11-03: "탑승시간 입력 완료하면 위로 자동으로 가게끔 안 되나요? 다음 송영 어르신 찾으러
 * 화면을 위아래로 내리고 올리고 해야 돼서요." 명단은 출석 순서인데 실제로 태우는 순서는 노선 순서라,
 * 한 분 적고 나면 다음 분을 찾아 목록을 오르내렸다. 끝난 분이 위 묶음으로 올라가면 다음에 적을 분은 늘
 * 끝난 묶음 바로 아래에 있다. 위 묶음의 순서는 적은 순서 = 실제로 태운 순서라 일지에도 그 순서로 남는다.
 *
 * '끝났다'의 기준: 등원은 승차 시각(집 앞에서 태운 때), 하원은 하차 시각(집 앞에 내려 드린 때)을 적은 것.
 * 타지 않은 분(탑승 해제)도 더 적을 게 없으니 끝난 쪽이다.
 */

export type RiderDirection = 'PICKUP' | 'DROPOFF';

export interface RiderTimes {
  elderlyId: number;
  boarded: boolean;
  boardTime: string;
  alightTime: string;
}

export function isRiderDone(r: RiderTimes, direction: RiderDirection): boolean {
  if (!r.boarded) return true;
  return (direction === 'PICKUP' ? r.boardTime : r.alightTime).trim() !== '';
}

/** 끝난 분을 앞으로 — 같은 묶음 안의 순서는 그대로(안정 정렬). 불러온 일지를 처음 펼칠 때 쓴다. */
export function doneFirst<T extends RiderTimes>(riders: readonly T[], direction: RiderDirection): T[] {
  return [...riders.filter((r) => isRiderDone(r, direction)), ...riders.filter((r) => !isRiderDone(r, direction))];
}

/**
 * 한 분의 줄을 바꾼다. 막 끝났으면 끝난 묶음의 맨 끝으로, 다시 안 끝난 상태가 되면(시각을 지움)
 * 안 끝난 묶음의 맨 앞으로 옮긴다. 끝남 여부가 그대로면 제자리에서 바꾼다(메모만 고칠 때 줄이 튀지 않게).
 */
export function placeRider<T extends RiderTimes>(riders: readonly T[], next: T, direction: RiderDirection): T[] {
  const i = riders.findIndex((r) => r.elderlyId === next.elderlyId);
  if (i < 0) return [...riders];
  const wasDone = isRiderDone(riders[i], direction);
  const nowDone = isRiderDone(next, direction);
  if (wasDone === nowDone) return riders.map((r, k) => (k === i ? next : r));
  const others = riders.filter((_, k) => k !== i);
  const doneCount = others.filter((r) => isRiderDone(r, direction)).length;
  // 끝난 묶음이 앞에 모여 있으니 그 경계가 곧 끼워 넣을 자리다 — 막 끝난 분은 묶음 끝, 되돌린 분은 안 끝난 묶음 맨 앞
  return [...others.slice(0, doneCount), next, ...others.slice(doneCount)];
}

/**
 * 탑승자 고르기에서 명단이 바뀌었을 때 — 남은 분은 지금 순서 그대로, 새로 고른 분은 맨 뒤에 붙인다.
 * (고르기 칸이 돌려주는 순서대로 다시 깔면 적어 둔 순서가 흐트러진다)
 */
export function mergePickedRiders<T extends RiderTimes>(riders: readonly T[], pickedIds: readonly number[], make: (id: number) => T): T[] {
  const picked = new Set(pickedIds);
  const kept = riders.filter((r) => picked.has(r.elderlyId));
  const have = new Set(kept.map((r) => r.elderlyId));
  const added = pickedIds.filter((id) => !have.has(id)).map(make);
  return [...kept, ...added];
}
