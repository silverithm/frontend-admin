"use client";

import { chatListImageUrl } from '@/lib/chatAttachments';

/** 그리드에 그릴 사진 한 장 — 두 화면의 ChatMessage 타입에서 필요한 만큼만 구조적으로 받는다 */
export interface ChatPhotoGroupItem {
    id: number;
    fileUrl?: string;
    thumbnailUrl?: string;
    fileName?: string;
}

/**
 * 연달아 온 사진을 한 말풍선 안 격자로 그린다 (카카오톡과 같은 모양).
 *
 * 목록에는 항상 축소본(chatListImageUrl)을 쓰고, 원본은 크게 보기에서만 연다.
 * 격자 칸은 정사각형으로 잘라(objectFit: cover) 줄이 들쭉날쭉해지지 않게 한다 —
 * 한 장짜리 사진은 이 컴포넌트를 쓰지 않고 원래 비율 그대로 그린다.
 */
export function ChatPhotoGroup({
    messages,
    maxWidth,
    onOpen,
}: {
    messages: ChatPhotoGroupItem[];
    maxWidth: number;
    onOpen: (index: number) => void;
}) {
    // 장수별 열 수 — 4장만 2열(2×2)로 두어야 어중간한 한 칸이 남지 않는다
    const count = messages.length;
    const columns = count === 2 ? 2 : count === 3 ? 3 : count === 4 ? 2 : 3;

    return (
        <div
            style={{
                display: "grid",
                gridTemplateColumns: `repeat(${columns}, 1fr)`,
                gap: 'var(--spacing-1)',
                width: "100%",
                maxWidth,
            }}
        >
            {messages.map((message, index) => (
                // img는 네이티브로 포커스를 못 받으므로 button으로 감싸 키보드로도 크게 보기를 열 수 있게 한다
                <button
                    key={message.id}
                    type="button"
                    onClick={() => onOpen(index)}
                    aria-label={`${index + 1}번째 사진 크게 보기`}
                    style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "block", width: "100%" }}
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        className="carev-chat-gridphoto"
                        src={chatListImageUrl(message)}
                        alt={message.fileName || `사진 ${index + 1}`}
                        loading="lazy"
                        decoding="async"
                        style={{
                            display: "block",
                            width: "100%",
                            aspectRatio: "1 / 1",
                            objectFit: "cover",
                            borderRadius: 'var(--radius-inner)',
                        }}
                    />
                </button>
            ))}
        </div>
    );
}

export default ChatPhotoGroup;
