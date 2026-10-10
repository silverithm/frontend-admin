/**
 * 브라우저에 남은 로그인 흔적으로 지금 방문자가 누구인지 판정한다.
 *
 * - guest: 로그인하지 않음
 * - demo: '로그인 없이 체험하기' 세션 — authToken은 있지만 내 계정이 아니라 결제할 수 없다
 * - employee: 직원 계정 — 결제는 기관 관리자만 한다
 * - admin: 기관 관리자 계정
 *
 * localStorage를 읽으므로 마운트 이후(useEffect)에만 부른다. SSR 첫 렌더는 guest로 둔다.
 */
export type AuthState = 'guest' | 'demo' | 'employee' | 'admin';

export function readAuthState(): AuthState {
    try {
        if (!localStorage.getItem('authToken')) return 'guest';
        if (localStorage.getItem('isDemoMode') === 'true') return 'demo';
        return localStorage.getItem('loginType') === 'employee' ? 'employee' : 'admin';
    } catch {
        return 'guest';
    }
}

/**
 * 로그인 뒤 돌아갈 화면. 외부 주소로 튕겨 나가는 오픈 리다이렉트를 막기 위해
 * 정해 둔 내부 경로만 받는다.
 */
const ALLOWED_RETURN_PATHS = ['/payment', '/subscription'] as const;

export function readReturnPath(search: string): string | null {
    const value = new URLSearchParams(search).get('redirect');
    return value && (ALLOWED_RETURN_PATHS as readonly string[]).includes(value) ? value : null;
}

export function loginPathFor(returnPath: string): string {
    return `/login?redirect=${encodeURIComponent(returnPath)}`;
}
