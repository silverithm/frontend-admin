import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chatAvatarLayout } from './chatAvatarLayout.ts';

test('사람 수대로 칸을 나눈다 — 넷을 넘으면 넷', () => {
    assert.deepEqual([0, 1, 2, 3, 4, 5, 12].map((n) => chatAvatarLayout(n).count), [1, 1, 2, 3, 4, 4, 4]);
});

test('한 명은 원 하나를 통째로 쓴다', () => {
    const l = chatAvatarLayout(1);
    assert.equal(l.grid, null);
    assert.deepEqual(l.cells, [{ size: 'whole' }]);
});

test('세 명은 왼쪽 하나가 크고 오른쪽 둘이 위아래로', () => {
    const l = chatAvatarLayout(3);
    assert.equal(l.grid?.areas, '"a b" "a c"');
    assert.deepEqual(l.cells.map((c) => [c.area, c.size]), [['a', 'half'], ['b', 'quarter'], ['c', 'quarter']]);
});

test('네 명 이상은 2×2 네 칸', () => {
    const l = chatAvatarLayout(7);
    assert.equal(l.grid?.columns, '1fr 1fr');
    assert.equal(l.grid?.rows, '1fr 1fr');
    assert.equal(l.cells.length, 4);
    assert.ok(l.cells.every((c) => c.size === 'quarter'));
});
