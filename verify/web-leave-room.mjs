// G7a: 웹에서 채팅방 나가기에 실제로 도달할 수 있는지.
//
// 처음엔 "웹에 기능이 없다"고 봤는데 아니었다. 방 머리의 작은 ⋯ 안에 있었고,
// 앱은 세 곳(목록 길게 누르기·방 ⋯·정보 화면)에서 나갈 수 있다. 하나뿐인 입구가
// 눈에 안 띄면 "컴퓨터로는 안 된다"가 된다. 그래서 도달 경로 수까지 본다.
import { WEB, APP, read, want, done } from './_lib.mjs';

const appApi = read(`${APP}/lib/services/api_service.dart`);
want(/leave|나가기/i.test(appApi), '기준으로 삼을 앱 나가기 API를 못 찾았다');

const webApi = read(`${WEB}/src/lib/apiService.ts`);
want(/leaveChatRoom/.test(webApi), '웹 API에 채팅방 나가기가 없다');

const ui = read(`${WEB}/src/components/ChatManagement.tsx`);
want(/leaveChatRoom\(/.test(ui), '웹 화면이 나가기를 실제로 호출하지 않는다');

// 실제 버그는 여기였다 — 화면·API 함수는 멀쩡한데 중간 프록시 경로 파일이 없어 404가 났다.
import { existsSync } from 'node:fs';
want(existsSync(`${WEB}/src/app/api/v1/chat/rooms/[roomId]/leave/route.ts`),
     '나가기 프록시 경로가 없다 — 요청이 백엔드에 닿기 전에 404가 난다');

// 입구가 둘 이상이어야 한다: 방 머리의 ⋯, 그리고 목록 행.
const entries = (ui.match(/label="채팅방 나가기"/g) || []).length;
want(entries >= 2,
     `나가기 입구가 ${entries}곳뿐이다 — 방을 열어야만 나갈 수 있으면 목록에서는 없는 기능으로 보인다`);

// 목록 행에서 여는 입구가 실제로 목록 쪽인지 (방 머리 메뉴를 두 번 센 게 아닌지)
want(/className="carev-chat-roomrow"/.test(ui), '목록 행에 메뉴를 여는 자리가 없다');
want(/onContextMenu=\{\(e\) => \{ e\.preventDefault\(\); setRoomMenuId\(room\.id\); \}\}/.test(ui),
     '목록 행에서 오른쪽 버튼으로 메뉴가 열리지 않는다');
want(/roomMenuId === room\.id/.test(ui), '목록 행 메뉴가 그 행에 묶여 있지 않다');

// 손가락으로 쓰는 화면에서 ⋯가 숨은 채로 남으면 도달 경로가 도로 하나가 된다
const css = read(`${WEB}/src/app/globals.css`);
want(/@media \(hover: none\)[\s\S]{0,120}carev-chat-roomrow-actions[\s\S]{0,60}opacity:\s*1/.test(css),
     'hover가 없는 기기에서 목록 ⋯가 계속 숨어 있다');

done('web-leave-ok');
