import { MetadataRoute } from 'next'
import { BLOG_POSTS } from '@/lib/blogPosts'
import { SITE_URL } from '@/lib/seo'

// lastModified에 new Date()를 쓰면 크롤링할 때마다 "방금 수정됨"으로 보고되어
// 검색엔진이 이 사이트의 lastmod 신호 자체를 신뢰하지 않게 된다.
// 실제로 내용을 고칠 때 이 상수를 함께 올린다.
const CONTENT_UPDATED = '2026-08-09'

/** 블로그 목록의 갱신일은 가장 최근 글의 작성일을 따른다. */
function latestBlogDate(): string {
  return BLOG_POSTS.reduce(
    (latest, post) => (post.date > latest ? post.date : latest),
    BLOG_POSTS[0]?.date ?? CONTENT_UPDATED
  )
}

export default function sitemap(): MetadataRoute.Sitemap {
  // 공개(색인 대상) 정적 경로.
  // robots.txt에서 Disallow한 경로와 noindex 페이지(/login, /register)는 넣지 않는다.
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: CONTENT_UPDATED,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${SITE_URL}/guide`,
      lastModified: CONTENT_UPDATED,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/faq`,
      lastModified: CONTENT_UPDATED,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/blog`,
      lastModified: latestBlogDate(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/plaza`,
      lastModified: CONTENT_UPDATED,
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/partners`,
      lastModified: CONTENT_UPDATED,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/contact`,
      lastModified: CONTENT_UPDATED,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/signup`,
      lastModified: CONTENT_UPDATED,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
  ]

  // 블로그 개별 글
  const blogRoutes: MetadataRoute.Sitemap = BLOG_POSTS.map((post) => ({
    url: `${SITE_URL}/blog/${post.slug}`,
    lastModified: post.date,
    changeFrequency: 'monthly',
    priority: 0.7,
  }))

  return [...staticRoutes, ...blogRoutes]
}
