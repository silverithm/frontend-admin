// G18: 프론트가 부르는 /api 경로마다 프록시 라우트가 실제로 있고, 그 메서드를 받는지.
//
// 나가기·메시지 수정·반응이 모두 이 한 가지 이유로 죽어 있었다. 화면도 API 함수도 백엔드도
// 멀쩡한데 중간 프록시 파일이나 메서드만 없어서, 코드를 읽으면 "있는 기능"으로 보이고
// 눌러야만 404가 난다. 세 번 같은 사고가 났으니 눈으로 세지 말고 전수로 본다.
import { existsSync, readFileSync } from 'node:fs';
import { WEB, read, want, done } from './_lib.mjs';

const api = read(`${WEB}/src/lib/apiService.ts`);

// fetchWithAuth(`<경로>`, { method: 'X' }) 를 모두 뽑는다. method가 없으면 GET이다.
const calls = [];
const re = /fetchWithAuth\(\s*`([^`]+)`\s*(?:,\s*\{([\s\S]*?)\n\s{4}\})?/g;
let m;
while ((m = re.exec(api)) !== null) {
    const method = (m[2]?.match(/method:\s*'(\w+)'/)?.[1] || 'GET').toUpperCase();
    calls.push({ raw: m[1], method });
}
want(calls.length > 50, `호출을 ${calls.length}건밖에 못 뽑았다 — 추출이 깨졌다`);

/** 경로 문자열을 프록시 파일 경로로 바꾼다. `${x}` 자리는 [param] 폴더가 받는다. */
function routeFileFor(raw) {
    const path = raw.split('?')[0].replace(/^\/api/, '');
    const segs = path.split('/').filter(Boolean);
    // 세그먼트 전체가 보간이면 동적 폴더다. 실제 폴더 이름은 알 수 없으므로 글롭 대신
    // 후보를 직접 훑는다.
    return segs;
}

function findRoute(segs) {
    let dir = `${WEB}/src/app/api`;
    for (let i = 0; i < segs.length; i++) {
        const seg = segs[i];
        // 포괄 라우트([[...path]] / [...path])가 있으면 이 아래는 전부 그 파일이 받는다
        const catchAll = catchAllChildOf(dir);
        if (catchAll) return `${dir}/${catchAll}/route.ts`;

        if (/^\$\{[^}]*\}$/.test(seg)) {
            const found = dynamicChildOf(dir);
            if (!found) return null;
            dir = `${dir}/${found}`;
        } else {
            if (!existsSync(`${dir}/${seg}`)) return null;
            dir = `${dir}/${seg}`;
        }
    }
    const catchAll = catchAllChildOf(dir);
    if (catchAll) return `${dir}/${catchAll}/route.ts`;
    const file = `${dir}/route.ts`;
    return existsSync(file) ? file : null;
}

import { readdirSync } from 'node:fs';
function dynamicChildOf(dir) {
    if (!existsSync(dir)) return null;
    return readdirSync(dir).find((n) => n.startsWith('[') && !n.includes('...')) || null;
}

/** [[...path]] 또는 [...path] — 이 아래 경로를 전부 받는 포괄 라우트 */
function catchAllChildOf(dir) {
    if (!existsSync(dir)) return null;
    const found = readdirSync(dir).find((n) => n.includes('...'));
    if (!found) return null;
    return existsSync(`${dir}/${found}/route.ts`) ? found : null;
}

const missing = [];
const wrongMethod = [];
for (const call of calls) {
    if (!call.raw.startsWith('/api') && !call.raw.startsWith('/v1') && !call.raw.startsWith('/admin')
        && !call.raw.startsWith('/vacation')) continue;
    const segs = routeFileFor(call.raw);
    const file = findRoute(segs);
    if (!file) { missing.push(`${call.method} ${call.raw}`); continue; }
    const src = readFileSync(file, 'utf8');
    if (!new RegExp(`export async function ${call.method}\\b`).test(src)) {
        wrongMethod.push(`${call.method} ${call.raw} → ${file.replace(WEB + '/', '')}`);
    }
}

// 화면 어디서도 부르지 않는 함수들이다 — 프록시가 없어도 사용자가 만날 일이 없다.
// (전수 확인: 각 함수 이름을 src/components·src/app에서 찾으면 apiService 밖 사용처가 0건)
// 지우는 게 맞지만 다른 작업자가 쓰려고 남겨 뒀을 수 있어 이 목록으로만 눌러 둔다.
// 화면에서 쓰기 시작하면 이 줄을 지우고 프록시부터 만든다.
const known = [
    'PUT /admin/users/${memberId}/fcm-token',   // updateFcmToken — 앱이 직접 부르고 웹은 안 쓴다
    'GET /admin/join-requests?companyId=${companyId}',  // getAllJoinRequests — 화면은 getPendingJoinRequests를 쓴다
    'GET /admin/users/${id}/profile',
    'PUT /admin/users/${id}/update',
];

const realMissing = missing.filter((x) => !known.includes(x));
want(realMissing.length === 0,
     `프록시 경로가 없는 호출 ${realMissing.length}건:\n  ` + realMissing.join('\n  '));
want(wrongMethod.length === 0,
     `프록시가 그 메서드를 안 받는 호출 ${wrongMethod.length}건:\n  ` + wrongMethod.join('\n  '));

done('proxy-routes-ok');
