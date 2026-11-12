/**
 * 목록 뼈대(`<Loading variant="rows" />`)의 줄 수·막대 폭.
 *
 * 뼈대는 불러오기가 끝나면 그 자리에 들어올 목록의 모양을 미리 보여 준다.
 * 영역 높이를 넘겨 줄을 그리면 스크롤이 생기거나 아래 내용을 밀어내므로,
 * 줄 수는 영역 높이에서 계산하고 위아래로 묶어 둔다.
 */

/** 뼈대 한 줄의 높이(px) — Loading의 한 줄 높이(--spacing-12, 48px)와 같은 값이어야 한다 */
export const SKELETON_ROW_HEIGHT = 48;
export const SKELETON_ROWS_MIN = 2;
export const SKELETON_ROWS_MAX = 8;
/** 높이가 문자열('100%', '60vh')이라 픽셀을 알 수 없을 때 */
export const SKELETON_ROWS_FALLBACK = 6;

/**
 * 영역 높이로 뼈대 줄 수를 정한다.
 * - 숫자(px): floor(높이 / 줄 높이)를 최소 2, 최대 8로 묶는다
 * - 문자열·없음: 6
 */
export function skeletonRowCount(height: number | string | undefined, rowHeight: number = SKELETON_ROW_HEIGHT): number {
  if (typeof height !== 'number' || !Number.isFinite(height) || !(rowHeight > 0)) {
    return SKELETON_ROWS_FALLBACK;
  }
  return Math.min(SKELETON_ROWS_MAX, Math.max(SKELETON_ROWS_MIN, Math.floor(height / rowHeight)));
}

/** 제목 막대 폭(%) — 60% 안팎에서 줄마다 조금씩 다르게. 모두 같은 폭이면 줄무늬처럼 보인다 */
const TITLE_WIDTHS = [62, 54, 68, 57, 65, 51, 60, 70] as const;

export function skeletonTitleWidth(index: number): string {
  const i = Math.abs(Math.trunc(index)) % TITLE_WIDTHS.length;
  return `${TITLE_WIDTHS[i]}%`;
}

/** 메타(작성자·날짜) 막대 폭 */
export const SKELETON_META_WIDTH = '30%';
