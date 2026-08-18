'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { format, startOfMonth, endOfMonth, addMonths } from 'date-fns';
import {
    getApprovalRequests,
    getApprovalRequesterId,
    getPendingUsers,
    getSchedules,
    getVoiceMessages,
    fetchCompanyLibrary,
} from '@/lib/apiService';
import { fetchPosts } from '@/components/plaza/plazaApi';
import { useVisiblePolling } from '@/lib/useVisiblePolling';
import type { ApprovalRequest } from '@/types/approval';
import type { Notice } from '@/types/notice';

/**
 * 사이드바 탭 배지 집계.
 *
 * 배지는 의미가 둘로 갈린다:
 * - 처리 대기형(approval·members): 내가 승인/거절해야 할 건수. 처리해야만 줄어든다.
 * - 미확인 새 글형(notice·schedule·voice·plaza·library): 마지막으로 그 탭을 본 시각
 *   이후에 등록된 항목 수. 탭에 들어가면 본 것으로 치고 사라진다.
 *
 * 서버에 사용자별 읽음 상태가 없으므로 '마지막으로 본 시각'은 브라우저(localStorage)에
 * 계정별로 저장한다. 처음 쓰는 브라우저에서는 전부 본 것으로 시작한다 — 안 그러면
 * 도입 첫날 모든 탭에 빨간 숫자가 한꺼번에 떠서 배지가 소음이 된다.
 *
 * 채팅 배지는 여기서 다루지 않는다 — 서버가 방별 unreadCount를 주고 ChatRail/
 * ChatManagement가 이미 받아오고 있어, 셸이 콜백으로 합계만 넘겨받으면 된다.
 */

/** 탭 진입을 '봤다'로 기록하는 탭들 */
const SEEN_TABS = ['notice', 'schedule', 'voice', 'plaza', 'library'] as const;
export type SeenTab = (typeof SEEN_TABS)[number];

export interface TabBadgeCounts {
    notice: number;
    schedule: number;
    voice: number;
    plaza: number;
    library: number;
    approval: number;
    members: number;
}

const ZERO_COUNTS: TabBadgeCounts = {
    notice: 0,
    schedule: 0,
    voice: 0,
    plaza: 0,
    library: 0,
    approval: 0,
    members: 0,
};

/** 새 글형 탭은 5분 — 롤링 배너·공지 폴링과 같은 호흡 */
const SLOW_INTERVAL_MS = 300000;
/** 처리 대기형 탭은 60초 — 결재·가입 신청은 더 빨리 눈에 띄어야 한다 */
const FAST_INTERVAL_MS = 60000;

/** 커뮤니티는 글이 많아 첫 페이지만 본다 — 배지는 '새 글이 있다'는 신호면 충분하다 */
const PLAZA_PAGE_SIZE = 20;

const isSeenTab = (tab: string): tab is SeenTab => (SEEN_TABS as readonly string[]).includes(tab);

function storageKey(): string | null {
    if (typeof window === 'undefined') return null;
    const companyId = localStorage.getItem('companyId');
    const userId = localStorage.getItem('userId');
    if (!companyId || !userId) return null;
    // 관리자와 직원의 id가 겹칠 수 있어 loginType까지 키에 넣는다 ([[chat-user-identity]]와 같은 이유)
    const loginType = localStorage.getItem('loginType') || 'admin';
    return `carev-tab-seen:${companyId}:${loginType}:${userId}`;
}

/** 저장된 '마지막으로 본 시각'을 읽는다. 처음이면 지금 시각으로 채워 저장한다. */
function loadSeen(): Partial<Record<SeenTab, string>> | null {
    const key = storageKey();
    if (!key) return null;
    try {
        const raw = localStorage.getItem(key);
        if (raw) return JSON.parse(raw);
    } catch {
        // 깨진 저장값은 새로 만든다
    }
    const now = new Date().toISOString();
    const initial = Object.fromEntries(SEEN_TABS.map((tab) => [tab, now])) as Record<SeenTab, string>;
    try {
        localStorage.setItem(key, JSON.stringify(initial));
    } catch {
        // 저장 불가 환경이어도 이번 세션 동작은 막지 않는다
    }
    return initial;
}

function persistSeen(seen: Partial<Record<SeenTab, string>>) {
    const key = storageKey();
    if (!key) return;
    try {
        localStorage.setItem(key, JSON.stringify(seen));
    } catch {
        // 저장 실패 시 다음 방문 때 배지가 다시 뜰 뿐, 동작은 계속한다
    }
}

/** seenIso 이후에 만들어진 항목 수. 생성시각이 없는 항목은 새 글인지 알 수 없으니 세지 않는다. */
function countNewer(createdAts: (string | null | undefined)[], seenIso: string | undefined): number {
    if (!seenIso) return 0;
    const seenTime = new Date(seenIso).getTime();
    if (Number.isNaN(seenTime)) return 0;
    let count = 0;
    for (const createdAt of createdAts) {
        if (!createdAt) continue;
        const time = new Date(createdAt).getTime();
        if (!Number.isNaN(time) && time > seenTime) count += 1;
    }
    return count;
}

interface UseTabBadgesOptions {
    /** 현재 활성 탭 — 새 글형 탭은 머무는 동안 계속 '봤다'로 기록한다 */
    activeTab: string;
}

/**
 * 관리자 전용 소스(결재·가입 신청·고충건의) 조회 여부.
 * 셸의 loginType state는 마운트 후에야 채워지는데 첫 폴링 틱은 그보다 먼저 돈다 —
 * prop으로 받으면 직원 세션이 관리자 API를 한 번 때리고 403을 받는다. 저장소를 직접 읽는다.
 */
const isAdminLogin = () =>
    typeof window !== 'undefined' && (localStorage.getItem('loginType') || 'admin') === 'admin';

export function useTabBadges({ activeTab }: UseTabBadgesOptions) {
    const [counts, setCounts] = useState<TabBadgeCounts>(ZERO_COUNTS);

    // 폴링 콜백은 ref로 최신 값을 본다 — 타이머를 다시 잡지 않기 위해서다
    const activeTabRef = useRef(activeTab);
    activeTabRef.current = activeTab;

    const ready = () =>
        typeof window !== 'undefined' && !!localStorage.getItem('authToken') && !!storageKey();

    const setCount = useCallback((tab: keyof TabBadgeCounts, value: number) => {
        setCounts((prev) => (prev[tab] === value ? prev : { ...prev, [tab]: value }));
    }, []);

    const markSeen = useCallback(
        (tab: SeenTab) => {
            const seen = loadSeen();
            if (!seen) return;
            seen[tab] = new Date().toISOString();
            persistSeen(seen);
            setCount(tab, 0);
        },
        [setCount],
    );

    /**
     * 새 글형 카운트 반영. 지금 그 탭을 보고 있으면 세지 않고 '봤다'만 갱신한다 —
     * 보고 있는 화면에 빨간 숫자가 뜨는 것은 알림이 아니라 소음이다.
     */
    const applySeenCount = useCallback(
        (tab: SeenTab, createdAts: (string | null | undefined)[]) => {
            if (activeTabRef.current === tab) {
                markSeen(tab);
                return;
            }
            const seen = loadSeen();
            if (!seen) return;
            setCount(tab, countNewer(createdAts, seen[tab]));
        },
        [markSeen, setCount],
    );

    // ── 새 글형 (5분) ──────────────────────────────────────────
    // 소스별로 독립 실행 — 한 API가 죽어도 나머지 배지는 갱신되고,
    // 실패한 배지는 0으로 꺼지는 대신 직전 값을 유지한다.
    const slowTick = useCallback(() => {
        if (!ready()) return;
        const today = new Date();

        // 일정: 지금 달부터 1년치 — 새로 잡히는 일정은 거의 앞날짜다
        getSchedules(
            format(startOfMonth(today), 'yyyy-MM-dd'),
            format(endOfMonth(addMonths(today, 11)), 'yyyy-MM-dd'),
        )
            .then((data) => {
                const schedules = Array.isArray(data) ? data : data?.schedules || [];
                applySeenCount(
                    'schedule',
                    schedules.map((s: { createdAt?: string }) => s.createdAt),
                );
            })
            .catch((error) => console.error('[탭배지] 일정 조회 실패:', error));

        // 커뮤니티: 최신 글 첫 페이지 (비로그인도 조회 가능한 공개 API)
        fetchPosts({ sort: 'latest', page: 0, size: PLAZA_PAGE_SIZE })
            .then((data) => {
                applySeenCount('plaza', (data.content || []).map((p) => p.createdAt));
            })
            .catch((error) => console.error('[탭배지] 커뮤니티 조회 실패:', error));

        // 자료실 (기관 전용)
        fetchCompanyLibrary()
            .then((data) => {
                const items = Array.isArray(data) ? data : data?.items || [];
                applySeenCount(
                    'library',
                    items.map((i: { createdAt?: string }) => i.createdAt),
                );
            })
            .catch((error) => console.error('[탭배지] 자료실 조회 실패:', error));

        // 고충·건의함 (관리자만 — 직원 호출은 403)
        if (isAdminLogin()) {
            getVoiceMessages('admin')
                .then((data) => {
                    const messages = Array.isArray(data) ? data : data?.messages || [];
                    applySeenCount(
                        'voice',
                        messages.map((m: { createdAt?: string | null }) => m.createdAt),
                    );
                })
                .catch((error) => console.error('[탭배지] 고충·건의함 조회 실패:', error));
        }
    }, [applySeenCount]);

    // ── 처리 대기형 (60초, 관리자만) ───────────────────────────
    const fastTick = useCallback(() => {
        if (!ready() || !isAdminLogin()) return;

        // 전자결재: PENDING 중에서도 '내 차례'인 문서만 — 결재선의 다른 사람 차례까지
        // 세면 내가 할 수 없는 일이 빨간 숫자로 남는다 (ApprovalManagement.isActionable과 동일 판정)
        getApprovalRequests({ status: 'PENDING' })
            .then((response) => {
                const approvals: ApprovalRequest[] = response?.approvals || [];
                const myApproverId = getApprovalRequesterId();
                const actionable = approvals.filter((approval) => {
                    if (approval.status !== 'PENDING') return false;
                    if (!approval.approvalLine || approval.approvalLine.length === 0) return true;
                    const currentStep = approval.approvalLine.find((step) => step.status === 'PENDING');
                    return !!currentStep && currentStep.approverId === myApproverId;
                });
                setCount('approval', actionable.length);
            })
            .catch((error) => console.error('[탭배지] 결재 대기 조회 실패:', error));

        // 회원관리: 가입 승인 대기 수
        getPendingUsers()
            .then((data) => {
                const requests = (data as unknown as { requests?: unknown[] })?.requests || [];
                setCount('members', requests.length);
            })
            .catch((error) => console.error('[탭배지] 가입 신청 조회 실패:', error));
    }, [setCount]);

    useVisiblePolling(slowTick, SLOW_INTERVAL_MS);
    useVisiblePolling(fastTick, FAST_INTERVAL_MS);

    // 새 글형 탭에 들어가면 '봤다'로 기록하고, 나갈 때도 한 번 더 기록한다 —
    // 머무는 동안 새로 올라온 글까지 본 것으로 쳐야 나가자마자 배지가 되살아나지 않는다.
    useEffect(() => {
        if (!isSeenTab(activeTab)) return;
        if (!ready()) return;
        markSeen(activeTab);
        return () => markSeen(activeTab);
    }, [activeTab, markSeen]);

    // 결재·회원 탭에서 나올 때 바로 다시 세어 승인/거절한 만큼 배지를 즉시 줄인다
    useEffect(() => {
        if (activeTab !== 'approval' && activeTab !== 'members') return;
        return () => fastTick();
    }, [activeTab, fastTick]);

    /** 공지 배지 — 롤링 배너가 5분마다 받아오는 목록을 그대로 넘겨받는다 (요청 추가 없음) */
    const onNoticesLoaded = useCallback(
        (notices: Notice[]) => {
            if (!ready()) return;
            applySeenCount(
                'notice',
                notices.map((n) => n.publishedAt || n.createdAt),
            );
        },
        [applySeenCount],
    );

    /** 회원관리 화면이 승인/거절/재조회로 알게 된 최신 대기 수를 배지에 반영한다 */
    const onMembersPendingChange = useCallback(
        (count: number) => setCount('members', count),
        [setCount],
    );

    return { counts, onNoticesLoaded, onMembersPendingChange };
}
