'use client';

import { FieldType } from '@/types/formSchema';
import { IconButton } from '@astryxdesign/core/IconButton';
import { Text } from '@astryxdesign/core/Text';
import { Icon } from '@astryxdesign/core/Icon';
import { HStack } from '@astryxdesign/core/Stack';
import {
  IconLetterCase,
  IconAlignLeft,
  IconHash,
  IconCalendar,
  IconCalendarEvent,
  IconChevronDown,
  IconCircleDot,
  IconSquareCheck,
  IconPaperclip,
  IconSeparator,
} from '@tabler/icons-react';

interface FieldTypeSelectorProps {
  onSelect: (type: FieldType) => void;
  onClose: () => void;
}

interface FieldTypeOption {
  type: FieldType;
  label: string;
  icon: React.ReactNode;
}

const FIELD_TYPE_OPTIONS: FieldTypeOption[] = [
  { type: 'text', label: '텍스트', icon: <IconLetterCase size={20} stroke={1.5} /> },
  { type: 'number', label: '숫자', icon: <IconHash size={20} stroke={1.5} /> },
  { type: 'date', label: '날짜', icon: <IconCalendar size={20} stroke={1.5} /> },
  { type: 'textarea', label: '긴 글', icon: <IconAlignLeft size={20} stroke={1.5} /> },
  { type: 'select', label: '선택', icon: <IconChevronDown size={20} stroke={1.5} /> },
  { type: 'dateRange', label: '날짜 범위', icon: <IconCalendarEvent size={20} stroke={1.5} /> },
  { type: 'radio', label: '라디오', icon: <IconCircleDot size={20} stroke={1.5} /> },
  { type: 'file', label: '파일 첨부', icon: <IconPaperclip size={20} stroke={1.5} /> },
  { type: 'checkbox', label: '체크박스', icon: <IconSquareCheck size={20} stroke={1.5} /> },
  { type: 'section', label: '구분선', icon: <IconSeparator size={20} stroke={1.5} /> },
];

export default function FieldTypeSelector({ onSelect, onClose }: FieldTypeSelectorProps) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background: 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(4px)',
        zIndex: 50,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 384,
          padding: 20,
          background: 'var(--color-background-card)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-container)',
          boxShadow: 'var(--shadow-high)',
        }}
      >
        <HStack hAlign="between" vAlign="center">
          <Text type="large" weight="semibold">필드 유형 선택</Text>
          <IconButton
            label="닫기"
            variant="ghost"
            size="sm"
            icon={<Icon icon="close" size="sm" />}
            onClick={onClose}
          />
        </HStack>

        <div
          style={{
            marginTop: 16,
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 8,
          }}
        >
          {FIELD_TYPE_OPTIONS.map((option) => (
            <button
              key={option.type}
              onClick={() => {
                onSelect(option.type);
                onClose();
              }}
              className="carev-fieldtype-option"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                padding: 12,
                borderRadius: 'var(--radius-element)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-background-card)',
                color: 'var(--color-text-secondary)',
                cursor: 'pointer',
                transition: 'all 150ms ease',
              }}
            >
              {option.icon}
              <Text type="supporting" color="inherit" weight="medium">{option.label}</Text>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
