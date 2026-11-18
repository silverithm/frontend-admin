// 장기요양 기준표(/ltc) 페이지 목록 — 허브·관련 링크·사이트맵이 같은 목록을 쓴다.
// 새 기준표를 만들면 여기에 넣는 것까지가 출시다 (빠지면 사이트맵에서도 빠져 색인이 몇 주씩 늦어진다).
// 기준표 숫자는 원문과 대조한 날을 lastModified로 쓴다.

import { LTC_VERIFIED_AT } from './ltc2026';
import { HOME_CARE_VERIFIED_AT } from './ltcHomeCare';
import { STAFFING_VERIFIED_AT } from './ltcStaffing';
import { BONUS_VERIFIED_AT } from './ltcStaffingBonus';
import { STANDARD_HOURS_VERIFIED_AT } from './ltcStandardHours';

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
    path: '/ltc/home-care-fee-2026',
    title: '2026년 방문요양 수가표',
    summary: '1회 급여제공시간별 급여비용(가-1~가-8), 등급별 제한, 하루 3회·2시간 간격, 중증·심야·휴일 가산, 가족인 요양보호사, 월 한도액 안 이용 횟수.',
    lastModified: HOME_CARE_VERIFIED_AT,
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
  {
    path: '/ltc/daycare-staffing-standard',
    title: '주간보호센터 인력배치기준',
    summary: '직종별 배치 기준과 이용자 수별 요양보호사 최소 인원(7명당 1명, 치매전담실 4명당 1명), 근무인원 세는 법.',
    lastModified: STAFFING_VERIFIED_AT,
  },
  {
    path: '/ltc/monthly-standard-hours-2026',
    title: '2026년 월 기준 근무시간',
    summary: '근무인원 1명을 세는 달별 기준 시간(1~12월)과 근무가능일수. 2026년부터 공휴일이 된 노동절·제헌절, 대체공휴일 반영.',
    lastModified: STANDARD_HOURS_VERIFIED_AT,
  },
  {
    path: '/ltc/daycare-staffing-bonus',
    title: '주간보호센터 인력추가배치 가산',
    summary: '요양보호사 1인당 6.4명 미만 요건, 직종별 가산점수, 이용자 수별 인정범위·추가산정, 가산금액 계산식과 예시(고시 제55·56조).',
    lastModified: BONUS_VERIFIED_AT,
  },
];
