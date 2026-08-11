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
