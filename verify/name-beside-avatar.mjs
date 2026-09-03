// G3a: 이름·직종이 아바타 위가 아니라 옆에 오는지.
//
// 원래 증상: 아바타가 하단 정렬이라 이름줄 아래로 밀려나, 화면에서는
//   배정민 (사무팀장)
//   [말풍선]
//   [아바타]
// 처럼 보였다. 아바타를 이름줄과 같은 높이에 세워야 한다.
//
// 네 가지를 다 본다:
//   (1) 아바타 행이 상단 정렬인가        alignItems: flex-start
//   (2) 아바타가 묶음 첫 메시지에만인가   isGroupStart 조건
//   (3) 이어지는 메시지가 자리를 차지하는가 (안 그러면 말풍선이 왼쪽으로 튄다)
//   (4) 이름과 직종이 한 문단인가        (둘로 나누면 긴 직종이 먼저 잘린다)
import { WEB, read, want, done } from './_lib.mjs';

for (const [file, label] of [
  [`${WEB}/src/components/ChatManagement.tsx`, '관리자 채팅탭'],
  [`${WEB}/src/components/FloatingChat/FloatingChatMessages.tsx`, '플로팅·레일 공용'],
]) {
  const src = read(file);

  // (1) 말풍선 행이 상단 정렬이어야 아바타가 이름줄 옆에 선다.
  want(!/alignItems:\s*["']flex-end["'][\s\S]{0,300}?<Avatar/.test(src),
       `${label}: 아바타 행이 하단 정렬이라 아바타가 이름 아래로 밀린다`);

  // (2)(3) 아바타는 묶음 첫 메시지에만, 나머지는 같은 폭의 빈 자리.
  want(/isGroupStart\s*\?[\s\S]{0,400}?<Avatar/.test(src),
       `${label}: 아바타를 묶음 첫 메시지에만 그리지 않는다`);
  want(/isGroupStart\s*\?[\s\S]{0,600}?width:\s*\d+[\s\S]{0,120}?aria-hidden/.test(src),
       `${label}: 이어지는 메시지가 아바타 폭을 비워두지 않아 말풍선이 어긋난다`);

  // (4) 이름과 직종이 한 문단.
  want(/senderName\}[\s\S]{0,120}?senderPosition\s*\?/.test(src),
       `${label}: 이름과 직종이 한 문단이 아니다 — 긴 직종이 먼저 잘린다`);

  // 이름줄도 묶음 첫 메시지에만.
  want(/!isMyMessage\s*&&\s*isGroupStart\s*&&/.test(src),
       `${label}: 이름줄이 메시지마다 반복된다`);
}

// 두 화면이 같은 규칙을 써야 한다 — 규칙이 흩어지면 한쪽만 고쳐진다.
const lib = read(`${WEB}/src/lib/chatMessageGrouping.ts`);
want(/showSenderHeader/.test(lib), '그룹 판정이 공용 규칙 파일에 없다');
want(/markSenderHeaders/.test(lib), '보낸 사람 묶음 판정 함수가 없다');

done('name-beside-avatar-ok');
