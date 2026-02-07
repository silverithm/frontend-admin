"use client";

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
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2 flex-shrink-0">
                <h3 className="text-base font-semibold text-gray-900">채팅</h3>
                <span
                    className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-gray-400"}`}
                    title={isConnected ? "실시간 연결됨" : "연결 중..."}
                />
            </div>

            {/* Room List */}
            <div className="flex-1 overflow-y-auto">
                {isLoadingRooms ? (
                    <div className="flex items-center justify-center h-32">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
                    </div>
                ) : rooms.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 text-gray-400 text-sm">
                        <svg className="w-8 h-8 mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        채팅방이 없습니다
                    </div>
                ) : (
                    rooms.map((room) => (
                        <button
                            key={room.id}
                            onClick={() => onSelectRoom(room.id)}
                            className="w-full px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors text-left"
                        >
                            <div className="flex items-start justify-between mb-0.5">
                                <h4 className="font-semibold text-gray-900 text-sm truncate flex-1 mr-2">
                                    {room.name}
                                </h4>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    {room.lastMessageAt && (
                                        <span className="text-[11px] text-gray-400">
                                            {formatTimestamp(room.lastMessageAt)}
                                        </span>
                                    )}
                                    {room.unreadCount > 0 && (
                                        <span className="bg-blue-600 text-white text-[10px] font-medium min-w-[18px] h-[18px] flex items-center justify-center px-1.5 rounded-full">
                                            {room.unreadCount > 99 ? "99+" : room.unreadCount}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <p className="text-xs text-gray-500 truncate">
                                {room.lastMessage
                                    ? `${room.lastMessage.senderName}: ${room.lastMessage.content}`
                                    : "메시지가 없습니다"}
                            </p>
                        </button>
                    ))
                )}
            </div>
        </div>
    );
}
