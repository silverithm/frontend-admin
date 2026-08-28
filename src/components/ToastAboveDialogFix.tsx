'use client';

import { useEffect } from 'react';

/**
 * Astryx의 전역 Toast(useToast)는 popover(top layer)로 렌더되고, 앱이 뜰 때 딱
 * 한 번 top layer에 들어간다(ToastViewport가 마운트 시 showPopover() 호출).
 * 그 뒤 Dialog(네이티브 <dialog>, showModal())가 열리면 Dialog가 top layer 스택에
 * Toast보다 "나중에" 들어가므로, 브라우저는 top layer 요소를 삽입 순서로 그려서
 * Dialog(배경 포함)가 항상 Toast 위에 그려진다 — 다이얼로그 안에서 알림을 띄우면
 * 뒤에 깔려 안 보이는 원인이다. (z-index를 아무리 올려도 top layer 삽입 순서를
 * 이기지 못한다 — 실제 브라우저에서 확인된 동작이다.)
 *
 * 아무 <dialog>든 열릴 때마다 Toast의 popover를 hidePopover()+showPopover()로
 * top layer 맨 위로 다시 승격시켜, 방금 연 다이얼로그보다 항상 위에 뜨게 한다.
 * Toast를 쓰는 모든 화면(회의록뿐 아니라 결재, 일정 등)에 공통으로 적용되는
 * 근본 수정이라 AstryxProvider 아래 앱 전역에 마운트한다.
 */
export function ToastAboveDialogFix() {
  useEffect(() => {
    const promoteToast = () => {
      const region = document.querySelector<HTMLElement>(
        '[popover][role="region"][aria-label="Notifications"]',
      );
      if (!region || !region.matches(':popover-open')) return;
      try {
        region.hidePopover();
        region.showPopover();
      } catch {
        // 전환 중 충돌하면 무시 — 다음 다이얼로그가 열릴 때 다시 시도된다
      }
    };

    const observer = new MutationObserver((mutations) => {
      const dialogOpened = mutations.some((mutation) => {
        if (mutation.type !== 'attributes' || mutation.attributeName !== 'open') {
          return false;
        }
        const target = mutation.target as Element;
        return target.tagName === 'DIALOG' && (target as HTMLDialogElement).open;
      });
      if (dialogOpened) {
        // 다이얼로그의 top layer 진입이 끝난 다음 틱에 재승격해야 확실히 위로 올라간다
        requestAnimationFrame(promoteToast);
      }
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['open'],
      subtree: true,
    });

    return () => observer.disconnect();
  }, []);

  return null;
}
