'use client';

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';
import {
  SegmentedControl as AstryxSegmentedControl,
  type SegmentedControlProps,
} from '@astryxdesign/core/SegmentedControl';
import { spring } from '@/theme/springs';

/**
 * Astryx SegmentedControl + 미끄러지는 선택 표시(2026-11-16, designbookmark 'Tab pill').
 *
 * 예전에는 고른 칸의 흰 바탕이 그 자리에서 바뀌기만 해서, 결재 상태 탭처럼 빠르게 오갈 때 무엇이
 * 골라졌는지 눈으로 따라가기 어려웠다. 이제 흰 바탕 하나가 칸 사이를 미끄러져 가고, 가는 쪽 가장자리가
 * 먼저 닿고 반대쪽이 따라와 잠깐 늘어난다. 쓰는 법·접근성(라디오 그룹·화살표 키)은 Astryx 그대로다 —
 * 겉의 흰 바탕만 이 감싸개가 그린다.
 *
 * 동작 줄이기를 켠 사람에게는 미끄러짐 없이 바로 옮겨 놓는다.
 */
export function SegmentedControl(props: SegmentedControlProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const left = useMotionValue(0);
  const right = useMotionValue(0);
  const top = useMotionValue(0);
  const height = useMotionValue(0);
  const width = useTransform(() => Math.max(0, right.get() - left.get()));
  const last = useRef<{ l: number; r: number } | null>(null);
  const [visible, setVisible] = useState(false);

  /** 고른 칸 자리를 재서 선택 표시를 옮긴다 — [glide]가 거짓이면(처음·크기 바뀜) 바로 옮긴다 */
  const place = useCallback(
    (glide: boolean) => {
      const wrap = wrapRef.current;
      const selected = wrap?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]');
      if (!wrap || !selected) {
        setVisible(false);
        return;
      }
      const box = wrap.getBoundingClientRect();
      const rect = selected.getBoundingClientRect();
      const l = rect.left - box.left;
      const r = rect.right - box.left;
      top.set(rect.top - box.top);
      height.set(rect.height);
      const prev = last.current;
      // 같은 자리면 그대로 둔다 — 여기서 jump하면 이미 가고 있던 미끄러짐이 끊긴다
      if (prev && prev.l === l && prev.r === r) {
        setVisible(true);
        return;
      }
      if (!glide || reduce || !prev) {
        left.jump(l);
        right.jump(r);
      } else {
        // 가는 쪽 가장자리가 먼저(lead), 떠나는 쪽이 늦게(trail). 방향은 지금 있는 자리 기준 —
        // 가는 도중에 폭이 바뀌어 다시 맞출 때도 방향이 뒤집히지 않게
        const toRight = l > left.get();
        animate(left, l, toRight ? spring.trail : spring.lead);
        animate(right, r, toRight ? spring.lead : spring.trail);
      }
      last.current = { l, r };
      setVisible(true);
    },
    [height, left, reduce, right, top],
  );

  useLayoutEffect(() => {
    place(true);
  }, [props.value, place]);

  // 칸 폭이 바뀌면(고른 칸 글자가 굵어짐, ‘전체 (8)’ 숫자) 지금 움직임을 이어 새 자리로 맞춘다.
  // 바로 옮기면(jump) 탭을 누르자마자 굵어진 글자 때문에 미끄러짐이 끊겼다.
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => place(true));
    observer.observe(wrap);
    wrap.querySelectorAll('[role="radio"]').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [place, props.children]);

  return (
    <div ref={wrapRef} className="carev-seg" data-layout={props.layout === 'fill' ? 'fill' : 'hug'}>
      <motion.span
        aria-hidden
        className="carev-seg-pill"
        style={{ x: left, width, y: top, height, opacity: visible ? 1 : 0 }}
      />
      <AstryxSegmentedControl {...props} />
    </div>
  );
}

export type { SegmentedControlProps };
