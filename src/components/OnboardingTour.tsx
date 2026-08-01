'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@astryxdesign/core/Button';
import { Text } from '@astryxdesign/core/Text';
import { Heading } from '@astryxdesign/core/Heading';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { duration, easeStandard } from '@/theme/motion';
import { markTourSeen, visibleSteps, type TourStep } from '@/lib/onboarding';

interface OnboardingTourProps {
  isOpen: boolean;
  isAdmin: boolean;
  /** 완료 기록에 쓸 계정 식별자 */
  userKey?: string | null;
  /** 단계가 요구하는 탭으로 이동시킨다 */
  onNavigate: (tab: string) => void;
  onFinish: () => void;
}

/** 대상 요소가 그려질 때까지 잠깐 기다린다 (탭 전환 직후엔 아직 없다) */
const TARGET_POLL_MS = 60;
const TARGET_TIMEOUT_MS = 1500;
/** 스포트라이트가 대상보다 조금 넉넉하게 */
const SPOTLIGHT_PAD = 8;

/**
 * 첫 방문 안내 투어.
 *
 * 안내판은 화면 아래 가운데에 **고정**하고, 스포트라이트만 대상으로 움직인다.
 * 처음에는 대상마다 말풍선을 붙였는데 단계가 넘어갈 때마다 가운데→왼쪽→오른쪽으로
 * 날아다니고 매번 새로 그려져서 눈이 따라가기 어려웠다. 읽는 위치를 한곳에 고정하니
 * 시선은 그대로 두고 화면의 어디가 밝아지는지만 보면 된다.
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
  const steps = visibleSteps(isAdmin);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const targetRef = useRef<HTMLElement | null>(null);

  const step: TourStep | undefined = steps[index];
  const isLast = index >= steps.length - 1;

  const finish = useCallback(() => {
    markTourSeen(userKey);
    setIndex(0);
    setRect(null);
    targetRef.current = null;
    onFinish();
  }, [onFinish, userKey]);

  const goNext = useCallback(
    () => setIndex((i) => (i >= steps.length - 1 ? i : i + 1)),
    [steps.length],
  );
  const goPrev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  // 단계가 바뀌면 탭을 옮기고, 대상이 그려질 때까지 기다렸다 위치를 잡는다
  useEffect(() => {
    if (!isOpen || !step) return;

    let cancelled = false;
    let elapsed = 0;

    if (step.tab) onNavigate(step.tab);

    if (!step.target) {
      targetRef.current = null;
      setRect(null);
      return;
    }

    const findTarget = () => {
      if (cancelled) return;
      const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
      if (el) {
        targetRef.current = el;
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        setRect(el.getBoundingClientRect());
        return;
      }
      elapsed += TARGET_POLL_MS;
      if (elapsed >= TARGET_TIMEOUT_MS) {
        targetRef.current = null;
        setRect(null);
        return;
      }
      setTimeout(findTarget, TARGET_POLL_MS);
    };

    const timer = setTimeout(findTarget, step.tab ? 220 : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isOpen, index, step, onNavigate]);

  // 스크롤·리사이즈로 대상이 움직이면 스포트라이트도 따라간다
  useEffect(() => {
    if (!isOpen) return;
    const sync = () => {
      if (targetRef.current) setRect(targetRef.current.getBoundingClientRect());
    };
    window.addEventListener('resize', sync);
    window.addEventListener('scroll', sync, true);
    return () => {
      window.removeEventListener('resize', sync);
      window.removeEventListener('scroll', sync, true);
    };
  }, [isOpen]);

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

  const spotlight = rect
    ? {
        top: rect.top - SPOTLIGHT_PAD,
        left: rect.left - SPOTLIGHT_PAD,
        width: rect.width + SPOTLIGHT_PAD * 2,
        height: rect.height + SPOTLIGHT_PAD * 2,
      }
    : null;

  return (
    <>
      {/* 화면 덮개 — 대상이 있으면 그 자리만 구멍을 낸다 */}
      {spotlight ? (
        <motion.div
          onClick={finish}
          initial={false}
          animate={spotlight}
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

      {/* 안내판 — 항상 같은 자리(화면 아래 가운데)에 머문다 */}
      <div
        role="dialog"
        aria-label="사용 안내"
        style={{
          position: 'fixed',
          left: '50%',
          bottom: 'var(--spacing-8)',
          transform: 'translateX(-50%)',
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

          {/* 내용만 부드럽게 교체 — 판 자체는 움직이지 않는다 */}
          <div style={{ minHeight: 116 }}>
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
      </div>
    </>
  );
}
