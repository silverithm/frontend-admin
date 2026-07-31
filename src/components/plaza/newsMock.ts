// 요양 소식 데이터 — 기본은 백엔드 API(GET /api/v1/news, Google News RSS 수집)를 사용하고,
// API 실패/빈 응답 시 아래 MOCK_NEWS로 폴백한다.

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
 * 뉴스 목록 로드: 백엔드 API 우선, 실패하거나 비어 있으면 목업 폴백.
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
    if (items.length > 0) return items;
  } catch {
    // API 미배포/토큰 만료 등 — 목업으로 폴백
  }
  return MOCK_NEWS;
}

const hoursAgo = (h: number) => new Date(Date.now() - h * 60 * 60 * 1000);

const newsSearchUrl = (keyword: string) =>
  `https://search.naver.com/search.naver?where=news&query=${encodeURIComponent(keyword)}`;

export const MOCK_NEWS: NewsItem[] = [
  {
    id: 'n1',
    title: '복지부, 2026년 장기요양 수가 개정안 행정예고… 주간보호 가산 확대',
    source: '연합뉴스',
    category: 'policy',
    publishedAt: hoursAgo(2),
    url: newsSearchUrl('장기요양 수가 개정'),
  },
  {
    id: 'n2',
    title: '"CCTV 사각지대 없앤다"… 요양시설 노인학대 예방 대책 발표',
    source: 'KBS',
    category: 'abuse',
    publishedAt: hoursAgo(4),
    url: newsSearchUrl('요양시설 노인학대 예방'),
  },
  {
    id: 'n3',
    title: '2026년 장기요양기관 정기평가 일정 공개… 지표 개편 사항 총정리',
    source: '실버산업신문',
    category: 'eval',
    publishedAt: hoursAgo(7),
    url: newsSearchUrl('장기요양기관 정기평가'),
  },
  {
    id: 'n4',
    title: '요양보호사 처우개선비 인상안 국회 통과… 내년 1월 시행',
    source: '뉴시스',
    category: 'policy',
    publishedAt: hoursAgo(11),
    url: newsSearchUrl('요양보호사 처우개선비'),
  },
  {
    id: 'n5',
    title: '주간보호센터 인지프로그램 우수사례 공모전 개최',
    source: '복지타임즈',
    category: 'field',
    publishedAt: hoursAgo(16),
    url: newsSearchUrl('주간보호센터 인지프로그램'),
  },
  {
    id: 'n6',
    title: '폭염 속 어르신 안전관리 비상… 시설 내 온열질환 대응 지침 배포',
    source: 'YTN',
    category: 'abuse',
    publishedAt: hoursAgo(22),
    url: newsSearchUrl('노인시설 온열질환 대응'),
  },
  {
    id: 'n7',
    title: '건보공단, 장기요양 급여비용 청구 오류 다발 항목 안내',
    source: '의학신문',
    category: 'policy',
    publishedAt: hoursAgo(28),
    url: newsSearchUrl('장기요양 급여비용 청구'),
  },
  {
    id: 'n8',
    title: '평가 A등급 기관들의 공통점은? 기록관리 노하우 집중 분석',
    source: '실버산업신문',
    category: 'eval',
    publishedAt: hoursAgo(33),
    url: newsSearchUrl('장기요양기관 평가 A등급'),
  },
  {
    id: 'n9',
    title: '치매전담형 주간보호 확대… 신규 지정 신청 접수 시작',
    source: '연합뉴스',
    category: 'policy',
    publishedAt: hoursAgo(40),
    url: newsSearchUrl('치매전담형 주간보호'),
  },
  {
    id: 'n10',
    title: '요양보호사 인력난 심화… 지자체별 채용 지원 사업 잇따라',
    source: 'MBC',
    category: 'field',
    publishedAt: hoursAgo(47),
    url: newsSearchUrl('요양보호사 인력난'),
  },
  {
    id: 'n11',
    title: '노인학대 신고 의무자 교육 온라인 과정 신설… 연 1회 이수 필수',
    source: '복지타임즈',
    category: 'abuse',
    publishedAt: hoursAgo(52),
    url: newsSearchUrl('노인학대 신고 의무자 교육'),
  },
  {
    id: 'n12',
    title: '어르신 낙상 예방 운동 프로그램, 현장 적용 가이드 나왔다',
    source: '헬스조선',
    category: 'field',
    publishedAt: hoursAgo(60),
    url: newsSearchUrl('노인 낙상 예방 프로그램'),
  },
  {
    id: 'n13',
    title: '장기요양위원회, 내년 보험료율 동결 결정… 재정 전망은',
    source: 'SBS',
    category: 'policy',
    publishedAt: hoursAgo(70),
    url: newsSearchUrl('장기요양보험료율'),
  },
  {
    id: 'n14',
    title: '평가 대비 자체점검 체크리스트, 공단 홈페이지에 공개',
    source: '의학신문',
    category: 'eval',
    publishedAt: hoursAgo(76),
    url: newsSearchUrl('장기요양 평가 자체점검'),
  },
  {
    id: 'n15',
    title: '세대통합 프로그램 운영 주간보호센터, 지역사회 호응 확산',
    source: '복지타임즈',
    category: 'field',
    publishedAt: hoursAgo(85),
    url: newsSearchUrl('세대통합 프로그램 주간보호'),
  },
];
