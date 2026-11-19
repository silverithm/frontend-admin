/**
 * 문장 속 링크 — `node --test src/lib/linkedText.test.ts`
 *
 * FAQ 답은 FAQPage 구조화 데이터에 평문 그대로 들어간다. 화면에서는 일부 글자만 링크가 되므로
 * (1) 잘라 낸 조각을 이으면 원래 답과 한 글자도 다르지 않아야 하고
 * (2) 적어 둔 링크가 하나도 빠지지 않아야 하며
 * (3) 링크가 가리키는 글·기준표가 실제로 있어야 한다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

import { splitLinkedText } from './linkedText.ts';
import { FAQ_DATA } from './faqData.ts';
import { BLOG_POSTS } from './blogPosts.ts';

test('글자 순서와 상관없이 앞에서부터 자르고, 링크 아닌 글자는 그대로 둔다', () => {
    assert.deepEqual(
        splitLinkedText('가나 다라 마바', [
            { text: '마바', href: '/b' },
            { text: '가나', href: '/a' },
        ]),
        [
            { text: '가나', href: '/a' },
            { text: ' 다라 ' },
            { text: '마바', href: '/b' },
        ]
    );
});

test('문장에 없는 링크·앞 링크와 겹치는 링크는 건너뛴다(화면은 깨지지 않는다)', () => {
    assert.deepEqual(
        splitLinkedText('주간보호센터 인력배치기준', [
            { text: '없는 글자', href: '/x' },
            { text: '주간보호센터', href: '/a' },
            { text: '센터 인력', href: '/b' },
        ]),
        [{ text: '주간보호센터', href: '/a' }, { text: ' 인력배치기준' }]
    );
    assert.deepEqual(splitLinkedText('링크 없음'), [{ text: '링크 없음' }]);
});

test('인력배치 기준 FAQ — 허브·인력배치기준·월 기준 근무시간 세 곳으로 간다', () => {
    const item = FAQ_DATA.find((f) => f.question === '인력배치 기준은 어디서 확인하나요?');
    assert.ok(item);
    const links = splitLinkedText(item.answer, item.links).filter((s) => s.href);
    assert.deepEqual(links, [
        { text: '장기요양 기준표', href: '/ltc' },
        { text: '주간보호센터 인력배치기준', href: '/ltc/daycare-staffing-standard' },
        { text: '2026년 월 기준 근무시간', href: '/ltc/monthly-standard-hours-2026' },
    ]);
    // 예전처럼 주소를 글자로만 적어 두지 않는다
    assert.equal(item.answer.includes('carev.kr/'), false);
});

test('FAQ 답 전부 — 조각을 이으면 원래 답, 링크 글자는 답 안에 정확히 한 번', () => {
    let linkCount = 0;
    for (const item of FAQ_DATA) {
        const segments = splitLinkedText(item.answer, item.links);
        assert.equal(segments.map((s) => s.text).join(''), item.answer, item.question);
        for (const link of item.links ?? []) {
            const first = item.answer.indexOf(link.text);
            assert.ok(first >= 0, `${item.question}: 답에 없다 — ${link.text}`);
            assert.equal(item.answer.indexOf(link.text, first + 1), -1, `${item.question}: 두 번 나온다 — ${link.text}`);
        }
        assert.equal(segments.filter((s) => s.href).length, item.links?.length ?? 0, `${item.question}: 빠진 링크`);
        linkCount += item.links?.length ?? 0;
    }
    assert.equal(linkCount, 11);
});

test('FAQ 링크 대상이 실제로 있다 — /blog 글은 글 목록에, /ltc는 페이지 파일로', () => {
    const slugs = new Set(BLOG_POSTS.map((p) => p.slug));
    for (const item of FAQ_DATA) {
        for (const { href } of item.links ?? []) {
            if (href.startsWith('/blog/')) {
                assert.ok(slugs.has(href.slice('/blog/'.length)), `없는 글: ${href}`);
            } else {
                assert.match(href, /^\/ltc(\/[a-z0-9-]+)?$/);
                assert.ok(existsSync(new URL(`../app${href}/page.tsx`, import.meta.url)), `없는 페이지: ${href}`);
            }
        }
    }
});
