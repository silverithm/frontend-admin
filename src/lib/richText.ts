/**
 * 서식 있는 본문(HTML)을 저장하고 보여줄 때 쓰는 공통 규칙.
 *
 * 광장 글쓰기가 쓰던 것을 공지사항도 함께 쓰도록 꺼냈다. 두 곳이 같은 허용 태그를 쓰지
 * 않으면, 한쪽에서 쓴 서식이 다른 쪽에서 통째로 지워지거나 반대로 위험한 태그가 새어 든다.
 */
import DOMPurify from 'dompurify';

/** 저장·렌더 공통 소독 — 이미지·스크립트류 제거, 서식 태그만 허용 */
export const sanitizeRichText = (html: string) =>
  DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'strong', 'i', 'em', 'u', 's', 'strike', 'span', 'font', 'div', 'p', 'br', 'ul', 'ol', 'li', 'a', 'blockquote'],
    ALLOWED_ATTR: ['style', 'color', 'size', 'face', 'href', 'target', 'rel'],
  });

/**
 * 서식이 들어간 본문인가.
 *
 * 공지는 오랫동안 평문으로 쌓여 왔다. 그 글들을 HTML로 그리면 줄바꿈이 사라지므로,
 * 태그가 있는 글만 HTML로 그리고 나머지는 예전처럼 평문으로 둔다.
 */
export const isRichText = (content: string) => /<(p|div|br|span|font|b|strong|i|em|u|s|ul|ol|li|a|blockquote)\b/i.test(content);

/** 목록 미리보기·알림용 — 태그를 걷어내고 글자만 남긴다 */
export const richTextToPlain = (content: string) => {
  if (!isRichText(content)) return content;
  if (typeof window === 'undefined') return content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const div = document.createElement('div');
  div.innerHTML = sanitizeRichText(content);
  return (div.textContent || '').replace(/\s+/g, ' ').trim();
};
