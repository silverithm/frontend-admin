'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@astryxdesign/core/Button';
import { Text } from '@astryxdesign/core/Text';
import { Heading } from '@astryxdesign/core/Heading';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { duration, easeStandard } from '@/theme/motion';
import { markTourSeen, visibleSteps } from '@/lib/onboarding';

interface OnboardingTourProps {
  isOpen: boolean;
  isAdmin: boolean;
  /** 완료 기록에 쓸 계정 식별자 */
  userKey?: string | null;
  /** 단계가 요구하는 탭으로 이동시킨다 */
  onNavigate: (tab: string) => void;
  onFinish: () => void;
}

/** 대상이 그려질 때까지 기다리는 한도 (탭 전환 + 데이터 로딩까지 감안) */
const TARGET_TIMEOUT_MS = 4000;
/** 스포트라이트가 대상보다 조금 넉넉하게 */
const SPOTLIGHT_PAD = 8;
/** 안내판이 차지하는 대략 높이 — 대상과 겹치는지 판단용 */
const PANEL_ZONE = 260;

interface Box { top: number; left: number; width: number; height: number }

/**
 * 첫 방문 안내 투어.
 *
 * 안내판은 한 자리에 고정하고 스포트라이트만 대상으로 움직인다.
 * 대상마다 말풍선을 붙이면 단계가 넘어갈 때 화면을 가로질러 날아다녀 눈이 따라가기 어렵다.
 *
 * 대상은 `data-tour="키"`로 표시한다. 화면 구조가 바뀌어도 속성만 유지되면 계속 동작하고,
 * 못 찾으면 스포트라이트 없이 안내만 보여준다.
 */
export default function OnboardingTour({
  isOpen,
  isAdmin,
  userKey,
  onNavigate,
  onFinish,
}: OnboardingTourProps) {
  // 매 렌더 새 배열을 만들면 아래 효과가 계속 재실행되어 대상 탐색이 취소된다
  const steps = useMemo(() => visibleSteps(isAdmin), [isAdmin]);

  const [index, setIndex] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const targetRef = useRef<HTMLElement | null>(null);

  // 부모가 인라인 함수를 넘겨도 효과가 재실행되지 않도록 ref로 고정한다
  const navigateRef = useRef(onNavigate);
  useEffect(() => { navigateRef.current = onNavigate; }, [onNavigate]);

  const step = steps[index];
  const isLast = index >= steps.length - 1;
  // 원시값만 의존성으로 써서 참조 변화에 흔들리지 않게 한다
  const stepTarget = step?.target;
  const stepTab = step?.tab;

  const measure = useCallback(() => {
    const el = targetRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    // 화면 밖으로 밀린 대상은 스포트라이트를 그리지 않는다(엉뚱한 곳이 밝아지는 것 방지)
    if (r.width === 0 || r.height === 0) { setBox(null); return; }
    setBox({
      top: r.top - SPOTLIGHT_PAD,
      left: r.left - SPOTLIGHT_PAD,
      width: r.width + SPOTLIGHT_PAD * 2,
      height: r.height + SPOTLIGHT_PAD * 2,
    });
  }, []);

  const finish = useCallback(() => {
    markTourSeen(userKey);
    setIndex(0);
    setBox(null);
    targetRef.current = null;
    onFinish();
  }, [onFinish, userKey]);

  const goNext = useCallback(
    () => setIndex((i) => (i >= steps.length - 1 ? i : i + 1)),
    [steps.length],
  );
  const goPrev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  // 단계가 바뀌면 탭을 옮기고, 대상이 나타날 때까지 기다렸다 위치를 잡는다
  useEffect(() => {
    if (!isOpen || !step) return;

    let cancelled = false;
    let observer: MutationObserver | null = null;
    let settleTimer: number | undefined;

    if (stepTab) navigateRef.current(stepTab);

    if (!stepTarget) {
      targetRef.current = null;
      setBox(null);
      return;
    }

    // 이전 단계의 스포트라이트를 그대로 두면 엉뚱한 곳이 밝은 채로 남는다
    setBox(null);
    targetRef.current = null;

    const lockOn = (el: HTMLElement) => {
      if (cancelled) return;
      targetRef.current = el;
      // smooth로 스크롤하면 이동 중 좌표를 재게 되어 스포트라이트가 어긋난다.
      // 즉시 스크롤한 뒤 다음 프레임에 측정한다.
      el.scrollIntoView({ block: 'center', behavior: 'auto' });
      requestAnimationFrame(() => {
        if (cancelled) return;
        measure();
        // 이미지·폰트 로딩으로 레이아웃이 조금 더 움직일 수 있어 잠시 뒤 한 번 더 잡는다
        settleTimer = window.setTimeout(() => { if (!cancelled) measure(); }, 300);
      });
    };

    const found = document.querySelector<HTMLElement>(`[data-tour="${stepTarget}"]`);
    if (found) {
      lockOn(found);
      return () => { cancelled = true; window.clearTimeout(settleTimer); };
    }

    // 탭 전환·데이터 로딩으로 아직 없을 수 있다. DOM이 바뀔 때마다 다시 찾는다.
    observer = new MutationObserver(() => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${stepTarget}"]`);
      if (el) {
        observer?.disconnect();
        lockOn(el);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const giveUp = window.setTimeout(() => {
      observer?.disconnect();
      if (!cancelled && !targetRef.current) setBox(null);
    }, TARGET_TIMEOUT_MS);

    return () => {
      cancelled = true;
      observer?.disconnect();
      window.clearTimeout(giveUp);
      window.clearTimeout(settleTimer);
    };
  }, [isOpen, index, step, stepTarget, stepTab, measure]);

  // 스크롤·리사이즈로 대상이 움직이면 스포트라이트도 따라간다
  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [isOpen, measure]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
      if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); goNext(); }
      if (e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, finish, goNext, goPrev]);

  if (!isOpen || !step) return null;

  // 대상이 화면 아래쪽이면 안내판과 겹친다 — 그럴 땐 안내판을 위로 올린다
  const viewportH = typeof window !== 'undefined' ? window.innerHeight : 0;
  const panelAtTop = !!box && box.top + box.height > viewportH - PANEL_ZONE;

  return (
    <>
      {box ? (
        <motion.div
          onClick={finish}
          initial={false}
          animate={{ top: box.top, left: box.left, width: box.width, height: box.height }}
          transition={{ duration: duration.medium, ease: easeStandard }}
          style={{
            position: 'fixed',
            borderRadius: 'var(--radius-element)',
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)',
            zIndex: 1000,
          }}
        />
      ) : (
        <div
          onClick={finish}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.6)', zIndex: 1000 }}
        />
      )}

      {/* 안내판 — 대상과 겹칠 때만 위아래를 바꾼다 */}
      <motion.div
        role="dialog"
        aria-label="사용 안내"
        initial={false}
        animate={{ top: panelAtTop ? 24 : viewportH - 24, y: panelAtTop ? 0 : '-100%' }}
        transition={{ duration: duration.medium, ease: easeStandard }}
        style={{
          position: 'fixed',
          left: '50%',
          x: '-50%',
          zIndex: 1001,
          width: 'min(520px, calc(100vw - var(--spacing-8)))',
          background: 'var(--color-background-card)',
          borderRadius: 'var(--radius-container)',
          boxShadow: 'var(--shadow-high)',
          padding: 'var(--spacing-5)',
        }}
      >
        <VStack gap={4} align="stretch">
          <VStack gap={1} align="stretch">
            <Text type="supporting" color="accent" weight="semibold">
              {index + 1} / {steps.length}
            </Text>
            <div style={{ height: 3, borderRadius: 'var(--radius-full)', background: 'var(--color-background-muted)', overflow: 'hidden' }}>
              <motion.div
                animate={{ width: `${((index + 1) / steps.length) * 100}%` }}
                transition={{ duration: duration.medium, ease: easeStandard }}
                style={{ height: '100%', background: 'var(--color-icon-teal)' }}
              />
            </div>
          </VStack>

          {/* 내용만 교체하고 판은 움직이지 않는다 */}
          <div style={{ minHeight: 132 }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: duration.fast, ease: easeStandard }}
              >
                <VStack gap={2} align="start">
                  <Heading level={2} type="display-3">{step.title}</Heading>
                  <Text type="body" color="secondary">
                    <span style={{ whiteSpace: 'pre-line' }}>{step.description}</span>
                  </Text>
                </VStack>
              </motion.div>
            </AnimatePresence>
          </div>

          <HStack gap={2} hAlign="between" vAlign="center" wrap="wrap">
            <Button label="건너뛰기" variant="ghost" size="sm" onClick={finish} />
            <HStack gap={2}>
              {index > 0 && <Button label="이전" variant="secondary" size="sm" onClick={goPrev} />}
              <Button
                label={isLast ? '시작하기' : '다음'}
                variant="primary"
                size="sm"
                onClick={() => (isLast ? finish() : goNext())}
              />
            </HStack>
          </HStack>
        </VStack>
      </motion.div>
    </>
  );
}
