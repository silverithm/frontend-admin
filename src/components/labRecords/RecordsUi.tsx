'use client';

/** 2차 기록 화면 공용 조각 — 연도 이동, AI 메모 상자, 판정 칩, 시각 입력. */
import type { ReactNode } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Icon } from '@astryxdesign/core/Icon';
import { IconButton } from '@astryxdesign/core/IconButton';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { TimeInput } from '@astryxdesign/core/TimeInput';
import type { ISOTimeString } from '@astryxdesign/core/TimeInput';
import type { VitalLevel } from '@/lib/lab/vitalFlags';
import { VITAL_LEVEL_LABEL } from '@/lib/lab/vitalFlags';
import { AiChip, Chip, ErrorBanner } from '@/components/lab/LabUi';
import styles from './labRecords.module.css';

interface YearStepperProps {
  value: number;
  onChange: (year: number) => void;
  isDisabled?: boolean;
  /** 이 해까지만 넘길 수 있다(미래 연도 기록을 막는다) */
  max?: number;
}

/** ‹ 2026년 › */
export function YearStepper({ value, onChange, isDisabled, max }: YearStepperProps) {
  return (
    <div role="group" aria-label="연도 선택" style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)' }}>
      <IconButton label="이전 해" tooltip="이전 해" variant="ghost" isDisabled={isDisabled} onClick={() => onChange(value - 1)} icon={<Icon icon="chevronLeft" size="sm" />} />
      <span style={{ display: 'inline-block', minWidth: 72, textAlign: 'center' }}>
        <Text type="label" hasTabularNumbers>
          {value}년
        </Text>
      </span>
      <IconButton label="다음 해" tooltip="다음 해" variant="ghost" isDisabled={isDisabled || (max !== undefined && value >= max)} onClick={() => onChange(value + 1)} icon={<Icon icon="chevronRight" size="sm" />} />
    </div>
  );
}

/** 바이탈 판정 단계 칩 — 높음·낮음은 빨강, 관찰은 노랑 */
export function LevelChip({ level }: { level: VitalLevel }) {
  return <Chip tone={level === 'WATCH' ? 'warn' : 'danger'} label={VITAL_LEVEL_LABEL[level]} />;
}

interface AiMemoBoxProps {
  label?: string;
  description: string;
  placeholder: string;
  memo: string;
  onMemoChange: (value: string) => void;
  buttonLabel: string;
  isLoading: boolean;
  onRun: () => void;
  error: string | null;
  /** 결과가 들어온 뒤 보일 안내(직접 쓴 칸을 남긴 개수, 추가 제안 등) */
  result?: ReactNode;
  maxLength?: number;
  rows?: number;
  isDisabled?: boolean;
}

/** 메모 → AI 제안 흐름의 공통 상자. 메모만 모델로 가고, 결과는 제안일 뿐 저장되지 않는다. */
export function AiMemoBox({
  label = '메모',
  description,
  placeholder,
  memo,
  onMemoChange,
  buttonLabel,
  isLoading,
  onRun,
  error,
  result,
  maxLength = 3000,
  rows = 4,
  isDisabled,
}: AiMemoBoxProps) {
  return (
    <VStack gap={2}>
      <TextArea label={label} description={description} placeholder={placeholder} value={memo} onChange={onMemoChange} rows={rows} maxLength={maxLength} isDisabled={isDisabled} />
      <HStack gap={3} vAlign="center" wrap="wrap">
        <Button label={buttonLabel} variant="secondary" isLoading={isLoading} isDisabled={isDisabled || memo.trim() === '' || isLoading} onClick={onRun} />
        <Text type="supporting" color="secondary">
          이름·연락처는 메모에 적지 마세요. 메모만 AI로 보내고, 결과는 제안일 뿐 저장되지 않습니다.
        </Text>
      </HStack>
      {error && <ErrorBanner message={error} />}
      {result && !error && (
        <div className={styles.suggestBox}>
          <VStack gap={2}>
            <HStack gap={2} vAlign="center" wrap="wrap">
              <AiChip />
              <Text type="supporting" color="secondary">
                아래 칸에 제안을 채웠습니다. 읽어 보고 고친 뒤 저장해 주세요.
              </Text>
            </HStack>
            {result}
          </VStack>
        </div>
      )}
    </VStack>
  );
}

interface TimeFieldProps {
  label: string;
  /** 'HH:MM' 또는 '' */
  value: string;
  onChange: (value: string) => void;
}

/** TimeInput은 ISOTimeString 형식 타입을 요구한다. 화면 상태는 평범한 문자열로 두고 여기서만 맞춘다. */
export function TimeField({ label, value, onChange }: TimeFieldProps) {
  return <TimeInput label={label} hasClear value={(value || undefined) as ISOTimeString | undefined} onChange={(v) => onChange(v ? String(v).slice(0, 5) : '')} />;
}
