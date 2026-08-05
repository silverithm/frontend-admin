// 커뮤니티(게시판·자료실) 목업 스토어 — 백엔드 API 연동 전까지 localStorage에 영속.
// TODO: API 연동 시 이 파일의 함수 시그니처를 유지한 채 내부를 fetch로 교체하면 컴포넌트 수정 최소화.

export type BoardType = 'free' | 'review' | 'tip';
/** 시설 유형 — 평가후기·실무팁 글에만 붙는다 (자유게시판은 null) */
export type PostCategory = 'daycare' | 'homecare' | 'nursing';
export type LibraryCategory = 'form' | 'eval' | 'program' | 'etc';

export interface PlazaComment {
  id: string;
  parentId: string | null; // 대댓글 1단계
  authorId: string;
  authorName: string;
  companyName: string;
  isAnonymous: boolean;
  content: string;
  createdAt: string;
  updatedAt: string | null;
  isAccepted: boolean; // Q&A 채택
}

export interface PlazaPost {
  id: string;
  board: BoardType;
  category: PostCategory | null;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  companyName: string;
  isAnonymous: boolean;
  createdAt: string;
  updatedAt: string | null;
  viewedBy: string[]; // 사용자당 1회 조회수
  likedBy: string[];
  reportedBy: string[];
  isPinned: boolean;
  isHidden: boolean; // 신고 누적 자동 숨김
  comments: PlazaComment[];
}

export interface LibraryItem {
  id: string;
  category: LibraryCategory;
  title: string;
  description: string;
  fileName: string;
  fileSize: number; // bytes
  uploaderId: string;
  uploaderName: string;
  companyName: string;
  downloadCount: number;
  reportedBy: string[];
  createdAt: string;
  isSeed: boolean; // 운영자 시딩 자료 (실파일은 API 연동 후 제공)
}

export const BOARD_META: { value: BoardType; label: string; badgeLabel: string; badgeVariant: 'blue' | 'yellow' | 'teal'; hasCategory: boolean }[] = [
  { value: 'free', label: '자유게시판', badgeLabel: '자유', badgeVariant: 'teal', hasCategory: false },
  { value: 'review', label: '평가후기', badgeLabel: '평가후기', badgeVariant: 'yellow', hasCategory: true },
  { value: 'tip', label: '실무팁', badgeLabel: '실무팁', badgeVariant: 'blue', hasCategory: true },
];

export const CATEGORY_META: { value: PostCategory; label: string; badgeVariant: 'green' | 'blue' | 'purple' }[] = [
  { value: 'daycare', label: '주간보호', badgeVariant: 'green' },
  { value: 'homecare', label: '방문요양·목욕', badgeVariant: 'blue' },
  { value: 'nursing', label: '요양원', badgeVariant: 'purple' },
];

export const LIBRARY_META: { value: LibraryCategory; label: string; badgeVariant: 'blue' | 'yellow' | 'green' | 'purple' }[] = [
  { value: 'form', label: '서식', badgeVariant: 'blue' },
  { value: 'eval', label: '평가자료', badgeVariant: 'yellow' },
  { value: 'program', label: '프로그램', badgeVariant: 'green' },
  { value: 'etc', label: '기타', badgeVariant: 'purple' },
];

export const REPORT_REASONS = ['광고/홍보', '욕설/비방', '개인정보 노출', '허위 정보', '기타'];

export const REPORT_AUTO_HIDE_THRESHOLD = 3;

export const getBoardMeta = (board: BoardType) => BOARD_META.find((b) => b.value === board) ?? BOARD_META[0];
export const getCategoryMeta = (cat: PostCategory) => CATEGORY_META.find((c) => c.value === cat) ?? CATEGORY_META[0];
export const getLibraryMeta = (cat: LibraryCategory) => LIBRARY_META.find((c) => c.value === cat) ?? LIBRARY_META[3];

export interface PlazaUser {
  id: string;
  name: string;
  company: string;
}

/** 로그인 여부 — 비로그인(공개 페이지)에서는 읽기만 허용하고 쓰기 동작은 로그인 유도 */
export function isLoggedIn(): boolean {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem('authToken');
}

/** 체험(데모) 모드 여부 — 체험 계정은 커뮤니티 읽기는 되지만 쓰기(글쓰기·댓글·좋아요·신고 등)는 막는다 */
export function isDemoMode(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('isDemoMode') === 'true';
}

export function getCurrentUser(): PlazaUser {
  if (typeof window === 'undefined') return { id: 'me', name: '나', company: '우리 기관' };
  return {
    id: localStorage.getItem('userId') || localStorage.getItem('userEmail') || 'me',
    name: localStorage.getItem('userName') || '나',
    company: localStorage.getItem('companyName') || '우리 기관',
  };
}

export const displayAuthor = (isAnonymous: boolean, companyName: string, authorName: string) =>
  isAnonymous ? '익명' : `${companyName} · ${authorName}`;

// ── 저장소 ──────────────────────────────────────────────

const STORE_KEY = 'carev-plaza-store-v1';

interface PlazaStore {
  posts: PlazaPost[];
  library: LibraryItem[];
}

// 세션 중 업로드한 실제 파일(다운로드 동작용) — localStorage에는 메타만 저장
const sessionFiles = new Map<string, File>();
export const registerSessionFile = (itemId: string, file: File) => sessionFiles.set(itemId, file);
export const getSessionFile = (itemId: string) => sessionFiles.get(itemId);

const hoursAgo = (h: number) => new Date(Date.now() - h * 60 * 60 * 1000).toISOString();

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

function seedStore(): PlazaStore {
  const posts: PlazaPost[] = [
    {
      id: 'seed-p1',
      board: 'tip',
      category: 'daycare',
      title: '요양보호사 근무시간표에서 연장근무 기록은 어떻게들 관리하시나요?',
      content:
        '저희 센터는 수기로 연장근무를 기록하다 보니 급여 정산 때마다 누락 시비가 생깁니다.\n다른 센터에서는 어떤 방식으로 관리하시는지 궁금합니다. 전산으로 관리하시는 곳 있으면 노하우 공유 부탁드려요.',
      authorId: 'seed-u1',
      authorName: '김복지',
      companyName: '하늘주간보호센터',
      isAnonymous: false,
      createdAt: hoursAgo(6),
      updatedAt: null,
      viewedBy: ['seed-u2', 'seed-u3', 'seed-u4', 'seed-u5'],
      likedBy: ['seed-u2', 'seed-u3'],
      reportedBy: [],
      isPinned: false,
      isHidden: false,
      comments: [
        {
          id: 'seed-c1',
          parentId: null,
          authorId: 'seed-u2',
          authorName: '박실장',
          companyName: '푸른요양원',
          isAnonymous: false,
          content:
            '저희는 출퇴근 체크 앱과 연동해서 30분 단위로 자동 기록되게 해놨습니다. 도입 후 정산 분쟁이 거의 없어졌어요.',
          createdAt: hoursAgo(5),
          updatedAt: null,
          isAccepted: true,
        },
        {
          id: 'seed-c2',
          parentId: 'seed-c1',
          authorId: 'seed-u1',
          authorName: '김복지',
          companyName: '하늘주간보호센터',
          isAnonymous: false,
          content: '감사합니다! 앱 이름 여쭤봐도 될까요?',
          createdAt: hoursAgo(4),
          updatedAt: null,
          isAccepted: false,
        },
      ],
    },
    {
      id: 'seed-p2',
      board: 'review',
      category: 'daycare',
      title: '2025년 하반기 정기평가 후기 — 기록관리에서 지적받은 항목 공유합니다',
      content:
        '지난주에 정기평가 받았습니다. 저희가 지적받은 부분은 크게 두 가지였어요.\n\n1. 프로그램 일지에 참여 어르신 개별 반응 기록 누락\n2. 낙상 위험도 평가 주기 미준수\n\n다들 평가 준비하실 때 이 두 항목은 꼭 챙기시길 바랍니다. 질문 있으시면 댓글 주세요.',
      authorId: 'seed-u3',
      authorName: '이원장',
      companyName: '햇살데이케어',
      isAnonymous: false,
      createdAt: hoursAgo(26),
      updatedAt: null,
      viewedBy: ['seed-u1', 'seed-u2', 'seed-u4', 'seed-u5', 'seed-u6', 'seed-u7'],
      likedBy: ['seed-u1', 'seed-u2', 'seed-u4', 'seed-u5'],
      reportedBy: [],
      isPinned: false,
      isHidden: false,
      comments: [
        {
          id: 'seed-c3',
          parentId: null,
          authorId: 'seed-u4',
          authorName: '최사회복지사',
          companyName: '동네방네주간보호',
          isAnonymous: false,
          content: '생생한 후기 감사합니다. 낙상 위험도 평가는 몇 개월 주기로 하고 계셨나요?',
          createdAt: hoursAgo(24),
          updatedAt: null,
          isAccepted: false,
        },
      ],
    },
    {
      id: 'seed-p3',
      board: 'free',
      category: null,
      title: '어르신들이 제일 좋아하셨던 인지활동 프로그램 하나만 추천해주세요',
      content:
        '매주 프로그램 짜는 게 제일 큰 숙제네요. 저희는 요즘 옛날 물건 사진 보고 이야기 나누는 회상요법 반응이 좋았습니다. 다른 센터 인기 프로그램도 궁금해요!',
      authorId: 'seed-u5',
      authorName: '정선생',
      companyName: '온기주간보호센터',
      isAnonymous: false,
      createdAt: hoursAgo(50),
      updatedAt: null,
      viewedBy: ['seed-u1', 'seed-u2', 'seed-u3'],
      likedBy: ['seed-u1'],
      reportedBy: [],
      isPinned: false,
      isHidden: false,
      comments: [],
    },
    {
      id: 'seed-p4',
      board: 'tip',
      category: 'nursing',
      title: '수급자 어르신 보호자와의 소통 기록, 어디까지 남기시나요?',
      content:
        '보호자 민원이 있을 때마다 통화 내용을 어디까지 기록해야 하는지 애매합니다.\n분쟁 대비 관점에서 다른 기관들은 어떻게 하시는지 궁금합니다.',
      authorId: 'seed-u6',
      authorName: '한팀장',
      companyName: '늘푸른실버케어',
      isAnonymous: true,
      createdAt: hoursAgo(74),
      updatedAt: null,
      viewedBy: ['seed-u1', 'seed-u3'],
      likedBy: [],
      reportedBy: [],
      isPinned: false,
      isHidden: false,
      comments: [],
    },
    {
      id: 'seed-p5',
      board: 'free',
      category: null,
      title: '[운영] 케어브이 커뮤니티 이용 안내',
      content:
        '케어브이 커뮤니티가 열렸습니다!\n\n· 자유게시판: 현장 이야기를 자유롭게 나누는 공간입니다.\n· 평가후기: 기관 평가 경험과 준비 노하우를 시설 유형별로 나눠주세요.\n· 실무팁: 업무 노하우와 꿀팁을 시설 유형별로 공유해주세요.\n\n광고·비방·개인정보 노출 게시물은 신고가 누적되면 자동으로 숨김 처리됩니다. 건강한 커뮤니티를 함께 만들어주세요.',
      authorId: 'carev-admin',
      authorName: '케어브이 운영팀',
      companyName: '케어브이',
      isAnonymous: false,
      createdAt: hoursAgo(120),
      updatedAt: null,
      viewedBy: ['seed-u1', 'seed-u2', 'seed-u3', 'seed-u4', 'seed-u5', 'seed-u6', 'seed-u7', 'seed-u8'],
      likedBy: ['seed-u1', 'seed-u2', 'seed-u5'],
      reportedBy: [],
      isPinned: true,
      isHidden: false,
      comments: [],
    },
  ];

  const library: LibraryItem[] = [
    { id: 'seed-l1', category: 'form', title: '장기요양급여 제공기록지 (주야간보호)', description: '국민건강보험공단 고시 서식. 주야간보호 급여 제공 내역 기록용.', fileName: '급여제공기록지_주야간보호.hwp', fileSize: 68 * 1024, uploaderId: 'carev-admin', uploaderName: '케어브이 운영팀', companyName: '케어브이', downloadCount: 214, reportedBy: [], createdAt: hoursAgo(240), isSeed: true },
    { id: 'seed-l2', category: 'form', title: '낙상 위험도 평가도구 (MFS) 양식', description: 'Morse Fall Scale 기반 낙상 위험도 평가 기록 양식.', fileName: '낙상위험도평가_MFS.hwp', fileSize: 42 * 1024, uploaderId: 'carev-admin', uploaderName: '케어브이 운영팀', companyName: '케어브이', downloadCount: 187, reportedBy: [], createdAt: hoursAgo(240), isSeed: true },
    { id: 'seed-l3', category: 'eval', title: '2026년 장기요양기관 평가 지표 요약본', description: '2026년 정기평가 지표 개편 사항을 영역별로 정리한 요약 자료.', fileName: '2026_평가지표_요약.pdf', fileSize: 1_240 * 1024, uploaderId: 'carev-admin', uploaderName: '케어브이 운영팀', companyName: '케어브이', downloadCount: 356, reportedBy: [], createdAt: hoursAgo(200), isSeed: true },
    { id: 'seed-l4', category: 'eval', title: '평가 대비 자체점검 체크리스트', description: '평가 전 기관 자체점검용 체크리스트. 영역별 준비 서류 목록 포함.', fileName: '자체점검_체크리스트.xlsx', fileSize: 96 * 1024, uploaderId: 'carev-admin', uploaderName: '케어브이 운영팀', companyName: '케어브이', downloadCount: 298, reportedBy: [], createdAt: hoursAgo(200), isSeed: true },
    { id: 'seed-l5', category: 'program', title: '회상요법 인지활동 프로그램 계획서 예시', description: '옛날 물건·사진을 활용한 회상요법 4주차 프로그램 계획서 샘플.', fileName: '회상요법_프로그램계획서.hwp', fileSize: 154 * 1024, uploaderId: 'seed-u5', uploaderName: '정선생', companyName: '온기주간보호센터', downloadCount: 92, reportedBy: [], createdAt: hoursAgo(96), isSeed: true },
    { id: 'seed-l6', category: 'program', title: '실버 체조 동작 안내판 (대형 인쇄용)', description: '어르신 눈높이에 맞춘 큰 글씨 체조 동작 안내판. A3 인쇄 권장.', fileName: '실버체조_안내판_A3.pdf', fileSize: 2_380 * 1024, uploaderId: 'seed-u2', uploaderName: '박실장', companyName: '푸른요양원', downloadCount: 61, reportedBy: [], createdAt: hoursAgo(80), isSeed: true },
    { id: 'seed-l7', category: 'form', title: '종사자 근무상황부 월간 양식', description: '요양보호사·사회복지사 월간 근무상황 기록 양식.', fileName: '근무상황부_월간.xlsx', fileSize: 54 * 1024, uploaderId: 'carev-admin', uploaderName: '케어브이 운영팀', companyName: '케어브이', downloadCount: 143, reportedBy: [], createdAt: hoursAgo(160), isSeed: true },
    { id: 'seed-l8', category: 'etc', title: '노인학대 신고 의무자 교육 안내문', description: '신고 의무자 온라인 교육 과정 안내 및 연 1회 이수 체크 가이드.', fileName: '노인학대_신고의무자_교육안내.pdf', fileSize: 480 * 1024, uploaderId: 'carev-admin', uploaderName: '케어브이 운영팀', companyName: '케어브이', downloadCount: 77, reportedBy: [], createdAt: hoursAgo(140), isSeed: true },
  ];

  return { posts, library };
}

function loadStore(): PlazaStore {
  if (typeof window === 'undefined') return seedStore();
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw) as PlazaStore;
  } catch {
    // 손상된 저장소는 시드로 초기화
  }
  const seeded = seedStore();
  saveStore(seeded);
  return seeded;
}

function saveStore(store: PlazaStore) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    // 저장 실패(용량 초과 등)는 조용히 무시 — 목업 단계
  }
}

function mutate<T>(fn: (store: PlazaStore) => T): T {
  const store = loadStore();
  const result = fn(store);
  saveStore(store);
  return result;
}

// ── 게시판 API ──────────────────────────────────────────

export function getPosts(): PlazaPost[] {
  return loadStore().posts;
}

export function getPost(id: string): PlazaPost | undefined {
  return loadStore().posts.find((p) => p.id === id);
}

export function createPost(input: { board: BoardType; category: PostCategory | null; title: string; content: string; isAnonymous: boolean }): PlazaPost {
  const user = getCurrentUser();
  const post: PlazaPost = {
    id: newId(),
    board: input.board,
    category: input.board === 'free' ? null : input.category,
    title: input.title,
    content: input.content,
    authorId: user.id,
    authorName: user.name,
    companyName: user.company,
    isAnonymous: input.isAnonymous,
    createdAt: new Date().toISOString(),
    updatedAt: null,
    viewedBy: [],
    likedBy: [],
    reportedBy: [],
    isPinned: false,
    isHidden: false,
    comments: [],
  };
  mutate((s) => s.posts.unshift(post));
  return post;
}

export function updatePost(id: string, input: { board: BoardType; category: PostCategory | null; title: string; content: string; isAnonymous: boolean }) {
  mutate((s) => {
    const p = s.posts.find((x) => x.id === id);
    if (!p) return;
    p.board = input.board;
    p.category = input.board === 'free' ? null : input.category;
    p.title = input.title;
    p.content = input.content;
    p.isAnonymous = input.isAnonymous;
    p.updatedAt = new Date().toISOString();
  });
}

export function deletePost(id: string) {
  mutate((s) => {
    s.posts = s.posts.filter((p) => p.id !== id);
  });
}

/** 사용자당 1회만 조회수 증가 */
export function incrementView(postId: string) {
  const user = getCurrentUser();
  mutate((s) => {
    const p = s.posts.find((x) => x.id === postId);
    if (p && !p.viewedBy.includes(user.id)) p.viewedBy.push(user.id);
  });
}

/** 좋아요 토글. true=좋아요 됨 */
export function toggleLike(postId: string): boolean {
  const user = getCurrentUser();
  return mutate((s) => {
    const p = s.posts.find((x) => x.id === postId);
    if (!p) return false;
    const i = p.likedBy.indexOf(user.id);
    if (i >= 0) {
      p.likedBy.splice(i, 1);
      return false;
    }
    p.likedBy.push(user.id);
    return true;
  });
}

/** 신고. 임계값 도달 시 자동 숨김. 반환: 'reported' | 'already' | 'hidden' */
export function reportPost(postId: string, _reason: string): 'reported' | 'already' | 'hidden' {
  const user = getCurrentUser();
  return mutate((s) => {
    const p = s.posts.find((x) => x.id === postId);
    if (!p) return 'already';
    if (p.reportedBy.includes(user.id)) return 'already';
    p.reportedBy.push(user.id);
    if (p.reportedBy.length >= REPORT_AUTO_HIDE_THRESHOLD) {
      p.isHidden = true;
      return 'hidden';
    }
    return 'reported';
  });
}

export function addComment(postId: string, content: string, parentId: string | null, isAnonymous: boolean): void {
  const user = getCurrentUser();
  mutate((s) => {
    const p = s.posts.find((x) => x.id === postId);
    if (!p) return;
    p.comments.push({
      id: newId(),
      parentId,
      authorId: user.id,
      authorName: user.name,
      companyName: user.company,
      isAnonymous,
      content,
      createdAt: new Date().toISOString(),
      updatedAt: null,
      isAccepted: false,
    });
  });
}

export function updateComment(postId: string, commentId: string, content: string) {
  mutate((s) => {
    const c = s.posts.find((x) => x.id === postId)?.comments.find((x) => x.id === commentId);
    if (!c) return;
    c.content = content;
    c.updatedAt = new Date().toISOString();
  });
}

export function deleteComment(postId: string, commentId: string) {
  mutate((s) => {
    const p = s.posts.find((x) => x.id === postId);
    if (!p) return;
    // 대댓글도 함께 삭제
    p.comments = p.comments.filter((c) => c.id !== commentId && c.parentId !== commentId);
  });
}

/** Q&A 답변 채택 (글 작성자만, 글당 1개) */
export function acceptComment(postId: string, commentId: string) {
  mutate((s) => {
    const p = s.posts.find((x) => x.id === postId);
    if (!p) return;
    p.comments.forEach((c) => {
      c.isAccepted = c.id === commentId;
    });
  });
}

// ── 자료실 API ──────────────────────────────────────────

export function getLibraryItems(): LibraryItem[] {
  return loadStore().library;
}

export function addLibraryItem(input: {
  category: LibraryCategory;
  title: string;
  description: string;
  file: File;
}): LibraryItem {
  const user = getCurrentUser();
  const item: LibraryItem = {
    id: newId(),
    category: input.category,
    title: input.title,
    description: input.description,
    fileName: input.file.name,
    fileSize: input.file.size,
    uploaderId: user.id,
    uploaderName: user.name,
    companyName: user.company,
    downloadCount: 0,
    reportedBy: [],
    createdAt: new Date().toISOString(),
    isSeed: false,
  };
  mutate((s) => s.library.unshift(item));
  registerSessionFile(item.id, input.file);
  return item;
}

export function deleteLibraryItem(id: string) {
  mutate((s) => {
    s.library = s.library.filter((i) => i.id !== id);
  });
}

export function incrementDownload(id: string) {
  mutate((s) => {
    const i = s.library.find((x) => x.id === id);
    if (i) i.downloadCount += 1;
  });
}

export function reportLibraryItem(id: string, _reason: string): 'reported' | 'already' {
  const user = getCurrentUser();
  return mutate((s) => {
    const i = s.library.find((x) => x.id === id);
    if (!i || i.reportedBy.includes(user.id)) return 'already';
    i.reportedBy.push(user.id);
    return 'reported';
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${bytes}B`;
}
