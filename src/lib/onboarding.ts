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
    title: '케어브이 사용법, 2분만에 알려드릴게요',
    description:
      '처음이시죠? 어디부터 봐야 할지 막막하실 텐데,\n제일 많이 쓰는 것부터 순서대로 짚어드릴게요.\n\n중간에 그만 보고 싶으시면 "건너뛰기"를 누르시면 됩니다.',
  },

  // ── 대시보드 ──
  {
    target: 'nav-dashboard',
    tab: 'dashboard',
    title: '① 대시보드 — 매일 아침 여기부터',
    description:
      '출근해서 가장 먼저 여는 화면입니다.\n오늘 처리해야 할 일이 다 모여 있어요.',
  },
  {
    target: 'dash-stats',
    tab: 'dashboard',
    title: '숫자만 봐도 오늘 할 일이 보입니다',
    description:
      '승인을 기다리는 휴무와 결재 건수가 여기 뜹니다.\n숫자가 0이 아니면 눌러서 바로 처리하러 갈 수 있어요.',
  },

  // ── 근무조정 ──
  {
    target: 'nav-work',
    tab: 'work',
    title: '② 근무조정 — 직원 휴무 관리',
    description:
      '가장 많이 쓰시게 될 메뉴입니다.\n직원이 앱으로 휴무를 신청하면 여기 달력에 쌓이고,\n관리자가 승인하거나 반려합니다.',
  },
  {
    target: 'work-side',
    tab: 'work',
    title: '오른쪽에서 신청 건을 처리합니다',
    description:
      '달력에서 날짜를 고르면 그날 신청자가 여기 나옵니다.\n이름·역할·상태로 걸러 볼 수 있고,\n여러 건을 한 번에 승인·반려할 수도 있어요.',
  },
  {
    target: 'action-add-vacation',
    tab: 'work',
    title: '직원 대신 등록해줄 수도 있어요',
    description:
      '앱을 안 쓰는 직원이 전화나 구두로 요청했을 때,\n관리자가 대신 휴무를 넣어주는 버튼입니다.',
    adminOnly: true,
  },
  {
    target: 'action-vacation-limit',
    tab: 'work',
    title: '하루에 몇 명까지 쉴 수 있는지 정해두세요',
    description:
      '"토요일은 2명까지"처럼 날짜별 상한을 걸어둘 수 있습니다.\n정해두면 달력에 3/2 처럼 표시돼서\n한도를 넘었는지 바로 보입니다.',
    adminOnly: true,
  },
  {
    target: 'action-export-excel',
    tab: 'work',
    title: '제출용 서류는 엑셀로 뽑습니다',
    description:
      '보고 있는 달의 근무일정을 엑셀 파일로 내려받습니다.\n평가나 보고에 쓰는 서식 그대로 나옵니다.',
  },

  // ── 전자결재 ──
  {
    target: 'nav-approval',
    tab: 'approval',
    title: '③ 전자결재 — 종이 결재 대신',
    description:
      '휴가원·지출품의 같은 문서를 화면에서 올리고 결재받습니다.\n결재선을 정해두면 순서대로 넘어가고,\n서명·직인도 화면에서 찍힙니다.',
  },
  {
    target: 'nav-approval',
    tab: 'approval',
    title: '먼저 "양식 관리"부터 만들어두세요',
    description:
      '자주 쓰는 문서를 양식으로 등록해두면\n다음부터는 빈칸만 채워서 올릴 수 있습니다.\n메뉴를 누르면 아래에 결재 신청·관리·양식 관리가 나옵니다.',
    adminOnly: true,
  },

  // ── 월간일정 ──
  {
    target: 'nav-schedule',
    tab: 'schedule',
    title: '④ 월간일정 — 기관 행사와 회의',
    description:
      '어르신 생신, 프로그램, 직원 회의 같은 일정을 달력에 올립니다.\n담당자를 지정하면 그 사람만 수행완료를 체크할 수 있어\n누가 맡았는지 흐지부지되지 않습니다.',
  },

  // ── 공지·소통 ──
  {
    target: 'nav-notice',
    tab: 'notice',
    title: '⑤ 공지사항 — 전 직원 알림',
    description:
      '직원 전체에게 알릴 내용을 올립니다.\n누가 읽었는지까지 확인할 수 있어서\n"못 봤다"는 일이 줄어듭니다.',
  },
  {
    target: 'nav-chat',
    tab: 'chat',
    title: '⑥ 채팅 — 직원과 바로 대화',
    description:
      '단톡방처럼 쓰시면 됩니다.\n사진이나 문서 파일도 주고받을 수 있어요.',
  },
  {
    target: 'nav-plaza',
    tab: 'plaza',
    title: '⑦ 광장 — 다른 기관 사람들과',
    description:
      '전국 요양 현장의 실무 Q&A와 자료가 모이는 곳입니다.\n요양 관련 뉴스도 여기서 한번에 보실 수 있어요.',
  },

  // ── 회원관리 ──
  {
    target: 'nav-members',
    tab: 'members',
    title: '⑧ 회원관리 — 직원 등록은 여기서',
    description:
      '직원이 앱에서 가입 신청을 하면 여기 쌓입니다.\n승인해야 우리 기관 소속으로 들어옵니다.\n역할(요양보호사·사무직 등)과 권한도 여기서 정합니다.',
    adminOnly: true,
  },
  {
    target: 'nav-members',
    tab: 'members',
    title: '어르신 명단도 같이 관리합니다',
    description:
      '"어르신 관리" 탭에서 이용 어르신을 등록합니다.\n등록해두면 배차와 출결에서 그대로 불러 씁니다.',
    adminOnly: true,
  },

  // ── 마무리 ──
  {
    target: 'sidebar-help',
    title: '다시 보고 싶으면 여기를 누르세요',
    description:
      '이 안내는 언제든 다시 볼 수 있습니다.\n헷갈리는 게 생기면 여기로 오세요.',
  },
  {
    title: '이제 시작해볼까요',
    description:
      '가장 먼저 할 일은 "회원관리"에서 직원을 초대하는 것입니다.\n직원이 들어와야 휴무 신청도 결재도 돌아가니까요.\n\n막히는 부분은 왼쪽 아래 "문의하기"로 알려주세요.',
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
