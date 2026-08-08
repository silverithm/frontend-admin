import { Metadata } from 'next'
import { BLOG_POSTS, getBlogPostMeta } from '@/lib/blogPosts'
import { OG_IMAGE, OG_IMAGES, SITE_URL, buildBreadcrumbJsonLd, jsonLdScriptProps } from '@/lib/seo'

export async function generateStaticParams() {
  return BLOG_POSTS.map((post) => ({ slug: post.slug }))
}

// 등록되지 않은 슬러그는 200 + "찾을 수 없습니다" 화면(soft 404)이 아니라
// 실제 404를 돌려줘야 검색엔진이 색인 대상에서 제외한다.
export const dynamicParams = false

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params
  const post = getBlogPostMeta(slug)

  if (!post) {
    return {
      title: '포스트를 찾을 수 없습니다',
      robots: { index: false, follow: true },
      alternates: { canonical: `/blog/${slug}` },
    }
  }

  return {
    title: post.title,
    description: post.excerpt,
    keywords: post.keywords.join(', '),
    openGraph: {
      title: `${post.title} | 케어브이`,
      description: post.excerpt,
      url: `https://carev.kr/blog/${post.slug}`,
      type: 'article',
      publishedTime: post.date,
      authors: ['케어브이'],
      tags: post.keywords,
      images: OG_IMAGES,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.excerpt,
    },
    alternates: {
      canonical: `/blog/${post.slug}`,
    },
  }
}

export default async function BlogPostLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const post = getBlogPostMeta(slug)

  if (!post) return children

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': `https://carev.kr/blog/${post.slug}#article`,
    headline: post.title,
    description: post.excerpt,
    datePublished: post.date,
    dateModified: post.date,
    articleSection: post.category,
    keywords: post.keywords.join(', '),
    inLanguage: 'ko-KR',
    // 구글 기사 리치 결과는 너비 1200px 이상의 이미지를 요구한다.
    // 로고(비율이 맞지 않음) 대신 OG 이미지를 쓴다.
    image: [OG_IMAGE.url],
    // Blog 노드는 목록 페이지에만 출력되므로, 여기서는 최소 정보를 인라인으로 함께 준다.
    isPartOf: {
      '@type': 'Blog',
      '@id': `${SITE_URL}/blog#blog`,
      name: '케어브이 블로그',
      url: `${SITE_URL}/blog`,
    },
    author: { '@type': 'Organization', name: '케어브이', url: SITE_URL },
    publisher: { '@id': `${SITE_URL}/#organization` },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${SITE_URL}/blog/${post.slug}`,
    },
  }

  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: '블로그', path: '/blog' },
    { name: post.title, path: `/blog/${post.slug}` },
  ])

  return (
    <>
      <script {...jsonLdScriptProps(articleJsonLd)} />
      <script {...jsonLdScriptProps(breadcrumbJsonLd)} />
      {children}
    </>
  )
}
