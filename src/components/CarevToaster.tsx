'use client';

import { useEffect } from 'react';
import { Toaster } from 'sonner';

/**
 * 앱 알림 자리 — sonner(MIT)로 쌓이고, 마우스를 올리면 펼쳐지고, 밀어서 닫는다(2026-11-16,
 * designbookmark 'Notification stack'). 예전 알림(useAlert)은 한 번에 하나만 떠서 새 알림이 앞 알림을
 * 지웠다 — 저장하고 바로 다른 일을 하면 앞 결과를 놓쳤다.
 *
 * Astryx 다이얼로그는 네이티브 <dialog>(top layer)라 z-index로는 위에 못 올라간다. 그래서 알림 자리를
 * popover(top layer)에 넣고, 다이얼로그가 열리거나 알림을 띄울 때마다 맨 위로 다시 올린다
 * (ToastAboveDialogFix와 같은 방식).
 */
const LAYER_ID = 'carev-toaster-layer';

/** 알림 자리를 top layer 맨 위로 — 방금 열린 다이얼로그보다 위에 그려지게 */
export function raiseToaster() {
  if (typeof document === 'undefined') return;
  const el = document.getElementById(LAYER_ID) as (HTMLElement & {
    showPopover?: () => void;
    hidePopover?: () => void;
  }) | null;
  if (!el || typeof el.showPopover !== 'function') return;
  try {
    if (el.matches(':popover-open')) el.hidePopover?.();
    el.showPopover();
  } catch {
    // 전환 중 충돌은 무시 — 다음 알림·다이얼로그 때 다시 올린다
  }
}

export function CarevToaster() {
  useEffect(() => {
    raiseToaster();
    const observer = new MutationObserver((mutations) => {
      const dialogOpened = mutations.some(
        (m) =>
          m.type === 'attributes' &&
          m.attributeName === 'open' &&
          (m.target as Element).tagName === 'DIALOG' &&
          (m.target as HTMLDialogElement).open,
      );
      if (dialogOpened) requestAnimationFrame(raiseToaster);
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['open'], subtree: true });
    return () => observer.disconnect();
  }, []);

  return (
    <div id={LAYER_ID} popover="manual" className="carev-toaster-layer">
      <Toaster
        position="top-center"
        visibleToasts={3}
        gap={8}
        offset={16}
        richColors
        closeButton
        theme="light"
        toastOptions={{ className: 'carev-toast', duration: 5000, closeButtonAriaLabel: '알림 닫기' }}
        containerAriaLabel="알림"
      />
    </div>
  );
}
