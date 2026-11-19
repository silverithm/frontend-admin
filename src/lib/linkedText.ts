// 문장 속 몇 글자를 내부 링크로 — FAQ 답·가이드 설명에 쓴다.
//
// 문장 자체는 평문으로 두고 "어느 글자가 어디로 가는 링크인지"만 따로 적는다.
// FAQ 답은 FAQPage 구조화 데이터에도 그대로 들어가는데, 구글 정책상 구조화 데이터의 답과
// 화면 글자가 같아야 한다. 문장에 마크업을 섞지 않으니 둘이 어긋날 일이 없다.
//
// 링크 글자를 문장에서 못 찾거나 다른 링크와 겹치면 그 링크만 건너뛴다(화면이 깨지지 않게).
// 빠뜨린 링크는 linkedText.test.ts가 잡는다.

export interface TextLink {
    /** 문장 안에 한 번만 나오는 글자 그대로 */
    text: string;
    /** 사이트 안 주소 — '/ltc/…', '/blog/…' */
    href: string;
}

export interface TextSegment {
    text: string;
    href?: string;
}

export function splitLinkedText(text: string, links: ReadonlyArray<TextLink> = []): TextSegment[] {
    const spans = links
        .map((link) => ({ start: text.indexOf(link.text), length: link.text.length, href: link.href }))
        .filter((span) => span.start >= 0 && span.length > 0)
        .sort((a, b) => a.start - b.start);

    const segments: TextSegment[] = [];
    let at = 0;
    for (const span of spans) {
        if (span.start < at) continue; // 앞 링크와 겹침
        if (span.start > at) segments.push({ text: text.slice(at, span.start) });
        segments.push({ text: text.slice(span.start, span.start + span.length), href: span.href });
        at = span.start + span.length;
    }
    if (at < text.length) segments.push({ text: text.slice(at) });
    return segments;
}
