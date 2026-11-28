// 장기요양 기준표(/ltc) 페이지 목록 — 허브·관련 링크·사이트맵이 같은 목록을 쓴다.
// 새 기준표를 만들면 여기에 넣는 것까지가 출시다 (빠지면 사이트맵에서도 빠져 색인이 몇 주씩 늦어진다).
// 기준표 숫자는 원문과 대조한 날을 lastModified로 쓴다.

import { LTC_VERIFIED_AT } from './ltc2026';
import { FACILITY_FEE_VERIFIED_AT } from './ltcFacilityFee';
import { GRADE_CRITERIA_VERIFIED_AT } from './ltcGradeCriteria';
import { GROUP_HOME_BONUS_VERIFIED_AT } from './ltcGroupHomeBonus';
import { HOME_CARE_VERIFIED_AT } from './ltcHomeCare';
import { NURSING_HOME_BONUS_VERIFIED_AT } from './ltcNursingHomeBonus';
import { NURSING_HOME_VERIFIED_AT } from './ltcNursingHomeStaffing';
import { OVER_CAPACITY_VERIFIED_AT } from './ltcOverCapacity';
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
/** 허브 제목·설명 — 페이지 메타데이터와 RSS가 같은 글자를 쓴다 */
export const LTC_HUB_TITLE = '장기요양 기준표 2026 — 수가·월 한도액·본인부담금';
export const LTC_HUB_DESCRIPTION =
  '2026년 장기요양 주·야간보호·방문요양·요양원 수가, 등급별 월 한도액, 본인부담금 계산법, 주간보호센터·요양원 인력배치기준과 인력추가배치 가산, 월 기준 근무시간, 장기요양등급 판정기준을 보건복지부 고시·법령 원문과 대조해 한곳에 정리했습니다.';

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
    path: '/ltc/nursing-home-fee-2026',
    title: '2026년 요양원 수가표',
    summary: '노인요양시설 1일 급여비용(요양보호사 2.1명당 1명 이상·미만), 노인요양공동생활가정·치매전담실 가형·나형, 본인부담 20%와 30일·31일 본인부담금, 입소일·외박 산정, 비급여.',
    lastModified: FACILITY_FEE_VERIFIED_AT,
  },
  {
    path: '/ltc/monthly-limit-2026',
    title: '2026년 장기요양 등급별 월 한도액',
    summary: '재가급여 월 한도액과 2025년 대비 인상액, 한도 안에서 주·야간보호를 며칠까지 이용할 수 있는지.',
    lastModified: LTC_VERIFIED_AT,
  },
  {
    path: '/ltc/ltc-grade-criteria',
    title: '장기요양등급 판정기준',
    summary: '1~5등급·인지지원등급의 장기요양인정 점수 구간(95·75·60·51·45점), 치매 요건, 52개 조사항목과 점수 산정 순서, 등급별 이용 급여, 유효기간과 갱신.',
    lastModified: GRADE_CRITERIA_VERIFIED_AT,
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
  {
    path: '/ltc/daycare-over-capacity',
    title: '주·야간보호 정원초과 감액',
    summary: '정원 초과비율별 급여비용 산정비율(5% 미만 90%~30% 이상 50%), 인원 세는 법, 정원별 초과 인원표, 인지지원등급 정원의 10%, 가산 제외와 감액 상한(고시 제65조).',
    lastModified: OVER_CAPACITY_VERIFIED_AT,
  },
  {
    path: '/ltc/nursing-home-staffing-standard',
    title: '요양원 인력배치기준',
    summary: '노인요양시설 요양보호사 입소자 2.1명당 1명(치매전담실 2명당), 직종별 기준, 2.3명당에서 바뀐 개정과 2026년 12월 31일 유예 기한, 노인요양공동생활가정 3명당 1명.',
    lastModified: NURSING_HOME_VERIFIED_AT,
  },
  {
    path: '/ltc/nursing-home-staffing-bonus',
    title: '요양원 인력추가배치 가산',
    summary: '일반실 요양보호사는 가산점수 미산정, 치매전담실 실별 최대 2명 1.3점, 간호(조무)사 19.0명 미만 요건, 입소자 수별 인정범위, 한시 가산(2026년 12월 31일까지), 간호사·야간직원배치 가산.',
    lastModified: NURSING_HOME_BONUS_VERIFIED_AT,
  },
  {
    path: '/ltc/group-home-staffing-bonus',
    title: '노인요양공동생활가정 인력추가배치 가산',
    summary: '요양보호사 1인당 2.4명 미만이면 추가 1명당 1.2점, 가산점수의 합에 더하는 0.4점·0.25점, 조리원 1.2점, 입소자 수별 인정범위와 요양보호사 가산 요건 인원, 야간직원배치 기관당 0.9점.',
    lastModified: GROUP_HOME_BONUS_VERIFIED_AT,
  },
];

// 허브(/ltc)는 기준표 목록을 그대로 보여 주므로, 목록 중 가장 최근에 바뀐 기준표 날짜가 허브의 갱신일이다.
// (허브 날짜를 LTC_VERIFIED_AT에 묶어 두면 새 기준표를 11개 붙이는 동안에도 사이트맵이 2026-10-04로 남는다.)
export const LTC_HUB_UPDATED: string = [LTC_VERIFIED_AT, ...LTC_PAGES.map((page) => page.lastModified)].reduce(
  (latest, date) => (date > latest ? date : latest),
);
