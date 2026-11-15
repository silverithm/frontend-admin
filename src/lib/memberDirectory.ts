import { useEffect } from 'react';
import { create } from 'zustand';
import { getMembersIncludingAdmins } from '@/lib/apiService';
import { ADMIN_CHAT_ID_PREFIX } from '@/lib/chatIdentity';

/**
 * 직원 이름 옆에 그 사람 프로필 사진을 붙이기 위한 기관 구성원 사진첩(2026-11-16
 * "직원과 관련된 정보에는 그 직원의 프로필 사진을" — 앱 MemberDirectory와 같은 규칙).
 *
 * 휴무·일정·결재·회의록 응답에는 사진 주소가 없고 사람 번호만 온다. 그래서 직원+시설장 명단
 * (`includeAdmins=true`, 이메일·role·사진이 함께 온다)을 한 번 받아 두고 번호로 찾는다.
 *
 * 사람 번호 표기는 화면마다 다르다 — 'admin_3'(채팅·결재·업무), ('ADMIN', 3), ('MEMBER', 12),
 * 그냥 12, 이메일(일정 작성자). 직원(members)과 시설장(app_user)은 번호가 겹치므로, 번호로 찾은
 * 사람의 이름이 넘겨받은 이름과 다르면 쓰지 않는다 — 남의 사진이 붙는 것이 사진이 없는 것보다 나쁘다.
 * 운영 DB의 직원 이름은 암호화돼 있어 이름만으로 맞출 수는 없고, 이름은 회사에 한 명뿐일 때만 쓴다.
 */

export interface DirectoryPerson {
    id: string;
    name: string;
    email: string | null;
    imageUrl: string | null;
    /** 시설장(app_user) 계정 — 직원과 번호가 겹칠 수 있다 */
    isAdmin: boolean;
}

/** 사람 하나를 가리키는 값 — 아는 것을 다 넘긴다 */
export interface PersonRef {
    /** 12 / '12' / 'admin_3' */
    id?: string | number | null;
    /** 'ADMIN' | 'MEMBER' | 'EXTERNAL' … — id의 종류 */
    type?: string | null;
    email?: string | null;
    name?: string | null;
}

type Status = 'idle' | 'loading' | 'loaded' | 'error';

interface DirectoryState {
    members: Map<string, DirectoryPerson>;
    admins: Map<string, DirectoryPerson>;
    byEmail: Map<string, DirectoryPerson>;
    byName: Map<string, DirectoryPerson[]>;
    status: Status;
    companyId: string | null;
    loadedAt: number;
    load: (options?: { force?: boolean }) => Promise<void>;
    replaceAll: (companyId: string, people: DirectoryPerson[]) => void;
    reset: () => void;
}

/** 사진을 바꾼 사람이 있어도 이만큼 지나면 다시 받는다 */
const MAX_AGE_MS = 30 * 60 * 1000;

const normName = (name: string) => name.replace(/\s+/g, '');

function currentCompanyId(): string {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('companyId') || '';
}

function text(value: unknown): string | null {
    if (value == null) return null;
    const s = String(value).trim();
    return s ? s : null;
}

function index(people: DirectoryPerson[]) {
    const members = new Map<string, DirectoryPerson>();
    const admins = new Map<string, DirectoryPerson>();
    const byEmail = new Map<string, DirectoryPerson>();
    const byName = new Map<string, DirectoryPerson[]>();
    for (const p of people) {
        if (!p.id) continue;
        (p.isAdmin ? admins : members).set(p.id, p);
        if (p.email) byEmail.set(p.email.toLowerCase(), p);
        if (p.name) {
            const key = normName(p.name);
            byName.set(key, [...(byName.get(key) ?? []), p]);
        }
    }
    return { members, admins, byEmail, byName };
}

const empty = () => ({
    members: new Map<string, DirectoryPerson>(),
    admins: new Map<string, DirectoryPerson>(),
    byEmail: new Map<string, DirectoryPerson>(),
    byName: new Map<string, DirectoryPerson[]>(),
});

export const useMemberDirectory = create<DirectoryState>((set, get) => ({
    ...empty(),
    status: 'idle',
    companyId: null,
    loadedAt: 0,

    load: async (options) => {
        const companyId = currentCompanyId();
        if (!companyId) return;
        const { status, loadedAt } = get();
        if (status === 'loading') return;
        const fresh =
            get().companyId === companyId &&
            (status === 'loaded' || status === 'error') &&
            Date.now() - loadedAt < MAX_AGE_MS;
        if (fresh && !options?.force) return;

        set({ status: 'loading' });
        try {
            const response = await getMembersIncludingAdmins();
            const list: unknown[] = Array.isArray(response?.members)
                ? response.members
                : Array.isArray(response)
                  ? response
                  : [];
            const people: DirectoryPerson[] = list.flatMap((raw) => {
                if (!raw || typeof raw !== 'object') return [];
                const m = raw as Record<string, unknown>;
                const id = text(m.id);
                if (!id) return [];
                return [
                    {
                        id,
                        name: text(m.name) ?? text(m.username) ?? '',
                        email: text(m.email),
                        imageUrl: text(m.profileImageUrl),
                        isAdmin: m.role === 'facility_admin',
                    },
                ];
            });
            get().replaceAll(companyId, people);
        } catch {
            // 사진이 없으면 이름 첫 글자로 보이니 화면은 그대로 쓸 수 있다 — 30분 뒤 다시 받는다
            set({ status: 'error', companyId, loadedAt: Date.now() });
        }
    },

    replaceAll: (companyId, people) =>
        set({ ...index(people), status: 'loaded', companyId, loadedAt: Date.now() }),

    reset: () => set({ ...empty(), status: 'idle', companyId: null, loadedAt: 0 }),
}));

/** 사람 번호 하나 → (직원 번호, 시설장 번호). 외부 참석자처럼 사람 번호가 아니면 둘 다 없다 */
export function parsePersonRef(
    id: string | number | null | undefined,
    type?: string | null,
): { memberId: string | null; adminId: string | null } {
    const raw = id == null ? '' : String(id).trim();
    if (!raw) return { memberId: null, adminId: null };
    if (raw.startsWith(ADMIN_CHAT_ID_PREFIX)) {
        return { memberId: null, adminId: raw.slice(ADMIN_CHAT_ID_PREFIX.length) };
    }
    const kind = type?.trim().toUpperCase();
    if (kind === 'ADMIN' || kind === 'FACILITY_ADMIN') return { memberId: null, adminId: raw };
    if (kind && kind !== 'MEMBER') return { memberId: null, adminId: null };
    return { memberId: raw, adminId: null };
}

type Lookup = Pick<DirectoryState, 'members' | 'admins' | 'byEmail' | 'byName'>;

/** 순서: 직원 번호 → 시설장 번호 → 이메일 → 이름(회사에 한 명뿐일 때) */
export function findPerson(state: Lookup, ref: PersonRef): DirectoryPerson | null {
    const wanted = ref.name ? normName(ref.name) : '';
    const sameName = (p: DirectoryPerson) => !wanted || normName(p.name) === wanted;
    const { memberId, adminId } = parsePersonRef(ref.id, ref.type);

    const byMember = memberId ? state.members.get(memberId) : undefined;
    if (byMember && sameName(byMember)) return byMember;
    // 종류를 모르고 숫자만 오는 곳(휴무) — 이름이 맞는 시설장이면 그 사람
    const adminKey = adminId ?? (ref.type ? null : memberId);
    const byAdmin = adminKey ? state.admins.get(adminKey) : undefined;
    if (byAdmin && (adminId || wanted) && sameName(byAdmin)) return byAdmin;
    const email = ref.email?.trim().toLowerCase();
    const byEmail = email ? state.byEmail.get(email) : undefined;
    if (byEmail && sameName(byEmail)) return byEmail;
    if (wanted) {
        const same = state.byName.get(wanted);
        if (same && same.length === 1) return same[0];
    }
    return null;
}

/**
 * 그 사람 사진 주소 — 사진첩을 처음 쓰는 화면이 받아 오게 한다(이미 받았으면 아무 일도 안 한다).
 * [known]이 있으면(응답에 사진이 함께 온 곳) 그것을 쓴다.
 */
export function useMemberPhoto(ref: PersonRef, known?: string | null): string | null {
    const load = useMemberDirectory((s) => s.load);
    const photo = useMemberDirectory((s) =>
        known ? null : (findPerson(s, ref)?.imageUrl ?? null),
    );
    useEffect(() => {
        if (!known) void load();
    }, [known, load]);
    return known || photo;
}
