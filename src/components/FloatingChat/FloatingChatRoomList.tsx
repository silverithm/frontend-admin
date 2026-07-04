"use client";

import { Text } from "@astryxdesign/core/Text";
import { Badge } from "@astryxdesign/core/Badge";
import { Spinner } from "@astryxdesign/core/Spinner";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { FiMessageCircle } from "react-icons/fi";
import { ChatRoom } from "./floatingChatTypes";

interface FloatingChatRoomListProps {
    rooms: ChatRoom[];
    isLoadingRooms: boolean;
    isConnected: boolean;
    onSelectRoom: (roomId: number) => void;
}

function formatTimestamp(timestamp: string) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return "방금";
    if (diffMins < 60) return `${diffMins}분 전`;
    if (diffHours < 24) return `${diffHours}시간 전`;

    return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
}

export function FloatingChatRoomList({
    rooms,
    isLoadingRooms,
    isConnected,
    onSelectRoom,
}: FloatingChatRoomListProps) {
    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            {/* Header */}
            <div
                style={{
                    padding: "12px 16px",
                    background: "linear-gradient(to right, #14b8a6, #0d9488)",
                    borderTopLeftRadius: 16,
                    borderTopRightRadius: 16,
                    display: "flex",
                    alignItems: "center",
                    gap: 'var(--spacing-2)',
                    flexShrink: 0,
                    color: "#ffffff",
                }}
            >
                <Text type="body" weight="semibold" color="inherit">채팅</Text>
                <span
                    title={isConnected ? "실시간 연결됨" : "연결 중..."}
                    style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        boxShadow: "0 0 0 2px rgba(255,255,255,0.3)",
                        background: isConnected ? 'var(--color-background-green)' : 'var(--color-background-muted)',
                    }}
                />
            </div>

            {/* Room List */}
            <div style={{ flex: 1, overflowY: "auto" }}>
                {isLoadingRooms ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 160 }}>
                        <Spinner aria-label="채팅방 불러오는 중" />
                    </div>
                ) : rooms.length === 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 160 }}>
                        <EmptyState icon={FiMessageCircle} title="채팅방이 없습니다" isCompact />
                    </div>
                ) : (
                    rooms.map((room) => (
                        <button
                            key={room.id}
                            onClick={() => onSelectRoom(room.id)}
                            className="carev-fchatroom-item"
                            style={{
                                width: "100%",
                                padding: "12px 16px",
                                textAlign: "left",
                                background: "transparent",
                                border: "none",
                                borderBottom: "1px solid var(--color-border)",
                                cursor: "pointer",
                                transition: 'background-color var(--duration-fast-min) var(--ease-standard)',
                            }}
                        >
                            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 'var(--spacing-0-5)' }}>
                                <div style={{ flex: 1, minWidth: 0, marginRight: 'var(--spacing-2)' }}>
                                    <Text type="body" weight="semibold" color="primary" maxLines={1}>
                                        {room.name}
                                    </Text>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 'var(--spacing-2)', flexShrink: 0 }}>
                                    {room.lastMessageAt && (
                                        <Text type="supporting" color="disabled">
                                            {formatTimestamp(room.lastMessageAt)}
                                        </Text>
                                    )}
                                    {room.unreadCount > 0 && (
                                        <Badge variant="teal" label={room.unreadCount > 99 ? "99+" : room.unreadCount} />
                                    )}
                                </div>
                            </div>
                            <Text type="supporting" color="secondary" maxLines={1}>
                                {room.lastMessage
                                    ? `${room.lastMessage.senderName}: ${room.lastMessage.content}`
                                    : "메시지가 없습니다"}
                            </Text>
                        </button>
                    ))
                )}
            </div>
        </div>
    );
}
