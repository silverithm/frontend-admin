/**
 * 채팅 사진·동영상을 브라우저에서 백엔드로 바로 올린다.
 *
 * 예전에는 `/api/v1/chat/rooms/{id}/files`(Next API 라우트 = Vercel 서버리스 함수)를 거쳤는데,
 * Vercel은 함수 요청 본문을 4.5MB까지만 받아 그보다 큰 동영상은 `FUNCTION_PAYLOAD_TOO_LARGE`(413)로
 * 서버에 닿지도 못했다(2026-11-03 5.2MB로 확인). 채팅 화면은 20MB까지 고르게 해 두어 사용자는
 * 이유도 모른 채 '전송 실패'만 봤다. 결재 첨부·자료실과 같은 직접 업로드로 옮긴다 — 백엔드 CORS가
 * carev.kr을 허용한다.
 */

export interface ChatUploadDeps {
    /** 백엔드 주소 (예: https://silverithm.site) */
    backendUrl: string;
    getToken: () => string | null;
    /** 401이면 부른다 — 새 토큰을 돌려주고, 갱신이 안 되면 던진다 */
    refreshToken: () => Promise<string>;
    fetchImpl?: typeof fetch;
}

export function chatFilesUploadUrl(backendUrl: string, roomId: number): string {
    return `${backendUrl.replace(/\/+$/, '')}/api/v1/chat/rooms/${roomId}/files`;
}

/**
 * 한 번 보내고, 401이면 토큰을 갱신해 같은 본문으로 한 번 더 보낸다(fetchWithAuth와 같은 규칙).
 * 응답 해석·오류 문구는 부르는 쪽이 정한다. 토큰 갱신 실패는 그대로 던진다.
 */
export async function postChatFileDirect(roomId: number, formData: FormData, deps: ChatUploadDeps): Promise<Response> {
    const doFetch = deps.fetchImpl ?? fetch;
    const url = chatFilesUploadUrl(deps.backendUrl, roomId);
    const send = (token: string | null) =>
        doFetch(url, {
            method: 'POST',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: formData,
        });

    const first = await send(deps.getToken());
    if (first.status !== 401) return first;
    const fresh = await deps.refreshToken();
    return send(fresh);
}
