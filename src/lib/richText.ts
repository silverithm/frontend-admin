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

/* ------------------------------------------------------------------ *
 * 저장 직전 정규화
 *
 * 크롬 contentEditable은 눈에 보이지 않는 자리표시자를 남긴다.
 *  - 블록 끝의 '가짜 <br>'  : <div>내용<br></div> — 편집기에선 안 보이지만
 *  - 문서 끝의 캐럿 자리    : <div><br></div> — 다시 그리면 진짜 빈 줄이 된다
 * 그래서 수정할수록 글이 세로로 늘어났다. .trim()은 문자열 공백만 깎아 이걸 못 잡는다.
 *
 * DOM API를 쓰지 않는 순수 문자열 함수다(= node --test로 검증 가능).
 * 입력은 sanitizeRichText를 거친 well-formed HTML이라고 전제한다.
 * ------------------------------------------------------------------ */

/** 가짜 <br>를 품을 수 있는 블록 태그 */
const BLOCK_TAGS = 'div|p|li|blockquote';

/** 블록 닫기 직전의 <br> — 뒤따르는 공백은 그대로 돌려준다 */
const TRAILING_BR_IN_BLOCK = new RegExp(`<br\\s*/?>(\\s*)(</(?:${BLOCK_TAGS})>)`, 'gi');

/**
 * 그 <br> 앞에 '글자'가 없는가.
 *
 * 블록을 열자마자 오는 <br>(<div><br></div>)이거나 또 다른 <br> 뒤에 오는 <br>이라면,
 * 그건 캐럿 자리표시자가 아니라 사용자가 만든 빈 줄이다 → 건드리지 않는다.
 * 글자 바로 뒤의 <br>만 가짜로 본다.
 */
const NO_CONTENT_BEFORE = new RegExp(`(?:<(?:${BLOCK_TAGS})\\b[^>]*>|<br\\s*/?>)\\s*$`, 'i');

/**
 * 문서 끝의 빈 꼬리 — 공백, <br>, <div><br></div>, <p><br></p>, <div></div>, <p></p>의 연속.
 * 역참조(\1)로 여닫는 태그 이름이 같은 경우만 지운다.
 */
const EMPTY_TAIL = /(?:\s|<br\s*\/?>|<(div|p)\b[^>]*>\s*(?:<br\s*\/?>\s*)?<\/\1>)+$/i;

/** 한 번 훑어 블록 끝의 가짜 <br>를 지운다 */
const stripFakeBreaks = (html: string) =>
  html.replace(TRAILING_BR_IN_BLOCK, (match, spacing: string, closeTag: string, offset: number, source: string) => {
    // <div><br></div>처럼 사용자가 만든 빈 줄은 보존
    if (NO_CONTENT_BEFORE.test(source.slice(0, offset))) return match;
    return spacing + closeTag;
  });

/** 중첩·연속이 있어도 더 줄어들지 않을 때까지 돈다(상한을 둬 무한루프를 막는다) */
const MAX_PASSES = 10;

/**
 * 편집기가 내놓은 HTML에서 '보이지 않는 빈 줄'만 걷어낸다.
 *
 * 글자·서식 태그·중간에 일부러 넣은 빈 줄은 건드리지 않는다.
 * 지우기만 하므로 길이가 단조 감소하고, 안정될 때까지 돌리므로 멱등이다.
 */
export const normalizeEditorHtml = (html: string): string => {
  if (!html) return '';

  let current = html;
  for (let pass = 0; pass < MAX_PASSES; pass += 1) {
    const next = stripFakeBreaks(current).replace(EMPTY_TAIL, '');
    if (next === current) return current;
    current = next;
  }
  return current;
};
