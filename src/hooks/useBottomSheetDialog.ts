'use client';

import { useSyncExternalStore, type CSSProperties } from 'react';
import type { DialogPosition } from '@astryxdesign/core/Dialog';

/** 아래에서 올라오는 확인 창을 쓰는 폭 — 640px 미만 (DESIGN.md 기준점 640px) */
export const BOTTOM_SHEET_QUERY = '(max-width: 639.98px)';

function subscribe(onChange: () => void): () => void {
  const mql = window.matchMedia(BOTTOM_SHEET_QUERY);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

const getSnapshot = (): boolean => window.matchMedia(BOTTOM_SHEET_QUERY).matches;
// 서버에서는 폭을 모른다 — 넓은 화면(지금 그대로)으로 그리고, 붙은 뒤 실제 폭으로 다시 그린다.
// 확인 창은 누른 뒤에야 열리므로 첫 그림에서 열려 있는 일은 없다.
const getServerSnapshot = (): boolean => false;

export interface BottomSheetDialogProps {
  width?: string;
  position?: DialogPosition;
  className?: string;
  style?: CSSProperties;
}

/**
 * 라이브러리 Dialog는 native <dialog>이고 위치·폭·모서리·등장을 ID 여러 겹 우선순위의 해시 클래스로 잡는다.
 * 그것을 CSS로 덮지 않고, 컴포넌트가 받는 값(width·position·className·style — 인라인 style은 클래스보다 앞선다)만으로
 * 화면 아래에 붙인다.
 */
const SHEET_STYLE: CSSProperties = {
  // 라이브러리 기본 max-width(90vw)를 풀어 폭을 끝까지 쓴다
  maxWidth: '100%',
  // 위쪽 모서리만 둥글게 — 안쪽 래퍼는 border-radius: inherit라 같이 따라온다
  borderRadius: 'var(--radius-page) var(--radius-page) 0 0',
  // 홈 막대가 있는 기기에서 단추가 그 밑에 깔리지 않게
  paddingBottom: 'env(safe-area-inset-bottom)',
  // 가운데 창의 '살짝 커지며 나타남' 대신 아래에서 올라온다(globals.css @keyframes carev-sheet-up)
  animationName: 'carev-sheet-up',
  animationDuration: 'var(--duration-medium)',
};

const SHEET_PROPS: BottomSheetDialogProps = {
  width: '100%',
  position: { left: 0, right: 0, bottom: 0 },
  className: 'carev-sheet',
  style: SHEET_STYLE,
};

const NO_PROPS: BottomSheetDialogProps = {};

/**
 * 좁은 화면(640px 미만)에서 확인·경고·짧은 선택 창을 화면 아래에 붙여 올린다(DESIGN.md "Motion").
 * Dialog의 width 뒤에 펼쳐 넘긴다: `<Dialog ... width={440} {...sheetProps}>`.
 * 640px 이상에서는 빈 객체라 지금 그대로 가운데 창이다.
 * 입력칸이 많은 큰 편집 창(일정 편집·공지 작성·결재 작성)에는 쓰지 않는다.
 */
export function useBottomSheetDialog(): BottomSheetDialogProps {
  const isNarrow = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return isNarrow ? SHEET_PROPS : NO_PROPS;
}
