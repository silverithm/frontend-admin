// 프로필 사진을 바꾸면 우측 상태표시창(채팅 레일)이 바로 따라오는가.
//
// 인원 명단은 기관별로 한 번만 받아 캐시한다. 회원관리 화면은 바꾼 뒤 강제로 다시 받는데,
// 정작 본인 사진을 바꾸는 정보관리 화면은 그러지 않아 "프로필 업데이트 했는데 오른쪽
// 상태표시창에 반영이 안 된다"는 말이 나왔다 — 새로고침을 눌러야 바뀌는 건 바뀐 게 아니다.
import { WEB, read, want, done } from './_lib.mjs';

const page = read(`${WEB}/src/app/admin/organization-profile/page.tsx`);
const store = read(`${WEB}/src/lib/orgPresenceStore.ts`);

// 사진을 올린 뒤·지운 뒤 둘 다 명단을 다시 받아야 한다 (지운 뒤 옛 사진이 남으면 같은 문제다)
const upload = page.slice(page.indexOf('const handleProfileImageSelect'), page.indexOf('const handleProfileImageDelete'));
const remove = page.slice(page.indexOf('const handleProfileImageDelete'));

want(/refreshOrgMembers\(\)/.test(upload), '사진을 올린 뒤 인원 명단을 다시 받지 않는다 — 레일에 옛 사진이 남는다');
want(/refreshOrgMembers\(\)/.test(remove), '사진을 지운 뒤 인원 명단을 다시 받지 않는다 — 레일에 지운 사진이 남는다');

// 강제 옵션 없이 부르면 캐시가 그대로라 아무 일도 일어나지 않는다
want(
    /useOrgPresenceStore\.getState\(\)\.load\([^)]*\{\s*force:\s*true\s*\}\)/.test(page),
    '명단을 force 없이 부른다 — 이미 받아둔 캐시가 그대로 남는다',
);

// 스토어가 force를 실제로 존중하는지 (옵션만 받고 무시하면 위 검사가 거짓 통과한다)
want(
    /const force = options\?\.force \?\? false;/.test(store) && /if \(!force && isSameCompany/.test(store),
    '인원 명단 스토어가 force를 존중하지 않는다',
);

done('프로필 사진 반영 확인');
