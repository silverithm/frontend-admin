import { BLOG_POSTS } from '@/lib/blogPosts'
import { SITE_URL, buildBreadcrumbJsonLd, jsonLdScriptProps } from '@/lib/seo'

// route group — URL은 그대로 /blog이면서, 목록 페이지에만 적용되는 layout을 만든다.
// (부모 blog/layout.tsx에 두면 /blog/[slug]에도 상속되어 구조화 데이터가 중복된다.)

// Blog + 글 목록. 개별 글 URL을 목록 단계에서 함께 알려 크롤 발견을 돕는다.
const blogJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Blog',
  '@id': `${SITE_URL}/blog#blog`,
  name: '케어브이 블로그',
  description: '요양기관 근무표 작성 노하우, 휴무 관리 팁, 케어브이 기능 업데이트 소식',
  url: `${SITE_URL}/blog`,
  inLanguage: 'ko-KR',
  isPartOf: { '@id': `${SITE_URL}/#website` },
  publisher: { '@id': `${SITE_URL}/#organization` },
  blogPost: BLOG_POSTS.map((post) => ({
    '@type': 'BlogPosting',
    '@id': `${SITE_URL}/blog/${post.slug}#article`,
    headline: post.title,
    description: post.excerpt,
    datePublished: post.date,
    url: `${SITE_URL}/blog/${post.slug}`,
  })),
}

const breadcrumbJsonLd = buildBreadcrumbJsonLd([{ name: '블로그', path: '/blog' }])

export default function BlogListLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <script {...jsonLdScriptProps(blogJsonLd)} />
      <script {...jsonLdScriptProps(breadcrumbJsonLd)} />
      {children}
    </>
  )
}
