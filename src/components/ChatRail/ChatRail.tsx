"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Client, IMessage } from "@stomp/stompjs";
import SockJS from "sockjs-client";

import { Text } from "@astryxdesign/core/Text";
import { Badge } from "@astryxdesign/core/Badge";
import { Item } from "@astryxdesign/core/Item";
import { Avatar } from "@astryxdesign/core/Avatar";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Icon } from "@astryxdesign/core/Icon";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { EmptyState } from "@astryxdesign/core/EmptyState";

import { FiMessageCircle, FiUsers, FiChevronDown, FiChevronRight, FiChevronsLeft, FiChevronsRight } from "react-icons/fi";

import MemberItem from "@/components/MemberItem";
import { Loading } from "@/components/Loading";
import { fetchChatRooms } from "@/lib/apiService";
import { DirectChatMember, openOrCreateDirectRoom } from "@/lib/directChat";
import { useOrgPresenceStore, sortMembersByPresence } from "@/lib/orgPresenceStore";
import { useVisiblePolling } from "@/lib/useVisiblePolling";

const BACKEND_WS_URL = process.env.NEXT_PUBLIC_API_URL || "https://silverithm.site";

/** 접힘 상태는 화면을 옮겨도 유지된다 — 매번 다시 접게 하면 상시 레일의 의미가 없다 */
const STORAGE_KEY = "carev-chat-rail";

interface RailRoom {
    id: number;
    name: string;
    unreadCount: number;
    participantCount: number;
    lastMessage?: { content: string; senderName: string } | null;
}

interface ChatRailProps {
    /** 방을 고르면 채팅 화면으로 데려간다 (레일은 좁아서 대화를 담지 않는다) */
    onOpenRoom: (roomId: number) => void;
}

type RailState = { isOpen: boolean; showPeople: boolean; showRooms: boolean };

const DEFAULT_STATE: RailState = { isOpen: true, showPeople: true, showRooms: true };

function readStoredState(): RailState {
    if (typeof window === "undefined") return DEFAULT_STATE;
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return DEFAULT_STATE;
        return { ...DEFAULT_STATE, ...JSON.parse(raw) };
    } catch {
        return DEFAULT_STATE;
    }
}

/**
 * 관리자 셸 우측 상시 레일 — 위는 직원, 아래는 대화방.
 *
 * 어느 탭을 보고 있든 누가 지금 접속해 있는지가 보여야 해서 셸에 붙인다.
 * 레일 자체와 두 구역을 각각 접을 수 있고, 접힌 상태는 기억한다.
 * 대화 내용은 여기 담지 않는다 — 폭이 좁아 읽기 어렵고, 이미 채팅 화면이 그 일을 한다.
 */
export function ChatRail({ onOpenRoom }: ChatRailProps) {
    const [state, setState] = useState<RailState>(DEFAULT_STATE);
    const [hydrated, setHydrated] = useState(false);

    const [rooms, setRooms] = useState<RailRoom[]>([]);
    const [isLoadingRooms, setIsLoadingRooms] = useState(true);
    const [isOpeningDirect, setIsOpeningDirect] = useState(false);
    const [directError, setDirectError] = useState<string | null>(null);

    const stompClientRef = useRef<Client | null>(null);

    const [companyId] = useState(() => (typeof window !== "undefined" ? localStorage.getItem("companyId") : null));
    const [userId] = useState(() => (typeof window !== "undefined" ? localStorage.getItem("userId") : null));
    const [userName] = useState(() => (typeof window !== "undefined" ? localStorage.getItem("userName") : null));
    const [authToken] = useState(() => (typeof window !== "undefined" ? localStorage.getItem("authToken") : null));

    const orgMembers = useOrgPresenceStore(s => s.members);
    const onlineUserIds = useOrgPresenceStore(s => s.onlineUserIds);
    const membersStatus = useOrgPresenceStore(s => s.status);
    const loadOrgPresence = useOrgPresenceStore(s => s.load);
    const setPresence = useOrgPresenceStore(s => s.setPresence);

    // localStorage는 서버 렌더 결과와 다를 수 있어 마운트 후에 반영한다
    useEffect(() => {
        setState(readStoredState());
        setHydrated(true);
    }, []);

    const update = useCallback((patch: Partial<RailState>) => {
        setState(prev => {
            const next = { ...prev, ...patch };
            try {
                window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            } catch {
                // 저장 불가 환경이어도 이번 세션 동작은 막지 않는다
            }
            return next;
        });
    }, []);

    const loadRooms = useCallback(async () => {
        if (!companyId || !userId) return;
        try {
            const data = await fetchChatRooms();
            const list = Array.isArray(data) ? data : (data.rooms || data.content || data.data || []);
            setRooms(list);
        } catch (error) {
            console.error("[ChatRail] 대화방 목록 로드 실패:", error);
        } finally {
            setIsLoadingRooms(false);
        }
    }, [companyId, userId]);

    useVisiblePolling(loadRooms, 30000);

    useEffect(() => {
        if (!companyId) return;
        loadOrgPresence(companyId);
    }, [companyId, loadOrgPresence]);

    /**
     * 접속 상태와 안 읽은 수는 레일이 직접 받는다.
     * 채팅 화면은 채팅 탭에서만 살아 있어서, 다른 탭을 보는 동안 알려줄 주체가 없다.
     */
    useEffect(() => {
        if (!authToken || !userId || !companyId) return;

        const client = new Client({
            webSocketFactory: () => new SockJS(`${BACKEND_WS_URL}/ws/chat`),
            // 서버 WS 인터셉터가 CONNECT 프레임의 Authorization 헤더를 요구한다
            connectHeaders: { Authorization: `Bearer ${authToken}` },
            reconnectDelay: 5000,
            heartbeatIncoming: 10000,
            heartbeatOutgoing: 10000,
            onConnect: () => {
                client.publish({
                    destination: "/app/presence/join",
                    body: JSON.stringify({ userId, companyId }),
                });
                client.subscribe(`/topic/presence/${companyId}`, (frame: IMessage) => {
                    try {
                        const { userId: changedId, online } = JSON.parse(frame.body) as { userId: string; online: boolean };
                        setPresence(changedId, online);
                    } catch (error) {
                        console.error("[ChatRail] 접속 상태 수신 실패:", error);
                    }
                });
            },
            onStompError: (frame) => {
                console.error("[ChatRail] STOMP 오류:", frame.headers["message"]);
            },
        });

        client.activate();
        stompClientRef.current = client;

        return () => {
            client.deactivate();
            stompClientRef.current = null;
        };
    }, [authToken, userId, companyId, setPresence]);

    const myProfileImageUrl = useMemo(
        () => orgMembers.find(m => m.id === userId)?.profileImageUrl ?? null,
        [orgMembers, userId],
    );

    const sortedMembers = useMemo(
        () => sortMembersByPresence(orgMembers, onlineUserIds, userId),
        [orgMembers, onlineUserIds, userId],
    );

    const onlineCount = useMemo(
        () => sortedMembers.filter(m => onlineUserIds.has(m.id)).length,
        [sortedMembers, onlineUserIds],
    );

    const totalUnread = useMemo(
        () => rooms.reduce((sum, r) => sum + (r.unreadCount || 0), 0),
        [rooms],
    );

    const openDirect = async (member: DirectChatMember) => {
        if (!userId || !userName || isOpeningDirect) return;
        setIsOpeningDirect(true);
        setDirectError(null);
        try {
            const { roomId, isNew } = await openOrCreateDirectRoom({ rooms, member, userId, userName });
            if (isNew) await loadRooms();
            if (roomId) onOpenRoom(roomId);
            else setDirectError(`${member.name} 님과의 대화를 열지 못했습니다`);
        } catch (error) {
            console.error("[ChatRail] 1:1 대화 열기 실패:", error);
            setDirectError(`${member.name} 님과의 대화를 열지 못했습니다`);
        } finally {
            setIsOpeningDirect(false);
        }
    };

    if (!companyId || !userId || !userName) return null;

    // 하이드레이션 전에는 저장된 접힘 상태를 모르므로 펼친 모습으로 그린다 (기본값과 동일)
    const isOpen = hydrated ? state.isOpen : DEFAULT_STATE.isOpen;

    if (!isOpen) {
        return (
            <aside className="carev-chat-rail carev-chat-rail-closed" aria-label="채팅">
                <IconButton
                    label="채팅 레일 펼치기"
                    tooltip="채팅 열기"
                    variant="ghost"
                    icon={<Icon icon={FiChevronsLeft} size="md" />}
                    onClick={() => update({ isOpen: true })}
                />
                {totalUnread > 0 && (
                    <Badge variant="error" label={totalUnread > 99 ? "99+" : totalUnread} />
                )}
                <div className="carev-chat-rail-closed-label" aria-hidden>
                    <Text type="supporting" color="secondary">채팅</Text>
                </div>
            </aside>
        );
    }

    return (
        <aside className="carev-chat-rail" aria-label="채팅">
            {/* 레일 머리 */}
            <div className="carev-chat-rail-head">
                <Text type="label" weight="semibold">채팅</Text>
                <IconButton
                    label="채팅 레일 접기"
                    tooltip="접기"
                    variant="ghost"
                    size="sm"
                    icon={<Icon icon={FiChevronsRight} size="sm" />}
                    onClick={() => update({ isOpen: false })}
                />
            </div>

            {directError && (
                <div className="carev-chat-rail-notice">
                    <Banner
                        status="error"
                        title={directError}
                        isDismissable
                        onDismiss={() => setDirectError(null)}
                    />
                </div>
            )}

            {/* 직원 */}
            <SectionHeader
                label="직원"
                count={membersStatus === "loaded" ? `${onlineCount}/${sortedMembers.length}` : undefined}
                isOpen={state.showPeople}
                onToggle={() => update({ showPeople: !state.showPeople })}
            />

            {state.showPeople && (
                <div className="carev-chat-rail-section">
                    <MemberItem
                        name={userName}
                        suffix="나"
                        imageUrl={myProfileImageUrl}
                        presence="online"
                        density="compact"
                    />
                    {membersStatus === "loading" || membersStatus === "idle" ? (
                        <Loading size="inline" height={72} label="직원을 불러오는 중..." />
                    ) : membersStatus === "error" ? (
                        <div className="carev-chat-rail-notice">
                            <Banner
                                status="error"
                                title="직원 목록을 불러오지 못했습니다"
                                endContent={
                                    <Button
                                        label="다시 시도"
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => companyId && loadOrgPresence(companyId, { force: true })}
                                    />
                                }
                            />
                        </div>
                    ) : sortedMembers.length === 0 ? (
                        <div className="carev-chat-rail-empty">
                            <EmptyState
                                isCompact
                                icon={<Icon icon={FiUsers} size="lg" color="tertiary" />}
                                title="등록된 직원이 없습니다"
                            />
                        </div>
                    ) : (
                        sortedMembers.map(member => (
                            <MemberItem
                                key={member.id}
                                name={member.name}
                                role={member.position}
                                imageUrl={member.profileImageUrl}
                                presence={onlineUserIds.has(member.id) ? "online" : "offline"}
                                isDisabled={isOpeningDirect}
                                density="compact"
                                onClick={() => openDirect(member)}
                            />
                        ))
                    )}
                </div>
            )}

            {/* 대화방 */}
            <SectionHeader
                label="대화방"
                count={rooms.length > 0 ? String(rooms.length) : undefined}
                badge={totalUnread > 0 ? (totalUnread > 99 ? "99+" : String(totalUnread)) : undefined}
                isOpen={state.showRooms}
                onToggle={() => update({ showRooms: !state.showRooms })}
                hasDividerAbove
            />

            {state.showRooms && (
                <div className="carev-chat-rail-section">
                    {isLoadingRooms ? (
                        <Loading size="inline" height={72} label="대화방을 불러오는 중..." />
                    ) : rooms.length === 0 ? (
                        <div className="carev-chat-rail-empty">
                            <EmptyState
                                isCompact
                                icon={<Icon icon={FiMessageCircle} size="lg" color="tertiary" />}
                                title="대화방이 없습니다"
                                description="위에서 직원을 누르면 1:1 대화가 열립니다."
                            />
                        </div>
                    ) : (
                        rooms.map(room => (
                            <Item
                                key={room.id}
                                label={room.name}
                                description={
                                    room.lastMessage
                                        ? `${room.lastMessage.senderName}: ${room.lastMessage.content}`
                                        : undefined
                                }
                                startContent={<Avatar name={room.name || "?"} size="xsmall" />}
                                endContent={
                                    room.unreadCount > 0 ? (
                                        <Badge
                                            variant="teal"
                                            label={room.unreadCount > 99 ? "99+" : room.unreadCount}
                                        />
                                    ) : undefined
                                }
                                onClick={() => onOpenRoom(room.id)}
                                density="compact"
                                labelLines={1}
                                descriptionLines={1}
                            />
                        ))
                    )}
                </div>
            )}
        </aside>
    );
}

interface SectionHeaderProps {
    label: string;
    count?: string;
    badge?: string;
    isOpen: boolean;
    onToggle: () => void;
    hasDividerAbove?: boolean;
}

/** 구역 머리 — 통째로 눌러 접었다 편다 */
function SectionHeader({ label, count, badge, isOpen, onToggle, hasDividerAbove }: SectionHeaderProps) {
    return (
        <button
            type="button"
            onClick={onToggle}
            aria-expanded={isOpen}
            className={`carev-chat-rail-sechead${hasDividerAbove ? " carev-chat-rail-sechead-divided" : ""}`}
        >
            <Icon icon={isOpen ? FiChevronDown : FiChevronRight} size="sm" color="secondary" />
            <Text type="label" weight="semibold">{label}</Text>
            {count && <Text type="supporting" color="secondary">{count}</Text>}
            {badge && <Badge variant="error" label={badge} />}
        </button>
    );
}
