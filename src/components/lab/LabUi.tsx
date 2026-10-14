'use client';

/**
 * 실험실 공용 화면 조각 — 상태 칩, 오류 배너, 월 이동, 숫자 입력, 확인 창, 알림.
 * 화면마다 따로 만들면 칩 색과 오류 문구 모양이 도구마다 달라지므로 한곳에 둔다.
 */
import { useCallback } from 'react';
import { AlertDialog } from '@astryxdesign/core/AlertDialog';
import { Badge } from '@astryxdesign/core/Badge';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import type { ISODateString } from '@astryxdesign/core/Calendar';
import { DateInput } from '@astryxdesign/core/DateInput';
import { Icon } from '@astryxdesign/core/Icon';
import { IconButton } from '@astryxdesign/core/IconButton';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { useToast } from '@astryxdesign/core/Toast';
import { groupDigits, monthLabel, parseDigits, shiftMonth } from './labFormat';
import styles from './lab.module.css';

export type Tone = 'ok' | 'warn' | 'danger' | 'neutral' | 'info';

// DESIGN.md의 상태 어휘: 확정=녹색, 대기·주의=노랑, 오류=빨강, 안내=파랑
const TONE_VARIANT = {
  ok: 'green',
  warn: 'yellow',
  danger: 'red',
  neutral: 'neutral',
  info: 'blue',
} as const;

export function Chip({ tone, label }: { tone: Tone; label: string }) {
  return <Badge variant={TONE_VARIANT[tone]} label={label} />;
}

/** AI가 채운 값에 붙이는 표시 — 사람이 확인하기 전까지는 제안일 뿐이라는 뜻 */
export function AiChip({ label = 'AI 제안' }: { label?: string }) {
  return <Badge variant="blue" label={label} />;
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Banner
      status="error"
      title={message}
      endContent={onRetry ? <Button label="다시 불러오기" size="sm" variant="secondary" onClick={onRetry} /> : undefined}
    />
  );
}

/** 알림 한 줄. Astryx Toast는 info·error 두 종류만 있다. */
export function useNotify() {
  const toast = useToast();
  return useCallback(
    (message: string, type: 'success' | 'error' | 'info' = 'info') => {
      toast({ body: message, type: type === 'error' ? 'error' : 'info' });
    },
    [toast],
  );
}

interface MonthStepperProps {
  value: string;
  onChange: (month: string) => void;
  isDisabled?: boolean;
}

/** ‹ 2026년 10월 › — 월 입력칸 대신 한 달씩 넘기는 방식이 청구·기록 업무에는 더 빠르다. */
export function MonthStepper({ value, onChange, isDisabled }: MonthStepperProps) {
  return (
    <div role="group" aria-label="월 선택" style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)' }}>
      <IconButton
        label="이전 달"
        tooltip="이전 달"
        variant="ghost"
        isDisabled={isDisabled}
        onClick={() => onChange(shiftMonth(value, -1))}
        icon={<Icon icon="chevronLeft" size="sm" />}
      />
      <span style={{ display: 'inline-block', minWidth: 104, textAlign: 'center' }}>
        <Text type="label" hasTabularNumbers>
          {monthLabel(value)}
        </Text>
      </span>
      <IconButton
        label="다음 달"
        tooltip="다음 달"
        variant="ghost"
        isDisabled={isDisabled}
        onClick={() => onChange(shiftMonth(value, 1))}
        icon={<Icon icon="chevronRight" size="sm" />}
      />
    </div>
  );
}

interface NumFieldProps {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  /** 입력 상한 */
  max: number;
  /** 천 단위 쉼표를 보여 줄지(금액 true, 일수 false) */
  grouped?: boolean;
  description?: string;
  placeholder?: string;
  isDisabled?: boolean;
  isLabelHidden?: boolean;
  size?: 'sm' | 'md';
}

/**
 * 숫자 입력 — 쉼표·원·공백을 붙여 넣어도 숫자만 읽는다.
 * Astryx NumberInput은 잘못된 글자가 들어오면 값을 갱신하지 않아, "1,234,000"을 붙여 넣으면 입력이 사라져 보인다.
 */
export function NumField({ label, value, onChange, max, grouped = true, description, placeholder, isDisabled, isLabelHidden, size }: NumFieldProps) {
  return (
    <TextInput
      label={label}
      isLabelHidden={isLabelHidden}
      value={value === null ? '' : grouped ? groupDigits(value) : String(value)}
      onChange={(text) => onChange(parseDigits(text, max))}
      description={description}
      placeholder={placeholder}
      isDisabled={isDisabled}
      size={size}
    />
  );
}

interface LabConfirmProps {
  isOpen: boolean;
  title: string;
  description: string;
  actionLabel: string;
  isLoading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/** 삭제·되돌릴 수 없는 동작 앞의 확인 창 */
export function LabConfirm({ isOpen, title, description, actionLabel, isLoading, onConfirm, onClose }: LabConfirmProps) {
  return (
    <AlertDialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open && !isLoading) onClose();
      }}
      title={title}
      description={description}
      actionLabel={actionLabel}
      cancelLabel="취소"
      isActionLoading={isLoading}
      onAction={onConfirm}
    />
  );
}

export function SupportText({ children, tone }: { children: React.ReactNode; tone?: 'warn' | 'error' }) {
  return (
    <span className={tone === 'warn' ? styles.warnText : tone === 'error' ? styles.errorText : undefined}>
      <Text type="supporting" color={tone ? 'inherit' : 'secondary'}>
        {children}
      </Text>
    </span>
  );
}

interface LabDateInputProps {
  label: string;
  /** 'YYYY-MM-DD' (비어 있으면 '') */
  value: string;
  onChange: (value: string) => void;
  max?: string;
  isRequired?: boolean;
}

/** DateInput은 ISODateString 형식 타입을 요구한다. 화면 상태는 평범한 문자열로 두고 여기서만 맞춘다. */
export function LabDateInput({ label, value, onChange, max, }: LabDateInputProps) {
  return (
    <DateInput
      label={label}
      placeholder="날짜 고르기"
      value={(value || undefined) as ISODateString | undefined}
      max={max as ISODateString | undefined}
      onChange={(v) => onChange(v ?? '')}
    />
  );
}
