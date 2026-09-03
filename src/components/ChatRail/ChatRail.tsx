"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Client, IMessage } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { motion, AnimatePresence } from "framer-motion";

import { Text } from "@astryxdesign/core/Text";
import { Badge } from "@astryxdesign/core/Badge";
import { Item } from "@astryxdesign/core/Item";
import { Avatar } from "@astryxdesign/core/Avatar";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Icon } from "@astryxdesign/core/Icon";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { EmptyState } from "@astryxdesign/core/EmptyState";

import { FiMessageCircle, FiUsers, FiChevronDown, FiChevronRight, FiChevronsRight } from "react-icons/fi";

import MemberItem from "@/components/MemberItem";
import { ChatRoomAvatarStack, type ChatRoomAvatarPerson } from "@/components/chat/ChatRoomAvatarStack";
import ChatDock from "@/components/ChatRail/ChatDock";
import { Loading } from "@/components/Loading";
import { fetchChatRooms } from "@/lib/apiService";
import { DirectChatMember, openOrCreateDirectRoom } from "@/lib/directChat";
import { getMyChatUserId } from "@/lib/chatIdentity";
import { useOrgPresenceStore, sortMembersByPresence } from "@/lib/orgPresenceStore";
import { useVisiblePolling } from "@/lib/useVisiblePolling";
import { duration } from "@/theme/motion";

/** 레일이 실제로 들어가는 최소 폭 — globals.css의 미디어쿼리와 같은 값이어야 한다 */
const RAIL_BREAKPOINT = 1280;
const RAIL_WIDTH = 264;

const BACKEND_WS_URL = process.env.NEXT_PUBLIC_API_URL || "https://silverithm.site";

/** 접힘 상태는 화면을 옮겨도 유지된다 — 매번 다시 접게 하면 상시 레일의 의미가 없다 */
const STORAGE_KEY = "carev-chat-rail";

interface RailRoom {
    id: number;
    name: string;
    unreadCount: number;
    participantCount: number;
    lastMessage?: { content: string; senderName: string } | null;
    /** 방 아이콘에 겹쳐 그릴 참여자(최대 4명, 나는 빠져 있다) — 서버가 목록에 실어 준다 */
    avatars?: ChatRoomAvatarPerson[];
}

interface ChatRailProps {
    /**
     * 방을 채팅 화면으로 넘긴다 — 작은 대화창의 '크게 보기'에서만 쓴다.
     * 방을 누르는 것만으로 탭이 바뀌면, 하려던 일과 대화가 번갈아 끊긴다.
     */
    onOpenRoom: (roomId: number) => void;
    /** 레일이 들어갈 폭이 안 되는 화면에서 플로팅 버튼을 누른 경우 — 채팅 탭으로 보낸다 */
    onOpenChatTab: () => void;
    /** 전체 안 읽은 메시지 수를 셸에 알린다 — 사이드바 채팅 탭 배지가 이 값을 쓴다 */
    onUnreadChange?: (total: number) => void;
    /**
     * 화면엔 그리지 않되(다른 탭 위에 겹치지 않게) 폴링은 계속 돈다 — 채팅 탭 안에서도
     * '지금 보는 방이 아닌 다른 방'의 새 메시지 토스트를 띄우려면 언마운트하면 안 된다.
     */
    hidden?: boolean;
    /** 지금 실제로 들여다보고 있는 방 — 이 방의 새 메시지는 토스트를 띄우지 않는다 */
    currentRoomId?: number | null;
    /** 어떤 방이든 안읽음 수가 늘면(내가 보고 있는 방 제외) 호출한다 — 셸이 토스트를 띄운다 */
    onNewMessage?: (room: RailRoom) => void;
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
export function ChatRail({ onOpenRoom, onOpenChatTab, onUnreadChange, hidden, currentRoomId, onNewMessage }: ChatRailProps) {
    const [state, setState] = useState<RailState>(DEFAULT_STATE);
    const [hydrated, setHydrated] = useState(false);

    const [rooms, setRooms] = useState<RailRoom[]>([]);
    /** 지금 작은 창으로 열어 둔 방. 탭은 그대로 두고 대화만 얹는다. */
    const [dockRoomId, setDockRoomId] = useState<number | null>(null);
    const [isLoadingRooms, setIsLoadingRooms] = useState(true);
    const [isOpeningDirect, setIsOpeningDirect] = useState(false);
    const [directError, setDirectError] = useState<string | null>(null);

    const stompClientRef = useRef<Client | null>(null);

    const [companyId] = useState(() => (typeof window !== "undefined" ? localStorage.getItem("companyId") : null));
    // 채팅에서 나를 가리키는 값. 관리자 계정은 접두사가 붙는다 ([[chatIdentity]])
    const [userId] = useState(() => getMyChatUserId());
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

    /** 첫 방 목록을 받기 전에는 안읽음 수를 셸에 보고하지 않기 위한 표식 */
    const hasLoadedRoomsRef = useRef(false);
    /** 직전 폴링 결과 — 안읽음 수 증가를 비교하려면 setRooms로 인한 재렌더를 기다리지 않고 바로 필요하다 */
    const prevRoomsRef = useRef<RailRoom[]>([]);
    /** 최신 currentRoomId/onNewMessage/dockRoomId를 ref로 들고 있는다 — loadRooms를 매번 새로 만들지 않기 위해서다 */
    const currentRoomIdRef = useRef(currentRoomId);
    currentRoomIdRef.current = currentRoomId;
    const onNewMessageRef = useRef(onNewMessage);
    onNewMessageRef.current = onNewMessage;
    const dockRoomIdRef = useRef<number | null>(null);
    dockRoomIdRef.current = dockRoomId;

    const loadRooms = useCallback(async () => {
        if (!companyId || !userId) return;
        try {
            const data = await fetchChatRooms();
            const list = Array.isArray(data) ? data : (data.rooms || data.content || data.data || []);

            // 새 메시지 감지 — 안읽음 수가 늘어난 방(내가 지금 보고 있는 방/작은 창으로 띄운 방은 제외)만 알린다.
            // 첫 로드는 '증가'가 아니라 '처음 안다'이므로 여기서 토스트를 띄우지 않는다.
            if (hasLoadedRoomsRef.current) {
                const prevMap = new Map(prevRoomsRef.current.map((r) => [r.id, r]));
                for (const room of list as RailRoom[]) {
                    const prevUnread = prevMap.get(room.id)?.unreadCount ?? 0;
                    if (
                        room.unreadCount > prevUnread &&
                        room.id !== currentRoomIdRef.current &&
                        room.id !== dockRoomIdRef.current
                    ) {
                        onNewMessageRef.current?.(room);
                    }
                }
            }

            hasLoadedRoomsRef.current = true; // setRooms로 인한 재렌더에서 배지 보고가 열리도록 먼저 세운다
            prevRoomsRef.current = list;
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

    // 셸의 채팅 탭 배지도 같은 숫자를 보게 한다 (레일이 접혀 있어도 값은 올라간다).
    // 첫 목록을 받기 전의 빈 배열은 '아직 모른다'이지 '0건'이 아니므로 보고하지 않고,
    // 의존성도 합계(숫자)가 아니라 rooms 자체로 둔다 — 마운트 때 0으로 계산된 합계가
    // 로드 후에도 0이면 숫자 의존성으로는 effect가 다시 돌지 않아 보고가 영영 빠진다.
    useEffect(() => {
        if (!hasLoadedRoomsRef.current) return;
        onUnreadChange?.(rooms.reduce((sum, r) => sum + (r.unreadCount || 0), 0));
    }, [rooms, onUnreadChange]);

    const openDirect = async (member: DirectChatMember) => {
        if (!userId || !userName || isOpeningDirect) return;
        setIsOpeningDirect(true);
        setDirectError(null);
        try {
            const { roomId, isNew } = await openOrCreateDirectRoom({ rooms, member, userId, userName });
            if (isNew) await loadRooms();
            if (roomId) setDockRoomId(roomId);
            else setDirectError(`${member.name} 님과의 대화를 열지 못했습니다`);
        } catch (error) {
            console.error("[ChatRail] 1:1 대화 열기 실패:", error);
            setDirectError(`${member.name} 님과의 대화를 열지 못했습니다`);
        } finally {
            setIsOpeningDirect(false);
        }
    };

    if (!companyId || !userId || !userName) return null;
    // 채팅 탭 안에서는 화면을 그리지 않는다 — 위의 훅들(폴링·STOMP)은 계속 살아 있어야 하므로
    // 컴포넌트를 언마운트하지 않고 여기서만 렌더를 건너뛴다.
    if (hidden) return null;

    // 하이드레이션 전에는 저장된 접힘 상태를 모르므로 펼친 모습으로 그린다 (기본값과 동일)
    const isOpen = hydrated ? state.isOpen : DEFAULT_STATE.isOpen;

    // 목록이 갱신되며 방이 사라졌다면 창도 닫는다
    const dockRoom = rooms.find(r => r.id === dockRoomId) ?? null;

    const openRail = () => {
        // 레일이 들어갈 폭이 아니면 펴 봐야 보이지 않는다 — 그럴 땐 채팅 화면으로 보낸다
        if (typeof window !== "undefined" && window.innerWidth < RAIL_BREAKPOINT) {
            onOpenChatTab();
            return;
        }
        update({ isOpen: true });
    };

    const peopleGroupClass = `carev-chat-rail-group${state.showPeople ? "" : " carev-chat-rail-group-closed"}`;
    const roomsGroupClass = `carev-chat-rail-group${state.showRooms ? "" : " carev-chat-rail-group-closed"}`;

    return (
        <>
            {/* 레일은 오른쪽에서 밀려 들어오고, 접으면 그 자리에서 플로팅 버튼으로 오므라든다.
                두 동작이 이어져 보여야 "저 버튼이 이걸 연다"가 설명 없이 전달된다. */}
            <AnimatePresence initial={false}>
                {isOpen && (
                    <motion.aside
                        key="rail"
                        className="carev-chat-rail"
                        aria-label="채팅"
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: RAIL_WIDTH, opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        transition={{ duration: duration.fast, ease: "easeOut" }}
                    >
                        <div className="carev-chat-rail-inner">
                            <div className="carev-chat-rail-head">
                                <Text type="label" weight="semibold">채팅</Text>
                                <IconButton
                                    label="채팅 접기"
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

                            {/* 방을 고르면 레일 안이 그대로 대화 화면이 된다.
                                별도 창으로 띄우면 "새 채팅방이 열렸다"로 읽혀서, 보던 화면을
                                유지한 채 대화만 얹는다는 의도가 전달되지 않는다. */}
                            {dockRoom ? (
                                <ChatDock
                                    key={dockRoom.id}
                                    roomId={dockRoom.id}
                                    roomName={dockRoom.name}
                                    participantCount={dockRoom.participantCount}
                                    onClose={() => setDockRoomId(null)}
                                    onExpand={() => {
                                        onOpenRoom(dockRoom.id);
                                        setDockRoomId(null);
                                    }}
                                    onRead={(readRoomId) =>
                                        // 이미 0이면 배열 정체성을 유지해 불필요한 재렌더(→ 도크 재로딩 루프)를 막는다
                                        setRooms(prev => prev.some(r => r.id === readRoomId && r.unreadCount > 0)
                                            ? prev.map(r => (r.id === readRoomId ? { ...r, unreadCount: 0 } : r))
                                            : prev)
                                    }
                                />
                            ) : (
                            /* 직원과 대화방이 높이를 반씩 나눠 갖고 각자 안에서 스크롤한다 */
                            <div className="carev-chat-rail-groups">
                                <div className={peopleGroupClass}>
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
                                </div>

                                <div className={roomsGroupClass}>
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
                                startContent={
                                    <ChatRoomAvatarStack
                                        roomName={room.name}
                                        people={room.avatars || []}
                                        size={28}
                                    />
                                }
                                endContent={
                                    room.unreadCount > 0 ? (
                                        <Badge
                                            variant="teal"
                                            label={room.unreadCount > 99 ? "99+" : room.unreadCount}
                                        />
                                    ) : undefined
                                }
                                onClick={() => setDockRoomId(room.id)}
                                density="compact"
                                labelLines={1}
                                descriptionLines={1}
                            />
                        ))
                    )}
                </div>
                                    )}
                                </div>
                            </div>
                            )}
                        </div>
                    </motion.aside>
                )}
            </AnimatePresence>

            <AnimatePresence initial={false}>
                {!isOpen && (
                    <motion.div
                        key="fab"
                        className="carev-chat-rail-fab"
                        initial={{ scale: 0.4, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.4, opacity: 0 }}
                        transition={{ duration: duration.fast, ease: "easeOut" }}
                    >
                        <IconButton
                            label="채팅 열기"
                            tooltip="채팅 열기"
                            className="carev-fchat-fab"
                            icon={<Icon icon={FiMessageCircle} size="md" />}
                            onClick={openRail}
                            style={{
                                width: 56,
                                height: 56,
                                minWidth: 56,
                                padding: "var(--spacing-0)",
                                borderRadius: "var(--radius-full)",
                                background: "var(--color-accent)",
                                color: "var(--color-on-accent)",
                                boxShadow: "var(--shadow-med)",
                            }}
                        />
                        {totalUnread > 0 && (
                            <div className="carev-chat-rail-fab-badge">
                                <Badge variant="error" label={totalUnread > 99 ? "99+" : totalUnread} />
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

        </>
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
