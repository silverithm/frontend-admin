'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Popover } from '@astryxdesign/core/Popover';
import { Dialog } from '@astryxdesign/core/Dialog';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';
import { Button } from '@astryxdesign/core/Button';
import { Text } from '@astryxdesign/core/Text';
import { Heading } from '@astryxdesign/core/Heading';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Center } from '@astryxdesign/core/Center';
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

/**
 * 첫 방문 안내 투어.
 *
 * 대상 요소를 스포트라이트로 비우고 그 옆에 설명을 띄운다.
 * 대상은 `data-tour="키"`로 표시해 두고 여기서 찾는다 — 화면 구조가 바뀌어도
 * 속성만 유지되면 투어는 계속 동작한다. 대상을 못 찾으면 그 단계는 건너뛴다.
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
  const anchorRef = useRef<HTMLElement | null>(null);

  const step: TourStep | undefined = steps[index];
  const isLast = index >= steps.length - 1;

  const finish = useCallback(() => {
    markTourSeen(userKey);
    setIndex(0);
    setRect(null);
    anchorRef.current = null;
    onFinish();
  }, [onFinish, userKey]);

  // 단계가 바뀌면 탭을 옮기고, 대상이 그려질 때까지 기다렸다 위치를 잡는다
  useEffect(() => {
    if (!isOpen || !step) return;

    let cancelled = false;
    let elapsed = 0;

    if (step.tab) onNavigate(step.tab);

    if (!step.target) {
      setRect(null);
      anchorRef.current = null;
      return;
    }

    const findTarget = () => {
      if (cancelled) return;
      const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
      if (el) {
        anchorRef.current = el;
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        setRect(el.getBoundingClientRect());
        return;
      }
      elapsed += TARGET_POLL_MS;
      if (elapsed >= TARGET_TIMEOUT_MS) {
        // 못 찾으면 스포트라이트 없이 설명만 화면 가운데에 띄운다
        anchorRef.current = null;
        setRect(null);
        return;
      }
      setTimeout(findTarget, TARGET_POLL_MS);
    };

    // 탭 전환 렌더가 끝난 뒤 찾는다
    const timer = setTimeout(findTarget, step.tab ? 220 : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isOpen, index, step, onNavigate]);

  // 스크롤·리사이즈로 대상이 움직이면 구멍도 따라간다
  useEffect(() => {
    if (!isOpen || !rect) return;
    const sync = () => {
      if (anchorRef.current) setRect(anchorRef.current.getBoundingClientRect());
    };
    window.addEventListener('resize', sync);
    window.addEventListener('scroll', sync, true);
    return () => {
      window.removeEventListener('resize', sync);
      window.removeEventListener('scroll', sync, true);
    };
  }, [isOpen, rect]);

  // 키보드로도 넘길 수 있게
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault();
        setIndex((i) => (i >= steps.length - 1 ? i : i + 1));
      }
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, steps.length, finish]);

  if (!isOpen || !step) return null;

  const progress = `${index + 1} / ${steps.length}`;

  const body = (
    <VStack gap={2} align="start">
      <VStack gap={1} align="stretch" width="100%">
        <Text type="supporting" color="accent" weight="semibold">{progress}</Text>
        {/* 남은 분량이 보이면 끝까지 볼지 판단하기 쉽다 */}
        <div style={{ height: 3, borderRadius: 'var(--radius-full)', background: 'var(--color-background-muted)', overflow: 'hidden' }}>
          <motion.div
            animate={{ width: `${((index + 1) / steps.length) * 100}%` }}
            transition={{ duration: duration.medium, ease: easeStandard }}
            style={{ height: '100%', background: 'var(--color-icon-teal)' }}
          />
        </div>
      </VStack>
      <Heading level={2} type="display-3">{step.title}</Heading>
      <Text type="body" color="secondary">
        <span style={{ whiteSpace: 'pre-line' }}>{step.description}</span>
      </Text>
    </VStack>
  );

  const controls = (
    <HStack gap={2} hAlign="between" vAlign="center" wrap="wrap">
      <Button label="건너뛰기" variant="ghost" size="sm" onClick={finish} />
      <HStack gap={2}>
        {index > 0 && (
          <Button label="이전" variant="secondary" size="sm" onClick={() => setIndex((i) => Math.max(0, i - 1))} />
        )}
        <Button
          label={isLast ? '시작하기' : '다음'}
          variant="primary"
          size="sm"
          onClick={() => (isLast ? finish() : setIndex((i) => i + 1))}
        />
      </HStack>
    </HStack>
  );

  // 대상이 없는 단계(인사말·마무리)는 가운데 모달로
  if (!rect) {
    return (
      <Dialog isOpen onOpenChange={(open) => { if (!open) finish(); }} purpose="info" width={420}>
        <Layout
          height="auto"
          content={<LayoutContent><Center axis="both" width="100%">{body}</Center></LayoutContent>}
          footer={<LayoutFooter hasDivider>{controls}</LayoutFooter>}
        />
      </Dialog>
    );
  }

  const pad = 8;

  return (
    <>
      {/* 스포트라이트 — 대상만 남기고 화면을 덮는다 (box-shadow로 구멍을 판다) */}
      <AnimatePresence>
        <motion.div
          key="spotlight"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: duration.fast, ease: easeStandard }}
          onClick={finish}
          style={{
            position: 'fixed',
            top: rect.top - pad,
            left: rect.left - pad,
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
            borderRadius: 'var(--radius-element)',
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.55)',
            zIndex: 1000,
            pointerEvents: 'auto',
            transition: `top ${duration.fast}s, left ${duration.fast}s, width ${duration.fast}s, height ${duration.fast}s`,
          }}
        />
      </AnimatePresence>

      <Popover
        isOpen
        onOpenChange={(open) => { if (!open) finish(); }}
        anchorRef={anchorRef as React.RefObject<HTMLElement>}
        placement="end"
        alignment="start"
        width={340}
        label="사용 안내"
        hasAutoFocus={false}
        content={
          <VStack gap={4} align="stretch">
            {body}
            {controls}
          </VStack>
        }
      />
    </>
  );
}
