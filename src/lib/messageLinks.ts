/**
 * 메시지 글 속에서 링크를 찾아 낸다.
 *
 * 채팅에 링크를 붙여 넣어도 그냥 글자였다 — 눌러도 아무 일이 없었다.
 * 앱과 **같은 규칙**으로 찾아야 한 쪽에서만 링크로 보이는 일이 없다.
 * (같은 규칙이 앱 `lib/utils/message_links.dart`에도 있다)
 */

/** 한 조각의 글 — 링크이거나 그냥 글자다 */
export interface MessageSpan {
    text: string;
    isLink: boolean;
    /** 실제로 열 주소. `www.`로 시작하면 https를 붙인다 */
    url?: string;
}

/** http(s):// 로 시작하거나 www. 로 시작하는 것을 링크로 본다 */
const LINK_PATTERN = /(https?:\/\/[^\s<>"]+|www\.[^\s<>"]+)/gi;

/** 링크 끝에서 떼어낼 문장부호 */
const TRAILING = `.,;:!?)]}'"…`;

/**
 * 끝의 문장부호를 링크에서 뺀다 — "여기 봐: https://a.com." 에서 마침표까지
 * 링크에 넣으면 열리지 않는다. 괄호는 짝이 맞을 때만 남긴다.
 */
function trimTrailing(raw: string): string {
    let s = raw;
    while (s.length > 0 && TRAILING.includes(s[s.length - 1])) {
        const last = s[s.length - 1];
        const count = (ch: string) => (s.match(new RegExp(`\\${ch}`, 'g')) || []).length;
        if (last === ')' && count('(') > count(')') - 1) break;
        if (last === ']' && count('[') > count(']') - 1) break;
        s = s.slice(0, -1);
    }
    return s;
}

/** 글을 링크와 글자 조각으로 쪼갠다. 링크가 없으면 통짜 한 조각이다. */
export function splitMessageLinks(text: string): MessageSpan[] {
    if (!text) return [];

    const spans: MessageSpan[] = [];
    let cursor = 0;

    LINK_PATTERN.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = LINK_PATTERN.exec(text)) !== null) {
        const trimmed = trimTrailing(m[0]);
        if (!trimmed) continue;

        if (m.index > cursor) {
            spans.push({ text: text.slice(cursor, m.index), isLink: false });
        }

        const url = trimmed.toLowerCase().startsWith('www.') ? `https://${trimmed}` : trimmed;
        spans.push({ text: trimmed, isLink: true, url });

        cursor = m.index + trimmed.length;
        LINK_PATTERN.lastIndex = cursor;
    }

    if (cursor < text.length) {
        spans.push({ text: text.slice(cursor), isLink: false });
    }

    return spans.length ? spans : [{ text, isLink: false }];
}

/** 글에서 첫 번째 링크. 미리보기를 붙일 대상이다 (없으면 null) */
export function firstLinkOf(text: string): string | null {
    for (const span of splitMessageLinks(text)) {
        if (span.isLink && span.url) return span.url;
    }
    return null;
}
