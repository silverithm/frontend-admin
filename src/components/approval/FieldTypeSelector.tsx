'use client';

import { FieldType } from '@/types/formSchema';
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
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-sm p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-900">필드 유형 선택</h3>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="닫기"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {FIELD_TYPE_OPTIONS.map((option) => (
            <button
              key={option.type}
              onClick={() => {
                onSelect(option.type);
                onClose();
              }}
              className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-gray-200 bg-white hover:border-teal-300 hover:bg-teal-50 transition-all text-gray-600 hover:text-teal-600"
            >
              {option.icon}
              <span className="text-xs font-medium">{option.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
