'use client';

/**
 * 최종 승인된 공문을 채팅방 공지로 올리는 창.
 *
 * 채팅 공지는 "방에 올라온 메시지 하나를 상단에 고정"하는 구조라, 여기서도 같은 길을 쓴다 —
 * 공문 요약을 메시지로 보낸 뒤 그 메시지를 공지로 지정한다. 그래야 직원이 공지를 눌렀을 때
 * 원본 메시지로 이동하는 기존 동작이 그대로 살아난다.
 */

import { useEffect, useMemo, useState } from 'react';
import { FiVolume2 } from 'react-icons/fi';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Icon } from '@astryxdesign/core/Icon';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Button } from '@astryxdesign/core/Button';
import { Banner } from '@astryxdesign/core/Banner';
import { TextArea } from '@astryxdesign/core/TextArea';
import { CheckboxList, CheckboxListItem } from '@astryxdesign/core/CheckboxList';
import { Loading } from '@/components/Loading';
import { ApprovalRequest } from '@/types/approval';
import { fetchChatRooms, sendChatMessage, updateChatRoomNotice } from '@/lib/apiService';
import { getMyChatUserId } from '@/lib/chatIdentity';

interface ChatRoomOption {
    id: number;
    name: string;
    participantCount?: number;
}

interface ApprovalAnnounceDialogProps {
    approval: ApprovalRequest;
    onClose: () => void;
    onDone?: (roomNames: string[]) => void;
}

/** 공지 본문은 1000자에서 잘리므로(백엔드 스냅샷 한도) 그 안에서 만든다 */
const NOTICE_MAX_LENGTH = 1000;

function formatDate(value?: string) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
}

/** 승인된 공문을 사람이 읽는 공지 문구로 */
export function buildAnnouncement(approval: ApprovalRequest): string {
    const lines: string[] = [];
    lines.push(`[공문] ${approval.title}`);

    const docNumber = approval.docNumberDisplay || approval.docNumber;
    if (docNumber) lines.push(`문서번호 ${docNumber}`);

    const approvedAt = formatDate(approval.processedAt);
    const approver = approval.processedByName;
    if (approver || approvedAt) {
        lines.push(`최종 승인 ${[approver, approvedAt].filter(Boolean).join(' · ')}`);
    }
    if (approval.requesterName) lines.push(`기안 ${approval.requesterName}`);

    if (approval.attachmentFileName) {
        lines.push(`첨부 ${approval.attachmentFileName}`);
    }

    const text = lines.join('\n');
    return text.length > NOTICE_MAX_LENGTH ? text.slice(0, NOTICE_MAX_LENGTH) : text;
}

export default function ApprovalAnnounceDialog({ approval, onClose, onDone }: ApprovalAnnounceDialogProps) {
    const [rooms, setRooms] = useState<ChatRoomOption[]>([]);
    const [isLoadingRooms, setIsLoadingRooms] = useState(true);
    const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([]);
    const [message, setMessage] = useState(() => buildAnnouncement(approval));
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const data = await fetchChatRooms();
                const list = Array.isArray(data) ? data : (data?.rooms || data?.content || []);
                if (cancelled) return;
                setRooms(list.map((r: ChatRoomOption) => ({
                    id: r.id,
                    name: r.name,
                    participantCount: r.participantCount,
                })));
            } catch (e) {
                console.error('채팅방 목록 조회 실패:', e);
                if (!cancelled) setError('채팅방 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요');
            } finally {
                if (!cancelled) setIsLoadingRooms(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, []);

    const senderName = useMemo(
        () => (typeof window !== 'undefined' ? localStorage.getItem('userName') || '관리자' : '관리자'),
        []
    );

    const canSend = selectedRoomIds.length > 0 && message.trim().length > 0 && !isSending;

    const handleSend = async () => {
        const senderId = getMyChatUserId();
        if (!senderId) {
            setError('로그인 정보를 찾을 수 없습니다. 다시 로그인해주세요');
            return;
        }

        setIsSending(true);
        setError('');

        const content = message.trim().slice(0, NOTICE_MAX_LENGTH);
        const succeeded: string[] = [];
        const failed: string[] = [];

        // 방마다 따로 보낸다 — 한 방이 실패해도 나머지는 올라가야 한다
        for (const roomId of selectedRoomIds) {
            const room = rooms.find(r => String(r.id) === roomId);
            const roomName = room?.name || `방 ${roomId}`;
            try {
                const sent = await sendChatMessage(Number(roomId), {
                    senderId,
                    senderName,
                    type: 'TEXT',
                    content,
                });
                const messageId = sent?.message?.id ?? sent?.id;
                if (!messageId) throw new Error('메시지 id를 받지 못했습니다');

                await updateChatRoomNotice(Number(roomId), Number(messageId), senderName);
                succeeded.push(roomName);
            } catch (e) {
                console.error(`공지 등록 실패 (roomId=${roomId}):`, e);
                failed.push(roomName);
            }
        }

        setIsSending(false);

        if (failed.length > 0) {
            setError(
                succeeded.length > 0
                    ? `${succeeded.join(', ')}에는 올렸지만 ${failed.join(', ')}에는 실패했습니다`
                    : '공지를 등록하지 못했습니다. 잠시 후 다시 시도해주세요'
            );
            // 성공한 방은 다시 보내지 않도록 선택에서 뺀다
            setSelectedRoomIds(prev => prev.filter(id => {
                const name = rooms.find(r => String(r.id) === id)?.name || `방 ${id}`;
                return failed.includes(name);
            }));
            return;
        }

        onDone?.(succeeded);
        onClose();
    };

    return (
        <Dialog isOpen onOpenChange={(open) => { if (!open && !isSending) onClose(); }} purpose="form" width={560}>
            <Layout
                header={<DialogHeader title="채팅방에 공지로 등록" onOpenChange={(open) => { if (!open && !isSending) onClose(); }} />}
                content={
                    <LayoutContent>
                        <VStack gap={4}>
                            <Banner
                                status="info"
                                container="section"
                                title="선택한 방에 아래 내용이 올라가고, 그 메시지가 방 공지로 고정됩니다"
                            />

                            {error && (
                                <Banner status="error" container="section" title={error} />
                            )}

                            <VStack gap={2}>
                                <Text type="label" weight="semibold" color="primary">공지 내용</Text>
                                <TextArea
                                    label="공지 내용"
                                    isLabelHidden
                                    value={message}
                                    onChange={(value: string) => setMessage(value.slice(0, NOTICE_MAX_LENGTH))}
                                    rows={7}
                                />
                                <Text type="supporting" color="secondary">
                                    {message.length} / {NOTICE_MAX_LENGTH}자
                                </Text>
                            </VStack>

                            <VStack gap={2}>
                                {isLoadingRooms ? (
                                    <Loading size="inline" label="채팅방을 불러오는 중..." />
                                ) : rooms.length === 0 ? (
                                    <Text type="supporting" color="secondary">
                                        올릴 채팅방이 없습니다. 채팅 탭에서 방을 먼저 만들어주세요.
                                    </Text>
                                ) : (
                                    <CheckboxList
                                        label={`올릴 채팅방 (${selectedRoomIds.length}개 선택)`}
                                        value={selectedRoomIds}
                                        onChange={setSelectedRoomIds}
                                    >
                                        {rooms.map(room => (
                                            <CheckboxListItem
                                                key={room.id}
                                                value={String(room.id)}
                                                label={room.participantCount
                                                    ? `${room.name} (${room.participantCount}명)`
                                                    : room.name}
                                            />
                                        ))}
                                    </CheckboxList>
                                )}
                            </VStack>
                        </VStack>
                    </LayoutContent>
                }
                footer={
                    <LayoutFooter hasDivider>
                        <HStack gap={2} hAlign="end">
                            <Button label="취소" variant="secondary" isDisabled={isSending} onClick={onClose} />
                            <Button
                                label={isSending ? '올리는 중...' : '공지로 등록'}
                                variant="primary"
                                icon={<Icon icon={FiVolume2} size="sm" />}
                                isLoading={isSending}
                                isDisabled={!canSend}
                                onClick={handleSend}
                            />
                        </HStack>
                    </LayoutFooter>
                }
            />
        </Dialog>
    );
}
