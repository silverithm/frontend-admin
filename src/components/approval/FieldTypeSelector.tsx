'use client';

import { FieldType } from '@/types/formSchema';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Layout, LayoutContent } from '@astryxdesign/core/Layout';
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
  IconCalculator,
  IconTable,
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
  { type: 'computed', label: '자동 계산', icon: <IconCalculator size={20} stroke={1.5} /> },
  { type: 'repeater', label: '반복 항목', icon: <IconTable size={20} stroke={1.5} /> },
];

export default function FieldTypeSelector({ onSelect, onClose }: FieldTypeSelectorProps) {
  return (
    // Dialog가 backdrop·ESC·포커스 트랩을 처리한다
    <Dialog
      isOpen
      onOpenChange={(open) => { if (!open) onClose(); }}
      purpose="form"
      width={400}
    >
      <Layout
        header={
          <DialogHeader
            title="필드 유형 선택"
            onOpenChange={(open) => { if (!open) onClose(); }}
          />
        }
        content={
          <LayoutContent>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 'var(--spacing-2)',
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
                gap: 'var(--spacing-1-5)',
                padding: 'var(--spacing-3)',
                borderRadius: 'var(--radius-element)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-background-card)',
                color: 'var(--color-text-secondary)',
                cursor: 'pointer',
                transition: 'all var(--duration-fast-min) var(--ease-standard)',
              }}
            >
              {option.icon}
              <Text type="supporting" color="inherit" weight="medium">{option.label}</Text>
            </button>
          ))}
        </div>
          </LayoutContent>
        }
      />
    </Dialog>
  );
}
