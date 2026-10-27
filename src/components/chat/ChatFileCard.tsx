"use client";

import { FiFile } from "react-icons/fi";

/** 파일 이름에서 확장자(대문자)를 뽑는다 — 없으면 빈 문자열 */
function extensionOf(name: string): string {
    const m = /\.([A-Za-z0-9]{1,6})$/.exec(name);
    return m ? m[1].toUpperCase() : "";
}

/**
 * 채팅 파일 메시지 — 아이콘 + 파일명(13/500, 한 줄 말줄임) + 종류(11, 보조). 밑줄 없음, 카드 전체가 누를 자리.
 * 크기는 메시지에 담겨 오지 않아 확장자만 보여 준다.
 */
export function ChatFileCard({ name, isMine, onOpen }: { name: string; isMine: boolean; onOpen: () => void }) {
    const ext = extensionOf(name);
    return (
        <button
            type="button"
            onClick={onOpen}
            title={name}
            className={`carev-chat-filecard${isMine ? " carev-chat-filecard-mine" : ""}`}
        >
            <span className="carev-chat-filecard-icon" aria-hidden>
                <FiFile size={16} />
            </span>
            <span className="carev-chat-filecard-text">
                <span className="carev-chat-filecard-name">{name}</span>
                <span className="carev-chat-filecard-meta">{ext ? `${ext} 파일` : "파일"}</span>
            </span>
        </button>
    );
}
