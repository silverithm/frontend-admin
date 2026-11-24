import test from 'node:test';
import assert from 'node:assert/strict';
import {
    browseChatFilesLocally,
    formatChatFilesDay,
    formatChatFilesMonth,
    formatChatFileSize,
    groupChatFilesByDay,
    isPagedChatFilesResponse,
    parseChatFilesPage,
    type ChatFileLike,
} from './chatFilesBrowse.ts';

const at = (y: number, mo: number, d: number, h = 9) => new Date(y, mo - 1, d, h).toISOString();

/** 11월: 사진 2·동영상 2(하나는 옛 .MOV)·문서 1, 10월: 사진 2·문서 1 — 섞어서 */
const room: ChatFileLike[] = [
    { id: 5, type: 'IMAGE', mimeType: 'image/jpeg', fileName: 'a.jpg', senderName: '박선영', createdAt: at(2026, 10, 30) },
    { id: 11, type: 'IMAGE', mimeType: 'image/jpeg', fileName: 'b.jpg', senderName: '김민지', createdAt: at(2026, 11, 24, 18) },
    { id: 9, type: 'FILE', mimeType: 'video/mp4', mediaType: 'VIDEO', fileName: '행사.mp4', senderName: '박선영', createdAt: at(2026, 11, 20) },
    { id: 10, type: 'IMAGE', mimeType: 'image/jpeg', fileName: 'c.jpg', senderName: '박선영', createdAt: at(2026, 11, 22) },
    { id: 8, type: 'FILE', fileName: 'IMG_0001.MOV', senderName: '김민지', createdAt: at(2026, 11, 3) },
    { id: 7, type: 'FILE', mimeType: 'application/pdf', fileName: '11월 근무표.pdf', senderName: '김관리', createdAt: at(2026, 11, 2) },
    { id: 4, type: 'IMAGE', mimeType: 'image/jpeg', fileName: 'd.jpg', senderName: '김민지', createdAt: at(2026, 10, 12) },
    { id: 3, type: 'FILE', mimeType: 'application/x-hwp', fileName: '10월 교육 자료.hwp', senderName: '김관리', createdAt: at(2026, 10, 2) },
    { id: 2, type: 'TEXT', senderName: '김관리', createdAt: at(2026, 10, 1) },
];
const ids = (xs: { id: number }[]) => xs.map((x) => x.id);

test('종류별·최신순, 탭 숫자 — 옛 .MOV도 동영상', () => {
    const p = browseChatFilesLocally(room, { kind: 'IMAGE' });
    assert.deepEqual(ids(p.items), [11, 10, 5, 4]);
    assert.deepEqual(p.counts, { IMAGE: 4, VIDEO: 2, FILE: 2 });
    assert.deepEqual(ids(browseChatFilesLocally(room, { kind: 'VIDEO' }).items), [9, 8]);
    assert.deepEqual(ids(browseChatFilesLocally(room, { kind: 'FILE' }).items), [7, 3]);
});

test('검색어는 파일 이름·보낸 사람에서', () => {
    const p = browseChatFilesLocally(room, { kind: 'IMAGE', query: ' 박선영 ' });
    assert.deepEqual(ids(p.items), [10, 5]);
    assert.equal(p.counts.VIDEO, 1);
    assert.deepEqual(ids(browseChatFilesLocally(room, { kind: 'FILE', query: '근무표' }).items), [7]);
});

test('이어 받기·달로 이동', () => {
    const first = browseChatFilesLocally(room, { kind: 'IMAGE', size: 2 });
    assert.deepEqual(ids(first.items), [11, 10]);
    assert.equal(first.hasMore, true);
    const next = browseChatFilesLocally(room, { kind: 'IMAGE', size: 2, beforeId: 10 });
    assert.deepEqual(ids(next.items), [5, 4]);
    assert.equal(next.hasMore, false);
    // 기준 항목이 그 사이 지워졌으면 id로 이어 간다
    assert.deepEqual(ids(browseChatFilesLocally(room, { kind: 'IMAGE', beforeId: 6 }).items), [5, 4]);
    const oct = browseChatFilesLocally(room, { kind: 'IMAGE', month: '2026-10' });
    assert.deepEqual(ids(oct.items), [5, 4]);
    assert.deepEqual(oct.months, [{ month: '2026-11', count: 2 }, { month: '2026-10', count: 2 }]);
});

test('응답 모양 구분과 읽기', () => {
    assert.equal(isPagedChatFilesResponse({ files: [] }), false);
    assert.equal(isPagedChatFilesResponse({ files: [], hasMore: false }), true);
    const p = parseChatFilesPage<{ id: number }>({
        files: [{ id: 1 }],
        hasMore: true,
        counts: { IMAGE: 4922, VIDEO: 468, FILE: 31 },
        months: [{ month: '2026-11', count: 2103 }, { bad: true }],
    });
    assert.deepEqual(ids(p.items), [1]);
    assert.equal(p.hasMore, true);
    assert.deepEqual(p.counts, { IMAGE: 4922, VIDEO: 468, FILE: 31 });
    assert.deepEqual(p.months, [{ month: '2026-11', count: 2103 }]);
});

test('날짜 묶음·이름표', () => {
    const sorted = browseChatFilesLocally(room, { kind: 'IMAGE' }).items;
    const days = groupChatFilesByDay(sorted);
    assert.equal(days.length, 4);
    assert.equal(days[0].items[0].id, 11);
    const now = new Date(2026, 10, 24, 21);
    assert.equal(formatChatFilesDay(new Date(2026, 10, 24), now), '오늘');
    assert.equal(formatChatFilesDay(new Date(2026, 10, 23), now), '어제');
    assert.equal(formatChatFilesDay(new Date(2026, 10, 2), now), '11월 2일 (월)');
    assert.equal(formatChatFilesDay(new Date(2025, 11, 3), now), '2025년 12월 3일 (수)');
    assert.equal(formatChatFilesMonth('2026-11', now), '11월');
    assert.equal(formatChatFilesMonth('2025-12', now), '2025년 12월');
    assert.equal(formatChatFileSize(34000), '33.2 KB');
    assert.equal(formatChatFileSize(undefined), '');
});
