'use client';

import { ReactNode } from 'react';

import { Item } from '@astryxdesign/core/Item';
import { Avatar, AvatarStatusDot } from '@astryxdesign/core/Avatar';
import { Icon } from '@astryxdesign/core/Icon';

/**
 * 직원 한 줄 — 프로필 사진 · 이름 · 직종 · 접속 상태를 한 규격으로 보여준다.
 *
 * 직원을 고르거나 늘어놓는 곳(일정 참석자, 채팅 직원 목록, 참가자 목록 등)은
 * 전부 이걸 쓴다. 화면마다 아바타와 상태 점을 따로 만들면 크기와 색이 어긋난다.
 */

export type MemberPresence = 'online' | 'offline' | 'none';

export interface MemberItemProps {
  name: string;
  /** 직종·직위 (예: 요양보호사). 접속 상태와 함께 아랫줄에 붙는다 */
  role?: string | null;
  imageUrl?: string | null;
  /** 'none'이면 상태 점을 그리지 않는다 (접속 개념이 없는 화면용) */
  presence?: MemberPresence;
  isSelected?: boolean;
  isDisabled?: boolean;
  onClick?: () => void;
  /** 오른쪽 보조 정보 (뱃지·시간 등). 선택 목록에서는 비워두면 체크 표시가 들어간다 */
  endContent?: ReactNode;
  size?: 'xsmall' | 'small' | 'medium' | 'large';
  density?: 'compact' | 'balanced' | 'spacious';
  /** 라벨 뒤에 붙는 꼬리표 (예: '나') */
  suffix?: string;
}

function presenceLabel(presence: MemberPresence): string | null {
  if (presence === 'online') return '접속 중';
  if (presence === 'offline') return '오프라인';
  return null;
}

export default function MemberItem({
  name,
  role,
  imageUrl,
  presence = 'none',
  isSelected = false,
  isDisabled = false,
  onClick,
  endContent,
  size = 'small',
  density = 'balanced',
  suffix,
}: MemberItemProps) {
  const statusDot =
    presence === 'none' ? undefined : (
      <AvatarStatusDot
        variant={presence === 'online' ? 'success' : 'neutral'}
        label={presence === 'online' ? '접속 중' : '오프라인'}
      />
    );

  // 아랫줄: '요양보호사 · 접속 중'처럼 있는 것만 이어 붙인다
  const description = [role?.trim() || null, presenceLabel(presence)]
    .filter(Boolean)
    .join(' · ');

  // 고를 수 있는 목록에서는 선택 표시를 오른쪽에 둔다.
  // 별도 체크박스를 넣지 않는 건 행 전체가 이미 눌리는 대상이기 때문이다.
  const trailing =
    endContent ??
    (isSelected && onClick ? <Icon icon="check" size="sm" color="accent" /> : undefined);

  return (
    <Item
      label={suffix ? `${name} (${suffix})` : name}
      description={description || undefined}
      startContent={
        <Avatar
          name={name}
          src={imageUrl || undefined}
          size={size}
          status={statusDot}
        />
      }
      endContent={trailing}
      isSelected={isSelected}
      isDisabled={isDisabled}
      density={density}
      onClick={onClick}
      labelLines={1}
      descriptionLines={1}
    />
  );
}
