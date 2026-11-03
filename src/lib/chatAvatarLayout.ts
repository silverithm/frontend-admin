/**
 * 채팅방 아이콘 칸 나누기 — 참여자 얼굴을 한 원에 나눠 담는다(카카오톡과 같은 방식, 앱과 같은 규칙).
 *
 * ```
 *   1명        2명          3명            4명 이상
 *  ┌────┐    ┌──┬──┐    ┌────┬───┐     ┌──┬──┐
 *  │ 얼 │    │얼│얼│    │ 얼 ├───┤     │얼│얼│
 *  │ 굴 │    │  │  │    │    │얼 │     ├──┼──┤
 *  └────┘    └──┴──┘    └────┴───┘     │얼│얼│
 * ```
 * 넷을 넘으면 앞의 넷만 — 더 넣으면 한 칸이 너무 작아져 누가 누군지 알아볼 수 없다.
 */

export const MAX_AVATAR_CELLS = 4;

export type AvatarCellSize = 'whole' | 'half' | 'quarter';

export interface AvatarLayout {
    /** 원 안에 그릴 칸 수 */
    count: number;
    /** CSS grid 정의 — 한 칸이면 grid를 쓰지 않는다 */
    grid: { columns: string; rows: string; areas?: string } | null;
    /** 칸마다 grid-area 이름(3명일 때만)과 크기 — 크기에 따라 첫 글자 크기를 고른다 */
    cells: { area?: string; size: AvatarCellSize }[];
}

export function chatAvatarLayout(peopleCount: number): AvatarLayout {
    const count = Math.max(1, Math.min(MAX_AVATAR_CELLS, Math.floor(peopleCount) || 0));
    if (count === 1) return { count, grid: null, cells: [{ size: 'whole' }] };
    if (count === 2) {
        return { count, grid: { columns: '1fr 1fr', rows: '1fr' }, cells: [{ size: 'half' }, { size: 'half' }] };
    }
    if (count === 3) {
        return {
            count,
            grid: { columns: '1fr 1fr', rows: '1fr 1fr', areas: '"a b" "a c"' },
            cells: [
                { area: 'a', size: 'half' },
                { area: 'b', size: 'quarter' },
                { area: 'c', size: 'quarter' },
            ],
        };
    }
    return {
        count,
        grid: { columns: '1fr 1fr', rows: '1fr 1fr' },
        cells: [{ size: 'quarter' }, { size: 'quarter' }, { size: 'quarter' }, { size: 'quarter' }],
    };
}
