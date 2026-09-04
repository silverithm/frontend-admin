"use client";

import { Fragment } from "react";

import { splitMessageLinks } from "@/lib/messageLinks";

interface Props {
    content: string;
    /** 내 말풍선(진한 배경)인지 — 언급·링크 색을 배경에 맞춘다 */
    isMyMessage: boolean;
}

/**
 * 말풍선 안의 글 — '@이름'을 눈에 띄게 칠하고, 링크는 눌러 열 수 있게 그린다.
 *
 * 링크가 그냥 글자였다: 붙여 넣어도 눌리지 않았다. 언급과 링크가 한 글에 섞여 있을 수
 * 있으므로 링크로 먼저 쪼갠 뒤, 링크가 아닌 조각 안에서만 언급을 찾는다.
 * (앱 `lib/screens/chat_room_screen.dart`의 _buildTextWithMentions와 같은 순서)
 */
export function ChatMessageText({ content, isMyMessage }: Props) {
    if (!content) return null;

    return (
        <>
            {splitMessageLinks(content).map((part, i) => {
                if (part.isLink) {
                    return (
                        <a
                            key={i}
                            href={part.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            /* 말풍선 배경 위에서 읽히도록 글자색은 물려받고 밑줄로만 구분한다 */
                            style={{
                                color: "inherit",
                                textDecoration: "underline",
                                textUnderlineOffset: 2,
                                fontWeight: 'var(--font-weight-semibold)',
                                wordBreak: "break-all",
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {part.text}
                        </a>
                    );
                }

                if (!part.text.includes("@")) {
                    return <Fragment key={i}>{part.text}</Fragment>;
                }

                return part.text.split(/(@[^\s@]{1,20})/g).map((piece, j) =>
                    piece.startsWith("@") && piece.length > 1 ? (
                        <strong
                            key={`${i}-${j}`}
                            style={{
                                fontWeight: 'var(--font-weight-semibold)',
                                color: isMyMessage ? 'var(--color-on-accent)' : 'var(--color-text-accent)',
                                background: isMyMessage ? "rgba(255,255,255,0.22)" : 'var(--color-background-teal)',
                                borderRadius: 'var(--radius-inner)',
                                padding: "0 var(--spacing-0-5)",
                            }}
                        >
                            {piece}
                        </strong>
                    ) : (
                        <Fragment key={`${i}-${j}`}>{piece}</Fragment>
                    ),
                );
            })}
        </>
    );
}
