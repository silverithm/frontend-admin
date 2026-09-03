// G22: 채팅방 목록 아이콘에 참여자 얼굴이 카톡처럼 모여 나오는지.
//
// 사람 수마다 칸을 다르게 나눠야 한다. 넷을 넘으면 앞의 넷만 — 더 넣으면 알아볼 수 없다.
// 서버가 목록에 얼굴을 실어 주지 않으면 앱이 아무리 잘 그려도 빈 원만 나온다.
import { readFileSync, existsSync } from 'node:fs';
import { APP, want, done } from './_lib.mjs';

const API = '/Users/gimjunhyeong/Develop/silverithm/api-server';

// --- 앱: 위젯이 사람 수별로 갈라지는지 ---
const w = `${APP}/lib/widgets/chat/chat_room_avatar_stack.dart`;
want(existsSync(w), '겹친 아바타 위젯이 없다');
const src = readFileSync(w, 'utf8');
want(/take\(4\)/.test(src), '넷을 넘는 방에서 앞의 넷만 쓰지 않는다');
for (const n of ['case 2:', 'case 3:']) {
    want(src.includes(n), `사람 수 ${n.replace(/\D/g, '')}명 배치가 없다 — 수와 상관없이 같게 그리면 균형이 깨진다`);
}
want(/people\.length == 1/.test(src), '한 명일 때 나누지 않고 통으로 그리는 처리가 없다');
want(/people\.isEmpty/.test(src), '참여자를 못 받았을 때 방 이름으로 그리는 대비가 없다');
want(/errorBuilder/.test(src), '사진이 안 열릴 때 칸이 비어 버린다');

// --- 앱: 목록이 실제로 그 위젯을 쓰는지 ---
const list = readFileSync(`${APP}/lib/screens/chat_room_list_screen.dart`, 'utf8');
want(/ChatRoomAvatarStack\(/.test(list), '채팅방 목록이 겹친 아바타를 쓰지 않는다');
want(/avatars:\s*room\.avatars/.test(list), '목록이 방의 참여자 얼굴을 넘기지 않는다');

// --- 앱: 모델이 서버 값을 받는지 ---
const model = readFileSync(`${APP}/lib/models/chat_room.dart`, 'utf8');
want(/avatars:\s*json\['avatars'\]/.test(model), '앱이 서버가 준 얼굴을 읽지 않는다');

// --- 서버: 목록에 얼굴을 실어 주는지 ---
const svc = readFileSync(`${API}/src/main/java/com/silverithm/vehicleplacementsystem/service/ChatService.java`, 'utf8');
want(/dto\.setAvatars\(/.test(svc), '서버 방 목록이 얼굴을 채우지 않는다');
want(/AVATAR_PREVIEW_LIMIT/.test(svc), '서버가 얼굴 수를 제한하지 않는다');

// --- 서버: 방·사람 수만큼 쿼리가 늘지 않는지 (예전에 목록 31→6으로 줄인 걸 되돌리면 안 된다) ---
const helper = svc.slice(svc.indexOf('private Map<Long, List<ChatRoomAvatarDTO>> roomAvatars'));
const body = helper.slice(0, helper.indexOf('\n    private ', 10));
want(!/findChatUser\(|getParticipantProfileImageUrl\(/.test(body),
     '참가자마다 사진을 따로 조회한다 — 사람 수만큼 쿼리가 나가 목록이 느려진다');
want(/findAvatarRowsByRoomIds/.test(body),
     '참가자와 사진을 한 쿼리로 잇지 않는다 — 나눠 물으면 목록 조회가 한 번 더 늘어난다');

// --- 웹: 앱과 같은 규칙으로 그리는지 ---
const WEB = `${process.env.HOME}/Develop/silverithm/frontend-admin`;
const web = readFileSync(`${WEB}/src/components/chat/ChatRoomAvatarStack.tsx`, 'utf8');
want(/slice\(0, 4\)/.test(web), '웹이 넷을 넘는 방에서 앞의 넷만 쓰지 않는다');
want(/count === 2/.test(web) && /count === 3/.test(web),
     '웹이 사람 수별로 칸을 나누지 않는다 — 수와 상관없이 같게 그리면 균형이 깨진다');
want(/onError=/.test(web), '웹에서 사진이 안 열릴 때 칸이 비어 버린다');

const rail = readFileSync(`${WEB}/src/components/ChatRail/ChatRail.tsx`, 'utf8');
want(/<ChatRoomAvatarStack/.test(rail), '웹 채팅 레일이 겹친 아바타를 쓰지 않는다');
const mgmt = readFileSync(`${WEB}/src/components/ChatManagement.tsx`, 'utf8');
want(/<ChatRoomAvatarStack/.test(mgmt), '웹 채팅 탭 목록이 겹친 아바타를 쓰지 않는다');

done('room-avatar-ok');
