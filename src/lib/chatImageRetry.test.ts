/**
 * 사진이 깨져 왔을 때 다시 받는 규칙 — `node --test src/lib/chatImageRetry.test.ts`
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    CHAT_IMAGE_MAX_ATTEMPTS,
    cacheBustedUrl,
    chatImageAttempt,
    proxyPathOf,
} from './chatImageRetry.ts';

const S3 = 'https://dearglobe.s3.ap-northeast-2.amazonaws.com/carev/chat/191/abc.jpg';

test('처음에는 있는 그대로 그린다', () => {
    assert.deepEqual(chatImageAttempt(S3, 0, 111), { kind: 'direct', src: S3 });
});

test('한 번 실패하면 캐시를 건너뛰고 다시 받는다 — 깨진 응답이 캐시에 남으면 새로고침도 소용없다', () => {
    const plan = chatImageAttempt(S3, 1, 111);
    assert.equal(plan.kind, 'reload');
    assert.equal(plan.kind === 'reload' && plan.src, `${S3}?carevRetry=111`);
});

test('두 번 실패하면 같은 출처 프록시로 넘어간다', () => {
    const plan = chatImageAttempt(S3, 2, 111);
    assert.equal(plan.kind, 'proxy');
    assert.equal(plan.kind === 'proxy' && plan.path, S3);
});

test('더 시도하지 않는다 — 무한 재시도로 서버를 두드리지 않는다', () => {
    assert.equal(chatImageAttempt(S3, CHAT_IMAGE_MAX_ATTEMPTS, 111).kind, 'give-up');
    assert.equal(chatImageAttempt(S3, 9, 111).kind, 'give-up');
});

test('주소가 없으면 시도하지 않는다', () => {
    assert.equal(chatImageAttempt('', 0, 111).kind, 'give-up');
});

test('이미 물음표가 붙은 주소에도 안전하게 표시를 더한다', () => {
    assert.equal(cacheBustedUrl('https://x/a.jpg?v=2', 5), 'https://x/a.jpg?v=2&carevRetry=5');
    assert.equal(cacheBustedUrl('https://x/a.jpg', 5), 'https://x/a.jpg?carevRetry=5');
});

test('프록시에 넘길 때 재시도 표시는 떼고 넘긴다 — 그게 붙으면 서버가 다른 파일로 읽는다', () => {
    assert.equal(proxyPathOf(`${S3}?carevRetry=111`), S3);
    assert.equal(proxyPathOf(`${S3}?v=2&carevRetry=111`), `${S3}?v=2`);
    assert.equal(proxyPathOf(`${S3}#anchor`), S3);
    assert.equal(proxyPathOf(S3), S3);
});

test('시도 순서에 같은 수단이 두 번 나오지 않는다', () => {
    const kinds = Array.from({ length: CHAT_IMAGE_MAX_ATTEMPTS }, (_, i) => chatImageAttempt(S3, i, 1).kind);
    assert.deepEqual(kinds, ['direct', 'reload', 'proxy']);
    assert.equal(new Set(kinds).size, kinds.length);
});
