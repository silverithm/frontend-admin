// 연계기관 바로가기 — 요양기관이 업무 중 자주 오가는 외부 사이트 모음.
//
// 원칙: 실제로 접속이 확인된 주소만 싣는다. 확인 못 한 곳은 넣지 않는다.
// (사회복지시설정보시스템 w4c.go.kr은 응답을 확인하지 못해 제외했다.)
// 최종 접속 확인: 2026-08-01

export interface ExternalLink {
  /** 화면에 보이는 이름 — 짧게 */
  name: string;
  url: string;
  /** 툴팁에 쓰는 한 줄 설명 */
  description: string;
}

/** 공공기관을 앞에, 업무 프로그램·매체를 뒤에 둔다. */
export const EXTERNAL_LINKS: ExternalLink[] = [
  {
    name: '장기요양보험',
    url: 'https://www.longtermcare.or.kr',
    description: '국민건강보험공단 장기요양보험 — 청구·평가·고시',
  },
  {
    name: '보건복지부',
    url: 'https://www.mohw.go.kr',
    description: '제도 개정·공고 확인',
  },
  {
    name: '케어포',
    url: 'https://www.carefor.co.kr',
    description: '노인장기요양 관리프로그램',
  },
  {
    name: '월간장기요양',
    url: 'https://www.carekim.com',
    description: '장기요양 업계 소식',
  },
];
