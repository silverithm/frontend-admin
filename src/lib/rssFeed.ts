/**
 * RSS 2.0 피드 만들기 — 블로그 글과 장기요양 기준표를 한 피드에 담는다.
 *
 * 네이버 서치어드바이저는 RSS로 새 글을 사이트맵보다 빨리 가져간다. 그런데 피드에 블로그만 있어서
 * 검색에서 실제로 노출되는 기준표(/ltc)는 네이버가 하나도 모르고 있었다(2026-11-26 site:carev.kr 5건).
 */

export interface RssItem {
  title: string;
  /** 절대 주소 */
  link: string;
  description: string;
  category: string;
  /** yyyy-MM-dd */
  date: string;
}

export interface RssChannel {
  title: string;
  link: string;
  description: string;
  selfUrl: string;
}

/** XML 텍스트 노드에 들어갈 수 없는 문자를 이스케이프한다. */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** yyyy-MM-dd → RFC 822 (RSS 2.0이 요구하는 날짜 형식), 한국 시각 오전 9시로 둔다 */
export function toRfc822(date: string): string {
  return new Date(`${date}T09:00:00+09:00`).toUTCString();
}

/** 최신 날짜가 먼저, 같은 날이면 주소순(빌드마다 순서가 같도록) */
export function sortRssItems(items: ReadonlyArray<RssItem>): RssItem[] {
  return [...items].sort((a, b) => (a.date !== b.date ? (a.date < b.date ? 1 : -1) : a.link < b.link ? -1 : a.link > b.link ? 1 : 0));
}

export function buildRssXml(channel: RssChannel, items: ReadonlyArray<RssItem>): string {
  const sorted = sortRssItems(items);
  const lastBuild = sorted[0] ? toRfc822(sorted[0].date) : new Date(0).toUTCString();
  const body = sorted
    .map(
      (item) => `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(item.link)}</link>
      <guid isPermaLink="true">${escapeXml(item.link)}</guid>
      <description>${escapeXml(item.description)}</description>
      <category>${escapeXml(item.category)}</category>
      <pubDate>${toRfc822(item.date)}</pubDate>
    </item>`,
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(channel.title)}</title>
    <link>${escapeXml(channel.link)}</link>
    <description>${escapeXml(channel.description)}</description>
    <language>ko</language>
    <lastBuildDate>${lastBuild}</lastBuildDate>
    <atom:link href="${escapeXml(channel.selfUrl)}" rel="self" type="application/rss+xml" />
${body}
  </channel>
</rss>
`;
}
