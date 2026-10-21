"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Client, IMessage } from "@stomp/stompjs";
import { motion, AnimatePresence } from "framer-motion";

import { Text } from "@astryxdesign/core/Text";
import { Badge } from "@astryxdesign/core/Badge";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Icon } from "@astryxdesign/core/Icon";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { EmptyState } from "@astryxdesign/core/EmptyState";

import { FiUsers, FiChevronDown, FiChevronRight, FiChevronsLeft, FiChevronsRight } from "react-icons/fi";

import MemberItem from "@/components/MemberItem";
import { type ChatRoomAvatarPerson } from "@/components/chat/ChatRoomAvatarStack";
import { Loading } from "@/components/Loading";
import WorkTaskSection from "@/components/WorkTask/WorkTaskSection";
import { OPEN_WORK_TASK_EVENT } from "@/lib/workTasks";
import { fetchChatRooms } from "@/lib/apiService";
import { requestDirectChat } from "@/lib/directChat";
import { getMyChatUserId } from "@/lib/chatIdentity";
import { CHAT_ROOM_PIN_EVENT, keepLocalPins, setRoomPinned, sortRoomsPinnedFirst, type ChatRoomPinChange } from "@/lib/chatRoomPin";
import { createChatClient } from "@/lib/chatSocket";
import { useOrgPresenceStore, sortMembersByPresence } from "@/lib/orgPresenceStore";
import { useVisiblePolling } from "@/lib/useVisiblePolling";
import { duration } from "@/theme/motion";

const RAIL_WIDTH = 264;
/** 접힌 패널(펼치기 막대) 폭 — globals.css .carev-chat-rail-strip과 같은 값 */
const STRIP_WIDTH = 44;


/** 접힘 상태는 화면을 옮겨도 유지된다 — 매번 다시 접게 하면 상시 레일의 의미가 없다 */
const STORAGE_KEY = "carev-chat-rail";

interface RailRoom {
    id: number;
    name: string;
    unreadCount: number;
    participantCount: number;
    lastMessage?: { content: string | null; senderName: string; displayContent?: string; type?: string; mediaType?: string; fileName?: string; isDeleted?: boolean } | null;
    /** 방 아이콘에 겹쳐 그릴 참여자(최대 4명, 나는 빠져 있다) — 서버가 목록에 실어 준다 */
    avatars?: ChatRoomAvatarPerson[];
    /** 내 목록 상단 고정 — 채팅 화면과 같은 순서 규칙을 쓴다 [[chatRoomPin]] */
    pinned?: boolean;
    pinnedAt?: string | null;
}

interface ChatRailProps {
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

type RailState = { isOpen: boolean; showPeople: boolean; showTasks: boolean };

const DEFAULT_STATE: RailState = { isOpen: true, showPeople: true, showTasks: true };

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
 * 셸 우측 상시 패널 — 위는 직원(접속 상태), 아래는 업무진행도.
 *
 * 원장 그림(2026-10-22): 대화방 목록 자리에 '업무진행도'가 들어가고, 대화는 예전처럼 오른쪽 아래
 * 말풍선(FloatingChat)에서 연다. 직원을 누르면 그 말풍선 창에서 1:1 대화가 열린다.
 * 패널을 접으면 업무진행도까지 함께 접히고, 오른쪽 끝에 펼치기 막대만 남는다.
 *
 * 대화방 목록을 그리지 않아도 안 읽은 수 폴링은 여기서 계속 돈다 — 사이드바 채팅 탭 배지와
 * 채팅 탭 안의 '다른 방' 새 메시지 알림이 이 값을 쓴다.
 */
export function ChatRail({ onUnreadChange, hidden, currentRoomId, onNewMessage }: ChatRailProps) {
    const [state, setState] = useState<RailState>(DEFAULT_STATE);
    const [hydrated, setHydrated] = useState(false);

    const [rooms, setRooms] = useState<RailRoom[]>([]);
    const [myTaskCount, setMyTaskCount] = useState(0);
    /** 알림 팝업의 '열기'로 열어 달라는 업무 — 패널을 편 뒤 업무 칸이 받아서 연다 */
    const [pendingTaskId, setPendingTaskId] = useState<number | null>(null);

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
    /** 최신 currentRoomId/onNewMessage를 ref로 들고 있는다 — loadRooms를 매번 새로 만들지 않기 위해서다 */
    const currentRoomIdRef = useRef(currentRoomId);
    currentRoomIdRef.current = currentRoomId;
    const onNewMessageRef = useRef(onNewMessage);
    onNewMessageRef.current = onNewMessage;
    /**
     * 채팅 화면에서 고정을 바꿀 때마다 올린다. 그보다 먼저 출발한 목록 응답이 도착해도
     * 고정 여부만은 화면 값을 지킨다 — 채팅 화면과 같은 규칙이다 [[chatRoomPin]]
     */
    const pinChangeSeqRef = useRef(0);

    const loadRooms = useCallback(async () => {
        if (!companyId || !userId) return;
        const pinSeqAtRequest = pinChangeSeqRef.current;
        try {
            const data = await fetchChatRooms();
            const list: RailRoom[] = Array.isArray(data) ? data : (data.rooms || data.content || data.data || []);

            // 새 메시지 감지 — 안읽음 수가 늘어난 방(내가 지금 보고 있는 방은 제외)만 알린다.
            // 첫 로드는 '증가'가 아니라 '처음 안다'이므로 여기서 토스트를 띄우지 않는다.
            if (hasLoadedRoomsRef.current) {
                const prevMap = new Map(prevRoomsRef.current.map((r) => [r.id, r]));
                for (const room of list as RailRoom[]) {
                    const prevUnread = prevMap.get(room.id)?.unreadCount ?? 0;
                    if (room.unreadCount > prevUnread && room.id !== currentRoomIdRef.current) {
                        onNewMessageRef.current?.(room);
                    }
                }
            }

            hasLoadedRoomsRef.current = true; // setRooms로 인한 재렌더에서 배지 보고가 열리도록 먼저 세운다
            prevRoomsRef.current = list;
            if (pinChangeSeqRef.current !== pinSeqAtRequest) {
                setRooms(prev => keepLocalPins(list, prev));
            } else {
                setRooms(sortRoomsPinnedFirst(list));
            }
        } catch (error) {
            console.error("[ChatRail] 대화방 목록 로드 실패:", error);
        }
    }, [companyId, userId]);

    useVisiblePolling(loadRooms, 30000);

    // 채팅 화면에서 고정/해제하면 바로 따라간다 — 다음 갱신까지 옛 순서를 들고 있지 않게
    useEffect(() => {
        const onPinChanged = (event: Event) => {
            const change = (event as CustomEvent<ChatRoomPinChange>).detail;
            if (!change) return;
            pinChangeSeqRef.current += 1;
            setRooms(prev => setRoomPinned(prev, change.roomId, change.pinned, change.pinnedAt));
        };
        window.addEventListener(CHAT_ROOM_PIN_EVENT, onPinChanged);
        return () => window.removeEventListener(CHAT_ROOM_PIN_EVENT, onPinChanged);
    }, []);

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

        // 토큰 재읽기·401 갱신·하트비트는 chatSocket.ts가 한다 — 네 화면이 같은 규칙으로 붙는다
        const client = createChatClient({
            label: "ChatRail",
            onConnect: (client) => {
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

    // 셸의 채팅 탭 배지도 같은 숫자를 보게 한다 (레일이 접혀 있어도 값은 올라간다).
    // 첫 목록을 받기 전의 빈 배열은 '아직 모른다'이지 '0건'이 아니므로 보고하지 않고,
    // 의존성도 합계(숫자)가 아니라 rooms 자체로 둔다 — 마운트 때 0으로 계산된 합계가
    // 로드 후에도 0이면 숫자 의존성으로는 effect가 다시 돌지 않아 보고가 영영 빠진다.
    useEffect(() => {
        if (!hasLoadedRoomsRef.current) return;
        onUnreadChange?.(rooms.reduce((sum, r) => sum + (r.unreadCount || 0), 0));
    }, [rooms, onUnreadChange]);

    // 알림의 '열기'로 업무를 열 때 — 패널·업무 칸이 접혀 있으면 펴고, 편 뒤의 업무 칸에 번호를 넘긴다.
    // 신호를 업무 칸이 직접 받으면, 접힌 상태에서는 받은 칸이 펼치면서 사라져 창이 안 열린다.
    useEffect(() => {
        const onOpen = (event: Event) => {
            const taskId = (event as CustomEvent<{ taskId: number | null }>).detail?.taskId ?? null;
            update({ isOpen: true, showTasks: true });
            setPendingTaskId(taskId);
        };
        window.addEventListener(OPEN_WORK_TASK_EVENT, onOpen);
        return () => window.removeEventListener(OPEN_WORK_TASK_EVENT, onOpen);
    }, [update]);
    const clearPendingTask = useCallback(() => setPendingTaskId(null), []);

    // 말풍선 채팅이 패널을 덮지 않고 그 왼쪽 옆에 서도록, 패널이 지금 차지한 폭을 알려 준다
    // (원장 그림 2026-10-22). 좁은 화면에서는 패널이 숨으므로 CSS가 0으로 본다.
    const railIsOpen = hydrated ? state.isOpen : DEFAULT_STATE.isOpen;
    const railShown = !!companyId && !!userId && !!userName && !hidden;
    useEffect(() => {
        const offset = railShown ? (railIsOpen ? RAIL_WIDTH : STRIP_WIDTH) : 0;
        document.documentElement.style.setProperty("--carev-rail-offset", `${offset}px`);
    }, [railShown, railIsOpen]);
    useEffect(() => () => {
        document.documentElement.style.setProperty("--carev-rail-offset", "0px");
    }, []);

    if (!companyId || !userId || !userName) return null;
    // 채팅 탭 안에서는 화면을 그리지 않는다 — 위의 훅들(폴링·STOMP)은 계속 살아 있어야 하므로
    // 컴포넌트를 언마운트하지 않고 여기서만 렌더를 건너뛴다.
    if (hidden) return null;

    // 하이드레이션 전에는 저장된 접힘 상태를 모르므로 펼친 모습으로 그린다 (기본값과 동일)
    const isOpen = railIsOpen;

    const peopleGroupClass = `carev-chat-rail-group${state.showPeople ? "" : " carev-chat-rail-group-closed"}`;
    const tasksGroupClass = `carev-chat-rail-group${state.showTasks ? "" : " carev-chat-rail-group-closed"}`;

    return (
        <>
            {/* 패널은 오른쪽에서 밀려 들어오고, 접으면 오른쪽 끝의 펼치기 막대로 줄어든다.
                업무진행도는 접힌 패널 안에 있으므로 함께 접힌다. 막대를 다시 누르면 펼친다. */}
            <AnimatePresence initial={false}>
                {isOpen ? (
                    <motion.aside
                        key="rail"
                        className="carev-chat-rail"
                        aria-label="직원·업무진행도"
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: RAIL_WIDTH, opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        transition={{ duration: duration.fast, ease: "easeOut" }}
                    >
                        <div className="carev-chat-rail-inner">
                            <div className="carev-chat-rail-head">
                                <Text type="label" weight="semibold">직원 · 업무</Text>
                                <IconButton
                                    label="패널 접기"
                                    tooltip="접기"
                                    variant="ghost"
                                    size="sm"
                                    icon={<Icon icon={FiChevronsRight} size="sm" />}
                                    onClick={() => update({ isOpen: false })}
                                />
                            </div>

                            {/* 직원과 업무진행도가 높이를 반씩 나눠 갖고 각자 안에서 스크롤한다 */}
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
                                                        density="compact"
                                                        // 대화는 오른쪽 아래 말풍선 창에서 열린다 — 패널은 업무를 보여 주는 자리다
                                                        onClick={() => requestDirectChat(member)}
                                                    />
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className={tasksGroupClass}>
                                    <WorkTaskSection
                                        meId={userId}
                                        members={orgMembers}
                                        isOpen={state.showTasks}
                                        onToggle={() => update({ showTasks: !state.showTasks })}
                                        openTaskId={pendingTaskId}
                                        onOpenedTask={clearPendingTask}
                                        onMyCountChange={setMyTaskCount}
                                        hasDividerAbove
                                    />
                                </div>
                            </div>
                        </div>
                    </motion.aside>
                ) : (
                    <motion.aside
                        key="strip"
                        className="carev-chat-rail-strip"
                        aria-label="직원·업무진행도 (접힘)"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: duration.fast, ease: "easeOut" }}
                    >
                        <IconButton
                            label="직원·업무진행도 펼치기"
                            tooltip="펼치기"
                            variant="ghost"
                            size="sm"
                            icon={<Icon icon={FiChevronsLeft} size="sm" />}
                            onClick={() => update({ isOpen: true })}
                        />
                        <button type="button" className="carev-chat-rail-strip-label" onClick={() => update({ isOpen: true })}>
                            업무진행도
                        </button>
                        {myTaskCount > 0 && (
                            <span className="carev-chat-rail-strip-badge">
                                <Badge variant="neutral" label={myTaskCount > 99 ? "99+" : myTaskCount} />
                            </span>
                        )}
                    </motion.aside>
                )}
            </AnimatePresence>

            {/* 접혀 있는 동안에도 막대의 '내 업무' 배지가 맞으려면 목록은 계속 받아야 한다 — 화면 밖에서 조용히 */}
            {!isOpen && (
                <div hidden>
                    <WorkTaskSection
                        meId={userId}
                        members={orgMembers}
                        isOpen={false}
                        onToggle={() => {}}
                        openTaskId={null}
                        onOpenedTask={clearPendingTask}
                        onMyCountChange={setMyTaskCount}
                    />
                </div>
            )}
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
