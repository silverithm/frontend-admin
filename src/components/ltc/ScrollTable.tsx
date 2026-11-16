'use client';

// 옆으로 밀리는 기준표 껍데기.
// 표가 칸 안에 다 들어오면 아무 표시가 없고, 잘려 있을 때만 '더 있음' 그림자를 낸다 —
// 오른쪽에 더 있으면 오른쪽 가장자리를 흐리게, 왼쪽으로 밀려 있으면 붙박이 첫 칸 옆에 그림자를 둔다.
// 처음 보일 때는 가장 많이 쓰는 강조 열(carev-ltc-focus)이 첫 칸 바로 옆에 오도록 가로 스크롤을 맞춘다.
// 표 내용은 서버에서 그대로 내려오고(children), 여기서는 스크롤 상태만 본다.

import { useEffect, useRef } from 'react';

export default function ScrollTable({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // 가장자리 상태를 data 속성으로만 바꾼다 — 스크롤마다 리렌더하지 않는다
    const sync = () => {
      const max = el.scrollWidth - el.clientWidth;
      const left = max > 1 && el.scrollLeft > 1;
      const right = max > 1 && el.scrollLeft < max - 1;
      el.toggleAttribute('data-more-left', left);
      el.toggleAttribute('data-more-right', right);
    };

    // 처음 한 번 — 강조 열이 가려져 있으면 첫 칸(붙박이) 바로 오른쪽으로 끌어온다
    const focus = el.querySelector<HTMLElement>('thead .carev-ltc-focus');
    const first = el.querySelector<HTMLElement>('thead tr > :first-child');
    if (focus && first && el.scrollWidth > el.clientWidth) {
      const wrap = el.getBoundingClientRect();
      const f = focus.getBoundingClientRect();
      const stickyWidth = first.getBoundingClientRect().width;
      const hidden = f.right > wrap.right || f.left < wrap.left + stickyWidth;
      if (hidden) el.scrollLeft += f.left - (wrap.left + stickyWidth);
    }
    sync();

    el.addEventListener('scroll', sync, { passive: true });
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    const table = el.querySelector('table');
    if (table) observer.observe(table);
    return () => {
      el.removeEventListener('scroll', sync);
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={ref} className="carev-ltc-tablewrap">
      {children}
    </div>
  );
}
