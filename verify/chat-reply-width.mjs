// G6: 답장 인용문이 말풍선을 화면 가로로 늘어뜨리지 않는지.
//
// 원인은 스타일이 아니라 flex의 min-width:auto였다. 인용문은 한 줄(nowrap)로 그리므로
// 그 줄 길이가 말풍선의 최소 폭이 되고, 부모의 min(70%,560px)/75% 상한을 그대로 뚫었다.
// 말풍선에 minWidth:0을 주어야 줄임표가 걸린다. 메인 탭과 플로팅 채팅 두 곳 모두 본다.
import { read, want, done } from './_lib.mjs';

const WT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');

function bubbleStyle(src, label) {
  // 말풍선 div: position:"relative" 로 시작하는 style 블록 중 padding을 가진 것
  const m = /style=\{\{\s*position: "relative",[\s\S]{0,2000}?\}\}/g;
  const blocks = (src.match(m) || []).filter((b) => /padding: "var\(--spacing-/.test(b));
  want(blocks.length >= 1, `${label}: 말풍선 style 블록을 못 찾았다`);
  for (const b of blocks) {
    want(/minWidth: 0/.test(b), `${label}: 말풍선에 minWidth: 0 이 없다 — 인용문 길이만큼 늘어난다`);
    want(/maxWidth: "100%"/.test(b), `${label}: 말풍선에 maxWidth: "100%" 가 없다`);
  }
}

const main = read(`${WT}/src/components/ChatManagement.tsx`);
bubbleStyle(main, '메인 채팅');
want(/className="carev-chat-msgrow" style=\{\{[^}]*maxWidth: "100%"/.test(main), '메인 채팅: 말풍선 행이 부모 폭을 넘을 수 있다');
// 인용문 자체는 계속 한 줄 줄임표여야 한다 (줄바꿈으로 바꾸면 인용문이 원문만큼 길어진다)
want(/replyToSenderName\}<\/div>/.test(main) && /textOverflow: "ellipsis", whiteSpace: "nowrap", opacity: 0\.8/.test(main),
  '메인 채팅: 인용문이 한 줄 줄임표가 아니다');

const floating = read(`${WT}/src/components/FloatingChat/FloatingChatMessages.tsx`);
bubbleStyle(floating, '플로팅 채팅');
want(/alignItems: "flex-end", gap: 'var\(--spacing-1\)', maxWidth: "100%"/.test(floating), '플로팅 채팅: 말풍선 행이 부모 폭을 넘을 수 있다');

done('REPLY_WIDTH_OK');
