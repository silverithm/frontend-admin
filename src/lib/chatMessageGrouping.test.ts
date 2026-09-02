/**
 * 사진 묶음 규칙 테스트 — `node --test src/lib/chatMessageGrouping.test.ts`
 * (npm 스크립트: `npm run test:chat`)
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildChatRenderItems,
    PHOTO_GROUP_MAX_COUNT,
    PHOTO_GROUP_MAX_GAP_MS,
    type GroupableChatMessage,
} from './chatMessageGrouping.ts';

let nextId = 1;

/** 사진 한 장 — createdAt은 'YYYY-MM-DDTHH:mm:ss' 로컬 시간 문자열 */
function photo(createdAt: string, senderId = 'u1', extra: Partial<GroupableChatMessage> = {}): GroupableChatMessage {
    return {
        id: nextId++,
        senderId,
        type: 'IMAGE',
        createdAt,
        isDeleted: false,
        fileUrl: `https://cdn.test/${nextId}.jpg`,
        fileName: `${nextId}.jpg`,
        ...extra,
    };
}

function textMessage(createdAt: string, senderId = 'u1'): GroupableChatMessage {
    return { id: nextId++, senderId, type: 'TEXT', createdAt, isDeleted: false };
}

function video(createdAt: string, senderId = 'u1'): GroupableChatMessage {
    return {
        id: nextId++,
        senderId,
        type: 'FILE',
        createdAt,
        isDeleted: false,
        fileUrl: 'https://cdn.test/clip.mp4',
        fileName: 'clip.mp4',
        mediaType: 'VIDEO',
    };
}

test('같은 사람이 연속으로 보낸 사진 3장은 한 묶음', () => {
    const items = buildChatRenderItems([
        photo('2026-09-01T10:00:00'),
        photo('2026-09-01T10:00:05'),
        photo('2026-09-01T10:00:10'),
    ]);
    assert.equal(items.length, 1);
    assert.equal(items[0].kind, 'photos');
    assert.equal(items[0].kind === 'photos' ? items[0].messages.length : 0, 3);
});

test('사이에 글이 끼면 안 묶인다', () => {
    const items = buildChatRenderItems([
        photo('2026-09-01T10:00:00'),
        photo('2026-09-01T10:00:05'),
        textMessage('2026-09-01T10:00:07'),
        photo('2026-09-01T10:00:09'),
        photo('2026-09-01T10:00:11'),
    ]);
    assert.deepEqual(items.map(i => i.kind), ['photos', 'single', 'photos']);
});

test('보낸 사람이 다르면 안 묶인다', () => {
    const items = buildChatRenderItems([
        photo('2026-09-01T10:00:00', 'u1'),
        photo('2026-09-01T10:00:02', 'u2'),
    ]);
    assert.deepEqual(items.map(i => i.kind), ['single', 'single']);
});

test('60초를 넘기면 끊긴다', () => {
    const items = buildChatRenderItems([
        photo('2026-09-01T10:00:00'),
        photo('2026-09-01T10:01:00'), // 정확히 60초 — 아직 같은 묶음
        photo('2026-09-01T10:02:01'), // 61초 — 새 묶음
        photo('2026-09-01T10:02:05'),
    ]);
    assert.equal(PHOTO_GROUP_MAX_GAP_MS, 60_000);
    assert.deepEqual(items.map(i => i.kind), ['photos', 'photos']);
    assert.equal(items[0].kind === 'photos' ? items[0].messages.length : 0, 2);
    assert.equal(items[1].kind === 'photos' ? items[1].messages.length : 0, 2);
});

test('날짜가 바뀌면 끊긴다', () => {
    const items = buildChatRenderItems([
        photo('2026-09-01T23:59:40'),
        photo('2026-09-02T00:00:10'), // 30초 차이지만 날짜가 다르다
    ]);
    assert.equal(items.length, 2);
    assert.equal(items[0].kind, 'single');
    assert.equal(items[1].kind, 'single');
    assert.equal(items[1].showDateSeparator, true);
});

test('9장을 넘기면 새 묶음이 시작된다', () => {
    const photos = Array.from({ length: 11 }, (_, i) =>
        photo(`2026-09-01T10:00:${String(i).padStart(2, '0')}`),
    );
    const items = buildChatRenderItems(photos);
    assert.equal(PHOTO_GROUP_MAX_COUNT, 9);
    assert.deepEqual(items.map(i => i.kind), ['photos', 'photos']);
    assert.equal(items[0].kind === 'photos' ? items[0].messages.length : 0, 9);
    assert.equal(items[1].kind === 'photos' ? items[1].messages.length : 0, 2);
});

test('사진 1장은 묶음이 아니라 single', () => {
    const items = buildChatRenderItems([photo('2026-09-01T10:00:00')]);
    assert.equal(items.length, 1);
    assert.equal(items[0].kind, 'single');
});

test('동영상은 사진 묶음에 들어가지 않는다', () => {
    const items = buildChatRenderItems([
        photo('2026-09-01T10:00:00'),
        video('2026-09-01T10:00:02'),
        photo('2026-09-01T10:00:04'),
    ]);
    assert.deepEqual(items.map(i => i.kind), ['single', 'single', 'single']);
});

test('삭제된 사진은 묶이지 않는다', () => {
    const items = buildChatRenderItems([
        photo('2026-09-01T10:00:00'),
        photo('2026-09-01T10:00:02', 'u1', { isDeleted: true }),
        photo('2026-09-01T10:00:04'),
    ]);
    assert.deepEqual(items.map(i => i.kind), ['single', 'single', 'single']);
});

test('날짜 구분선 계산이 묶음 뒤에도 어긋나지 않는다', () => {
    const items = buildChatRenderItems([
        photo('2026-09-01T10:00:00'),
        photo('2026-09-01T10:00:02'),
        photo('2026-09-01T10:00:04'),
        textMessage('2026-09-01T11:00:00'),
        photo('2026-09-02T09:00:00'),
        photo('2026-09-02T09:00:02'),
        textMessage('2026-09-02T09:30:00'),
    ]);
    assert.deepEqual(items.map(i => i.kind), ['photos', 'single', 'photos', 'single']);
    assert.deepEqual(items.map(i => i.showDateSeparator), [true, false, true, false]);
});
