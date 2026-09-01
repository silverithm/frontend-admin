/**
 * 채팅 첨부 공통 규칙 — 관리자 채팅 탭과 플로팅 채팅이 같은 기준으로 동작하도록 한곳에 둔다.
 */

/** 채팅 첨부 상한 — S3 업로드와 모바일 데이터 사용을 감안한 값 */
export const MAX_CHAT_FILE_SIZE = 20 * 1024 * 1024;

/**
 * 뷰어(DocumentViewerModal)가 실제로 그려낼 수 있는 형식.
 * 여기 목록과 뷰어의 분기가 어긋나면 "열었는데 못 읽는 창"이 뜨므로 함께 고친다.
 * 옛 바이너리 오피스(doc/xls/ppt)는 브라우저에서 열 방법이 없어 일부러 뺐다 — 바로 내려받게 둔다.
 */
export const VIEWABLE_DOC_EXTENSIONS = [
    'pdf',
    'hwp', 'hwpx',
    'docx',
    'xlsx', 'xlsm',
    'pptx',
    'txt', 'csv', 'md', 'json', 'log', 'xml', 'yaml', 'yml',
    'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg',
];

export const isViewableDocument = (fileName?: string) => {
    if (!fileName) return false;
    const ext = fileName.split('.').pop()?.toLowerCase();
    return !!ext && VIEWABLE_DOC_EXTENSIONS.includes(ext);
};

/**
 * 채팅 메시지 목록(말풍선·사진 그리드)에 그릴 이미지 URL을 고르는 단일 지점.
 * 관리자 채팅(ChatManagement)·직원 플로팅 채팅(FloatingChat)이 같은 규칙을 쓴다.
 *
 * 썸네일이 있으면 그걸 쓰고, 없으면(막 올린 사진이라 서버가 아직 못 만들었거나
 * 옛 메시지라 애초에 없는 경우) 원본으로 대체해 빈칸이 되지 않게 한다.
 * 확대·원본 보기·다운로드는 이 함수를 거치지 않고 항상 fileUrl을 직접 써야 한다.
 * 두 컴포넌트가 ChatMessage 타입을 각자 갖고 있어(합치면 더 지저분해져 그대로 둠) 필요한
 * 두 필드만 구조적으로 받는다.
 */
export function chatListImageUrl(message: { thumbnailUrl?: string; fileUrl?: string }): string | undefined {
    return message.thumbnailUrl || message.fileUrl;
}
