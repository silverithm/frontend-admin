// G21: 사람 목록에 프로필 사진이 실제로 그려지는지.
//
// SeedAvatar는 사진 URL을 받게 돼 있는데, 부르는 쪽이 안 넘기면 이름 첫 글자만 나온다.
// 사진이 등록돼 있어도 안 뜨니 "왜 사진이 안 뜨냐"가 된다. 눈으로 세지 말고 전수로 본다.
import { readFileSync, existsSync } from 'node:fs';
import { APP, want, done } from './_lib.mjs';

const API = '/Users/gimjunhyeong/Develop/silverithm/api-server';

// 사람을 줄지어 보여주는 화면들 — 여기 SeedAvatar가 있으면 사진도 넘겨야 한다.
const files = [
    'lib/screens/create_chat_room_screen.dart',
    'lib/screens/chat_room_info_screen.dart',
    'lib/screens/chat_room_screen.dart',
    'lib/widgets/chat/chat_member_list.dart',
];

// 방 이름을 쓰는 아바타는 사람이 아니라 방이라 사진이 없다 — 예외로 둔다.
const notAPerson = [/name:\s*room\.name/];

const missing = [];
for (const rel of files) {
    const f = `${APP}/${rel}`;
    if (!existsSync(f)) continue;
    const src = readFileSync(f, 'utf8');
    const re = /SeedAvatar\(([\s\S]{0,260}?)\)/g;
    let m;
    while ((m = re.exec(src)) !== null) {
        const body = m[1];
        if (notAPerson.some((p) => p.test(body))) continue;
        if (!/imageUrl:/.test(body)) {
            const line = src.slice(0, m.index).split('\n').length;
            missing.push(`${rel}:${line}`);
        }
    }
}
want(missing.length === 0,
     `사람 아바타에 사진을 안 넘기는 곳 ${missing.length}곳:\n  ` + missing.join('\n  '));

// 읽은 사람 목록은 서버가 사진을 내려줘야 그릴 수 있다.
const dto = readFileSync(`${API}/src/main/java/com/silverithm/vehicleplacementsystem/dto/ChatMessageReaderDTO.java`, 'utf8');
want(/profileImageUrl/.test(dto), '서버가 읽은 사람의 사진을 안 내려준다');
const svc = readFileSync(`${API}/src/main/java/com/silverithm/vehicleplacementsystem/service/ChatService.java`, 'utf8');
want(/getMessageReaders[\s\S]{0,600}?getParticipantProfileImageUrl/.test(svc),
     '읽은 사람 조회가 사진을 채워 넣지 않는다 — DTO에 자리만 있고 늘 비어 온다');

// 앱 모델이 그 값을 받아야 한다
const model = readFileSync(`${APP}/lib/models/chat_message.dart`, 'utf8');
want(/class ChatMessageReader[\s\S]{0,900}?profileImageUrl:\s*json\['profileImageUrl'\]/.test(model),
     '앱이 읽은 사람의 사진을 읽지 않는다');

// --- 웹: 사람 아바타에 사진을 넘기는지 (앱과 같은 종류의 누락) ---
import { readdirSync, statSync } from 'node:fs';
const WEBSRC = `${process.env.HOME}/Develop/silverithm/frontend-admin/src`;

/** 방·기관 이름을 쓰는 아바타는 사람이 아니라 사진이 없다 */
const webNotAPerson = [
    /name=\{room\.name/, /name=\{companyName/, /name=\{organizationName/,
    /name=\{roomName/,   // 겹친 아바타의 폴백
];
// 사진이 아직 없는 곳 — 이유를 적어 두고, 생기면 이 줄을 지운다
const webKnown = [
    'components/EmployeeCalendar.tsx',  // 휴무 신청자: 서버 휴무 응답에 사진이 없다
];

function walk(dir, out = []) {
    for (const name of readdirSync(dir)) {
        const full = `${dir}/${name}`;
        if (statSync(full).isDirectory()) walk(full, out);
        else if (name.endsWith('.tsx')) out.push(full);
    }
    return out;
}

const webMissing = [];
for (const full of walk(WEBSRC)) {
    const rel = full.slice(WEBSRC.length + 1);
    if (webKnown.some((k) => rel.includes(k))) continue;
    const src = readFileSync(full, 'utf8');
    const re = /<Avatar\b([\s\S]{0,240}?)\/>/g;
    let m;
    while ((m = re.exec(src)) !== null) {
        const body = m[1];
        if (/src=/.test(body)) continue;
        if (webNotAPerson.some((p) => p.test(body))) continue;
        webMissing.push(`${rel}:${src.slice(0, m.index).split('\n').length}`);
    }
}
want(webMissing.length === 0,
     `웹에서 사람 아바타에 사진을 안 넘기는 곳 ${webMissing.length}곳:\n  ` + webMissing.join('\n  '));

done('avatar-photo-ok');
