import type { ReactNode } from 'react';
import { FiCamera, FiVideo, FiPaperclip } from 'react-icons/fi';
import { IconPin } from '@tabler/icons-react';
import { Icon } from '@astryxdesign/core/Icon';

export type ChatAttachmentKind = 'IMAGE' | 'VIDEO' | 'FILE' | 'NOTICE';

const ICONS = { IMAGE: FiCamera, VIDEO: FiVideo, FILE: FiPaperclip, NOTICE: IconPin } as const;

/**
 * 첨부·공지 표시 앞의 아이콘 — 이모지(📷🎬📎📌)는 OS마다 모양이 달라 화면의 다른 아이콘과 어긋난다.
 * 글줄 안에서 쓰므로 inline-flex로 글자와 높이를 맞춘다.
 */
export function ChatAttachmentLabel({ kind, children }: { kind: ChatAttachmentKind; children?: ReactNode }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--spacing-1)', verticalAlign: 'bottom' }}>
      <Icon icon={ICONS[kind]} size="sm" />
      {children}
    </span>
  );
}
