// G7: 같은 방을 두 번째 눌러도 다시 열리는지.
//
// ChatManagement는 initialRoomId가 바뀔 때만 방을 펴 줬다. 목록으로 나갔다가 같은 방 알림을
// 누르면 값이 같아 effect가 안 돌고 목록에 머물렀다. 누를 때마다 오르는 nonce를 함께 본다.
// 직원 화면의 새 메시지 토스트는 아예 갈 곳이 없었다 — '이동' 버튼이 있어야 한다.
import { read, want, done } from './_lib.mjs';

const WT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');

const cm = read(`${WT}/src/components/ChatManagement.tsx`);
want(/initialRoomNonce\?: number;/.test(cm), 'ChatManagement에 initialRoomNonce prop이 없다');
want(/\}, \[initialRoomId, initialRoomNonce\]\);/.test(cm), '방을 펴는 effect가 nonce를 의존성으로 보지 않는다');

for (const [file, label] of [['src/app/admin/page.tsx', '관리자'], ['src/app/employee/page.tsx', '직원']]) {
  const src = read(`${WT}/${file}`);
  want(/setRailRoomNonce\(\(n\) => n \+ 1\)/.test(src), `${label} 화면: 방을 지목할 때 nonce를 올리지 않는다`);
  want(/initialRoomNonce=\{railRoomNonce\}/.test(src), `${label} 화면: ChatManagement에 nonce를 넘기지 않는다`);
  want(/onOpenRoom=\{openChatRoom\}/.test(src), `${label} 화면: 레일에서 방 열기가 openChatRoom을 쓰지 않는다`);
  want(/showActionToast\(`\$\{room\.name\} — 새로운 메시지가 왔습니다`, \(\) => openChatRoom\(room\.id\)\)/.test(src),
    `${label} 화면: 새 메시지 토스트가 그 방으로 데려가지 않는다`);
}

done('REOPEN_OK');
