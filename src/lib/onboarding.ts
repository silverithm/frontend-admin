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
    title: '케어브이에 오신 것을 환영합니다',
    description:
      '처음이라 어디부터 봐야 할지 막막하시죠.\n자주 쓰시게 될 것부터 하나씩 짚어드릴게요. 2분이면 충분합니다.\n\n중간에 그만 보셔도 괜찮아요. "건너뛰기"를 누르시면 됩니다.',
  },

  // ── 대시보드 ──
  {
    target: 'nav-dashboard',
    tab: 'dashboard',
    title: '① 대시보드',
    description:
      '아침에 출근하시면 가장 먼저 보시게 될 화면이에요.\n오늘 처리하실 일이 여기 다 모여 있습니다.',
  },
  {
    target: 'dash-stats',
    tab: 'dashboard',
    title: '숫자만 보셔도 할 일이 보입니다',
    description:
      '승인을 기다리는 휴무와 결재가 몇 건인지 여기 나와요.\n숫자를 누르시면 바로 처리하는 화면으로 넘어갑니다.',
  },

  // ── 근무조정 ──
  {
    target: 'nav-work',
    tab: 'work',
    title: '② 근무조정',
    description:
      '아마 가장 자주 여시게 될 메뉴예요.\n직원분이 휴무를 신청하시면 이 달력에 쌓이고,\n관리자가 승인하거나 반려하시면 됩니다.',
  },
  {
    target: 'work-side',
    tab: 'work',
    title: '신청 건은 오른쪽에서 처리하세요',
    description:
      '달력에서 날짜를 누르시면 그날 신청하신 분들이 여기 나옵니다.\n이름이나 역할로 걸러 보실 수 있고,\n여러 건을 한 번에 승인하거나 반려하실 수도 있어요.',
  },
  {
    target: 'action-add-vacation',
    tab: 'work',
    title: '직원분 대신 넣어드릴 수도 있어요',
    description:
      '전화로 "내일 좀 쉬겠습니다" 하고 연락이 오는 경우가 있죠.\n그럴 때 관리자가 대신 등록해드리는 버튼입니다.',
    adminOnly: true,
  },
  {
    target: 'action-vacation-limit',
    tab: 'work',
    title: '하루에 몇 분까지 쉬실 수 있는지 정해두세요',
    description:
      '"토요일은 두 명까지"처럼 날짜별로 정해두실 수 있어요.\n정해두시면 달력에 3/2 처럼 표시돼서,\n한도를 넘었는지 한눈에 보입니다.',
    adminOnly: true,
  },
  {
    target: 'action-export-excel',
    tab: 'work',
    title: '제출하실 서류는 엑셀로 받으세요',
    description:
      '지금 보고 계신 달의 근무일정을 엑셀 파일로 내려받습니다.\n평가나 보고에 쓰시는 서식 그대로 나와요.',
  },

  // ── 전자결재 ──
  {
    target: 'nav-approval',
    tab: 'approval',
    title: '③ 전자결재',
    description:
      '휴가원이나 지출품의 같은 문서를 화면에서 올리고 결재받으실 수 있어요.\n결재선을 정해두시면 순서대로 넘어가고,\n서명과 직인도 화면에서 찍힙니다.',
  },
  {
    target: 'nav-approval',
    tab: 'approval',
    title: '"양식 관리"부터 만들어두시면 편해요',
    description:
      '자주 쓰시는 문서를 양식으로 등록해두시면\n다음부터는 빈칸만 채워서 올리시면 됩니다.\n메뉴를 누르시면 아래에 결재 신청·관리·양식 관리가 펼쳐집니다.',
    adminOnly: true,
  },

  // ── 월간일정 ──
  {
    target: 'nav-schedule',
    tab: 'schedule',
    title: '④ 월간일정',
    description:
      '어르신 생신이나 프로그램, 직원 회의 같은 일정을 달력에 올리시는 곳이에요.\n담당자를 지정해두시면 그분만 수행완료를 체크하실 수 있어서,\n누가 맡았는지 흐지부지되지 않습니다.',
  },

  // ── 공지·소통 ──
  {
    target: 'nav-notice',
    tab: 'notice',
    title: '⑤ 공지사항',
    description:
      '직원분들께 한 번에 알리실 내용을 올리시면 됩니다.\n누가 읽었는지까지 보이니까\n"못 봤습니다" 하는 일이 줄어들어요.',
  },
  {
    target: 'nav-chat',
    tab: 'chat',
    title: '⑥ 채팅',
    description:
      '단톡방 쓰시듯 편하게 쓰시면 됩니다.\n사진이나 문서 파일도 주고받으실 수 있어요.',
  },
  {
    target: 'nav-plaza',
    tab: 'plaza',
    title: '⑦ 광장',
    description:
      '다른 기관에서 일하시는 분들과 이야기 나누는 공간이에요.\n실무 질문과 자료, 요양 관련 소식도 여기 모여 있습니다.',
  },

  // ── 회원관리·직원 초대 ──
  {
    target: 'nav-members',
    tab: 'members',
    title: '⑧ 회원관리',
    description:
      '직원분이 가입 신청을 하시면 "가입 신청" 탭에 쌓입니다.\n관리자가 승인하셔야 우리 기관 소속으로 들어와요.\n역할과 권한도 여기서 정해주시면 됩니다.',
    adminOnly: true,
  },
  {
    target: 'sidebar-profile',
    title: '직원분을 부르시려면 "기관 코드"가 필요해요',
    description:
      '왼쪽 아래 "기관 프로필"에 우리 기관만의 코드가 있습니다.\n옆에 있는 복사 버튼을 눌러 직원분께 전달해주세요.\n\n이 코드가 있어야 우리 기관으로 가입하실 수 있습니다.',
    adminOnly: true,
  },
  {
    title: '직원분은 이렇게 가입하십니다',
    description:
      '① 케어브이 홈페이지에서 "회원가입"을 누르십니다.\n② "직원 가입"을 고르시고, 전달받은 기관 코드를 입력하십니다.\n③ 코드가 맞으면 우리 기관 직책이 뜨고, 본인 직책을 고르십니다.\n④ 신청하시면 관리자에게 넘어오고, 승인하시면 끝납니다.\n\n앱이 아니라 홈페이지에서 가입하신다는 점만 알려주시면 됩니다.',
    adminOnly: true,
  },
  {
    target: 'nav-members',
    tab: 'members',
    title: '어르신 명단도 여기서 관리하세요',
    description:
      '"어르신 관리" 탭에서 이용 어르신을 등록하실 수 있어요.\n한 번 등록해두시면 배차와 출결에서 그대로 불러 씁니다.',
    adminOnly: true,
  },

  // ── 마무리 ──
  {
    target: 'sidebar-help',
    title: '다시 보고 싶으실 땐 여기를 눌러주세요',
    description:
      '이 안내는 언제든 다시 보실 수 있습니다.\n쓰시다가 헷갈리는 게 생기면 편하게 들러주세요.',
  },
  {
    title: '이제 시작해볼까요',
    description:
      '먼저 "기관 프로필"에서 기관 코드를 복사해\n직원분들께 전달해주세요.\n직원분이 들어오셔야 휴무 신청도 결재도 돌아가니까요.\n\n쓰시다가 막히는 부분이 있으면 언제든 문의해주세요.',
  },
];

const STORAGE_PREFIX = 'onboardingDone:';

/** 계정별 키. 식별자가 없으면 공용 키로 떨어진다. */
const storageKey = (userKey?: string | null) =>
  `${STORAGE_PREFIX}${userKey && userKey.trim() ? userKey.trim() : 'anonymous'}`;

/**
 * 체험 모드는 "둘러보러" 들어온 것이므로 매 체험 세션마다 안내를 띄운다.
 * 체험 시작 시각(demoStartedAt)을 키에 섞어, 같은 세션 안에서 건너뛰면
 * 다시 뜨지 않되 새로 체험을 시작하면 다시 보이게 한다.
 */
const demoSessionKey = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    if (localStorage.getItem('isDemoMode') !== 'true') return null;
    return `demo:${localStorage.getItem('demoStartedAt') ?? 'session'}`;
  } catch {
    return null;
  }
};

/** 체험 모드면 체험 세션 키를, 아니면 계정 키를 쓴다. */
const resolveKey = (userKey?: string | null) => demoSessionKey() ?? (userKey ?? null);

export function hasSeenTour(userKey?: string | null): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return localStorage.getItem(storageKey(resolveKey(userKey))) === '1';
  } catch {
    // 시크릿 모드 등에서 접근이 막히면 투어를 반복해 띄우지 않는다.
    return true;
  }
}

export function markTourSeen(userKey?: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(storageKey(resolveKey(userKey)), '1');
  } catch {
    // 저장 실패는 무시한다 — 투어 자체는 이미 끝났다.
  }
}

/** 권한에 따라 볼 수 없는 단계를 걸러낸다. */
export function visibleSteps(isAdmin: boolean): TourStep[] {
  return TOUR_STEPS.filter((step) => !step.adminOnly || isAdmin);
}
