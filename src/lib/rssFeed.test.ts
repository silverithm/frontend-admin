/**
 * RSS 피드 — `node --test src/lib/rssFeed.test.ts`
 * 기준표가 블로그와 한 피드에 들어가도 최신순·이스케이프·RFC 822 날짜가 지켜지는지.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { buildRssXml, escapeXml, sortRssItems, toRfc822, type RssItem } from './rssFeed.ts';

const item = (link: string, date: string, title = link): RssItem => ({
  title,
  link: `https://carev.kr${link}`,
  description: `${title} 설명`,
  category: '장기요양 기준표',
  date,
});

test('최신 날짜가 먼저, 같은 날은 주소순', () => {
  const sorted = sortRssItems([
    item('/blog/a', '2026-08-29'),
    item('/ltc/z', '2026-11-25'),
    item('/ltc/b', '2026-11-25'),
    item('/ltc', '2026-11-25'),
    item('/ltc/old', '2026-10-04'),
  ]);
  assert.deepEqual(
    sorted.map((i) => i.link.replace('https://carev.kr', '')),
    ['/ltc', '/ltc/b', '/ltc/z', '/ltc/old', '/blog/a'],
  );
});

test('제목·설명의 특수문자를 이스케이프하고 날짜는 RFC 822', () => {
  assert.equal(escapeXml(`a & b <c> "d" 'e'`), 'a &amp; b &lt;c&gt; &quot;d&quot; &apos;e&apos;');
  assert.equal(toRfc822('2026-11-25'), 'Wed, 25 Nov 2026 00:00:00 GMT');
  const xml = buildRssXml(
    { title: '케어브이', link: 'https://carev.kr/blog', description: '설명', selfUrl: 'https://carev.kr/rss.xml' },
    [item('/ltc/x', '2026-11-25', '수가 & 한도액 <2026>'), item('/blog/y', '2026-08-29')],
  );
  assert.match(xml, /<title>수가 &amp; 한도액 &lt;2026&gt;<\/title>/);
  assert.match(xml, /<lastBuildDate>Wed, 25 Nov 2026 00:00:00 GMT<\/lastBuildDate>/);
  assert.equal((xml.match(/<item>/g) ?? []).length, 2);
  assert.ok(xml.indexOf('/ltc/x') < xml.indexOf('/blog/y'));
});

test('항목이 없어도 올바른 피드', () => {
  const xml = buildRssXml({ title: 't', link: 'l', description: 'd', selfUrl: 's' }, []);
  assert.match(xml, /<lastBuildDate>Thu, 01 Jan 1970 00:00:00 GMT<\/lastBuildDate>/);
  assert.doesNotMatch(xml, /<item>/);
});
