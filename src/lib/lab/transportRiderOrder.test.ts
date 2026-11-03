import { test } from 'node:test';
import assert from 'node:assert/strict';
import { doneFirst, isRiderDone, mergePickedRiders, placeRider } from './transportRiderOrder.ts';

const r = (id: number, boardTime = '', alightTime = '', boarded = true) => ({ elderlyId: id, boarded, boardTime, alightTime });
const ids = (list: { elderlyId: number }[]) => list.map((x) => x.elderlyId);

test('등원은 승차 시각, 하원은 하차 시각을 적으면 끝 — 타지 않은 분도 끝', () => {
  assert.equal(isRiderDone(r(1, '08:10'), 'PICKUP'), true);
  assert.equal(isRiderDone(r(1, '', '16:40'), 'PICKUP'), false);
  assert.equal(isRiderDone(r(1, '', '16:40'), 'DROPOFF'), true);
  assert.equal(isRiderDone(r(1, '08:10'), 'DROPOFF'), false);
  assert.equal(isRiderDone(r(1, '', '', false), 'PICKUP'), true);
});

test('막 적은 분은 끝난 묶음 끝으로 올라가고, 다음에 적을 분이 바로 그 아래에 온다', () => {
  // 명단 1~5, 실제로는 4 → 2 순서로 태웠다
  let list = [r(1), r(2), r(3), r(4), r(5)];
  list = placeRider(list, r(4, '08:05'), 'PICKUP');
  assert.deepEqual(ids(list), [4, 1, 2, 3, 5]);
  list = placeRider(list, r(2, '08:12'), 'PICKUP');
  assert.deepEqual(ids(list), [4, 2, 1, 3, 5]);
});

test('메모만 고치거나 이미 적은 시각을 바꾸면 줄이 튀지 않는다', () => {
  const list = [r(4, '08:05'), r(2, '08:12'), r(1), r(3)];
  assert.deepEqual(ids(placeRider(list, { ...r(4, '08:06') }, 'PICKUP')), [4, 2, 1, 3]);
  assert.deepEqual(ids(placeRider(list, { ...r(3), boardTime: '' }, 'PICKUP')), [4, 2, 1, 3]);
});

test('적은 시각을 지우면 안 끝난 묶음 맨 앞으로 돌아간다', () => {
  const list = [r(4, '08:05'), r(2, '08:12'), r(1), r(3)];
  assert.deepEqual(ids(placeRider(list, r(4), 'PICKUP')), [2, 4, 1, 3]);
});

test('불러온 일지는 끝난 분부터 — 같은 묶음 안의 순서는 그대로', () => {
  assert.deepEqual(ids(doneFirst([r(1), r(2, '08:01'), r(3), r(4, '08:03')], 'PICKUP')), [2, 4, 1, 3]);
});

test('고르기에서 명단을 바꿔도 적어 둔 순서는 그대로, 새로 고른 분은 맨 뒤', () => {
  const list = [r(4, '08:05'), r(2, '08:12'), r(1), r(3)];
  const next = mergePickedRiders(list, [1, 2, 3, 4, 9].sort(), (id) => r(id));
  assert.deepEqual(ids(next), [4, 2, 1, 3, 9]);
  assert.deepEqual(ids(mergePickedRiders(list, [3, 4], (id) => r(id))), [4, 3]);
});
