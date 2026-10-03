// 요양 소식 데이터 — 백엔드 API(GET /api/v1/news, Google News RSS 수집)만 쓴다.
// 예전에는 API 실패 시와 첫 렌더에 지어낸 기사 제목(MOCK_NEWS, "약 2시간 전")을 보여 줬는데,
// 자바스크립트를 실행하지 않는 검색 로봇(네이버 Yeti 등)은 공개 커뮤니티 페이지에서 그 가짜 제목만 읽어 갔다.
// 사실이 아닌 기사를 사실처럼 보여 주지 않도록 실패하면 빈 목록을 돌려주고, 화면이 "불러오지 못함"을 표시한다.

import { getNews } from '@/lib/apiService';

export type NewsCategory = 'abuse' | 'policy' | 'eval' | 'field';

export interface NewsItem {
  id: string;
  title: string;
  source: string;
  category: NewsCategory;
  publishedAt: Date;
  url: string;
}

export const NEWS_CATEGORIES: {
  value: NewsCategory;
  label: string;
  badgeVariant: 'red' | 'blue' | 'yellow' | 'teal';
}[] = [
  { value: 'abuse', label: '학대·안전', badgeVariant: 'red' },
  { value: 'policy', label: '제도·수가', badgeVariant: 'blue' },
  { value: 'eval', label: '평가', badgeVariant: 'yellow' },
  { value: 'field', label: '현장소식', badgeVariant: 'teal' },
];

export const getNewsCategoryMeta = (category: NewsCategory) =>
  NEWS_CATEGORIES.find((c) => c.value === category) ?? NEWS_CATEGORIES[3];

const VALID_CATEGORIES: NewsCategory[] = ['abuse', 'policy', 'eval', 'field'];

/**
 * 뉴스 목록 로드. 실패하거나 비어 있으면 빈 배열.
 * (백엔드는 { content: [...] } 래퍼로 응답)
 */
export async function loadNews(): Promise<NewsItem[]> {
  try {
    const data = await getNews({ size: 50 });
    const content: unknown[] = Array.isArray(data) ? data : (data?.content ?? []);
    const items: NewsItem[] = content
      .map((raw) => {
        const n = raw as { id?: number | string; title?: string; source?: string; category?: string; url?: string; publishedAt?: string };
        if (!n.title || !n.url) return null;
        const category = VALID_CATEGORIES.includes(n.category as NewsCategory) ? (n.category as NewsCategory) : 'field';
        return {
          id: String(n.id ?? n.url),
          title: n.title,
          source: n.source || '뉴스',
          category,
          publishedAt: n.publishedAt ? new Date(n.publishedAt) : new Date(),
          url: n.url,
        } satisfies NewsItem;
      })
      .filter((n): n is NewsItem => n !== null);
    return items;
  } catch {
    // API 미배포/토큰 만료 등 — 빈 목록으로 두고 화면이 안내한다
    return [];
  }
}
