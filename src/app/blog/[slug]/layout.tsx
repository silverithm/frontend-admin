import { Metadata } from 'next'
import { BLOG_POSTS, getBlogPostMeta } from '@/lib/blogPosts'
import { OG_IMAGES } from '@/lib/seo'

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
    image: 'https://carev.kr/images/carev-logo-text.png',
    author: { '@type': 'Organization', name: '케어브이', url: 'https://carev.kr' },
    publisher: { '@id': 'https://carev.kr/#organization' },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `https://carev.kr/blog/${post.slug}`,
    },
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '홈', item: 'https://carev.kr' },
      { '@type': 'ListItem', position: 2, name: '블로그', item: 'https://carev.kr/blog' },
      {
        '@type': 'ListItem',
        position: 3,
        name: post.title,
        item: `https://carev.kr/blog/${post.slug}`,
      },
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {children}
    </>
  )
}
