/**
 * 채팅 첨부 공통 규칙 — 관리자 채팅 탭과 플로팅 채팅이 같은 기준으로 동작하도록 한곳에 둔다.
 */

/** 채팅 첨부 상한 — S3 업로드와 모바일 데이터 사용을 감안한 값 */
export const MAX_CHAT_FILE_SIZE = 20 * 1024 * 1024;

/** 브라우저에서 바로 열어볼 수 있는 문서 (그 외는 다운로드로 안내) */
export const VIEWABLE_DOC_EXTENSIONS = ['pdf', 'hwp', 'hwpx', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'];

export const isViewableDocument = (fileName?: string) => {
    if (!fileName) return false;
    const ext = fileName.split('.').pop()?.toLowerCase();
    return !!ext && VIEWABLE_DOC_EXTENSIONS.includes(ext);
};
