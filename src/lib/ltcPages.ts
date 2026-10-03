// 장기요양 기준표(/ltc) 페이지 목록 — 허브·관련 링크·사이트맵이 같은 목록을 쓴다.
// 새 기준표를 만들면 여기에 넣는 것까지가 출시다 (빠지면 사이트맵에서도 빠져 색인이 몇 주씩 늦어진다).
// 기준표 숫자는 원문과 대조한 날을 lastModified로 쓴다.

import { LTC_VERIFIED_AT } from './ltc2026';

export interface LtcPageMeta {
  path: string;
  title: string;
  summary: string;
  lastModified: string;
}

export const LTC_HUB_PATH = '/ltc';

export const LTC_PAGES: ReadonlyArray<LtcPageMeta> = [
  {
    path: '/ltc/daycare-fee-2026',
    title: '2026년 주·야간보호 수가표',
    summary: '등급과 하루 이용시간에 따른 1일 급여비용. 일반 주·야간보호와 치매전담실을 함께 정리했습니다.',
    lastModified: LTC_VERIFIED_AT,
  },
  {
    path: '/ltc/monthly-limit-2026',
    title: '2026년 장기요양 등급별 월 한도액',
    summary: '재가급여 월 한도액과 2025년 대비 인상액, 한도 안에서 주·야간보호를 며칠까지 이용할 수 있는지.',
    lastModified: LTC_VERIFIED_AT,
  },
  {
    path: '/ltc/daycare-copay-calculator',
    title: '주·야간보호 본인부담금 계산기',
    summary: '등급·이용시간·일수·감경 여부를 넣으면 한 달 급여비용과 본인부담금, 한도 초과분을 계산합니다.',
    lastModified: LTC_VERIFIED_AT,
  },
];
