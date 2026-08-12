/**
 * 채팅에서 사람을 가리키는 식별자.
 *
 * 관리자 계정(app_user)과 직원(members)은 서로 다른 테이블이라 id가 겹친다. 채팅이 원시
 * 숫자 하나로만 사람을 가리키면 관리자 3번과 직원 3번이 같은 사람이 되어, 참가자 이름과
 * 프로필이 남의 것으로 표시되고 (방, user_id) 유니크 제약 때문에 둘이 같은 방에 들어가지도
 * 못하며, 서로의 메시지를 자기 것으로 보게 된다.
 *
 * 그래서 관리자만 'admin_' 접두사를 붙여 갈라놓는다. 직원은 그대로 숫자만 쓴다 —
 * 직원용 앱이 보내는 값과 같은 형태여야 한다.
 * 백엔드의 `ChatService.ADMIN_ID_PREFIX`, 결재선의 `approverIdLegacy`와 같은 규약이다.
 *
 * 주의: localStorage의 `userId`는 이 값이 아니다. 그건 계정 테이블의 원시 id이고
 * 휴가·결재·일정 등 다른 화면이 그 형태를 기대한다. 변환은 채팅 경계에서만 한다.
 */

export const ADMIN_CHAT_ID_PREFIX = 'admin_';

/** 결재선 후보 API가 돌려주는 approverType */
export type ApproverType = 'ADMIN' | 'MEMBER' | string;

/** 원시 계정 id를 채팅 식별자로 */
export function toChatUserId(rawId: string | number | null | undefined, isAdmin: boolean): string {
    const id = rawId == null ? '' : String(rawId);
    if (!id) return '';
    // 이미 접두사가 붙어 있으면 그대로 둔다 (두 번 씌우면 다른 사람이 된다)
    if (id.startsWith(ADMIN_CHAT_ID_PREFIX)) return id;
    return isAdmin ? `${ADMIN_CHAT_ID_PREFIX}${id}` : id;
}

/** 결재선 후보 한 명을 채팅 식별자로 */
export function candidateToChatUserId(
    approverId: string | number | null | undefined,
    approverType: ApproverType | null | undefined,
): string {
    return toChatUserId(approverId, approverType === 'ADMIN');
}

/** 지금 로그인한 사람의 채팅 식별자. 로그인 정보가 없으면 null */
export function getMyChatUserId(): string | null {
    if (typeof window === 'undefined') return null;
    const rawId = localStorage.getItem('userId');
    if (!rawId) return null;
    return toChatUserId(rawId, isAdminSession());
}

/**
 * 관리자 계정으로 로그인했는지.
 *
 * `loginType`이 정식 경로(로그인 화면·체험 시작)에서 심어주는 값이고, 옛 `login()` 경로처럼
 * 그걸 남기지 않는 곳이 있어 `userRole`도 함께 본다.
 */
export function isAdminSession(): boolean {
    if (typeof window === 'undefined') return false;
    const loginType = localStorage.getItem('loginType');
    if (loginType === 'admin') return true;
    if (loginType === 'employee') return false;
    return localStorage.getItem('userRole') === 'ROLE_ADMIN';
}
