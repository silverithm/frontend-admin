import { BLOG_POSTS } from '@/lib/blogPosts'
import { LTC_HUB_DESCRIPTION, LTC_HUB_PATH, LTC_HUB_TITLE, LTC_HUB_UPDATED, LTC_PAGES } from '@/lib/ltcPages'
import { buildRssXml, type RssItem } from '@/lib/rssFeed'
import { SITE_URL } from '@/lib/seo'

// 블로그 글과 장기요양 기준표 RSS 피드.
// 네이버 서치어드바이저는 sitemap과 별개로 RSS 제출을 지원하고, 새 글 수집이 사이트맵보다 빠르다.
// 구글도 피드를 보조 발견 경로로 사용한다.
// 기준표는 ltcPages.ts 목록을 그대로 쓰므로, 새 기준표를 목록에 넣으면 피드에도 자동으로 들어간다.

export const dynamic = 'force-static'

export async function GET() {
  const blogItems: RssItem[] = BLOG_POSTS.map((post) => ({
    title: post.title,
    link: `${SITE_URL}/blog/${post.slug}`,
    description: post.excerpt,
    category: post.category,
    date: post.date,
  }))

  const ltcItems: RssItem[] = [
    {
      title: LTC_HUB_TITLE,
      link: `${SITE_URL}${LTC_HUB_PATH}`,
      description: LTC_HUB_DESCRIPTION,
      category: '장기요양 기준표',
      date: LTC_HUB_UPDATED,
    },
    ...LTC_PAGES.map((page) => ({
      title: page.title,
      link: `${SITE_URL}${page.path}`,
      description: page.summary,
      category: '장기요양 기준표',
      date: page.lastModified,
    })),
  ]

  const xml = buildRssXml(
    {
      title: '케어브이 블로그·장기요양 기준표',
      link: `${SITE_URL}/blog`,
      description: '요양기관 근무표 작성 노하우, 휴무 관리 팁, 케어브이 기능 업데이트 소식과 장기요양 기준표',
      selfUrl: `${SITE_URL}/rss.xml`,
    },
    [...ltcItems, ...blogItems],
  )

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
