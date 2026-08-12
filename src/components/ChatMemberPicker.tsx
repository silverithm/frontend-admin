'use client';

import { useMemo, useState } from 'react';

import { TextInput } from '@astryxdesign/core/TextInput';
import { Text } from '@astryxdesign/core/Text';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { FiSearch } from 'react-icons/fi';

import MemberItem from '@/components/MemberItem';
import type { DirectChatMember } from '@/lib/directChat';

/**
 * 채팅에 부를 사람 고르기.
 *
 * 새 방을 만들 때와 이미 있는 방에 초대할 때가 같은 목록·같은 규격이어야 해서 한 곳에 둔다.
 * 사람이 많으면 스크롤로 찾기 어려워 이름·직종으로 걸러내는 칸을 위에 둔다.
 */

interface ChatMemberPickerProps {
    /** 고를 수 있는 사람 (보통 나를 제외하고 접속 순으로 정렬된 명단) */
    members: DirectChatMember[];
    onlineUserIds: Set<string>;
    /** 고른 사람들의 채팅 식별자 */
    selectedIds: string[];
    onToggle: (id: string) => void;
    /** 이미 방에 있어 고를 필요가 없는 사람 */
    excludeIds?: string[];
    /** 목록이 비었을 때 보여줄 말 */
    emptyLabel?: string;
    /** 목록 영역 최대 높이 (모달 안에서 대화 상자가 끝없이 길어지지 않게) */
    maxListHeight?: number;
}

export default function ChatMemberPicker({
    members,
    onlineUserIds,
    selectedIds,
    onToggle,
    excludeIds = [],
    emptyLabel = '부를 수 있는 사람이 없습니다',
    maxListHeight = 260,
}: ChatMemberPickerProps) {
    const [query, setQuery] = useState('');

    const excluded = useMemo(() => new Set(excludeIds), [excludeIds]);
    const selected = useMemo(() => new Set(selectedIds), [selectedIds]);

    const visible = useMemo(() => {
        const q = query.trim().toLowerCase();
        return members
            .filter((m) => !excluded.has(m.id))
            .filter((m) => {
                if (!q) return true;
                return (
                    m.name.toLowerCase().includes(q) ||
                    (m.position || '').toLowerCase().includes(q)
                );
            });
    }, [members, excluded, query]);

    return (
        <VStack gap={2}>
            <HStack gap={2} vAlign="center" hAlign="between">
                <Text type="label" weight="semibold">구성원</Text>
                <Text type="supporting">{selectedIds.length}명 선택</Text>
            </HStack>

            <TextInput
                label="구성원 검색"
                isLabelHidden
                type="text"
                value={query}
                onChange={setQuery}
                placeholder="이름이나 직종으로 찾기"
                startIcon={FiSearch}
                hasClear
            />

            <div
                style={{
                    maxHeight: maxListHeight,
                    overflowY: 'auto',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-container)',
                    padding: 'var(--spacing-1)',
                }}
            >
                {visible.length > 0 ? (
                    <VStack gap={0.5}>
                        {visible.map((member) => (
                            <MemberItem
                                key={member.id}
                                name={member.name}
                                role={member.position}
                                imageUrl={member.profileImageUrl}
                                presence={onlineUserIds.has(member.id) ? 'online' : 'offline'}
                                isSelected={selected.has(member.id)}
                                onClick={() => onToggle(member.id)}
                            />
                        ))}
                    </VStack>
                ) : (
                    <div style={{ padding: 'var(--spacing-4)', textAlign: 'center' }}>
                        <Text type="supporting">
                            {query.trim() ? '찾는 사람이 없습니다' : emptyLabel}
                        </Text>
                    </div>
                )}
            </div>
        </VStack>
    );
}
