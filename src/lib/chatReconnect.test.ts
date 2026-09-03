/**
 * 재연결 시 놓친 메시지 메우기 규칙 테스트 — `node --test src/lib/chatReconnect.test.ts`
 * (npm 스크립트: `npm run test:chat`)
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    mergeMissedMessages,
    hasMissedMessages,
    readAscendingMessages,
} from './chatReconnect.ts';

interface Msg { id: number; content?: string }

const m = (id: number, content = `m${id}`): Msg => ({ id, content });

test('겹치는 구간이 있으면 id로 합치고 순서를 지킨다', () => {
    const current = [m(1), m(2), m(3)];
    const latest = [m(2), m(3), m(4), m(5)];
    assert.deepEqual(mergeMissedMessages(current, latest).map(x => x.id), [1, 2, 3, 4, 5]);
});

test('겹치는 메시지는 서버 것이 이긴다 — 끊긴 사이의 수정·삭제가 따라온다', () => {
    const current = [m(1, '원래'), m(2, '원래')];
    const latest = [m(2, '고쳐짐'), m(3)];
    const merged = mergeMissedMessages(current, latest);
    assert.equal(merged.find(x => x.id === 2)?.content, '고쳐짐');
    assert.equal(merged.find(x => x.id === 1)?.content, '원래');
});

test('새로 받은 구간이 통째로 더 최신이면(사이가 비면) 억지로 잇지 않는다', () => {
    const current = [m(1), m(2)];
    const latest = [m(50), m(51)];
    // 3~49가 빠져 있다 — 이어붙이면 빠진 구간이 없는 것처럼 보인다
    assert.deepEqual(mergeMissedMessages(current, latest).map(x => x.id), [50, 51]);
});

test('놓친 것이 없으면 목록이 그대로다', () => {
    const current = [m(1), m(2), m(3)];
    const latest = [m(2), m(3)];
    assert.deepEqual(mergeMissedMessages(current, latest).map(x => x.id), [1, 2, 3]);
    assert.equal(hasMissedMessages(current, latest), false);
});

test('빈 목록끼리도 터지지 않는다', () => {
    assert.deepEqual(mergeMissedMessages([], [m(1)]).map(x => x.id), [1]);
    assert.deepEqual(mergeMissedMessages([m(1)], []).map(x => x.id), [1]);
    assert.equal(hasMissedMessages([], []), false);
    assert.equal(hasMissedMessages([], [m(1)]), true);
});

test('더 큰 id가 새로 오면 놓친 것으로 본다', () => {
    assert.equal(hasMissedMessages([m(1), m(2)], [m(2), m(3)]), true);
});

test('응답 래퍼에서 배열을 꺼내 오래된 것부터로 뒤집는다', () => {
    // 서버는 최신순(DESC)으로 준다 — 이 프로젝트의 오랜 규약대로 래퍼 객체다
    assert.deepEqual(readAscendingMessages<Msg>({ messages: [m(3), m(2), m(1)] }).map(x => x.id), [1, 2, 3]);
    assert.deepEqual(readAscendingMessages<Msg>({ content: [m(2), m(1)] }).map(x => x.id), [1, 2]);
    assert.deepEqual(readAscendingMessages<Msg>([m(2), m(1)]).map(x => x.id), [1, 2]);
    assert.deepEqual(readAscendingMessages<Msg>(null), []);
    assert.deepEqual(readAscendingMessages<Msg>({}), []);
});
