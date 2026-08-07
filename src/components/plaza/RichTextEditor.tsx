'use client';

import { useEffect, useRef, useState } from 'react';
import { IconButton } from '@astryxdesign/core/IconButton';
import { Icon } from '@astryxdesign/core/Icon';
import { Selector } from '@astryxdesign/core/Selector';
import { HStack } from '@astryxdesign/core/Stack';
import {
  IconBold,
  IconItalic,
  IconUnderline,
  IconStrikethrough,
  IconAlignLeft,
  IconAlignCenter,
  IconAlignRight,
  IconList,
  IconListNumbers,
  IconClearFormatting,
} from '@tabler/icons-react';

/**
 * 커뮤니티 글쓰기용 리치 텍스트 에디터.
 *
 * contentEditable + execCommand 기반 — 외부 에디터 라이브러리 없이
 * 네이버 카페 글쓰기 수준의 기본 서식(굵게·기울임·밑줄·취소선·크기·
 * 글자색·배경색·정렬·목록)을 제공한다. 값은 HTML 문자열이며,
 * 렌더하는 쪽에서 반드시 DOMPurify로 소독한 뒤 표시한다.
 */

const FONT_SIZES = [
  { value: '2', label: '작게' },
  { value: '3', label: '보통' },
  { value: '5', label: '크게' },
  { value: '6', label: '아주 크게' },
];

// 네이버 카페풍 기본 팔레트 (검정~회색 + 주요 색상)
const TEXT_COLORS = [
  '#000000', '#4d4d4d', '#979797', '#ffffff',
  '#e03131', '#f76707', '#f5c211', '#2f9e44',
  '#1971c2', '#6741d9', '#e64980', '#846358',
];

const HIGHLIGHT_COLORS = [
  'transparent', '#fff3bf', '#ffe3e3', '#d3f9d8',
  '#d0ebff', '#e5dbff', '#ffdeeb', '#e9ecef',
];

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}

export default function RichTextEditor({ value, onChange, placeholder, minHeight = 280 }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  // onChange로 내보낸 값 — 외부 value와 비교해 편집 중 커서 리셋을 막는다
  const lastEmittedRef = useRef<string>('');
  const [colorOpen, setColorOpen] = useState<'text' | 'highlight' | null>(null);
  const paletteRef = useRef<HTMLDivElement>(null);

  // 외부 value 반영 (수정 모드 진입·초기화). 내가 방금 내보낸 값이면 무시.
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (value !== lastEmittedRef.current) {
      editor.innerHTML = value || '';
      lastEmittedRef.current = value || '';
    }
  }, [value]);

  // 팔레트 밖 클릭 시 닫기
  useEffect(() => {
    if (!colorOpen) return;
    const close = (e: MouseEvent) => {
      if (paletteRef.current && !paletteRef.current.contains(e.target as Node)) {
        setColorOpen(null);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [colorOpen]);

  const emitChange = () => {
    const html = editorRef.current?.innerHTML ?? '';
    lastEmittedRef.current = html;
    onChange(html);
  };

  const exec = (command: string, commandValue?: string) => {
    editorRef.current?.focus();
    try {
      document.execCommand('styleWithCSS', false, 'true');
    } catch { /* 일부 브라우저 미지원 — 무시 */ }
    document.execCommand(command, false, commandValue);
    emitChange();
  };

  const toolbarButton = (label: string, icon: React.ComponentType, onClick: () => void) => (
    <IconButton
      label={label}
      size="sm"
      variant="ghost"
      icon={<Icon icon={icon} size="sm" />}
      onClick={onClick}
    />
  );

  const colorPalette = (kind: 'text' | 'highlight') => (
    <div
      ref={paletteRef}
      style={{
        position: 'absolute',
        top: '100%',
        left: 0,
        zIndex: 20,
        marginTop: 4,
        padding: 8,
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 24px)',
        gap: 6,
        background: 'var(--color-background)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-container)',
        boxShadow: 'var(--shadow-med)',
      }}
    >
      {(kind === 'text' ? TEXT_COLORS : HIGHLIGHT_COLORS).map((color) => (
        <button
          key={color}
          type="button"
          aria-label={color === 'transparent' ? '배경 없음' : color}
          onMouseDown={(e) => {
            // mousedown에서 처리해 에디터 selection이 풀리기 전에 적용
            e.preventDefault();
            exec(kind === 'text' ? 'foreColor' : 'hiliteColor', color);
            setColorOpen(null);
          }}
          style={{
            width: 24,
            height: 24,
            borderRadius: 4,
            cursor: 'pointer',
            border: '1px solid var(--color-border)',
            background: color === 'transparent'
              ? 'repeating-conic-gradient(#e9ecef 0% 25%, #ffffff 0% 50%) 0 / 8px 8px'
              : color,
          }}
        />
      ))}
    </div>
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-container)',
        overflow: 'visible',
        height: '100%',
      }}
    >
      {/* 툴바 */}
      <div
        style={{
          padding: '6px 8px',
          borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-background-muted)',
          borderRadius: 'var(--radius-container) var(--radius-container) 0 0',
        }}
      >
        <HStack gap={1} vAlign="center" wrap="wrap">
          <div style={{ width: 110 }}>
            <Selector
              label="글자 크기"
              isLabelHidden
              size="sm"
              options={FONT_SIZES}
              value="3"
              onChange={(v) => { if (v) exec('fontSize', v); }}
            />
          </div>
          <span style={{ width: 1, height: 20, background: 'var(--color-border)', margin: '0 4px' }} />
          {toolbarButton('굵게', IconBold, () => exec('bold'))}
          {toolbarButton('기울임', IconItalic, () => exec('italic'))}
          {toolbarButton('밑줄', IconUnderline, () => exec('underline'))}
          {toolbarButton('취소선', IconStrikethrough, () => exec('strikeThrough'))}
          <span style={{ width: 1, height: 20, background: 'var(--color-border)', margin: '0 4px' }} />

          {/* 글자색 */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              aria-label="글자색"
              onClick={() => setColorOpen(colorOpen === 'text' ? null : 'text')}
              className="carev-richtext-color-btn"
            >
              <span style={{ fontWeight: 700, fontSize: 14, lineHeight: 1 }}>가</span>
              <span style={{ display: 'block', height: 3, marginTop: 1, borderRadius: 1, background: '#e03131' }} />
            </button>
            {colorOpen === 'text' && colorPalette('text')}
          </div>

          {/* 배경색(형광펜) */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              aria-label="배경색"
              onClick={() => setColorOpen(colorOpen === 'highlight' ? null : 'highlight')}
              className="carev-richtext-color-btn"
            >
              <span style={{ fontWeight: 700, fontSize: 14, lineHeight: 1, background: '#fff3bf', padding: '0 2px' }}>가</span>
            </button>
            {colorOpen === 'highlight' && colorPalette('highlight')}
          </div>

          <span style={{ width: 1, height: 20, background: 'var(--color-border)', margin: '0 4px' }} />
          {toolbarButton('왼쪽 정렬', IconAlignLeft, () => exec('justifyLeft'))}
          {toolbarButton('가운데 정렬', IconAlignCenter, () => exec('justifyCenter'))}
          {toolbarButton('오른쪽 정렬', IconAlignRight, () => exec('justifyRight'))}
          <span style={{ width: 1, height: 20, background: 'var(--color-border)', margin: '0 4px' }} />
          {toolbarButton('글머리 기호', IconList, () => exec('insertUnorderedList'))}
          {toolbarButton('번호 목록', IconListNumbers, () => exec('insertOrderedList'))}
          <span style={{ width: 1, height: 20, background: 'var(--color-border)', margin: '0 4px' }} />
          {toolbarButton('서식 지우기', IconClearFormatting, () => exec('removeFormat'))}
        </HStack>
      </div>

      {/* 본문 편집 영역 */}
      <div
        ref={editorRef}
        className="carev-richtext-editor"
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder || '내용을 입력하세요.'}
        onInput={emitChange}
        onBlur={emitChange}
        style={{
          flex: 1,
          minHeight,
          padding: 'var(--spacing-4)',
          overflowY: 'auto',
          outline: 'none',
          fontSize: 'var(--font-size-md, 15px)',
          lineHeight: 1.7,
          color: 'var(--color-text)',
        }}
      />
    </div>
  );
}
