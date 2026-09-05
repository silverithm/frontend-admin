"use client";

import { lastMessagePreview } from "@/lib/chatMessageGrouping";
import { Text } from "@astryxdesign/core/Text";
import { Badge } from "@astryxdesign/core/Badge";
import { Avatar } from "@astryxdesign/core/Avatar";
import { Item } from "@astryxdesign/core/Item";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { Timestamp } from "@astryxdesign/core/Timestamp";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import { FiMessageCircle, FiUsers } from "react-icons/fi";
import { Loading } from "@/components/Loading";
import MemberItem from "@/components/MemberItem";
import { DirectChatMember } from "@/lib/directChat";
import { ChatRoom } from "./floatingChatTypes";

export type FloatingChatListTab = "rooms" | "people";

interface FloatingChatRoomListProps {
    rooms: ChatRoom[];
    isLoadingRooms: boolean;
    isConnected: boolean;
    onSelectRoom: (roomId: number) => void;

    listTab: FloatingChatListTab;
    onListTabChange: (tab: FloatingChatListTab) => void;

    members: DirectChatMember[];
    onlineUserIds: Set<string>;
    /** 인원 명단 로드 상태 — 실패를 '직원 없음'과 구분해 보여주기 위해 필요하다 */
    membersStatus: "idle" | "loading" | "loaded" | "error";
    onRetryLoadMembers: () => void;
    myName: string;
    myProfileImageUrl?: string | null;
    isOpeningDirect: boolean;
    onSelectMember: (member: DirectChatMember) => void;
    /** 1:1 대화 열기 실패 안내 */
    directError?: string | null;
    onDismissDirectError: () => void;
}

export function FloatingChatRoomList({
    rooms,
    isLoadingRooms,
    isConnected,
    onSelectRoom,
    listTab,
    onListTabChange,
    members,
    onlineUserIds,
    membersStatus,
    onRetryLoadMembers,
    myName,
    myProfileImageUrl,
    isOpeningDirect,
    onSelectMember,
    directError,
    onDismissDirectError,
}: FloatingChatRoomListProps) {
    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            {/* Header */}
            <div
                style={{
                    padding: "var(--spacing-3) var(--spacing-4)",
                    background: "var(--color-icon-teal)",
                    borderTopLeftRadius: "var(--radius-container)",
                    borderTopRightRadius: "var(--radius-container)",
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--spacing-2)",
                    flexShrink: 0,
                    color: "var(--color-on-accent)",
                }}
            >
                <Text type="body" weight="semibold" color="inherit">채팅</Text>
                <StatusDot
                    variant={isConnected ? "success" : "neutral"}
                    label={isConnected ? "실시간 연결됨" : "연결 중..."}
                    tooltip={isConnected ? "실시간 연결됨" : "연결 중..."}
                    isPulsing={isConnected}
                />
            </div>

            {/* 대화 / 직원 전환 — 채팅 페이지와 같은 구성 */}
            <div
                style={{
                    padding: "var(--spacing-2) var(--spacing-3)",
                    borderBottom: "1px solid var(--color-border)",
                    flexShrink: 0,
                }}
            >
                <SegmentedControl
                    label="목록 전환"
                    value={listTab}
                    onChange={(value) => onListTabChange(value as FloatingChatListTab)}
                    layout="fill"
                >
                    <SegmentedControlItem value="rooms" label={`대화 (${rooms.length})`} />
                    <SegmentedControlItem value="people" label={`직원 (${members.length})`} />
                </SegmentedControl>
            </div>

            {/* 직원 목록 — 온라인이 위, 누르면 1:1 대화 */}
            {listTab === "people" && (
                <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
                    {directError && (
                        <div style={{ padding: "var(--spacing-2)" }}>
                            <Banner
                                status="error"
                                title={directError}
                                description="잠시 후 다시 눌러주세요."
                                isDismissable
                                onDismiss={onDismissDirectError}
                            />
                        </div>
                    )}

                    {/* 맨 위는 내 프로필 — 이 화면을 보고 있다는 것 자체가 접속 중이라는 뜻 */}
                    <div
                        style={{
                            borderBottom: "1px solid var(--color-border)",
                            background: "var(--color-background-muted)",
                        }}
                    >
                        <MemberItem
                            name={myName || "나"}
                            suffix="나"
                            imageUrl={myProfileImageUrl}
                            presence="online"
                        />
                    </div>

                    {/* idle은 '아직 요청 전' — 여기서 빈 목록을 보여주면 '직원 없음'이 한 프레임 스친다 */}
                    {membersStatus === "loading" || membersStatus === "idle" ? (
                        <Loading size="inline" height={160} label="직원 목록을 불러오는 중..." />
                    ) : membersStatus === "error" ? (
                        // 실패를 '직원 없음'으로 보여주면 사용자가 기관에 사람이 없다고 오해한다
                        <div style={{ padding: "var(--spacing-2)" }}>
                            <Banner
                                status="error"
                                title="직원 목록을 불러오지 못했습니다"
                                description="연결 상태를 확인한 뒤 다시 시도해주세요."
                                endContent={
                                    <Button label="다시 시도" variant="secondary" size="sm" onClick={onRetryLoadMembers} />
                                }
                            />
                        </div>
                    ) : members.length === 0 ? (
                        <div style={{ padding: "var(--spacing-6)" }}>
                            <EmptyState
                                isCompact
                                icon={<Icon icon={FiUsers} size="lg" color="tertiary" />}
                                title="등록된 직원이 없습니다"
                            />
                        </div>
                    ) : (
                        members.map((member) => (
                            <div key={member.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                                <MemberItem
                                    name={member.name}
                                    role={member.position}
                                    imageUrl={member.profileImageUrl}
                                    presence={onlineUserIds.has(member.id) ? "online" : "offline"}
                                    isDisabled={isOpeningDirect}
                                    onClick={() => onSelectMember(member)}
                                    endContent={<Icon icon={FiMessageCircle} size="sm" color="tertiary" />}
                                />
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* 대화 목록 */}
            {listTab === "rooms" && (
                <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
                    {isLoadingRooms ? (
                        <Loading size="inline" height={160} label="채팅방을 불러오는 중..." />
                    ) : rooms.length === 0 ? (
                        <div style={{ padding: "var(--spacing-6)" }}>
                            <EmptyState
                                isCompact
                                icon={<Icon icon={FiMessageCircle} size="lg" color="tertiary" />}
                                title="채팅방이 없습니다"
                                description="직원 탭에서 이름을 누르면 1:1 대화가 열립니다."
                            />
                        </div>
                    ) : (
                        rooms.map((room) => (
                            <div key={room.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                                <Item
                                    label={room.name}
                                    description={
                                        room.lastMessage
                                            ? `${room.lastMessage.senderName}: ${lastMessagePreview(room.lastMessage)}`
                                            : "메시지가 없습니다"
                                    }
                                    startContent={<Avatar name={room.name || "?"} size="small" />}
                                    endContent={
                                        <div
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "var(--spacing-2)",
                                                flexShrink: 0,
                                            }}
                                        >
                                            {room.lastMessageAt && (
                                                <Timestamp
                                                    value={room.lastMessageAt}
                                                    format="auto"
                                                    hasTooltip
                                                    type="supporting"
                                                    color="disabled"
                                                />
                                            )}
                                            {room.unreadCount > 0 && (
                                                <Badge
                                                    variant="teal"
                                                    label={room.unreadCount > 99 ? "99+" : room.unreadCount}
                                                />
                                            )}
                                        </div>
                                    }
                                    onClick={() => onSelectRoom(room.id)}
                                    labelLines={1}
                                    descriptionLines={1}
                                />
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
