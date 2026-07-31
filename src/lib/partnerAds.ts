/**
 * 케어브이와 함께하는 제휴 기관(광고) 목록.
 *
 * 광고는 백엔드 없이 이 상수로 관리한다 — 새 광고가 들어오면 이 배열에 항목을 추가하고
 * 배포하면 `/partners` 갤러리와 랜딩 페이지 "함께하고 있는 기관" 섹션에 함께 반영된다.
 *
 * 기관 소개 문구(tagline/description)는 기관이 직접 확인해준 내용만 넣는다.
 * 임의로 지어낸 홍보 문구는 넣지 않는다.
 */

export type PartnerCategoryId = 'rehab' | 'daycare' | 'nursing' | 'welfare' | 'etc';

export interface PartnerCategory {
    id: PartnerCategoryId;
    label: string;
}

/** 갤러리 카테고리 탭. 실제 등록된 광고가 있는 카테고리만 탭으로 노출된다. */
export const PARTNER_CATEGORIES: PartnerCategory[] = [
    { id: 'rehab', label: '재활·기능회복' },
    { id: 'daycare', label: '주야간보호' },
    { id: 'nursing', label: '요양원·시설' },
    { id: 'welfare', label: '복지관·재가' },
    { id: 'etc', label: '그 외' },
];

export interface PartnerAd {
    /** URL·key로 쓰이는 고유 식별자 */
    id: string;
    /** 기관명 */
    name: string;
    category: PartnerCategoryId;
    /** 카드 상단 한 줄 소개 */
    tagline: string;
    /** 카드 본문 설명 */
    description: string;
    /** 지역 (선택) */
    region?: string;
    /** 바로가기 링크 — 블로그, 홈페이지 등 */
    href: string;
    /** 링크 버튼에 표시할 문구 */
    linkLabel: string;
    /** 대표 이미지 경로 (public 기준). 없으면 이니셜 썸네일로 대체된다. */
    imageSrc?: string;
    /** 이니셜 썸네일 배경 그라데이션 */
    accent: { from: string; to: string };
    /** 썸네일에 크게 표시할 글자 (1~2자) */
    initial: string;
    /** 카드 하단 태그 */
    tags: string[];
    /** 랜딩 페이지 "함께하고 있는 기관" 섹션 노출 여부 */
    isFeatured?: boolean;
}

export const PARTNER_ADS: PartnerAd[] = [
    {
        id: 'soopsok',
        name: '숲속재활어르신학교',
        category: 'rehab',
        tagline: '어르신 재활 프로그램을 운영하는 케어브이 제휴 기관',
        description:
            '어르신 재활과 기능회복을 위한 프로그램을 운영합니다. 진행 중인 프로그램과 현장 소식은 네이버 블로그에서 확인하실 수 있습니다.',
        href: 'https://blog.naver.com/soopsok4111',
        linkLabel: '네이버 블로그에서 보기',
        accent: { from: '#2F7A5B', to: '#7BC5A0' },
        initial: '숲속',
        tags: ['재활', '기능회복', '어르신 프로그램'],
        isFeatured: true,
    },
];

/** 등록된 광고가 하나라도 있는 카테고리만 반환 — 빈 탭을 노출하지 않는다. */
export function getActiveCategories(ads: PartnerAd[] = PARTNER_ADS): PartnerCategory[] {
    const used = new Set(ads.map((ad) => ad.category));
    return PARTNER_CATEGORIES.filter((category) => used.has(category.id));
}

/** 랜딩 페이지에 노출할 제휴 기관 */
export function getFeaturedAds(ads: PartnerAd[] = PARTNER_ADS): PartnerAd[] {
    return ads.filter((ad) => ad.isFeatured);
}

/** 광고 문의를 받는 메일 주소 — 문의하기(/contact)와 동일 창구 */
export const PARTNER_INQUIRY_EMAIL = 'ggprgrkjh2@gmail.com';
