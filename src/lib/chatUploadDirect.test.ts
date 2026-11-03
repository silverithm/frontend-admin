import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chatFilesUploadUrl, postChatFileDirect } from './chatUploadDirect.ts';

type Call = { url: string; auth: string | undefined; body: unknown };

function fakeFetch(statuses: number[]) {
    const calls: Call[] = [];
    const impl = (async (url: string, init: RequestInit) => {
        const headers = (init.headers ?? {}) as Record<string, string>;
        calls.push({ url, auth: headers.Authorization, body: init.body });
        const status = statuses[calls.length - 1] ?? 500;
        return new Response(status === 200 ? '{"id":1}' : '{}', { status });
    }) as unknown as typeof fetch;
    return { impl, calls };
}

test('업로드 주소는 Vercel 프록시(/api/...)가 아니라 백엔드 절대 주소다', () => {
    assert.equal(chatFilesUploadUrl('https://silverithm.site', 174), 'https://silverithm.site/api/v1/chat/rooms/174/files');
    assert.equal(chatFilesUploadUrl('https://silverithm.site/', 7), 'https://silverithm.site/api/v1/chat/rooms/7/files');
});

test('한 번에 성공하면 한 번만 보낸다 — 내 토큰을 실어', async () => {
    const { impl, calls } = fakeFetch([200]);
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(10)]), 'a.mp4');
    const res = await postChatFileDirect(174, form, {
        backendUrl: 'https://silverithm.site',
        getToken: () => 'old',
        refreshToken: async () => assert.fail('갱신하면 안 된다'),
        fetchImpl: impl,
    });
    assert.equal(res.status, 200);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://silverithm.site/api/v1/chat/rooms/174/files');
    assert.equal(calls[0].auth, 'Bearer old');
    assert.equal(calls[0].body, form);
});

test('401이면 토큰을 갱신해 같은 본문으로 한 번 더 보낸다', async () => {
    const { impl, calls } = fakeFetch([401, 200]);
    const form = new FormData();
    const res = await postChatFileDirect(9, form, {
        backendUrl: 'https://silverithm.site',
        getToken: () => 'old',
        refreshToken: async () => 'new',
        fetchImpl: impl,
    });
    assert.equal(res.status, 200);
    assert.deepEqual(calls.map((c) => c.auth), ['Bearer old', 'Bearer new']);
    assert.equal(calls[1].body, form);
});

test('갱신이 안 되면 그 오류를 그대로 던진다', async () => {
    const { impl } = fakeFetch([401]);
    await assert.rejects(
        postChatFileDirect(9, new FormData(), {
            backendUrl: 'https://silverithm.site',
            getToken: () => null,
            refreshToken: async () => { throw new Error('로그인이 필요합니다'); },
            fetchImpl: impl,
        }),
        /로그인이 필요합니다/,
    );
});

test('413 같은 다른 실패는 다시 보내지 않고 그대로 돌려준다', async () => {
    const { impl, calls } = fakeFetch([413]);
    const res = await postChatFileDirect(9, new FormData(), {
        backendUrl: 'https://silverithm.site',
        getToken: () => 't',
        refreshToken: async () => 'n',
        fetchImpl: impl,
    });
    assert.equal(res.status, 413);
    assert.equal(calls.length, 1);
});
