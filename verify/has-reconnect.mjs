// G1a: 소켓이 끊긴 뒤 다시 붙었을 때 방 구독이 되살아나고, 그 사이 놓친 메시지를 메우는지.
//
// 원래 버그: stompjs의 onDisconnect는 정상 종료일 때만 불린다. 와이파이가 바뀌어 툭
// 끊기면 onWebSocketClose가 불리는데 그걸 안 받아서 isConnected가 true로 남고,
// 재연결해도 React 상태가 안 바뀌어 구독 effect가 다시 돌지 않았다.
//
// 그래서 세 가지를 다 확인한다:
//   (1) 갑작스러운 끊김을 받는가          onWebSocketClose
//   (2) 재연결마다 값이 반드시 바뀌는가    세대 번호(epoch) — 불리언이면 안 된다
//   (3) 구독이 그 값에 매달려 있는가       deps에 epoch
//   (4) 놓친 메시지를 메우는가             재연결 시 다시 받아오기
import { WEB, APP, read, want, done } from './_lib.mjs';

// 웹 세 화면이 모두 같은 규칙을 써야 한다. 한 곳만 고치면 나머지에서 그대로 재발한다.
for (const [file, label] of [
  [`${WEB}/src/components/ChatManagement.tsx`, '관리자 채팅탭'],
  [`${WEB}/src/components/FloatingChat/FloatingChat.tsx`, '직원 플로팅'],
  [`${WEB}/src/components/ChatRail/ChatDock.tsx`, '사이드 채팅'],
]) {
  const src = read(file);
  want(/onWebSocketClose/.test(src),
       `${label}: 갑작스러운 끊김(onWebSocketClose)을 받지 않는다`);
  want(/connectionEpoch/.test(src),
       `${label}: 재연결 세대 번호가 없다 — 불리언은 두 번째 연결에서 값이 안 바뀐다`);
  // 구독 effect의 의존성에 세대 번호가 들어가야 재연결마다 다시 구독한다.
  want(/useEffect\([\s\S]{0,4000}?SUBSCRIBE|subscribe\([\s\S]{0,3000}?\[[^\]]*connectionEpoch/.test(src)
       || /\[[^\]]*connectionEpoch[^\]]*\]/.test(src),
       `${label}: 구독이 세대 번호에 매달려 있지 않다`);
  want(/chatReconnect|backfill|mergeById|메[운웁]/.test(src),
       `${label}: 끊긴 사이 놓친 메시지를 메우지 않는다`);
}

// 규칙이 세 벌로 흩어지면 나중에 한쪽만 고쳐진다. 한곳에 모여 있어야 한다.
const lib = read(`${WEB}/src/lib/chatReconnect.ts`);
want(/onWebSocketClose|epoch/.test(lib), '공용 재연결 규칙 파일이 비어 있다');

// 앱은 구독은 되살아나지만 놓친 메시지를 안 메운다 — 그것도 같이 봐야 한다.
const app = read(`${APP}/lib/providers/chat_provider.dart`);
want(/_onConnect|onConnect/.test(app), '앱: 재연결 처리가 없다');
want(/(_onConnect|재연결)[\s\S]{0,900}?(loadMessages|fetchMessages|backfill)/i.test(app),
     '앱: 재연결 뒤 놓친 메시지를 메우지 않는다');

done('reconnect-handling-present');
