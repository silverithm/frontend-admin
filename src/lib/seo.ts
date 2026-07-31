// 공용 SEO 상수.
// Next.js는 하위 layout이 openGraph를 선언하면 상위의 openGraph를 통째로 대체한다.
// (images가 상속되지 않으므로 각 layout에서 이 상수를 명시적으로 펼쳐 써야 한다.)

export const SITE_URL = 'https://carev.kr';

export const OG_IMAGE = {
  url: `${SITE_URL}/images/og-carev.png`,
  width: 1200,
  height: 630,
  alt: '케어브이 - 주간보호센터, 장기요양기관 근무표 휴무관리 프로그램',
  type: 'image/png',
} as const;

export const OG_IMAGES = [OG_IMAGE];
