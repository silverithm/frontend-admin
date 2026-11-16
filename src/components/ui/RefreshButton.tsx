'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@astryxdesign/core/Button';
import type { ButtonSize } from '@astryxdesign/core/Button';
import { Icon } from '@astryxdesign/core/Icon';
import { FiCheck, FiRefreshCw } from 'react-icons/fi';
import { spring } from '@/theme/springs';
import '@/styles/work.css';

interface RefreshButtonProps {
  /**
   * 다시 불러오는 함수. 끝날 때까지 기다린다.
   * 던지거나 false를 돌려주면 실패로 보고 ✓ 없이 그냥 돌아온다(그 외에는 성공).
   */
  onRefresh: () => Promise<unknown> | unknown;
  /** 접근성 이름과 툴팁 */
  label?: string;
  size?: ButtonSize;
  variant?: 'ghost' | 'secondary';
  isDisabled?: boolean;
}

/** ✓가 보이는 시간 */
const DONE_MS = 800;

/**
 * 새로고침 아이콘 단추(2026-11-16). 누르면 불러오는 동안 아이콘이 돌고, 끝나면 ✓가 0.8초 보였다
 * 돌아온다. 불러오는 중에 또 눌러도 한 번만 부른다.
 */
export function RefreshButton({
  onRefresh,
  label = '새로고침',
  size,
  variant = 'ghost',
  isDisabled = false,
}: RefreshButtonProps) {
  const [phase, setPhase] = useState<'idle' | 'busy' | 'done'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const handleClick = useCallback(async () => {
    if (phase === 'busy') return;
    if (timer.current) clearTimeout(timer.current);
    setPhase('busy');
    let ok = true;
    try {
      ok = (await onRefresh()) !== false;
    } catch {
      ok = false;
    }
    if (!alive.current) return;
    if (!ok) {
      setPhase('idle');
      return;
    }
    setPhase('done');
    timer.current = setTimeout(() => {
      if (alive.current) setPhase('idle');
    }, DONE_MS);
  }, [onRefresh, phase]);

  return (
    <Button
      label={label}
      tooltip={label}
      variant={variant}
      size={size}
      isIconOnly
      isDisabled={isDisabled}
      aria-busy={phase === 'busy' || undefined}
      onClick={handleClick}
      icon={
        <span className="carev-refresh-icon" data-busy={phase === 'busy' ? 'true' : undefined}>
          <AnimatePresence mode="wait" initial={false}>
            {phase === 'done' ? (
              <motion.span
                key="done"
                className="carev-refresh-swap"
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.1 } }}
                transition={spring.pop}
              >
                <Icon icon={FiCheck} size="sm" />
              </motion.span>
            ) : (
              <motion.span
                key="idle"
                className="carev-refresh-swap carev-refresh-spin"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.1 } }}
                transition={{ duration: 0.12 }}
              >
                <Icon icon={FiRefreshCw} size="sm" />
              </motion.span>
            )}
          </AnimatePresence>
        </span>
      }
    />
  );
}
