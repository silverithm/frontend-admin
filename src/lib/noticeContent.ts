/**
 * 공지 본문 형식 변환 (DOMPurify 없이 도는 순수 함수) — `node --test src/lib/noticeContent.test.ts`
 *
 * 공지는 오랫동안 평문으로 쌓여 왔고, 지금 작성 화면은 HTML을 저장한다.
 * 옛 평문 공지를 서식 편집기로 열 때 줄바꿈이 사라지지 않도록 HTML로 바꿔 준다.
 */

const TAG_RE = /<(p|div|br|span|font|b|strong|i|em|u|s|ul|ol|li|a|blockquote)\b/i;

/** 서식 편집기에 넣을 값 — 태그가 있으면 그대로, 평문이면 이스케이프하고 줄바꿈을 <br>로 */
export const toEditorHtml = (content: string): string => {
  if (!content) return '';
  if (TAG_RE.test(content)) return content;
  return content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\r\n?/g, '\n')
    .replace(/\n/g, '<br>');
};
