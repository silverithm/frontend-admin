/**
 * 프론트가 부르는 경로마다 중간 프록시가 실제로 있고 그 메서드를 받는지 —
 * `node --test src/lib/proxyRoutes.test.ts` (npm 스크립트: `npm run test:chat`)
 *
 * 왜 이걸 테스트하나: 채팅방 나가기·메시지 수정·이모지 반응·결재 양식 순서가
 * **모두 같은 이유로 죽어 있었다.** 화면도 API 함수도 백엔드도 멀쩡한데
 * 중간 파일이나 메서드만 없어서, 코드를 읽으면 "있는 기능"으로 보이고 눌러야만 404가 난다.
 * 눈으로 세면 또 놓친다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const API_DIR = join(ROOT, 'src', 'app', 'api');

/** fetchWithAuth(`<경로>`, { method: 'X' }) 를 모두 뽑는다. method가 없으면 GET. */
function collectCalls(): { raw: string; method: string }[] {
    const src = readFileSync(join(ROOT, 'src', 'lib', 'apiService.ts'), 'utf8');
    const calls: { raw: string; method: string }[] = [];
    const re = /fetchWithAuth\(\s*`([^`]+)`\s*(?:,\s*\{([\s\S]*?)\n\s{4}\})?/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) {
        calls.push({ raw: m[1], method: (m[2]?.match(/method:\s*'(\w+)'/)?.[1] || 'GET').toUpperCase() });
    }
    return calls;
}

/** [[...path]] / [...path] — 이 아래 경로를 전부 받는 포괄 라우트 */
function catchAllChildOf(dir: string): string | null {
    if (!existsSync(dir)) return null;
    const found = readdirSync(dir).find(n => n.includes('...'));
    return found && existsSync(join(dir, found, 'route.ts')) ? found : null;
}

function dynamicChildOf(dir: string): string | null {
    if (!existsSync(dir)) return null;
    return readdirSync(dir).find(n => n.startsWith('[') && !n.includes('...')) || null;
}

/** 경로 문자열이 닿는 route.ts 를 찾는다. 없으면 null. */
function routeFileFor(raw: string): string | null {
    const segs = raw.split('?')[0].replace(/^\/api/, '').split('/').filter(Boolean);
    let dir = API_DIR;
    for (const seg of segs) {
        const catchAll = catchAllChildOf(dir);
        if (catchAll) return join(dir, catchAll, 'route.ts');

        if (/^\$\{[^}]*\}$/.test(seg)) {
            const found = dynamicChildOf(dir);
            if (!found) return null;
            dir = join(dir, found);
        } else {
            if (!existsSync(join(dir, seg))) return null;
            dir = join(dir, seg);
        }
    }
    const catchAll = catchAllChildOf(dir);
    if (catchAll) return join(dir, catchAll, 'route.ts');
    const file = join(dir, 'route.ts');
    return existsSync(file) ? file : null;
}

/**
 * 화면 어디서도 부르지 않는 함수들 — 프록시가 없어도 사용자가 만날 일이 없다.
 * (각 함수 이름을 src/components·src/app에서 찾으면 apiService 밖 사용처가 0건)
 * 화면에서 쓰기 시작하면 이 줄을 지우고 프록시부터 만든다.
 */
const KNOWN_UNUSED = [
    'PUT /admin/users/${memberId}/fcm-token',
    'GET /admin/join-requests?companyId=${companyId}',
    'GET /admin/users/${id}/profile',
    'PUT /admin/users/${id}/update',
];

const PROXIED_PREFIXES = ['/api', '/v1', '/admin', '/vacation'];

test('프론트가 부르는 모든 경로에 프록시 파일이 있다', () => {
    const missing = collectCalls()
        .filter(c => PROXIED_PREFIXES.some(p => c.raw.startsWith(p)))
        .filter(c => !routeFileFor(c.raw))
        .map(c => `${c.method} ${c.raw}`)
        .filter(x => !KNOWN_UNUSED.includes(x));

    assert.deepEqual(missing, [],
        `프록시 경로가 없는 호출:\n  ${missing.join('\n  ')}\n` +
        '이 경로는 눌렀을 때만 404가 난다 — 백엔드에 닿지도 못한다.');
});

test('프록시가 프론트가 쓰는 메서드를 실제로 받는다', () => {
    const wrong = collectCalls()
        .filter(c => PROXIED_PREFIXES.some(p => c.raw.startsWith(p)))
        .filter(c => {
            const file = routeFileFor(c.raw);
            if (!file) return false;                       // 위 테스트가 잡는다
            const src = readFileSync(file, 'utf8');
            return !new RegExp(`export async function ${c.method}\\b`).test(src);
        })
        .map(c => `${c.method} ${c.raw}`)
        .filter(x => !KNOWN_UNUSED.includes(x));

    assert.deepEqual(wrong, [],
        `프록시가 그 메서드를 안 받는 호출:\n  ${wrong.join('\n  ')}\n` +
        '메시지 수정이 이 형태로 죽어 있었다 — 파일은 있는데 PUT이 없었다.');
});

test('한 번 죽었던 네 경로는 반드시 살아 있다', () => {
    // 실제로 사고가 났던 자리들 — 회귀하면 여기서 먼저 걸린다
    const 사고났던곳: [string, string][] = [
        ['/api/v1/chat/rooms/${roomId}/leave', 'POST'],                       // 채팅방 나가기
        ['/api/v1/chat/rooms/${roomId}/messages/${messageId}', 'PUT'],        // 메시지 수정
        ['/api/v1/chat/rooms/${roomId}/messages/${messageId}/reactions', 'POST'], // 이모지 반응
        ['/api/v1/approval-templates/reorder', 'PUT'],                        // 결재 양식 순서
    ];

    for (const [path, method] of 사고났던곳) {
        const file = routeFileFor(path);
        assert.ok(file, `${method} ${path} 의 프록시 파일이 사라졌다`);
        const src = readFileSync(file!, 'utf8');
        assert.match(src, new RegExp(`export async function ${method}\\b`),
            `${method} ${path} 프록시가 ${method}를 안 받는다`);
    }
});

test('추출이 깨지지 않았다 — 호출을 충분히 찾아낸다', () => {
    // 정규식이 틀어져 0건을 뽑으면 위 테스트가 전부 조용히 통과해 버린다
    assert.ok(collectCalls().length > 50, `호출을 ${collectCalls().length}건밖에 못 뽑았다`);
});
