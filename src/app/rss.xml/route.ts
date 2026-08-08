import { BLOG_POSTS } from '@/lib/blogPosts'
import { SITE_URL } from '@/lib/seo'

// 블로그 RSS 피드.
// 네이버 서치어드바이저는 sitemap과 별개로 RSS 제출을 지원하고, 새 글 수집이 사이트맵보다 빠르다.
// 구글도 피드를 보조 발견 경로로 사용한다.

export const dynamic = 'force-static'

/** XML 텍스트 노드에 들어갈 수 없는 문자를 이스케이프한다. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** yyyy-MM-dd → RFC 822 (RSS 2.0이 요구하는 날짜 형식) */
function toRfc822(date: string): string {
  return new Date(`${date}T09:00:00+09:00`).toUTCString()
}

export async function GET() {
  const posts = [...BLOG_POSTS].sort((a, b) => (a.date < b.date ? 1 : -1))
  const lastBuild = posts[0] ? toRfc822(posts[0].date) : new Date(0).toUTCString()

  const items = posts
    .map(
      (post) => `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${SITE_URL}/blog/${post.slug}</link>
      <guid isPermaLink="true">${SITE_URL}/blog/${post.slug}</guid>
      <description>${escapeXml(post.excerpt)}</description>
      <category>${escapeXml(post.category)}</category>
      <pubDate>${toRfc822(post.date)}</pubDate>
    </item>`
    )
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>케어브이 블로그</title>
    <link>${SITE_URL}/blog</link>
    <description>요양기관 근무표 작성 노하우, 휴무 관리 팁, 케어브이 기능 업데이트 소식</description>
    <language>ko</language>
    <lastBuildDate>${lastBuild}</lastBuildDate>
    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
