/**
 * 첫 방문 온보딩 투어 정의와 완료 상태 저장.
 *
 * 완료 여부는 브라우저(localStorage)에 계정별로 남긴다. 다른 기기·브라우저에서는
 * 다시 뜨지만, 백엔드 스키마 변경 없이 바로 쓸 수 있어 이 방식을 택했다.
 * 같은 PC를 여러 명이 쓰는 기관이 있어 계정 식별자로 키를 나눈다.
 */

/** 투어 한 단계 */
export interface TourStep {
  /** 대상 요소의 data-tour 값. 없으면 화면 가운데에 안내만 띄운다(인사말 등). */
  target?: string;
  title: string;
  description: string;
  /** 이 단계를 보여주기 전에 이동할 탭 */
  tab?: string;
  /** 관리자에게만 보여줄 단계 */
  adminOnly?: boolean;
}

export const TOUR_STEPS: TourStep[] = [
  {
    title: '케어브이에 오신 걸 환영합니다',
    description:
      '근무표부터 전자결재까지, 기관 운영에 필요한 기능을 한곳에 모았습니다.\n주요 메뉴를 30초만에 둘러볼게요.',
  },
  {
    target: 'nav-dashboard',
    tab: 'dashboard',
    title: '대시보드',
    description:
      '오늘 처리할 일을 한눈에 봅니다. 승인 대기 중인 휴무·결재, 오늘의 일정, 새 공지가 모여 있어요.',
  },
  {
    target: 'nav-work',
    tab: 'work',
    title: '근무조정',
    description:
      '직원 휴무를 달력으로 관리합니다. 날짜를 누르면 그날 휴무자를 보고 승인·반려할 수 있어요.',
  },
  {
    target: 'action-vacation-limit',
    tab: 'work',
    title: '휴무 제한 설정',
    description:
      '날짜별로 쉴 수 있는 최대 인원을 정해두면, 그 이상 신청이 들어와도 한눈에 표시됩니다.',
    adminOnly: true,
  },
  {
    target: 'action-export-excel',
    tab: 'work',
    title: '엑셀 내보내기',
    description:
      '보고 있는 달의 근무일정을 엑셀로 받습니다. 제출용 서식 그대로 나옵니다.',
  },
  {
    target: 'nav-approval',
    tab: 'approval',
    title: '전자결재',
    description:
      '기안부터 결재선 지정, 서명 날인까지 전자로 처리합니다. 자주 쓰는 문서는 양식으로 등록해두세요.',
  },
  {
    target: 'nav-schedule',
    tab: 'schedule',
    title: '월간일정',
    description:
      '기관 행사와 회의를 달력에 올립니다. 담당자를 지정하면 그 사람만 수행완료를 체크할 수 있어요.',
  },
  {
    target: 'nav-notice',
    tab: 'notice',
    title: '공지사항',
    description:
      '직원 전체에게 알릴 내용을 올립니다. 누가 읽었는지까지 확인할 수 있어요.',
  },
  {
    target: 'nav-chat',
    tab: 'chat',
    title: '채팅',
    description: '직원들과 실시간으로 대화합니다. 파일도 주고받을 수 있어요.',
  },
  {
    target: 'nav-plaza',
    tab: 'plaza',
    title: '광장',
    description:
      '다른 기관 종사자들과 정보를 나누는 공간입니다. 요양 뉴스와 실무 자료도 모여 있어요.',
  },
  {
    target: 'nav-members',
    tab: 'members',
    title: '회원관리',
    description:
      '직원 가입 요청을 승인하고 역할·권한을 정합니다. 어르신 명단도 여기서 관리해요.',
    adminOnly: true,
  },
  {
    title: '준비됐습니다',
    description:
      '먼저 회원관리에서 직원을 초대해보세요.\n이 안내는 사이드바 아래 "사용법 보기"로 언제든 다시 볼 수 있습니다.',
  },
];

const STORAGE_PREFIX = 'onboardingDone:';

/** 계정별 키. 식별자가 없으면 공용 키로 떨어진다. */
const storageKey = (userKey?: string | null) =>
  `${STORAGE_PREFIX}${userKey && userKey.trim() ? userKey.trim() : 'anonymous'}`;

export function hasSeenTour(userKey?: string | null): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return localStorage.getItem(storageKey(userKey)) === '1';
  } catch {
    // 시크릿 모드 등에서 접근이 막히면 투어를 반복해 띄우지 않는다.
    return true;
  }
}

export function markTourSeen(userKey?: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(storageKey(userKey), '1');
  } catch {
    // 저장 실패는 무시한다 — 투어 자체는 이미 끝났다.
  }
}

/** 권한에 따라 볼 수 없는 단계를 걸러낸다. */
export function visibleSteps(isAdmin: boolean): TourStep[] {
  return TOUR_STEPS.filter((step) => !step.adminOnly || isAdmin);
}
