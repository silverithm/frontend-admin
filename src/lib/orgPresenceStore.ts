import { create } from 'zustand';
import { getApproverCandidates, fetchOnlineUserIds } from '@/lib/apiService';
import type { DirectChatMember } from '@/lib/directChat';

/**
 * 기관 인원 명단 + 지금 접속 중인 사람.
 *
 * 채팅 페이지와 플로팅 채팅이 동시에 떠 있을 수 있어 스토어 하나를 함께 쓴다.
 * 각자 상태를 들고 있으면 같은 명단을 두 번 받아오고, 한쪽만 접속 변화를 받아
 * 같은 사람이 화면마다 다르게 보인다.
 *
 * 접속 상태의 실제 출처는 WebSocket이다. REST(fetchOnlineUserIds)는 첫 화면용 스냅샷일 뿐이다.
 */

type LoadStatus = 'idle' | 'loading' | 'loaded' | 'error';

interface ApproverCandidate {
    approverId: number | string;
    name: string;
    position?: string | null;
    profileImageUrl?: string | null;
}

interface OrgPresenceStore {
    members: DirectChatMember[];
    onlineUserIds: Set<string>;
    status: LoadStatus;
    /** 명단을 받아온 기관 — 계정이 바뀌면 다시 받아야 한다 */
    loadedCompanyId: string | null;

    /** 명단+접속 스냅샷을 받아온다. 이미 받았거나 받는 중이면 아무 일도 하지 않는다 */
    load: (companyId: string, options?: { force?: boolean }) => Promise<void>;
    /** WebSocket으로 받은 접속 변화 */
    setPresence: (userId: string, online: boolean) => void;
    reset: () => void;
}

/**
 * 명단을 받아오는 사이에 WebSocket으로 도착한 접속 변화.
 *
 * REST 스냅샷은 요청을 보낸 시점의 사진이라 그 사이 변화보다 오래됐다. 스냅샷으로 통째로
 * 덮어쓰면 먼저 도착한 '오프라인'이 되살아나므로, 받아둔 변화를 스냅샷 뒤에 다시 적용한다.
 */
let deltasWhileLoading: Map<string, boolean> | null = null;

export const useOrgPresenceStore = create<OrgPresenceStore>((set, get) => ({
    members: [],
    onlineUserIds: new Set<string>(),
    status: 'idle',
    loadedCompanyId: null,

    load: async (companyId, options) => {
        const force = options?.force ?? false;
        const { status, loadedCompanyId } = get();

        // 받는 중이면 그 요청의 결과를 같이 쓴다 (두 화면이 동시에 열려도 요청은 한 번)
        if (status === 'loading') return;
        // 실패는 종료 상태다 — 다시 시도하려면 force로 명시해야 한다.
        // (실패를 자동 재시도로 두면 effect 의존성과 맞물려 무한 요청이 된다)
        const isSameCompany = loadedCompanyId === companyId;
        if (!force && isSameCompany && (status === 'loaded' || status === 'error')) return;

        deltasWhileLoading = new Map();
        set({ status: 'loading' });

        try {
            // 결재선 후보는 관리자까지 포함해 인원이 가장 온전하다 (프로필 사진도 함께 온다)
            const [candidateResponse, presenceResponse] = await Promise.all([
                getApproverCandidates(),
                fetchOnlineUserIds().catch(() => ({ onlineUserIds: [] })),
            ]);

            const candidates: ApproverCandidate[] = Array.isArray(candidateResponse?.candidates)
                ? candidateResponse.candidates
                : [];

            const members: DirectChatMember[] = candidates.map((c) => ({
                id: String(c.approverId),
                name: c.name,
                position: c.position,
                profileImageUrl: c.profileImageUrl ?? null,
            }));

            const online = new Set<string>((presenceResponse?.onlineUserIds || []).map(String));
            deltasWhileLoading?.forEach((isOnline, id) => {
                if (isOnline) online.add(id);
                else online.delete(id);
            });
            deltasWhileLoading = null;

            set({ members, onlineUserIds: online, status: 'loaded', loadedCompanyId: companyId });
        } catch (error) {
            deltasWhileLoading = null;
            console.error('[OrgPresence] 인원 목록 로드 실패:', error);
            set({ status: 'error', loadedCompanyId: companyId });
        }
    },

    setPresence: (userId, online) => {
        const id = String(userId);
        if (deltasWhileLoading) deltasWhileLoading.set(id, online);

        set((state) => {
            if (state.onlineUserIds.has(id) === online) return state;
            const next = new Set(state.onlineUserIds);
            if (online) next.add(id);
            else next.delete(id);
            return { onlineUserIds: next };
        });
    },

    reset: () => {
        deltasWhileLoading = null;
        set({ members: [], onlineUserIds: new Set<string>(), status: 'idle', loadedCompanyId: null });
    },
}));

/** 접속 중인 사람을 위로, 그 안에서는 이름순. 나는 목록에서 뺀다 */
export function sortMembersByPresence(
    members: DirectChatMember[],
    onlineUserIds: Set<string>,
    myUserId: string | null,
): DirectChatMember[] {
    return [...members]
        .filter((m) => m.id !== myUserId)
        .sort((a, b) => {
            const aOn = onlineUserIds.has(a.id) ? 0 : 1;
            const bOn = onlineUserIds.has(b.id) ? 0 : 1;
            if (aOn !== bOn) return aOn - bOn;
            return a.name.localeCompare(b.name, 'ko');
        });
}
