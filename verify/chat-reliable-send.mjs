// 채팅 전송 신뢰성 — 네 소켓 화면이 같은 규칙으로 붙고, 보내는 곳마다 식별자·낙관적 말풍선이 있는지.
//
// 2026-09-14 "메시지가 안 보내져요": 웹은 소켓 publish를 성공으로 여기고 입력창만 비웠다.
// 고친 뒤 누가 다시 `new Client(`를 화면에 직접 쓰거나 식별자 없이 보내면 여기서 걸린다.
//
// 실행: node verify/chat-reliable-send.mjs  →  CHAT_RELIABLE_SEND_OK
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(path.join(root, p), "utf8");

const socketScreens = [
    "src/components/ChatManagement.tsx",
    "src/components/FloatingChat/FloatingChat.tsx",
    "src/components/ChatRail/ChatRail.tsx",
    "src/components/ChatRail/ChatDock.tsx",
];
const sendingScreens = [
    "src/components/ChatManagement.tsx",
    "src/components/FloatingChat/FloatingChat.tsx",
    "src/components/ChatRail/ChatDock.tsx",
];

const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };

for (const file of socketScreens) {
    const src = read(file);
    check(!src.includes("new Client("), `${file}: 소켓을 직접 만든다 — createChatClient를 써야 토큰 재읽기·401 갱신·하트비트가 붙는다`);
    check(!src.includes("sockjs-client"), `${file}: SockJS를 직접 쓴다`);
    check(src.includes("createChatClient("), `${file}: createChatClient를 안 쓴다`);
}

for (const file of sendingScreens) {
    const src = read(file);
    check(src.includes("useReliableChatSend"), `${file}: 낙관적 전송 훅(useReliableChatSend)을 안 쓴다`);
    check(!src.includes("destination: `/app/chat/${") || !src.includes('type: "TEXT",\n                        content: messageInput'),
        `${file}: 식별자 없이 소켓으로 직접 보낸다`);
    check(src.includes("applyIncoming(prev"), `${file}: 서버 에코를 applyIncoming으로 반영하지 않는다 — '전송 중' 말풍선이 안 바뀐다`);
    check(src.includes("ack("), `${file}: 에코를 받아도 재전송 시계를 멈추지 않는다`);
}

// 실패 말풍선의 손잡이 — 사용자가 다시 타이핑하지 않게
for (const file of ["src/components/FloatingChat/FloatingChatMessages.tsx", "src/components/ChatManagement.tsx"]) {
    const src = read(file);
    check(src.includes('"다시 보내기"'), `${file}: 실패한 말풍선에 '다시 보내기'가 없다`);
    check(src.includes('sendingStatus === "sending" ? 0.6 : 1'), `${file}: 전송 중 말풍선을 옅게 그리지 않는다`);
}

// 소켓 규칙 자체
const socket = read("src/lib/chatSocket.ts");
check(socket.includes("beforeConnect"), "chatSocket.ts: 붙을 때마다 토큰을 새로 읽지 않는다(beforeConnect 없음)");
check(socket.includes("refreshAuthTokenForSocket"), "chatSocket.ts: 401 뒤 토큰을 갱신하지 않는다");
check(socket.includes("shouldGiveUp"), "chatSocket.ts: 인증이 계속 거절돼도 멈추지 않는다");

// 서버 계약 — REST 전송에 식별자를 실어 보낸다
const api = read("src/lib/apiService.ts");
check(api.includes("clientMessageId?: string;"), "apiService.ts: sendChatMessage에 clientMessageId가 없다");

if (failures.length) {
    console.error("CHAT_RELIABLE_SEND_FAIL");
    for (const f of failures) console.error(" - " + f);
    process.exit(1);
}
console.log("CHAT_RELIABLE_SEND_OK");
