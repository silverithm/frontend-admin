/**
 * 요양원(노인요양시설·노인요양공동생활가정) 인력배치 계산 — `node --test src/lib/ltcNursingHomeStaffing.test.ts`
 *
 * 기대값은 원문 규칙을 손으로 적용한 값이다(코드에서 베끼지 않는다).
 * - 별표 4 제6호: 노인요양시설 요양보호사 2.1명당 1명(치매전담실 2명당), 공동생활가정 3명당(치매전담형 2.5명당),
 *   입소자 30명 이상이면 간호사 또는 간호조무사·조리원 25명당 1명, 사무국장·사무원·관리인은 50명 이상일 때 1명
 * - 개정 전 2.3명당 1명: 고시 제66조제4항(제44조제1항제2호 급여비용 산정 시 요양보호사 감액 기준)
 * - 고시 제44조제1항·제48조제1항: 소수점 이하 반올림, 0.5 미만이면 기본 1명
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { nursingHomeExample, requiredStaff, staffBands } from './ltcNursingHomeStaffing.ts';

test('노인요양시설 — 2.1명당 1명, 반올림', () => {
  // 10/2.1 = 4.76 → 5, 11/2.1 = 5.24 → 5, 12/2.1 = 5.71 → 6
  assert.equal(requiredStaff(10, 'nursingHome'), 5);
  assert.equal(requiredStaff(11, 'nursingHome'), 5);
  assert.equal(requiredStaff(12, 'nursingHome'), 6);
  // 22/2.1 = 10.48 → 10, 23/2.1 = 10.95 → 11
  assert.equal(requiredStaff(22, 'nursingHome'), 10);
  assert.equal(requiredStaff(23, 'nursingHome'), 11);
  // 29/2.1 = 13.81 → 14, 30/2.1 = 14.29 → 14, 31/2.1 = 14.76 → 15
  assert.equal(requiredStaff(29, 'nursingHome'), 14);
  assert.equal(requiredStaff(30, 'nursingHome'), 14);
  assert.equal(requiredStaff(31, 'nursingHome'), 15);
  // 50/2.1 = 23.81 → 24, 70/2.1 = 33.33 → 33, 100/2.1 = 47.62 → 48
  assert.equal(requiredStaff(50, 'nursingHome'), 24);
  assert.equal(requiredStaff(70, 'nursingHome'), 33);
  assert.equal(requiredStaff(100, 'nursingHome'), 48);
});

test('개정 전 2.3명당 1명 — 제66조제4항 감액 기준', () => {
  // 30/2.3 = 13.04 → 13, 50/2.3 = 21.74 → 22, 70/2.3 = 30.43 → 30, 100/2.3 = 43.48 → 43
  assert.equal(requiredStaff(30, 'nursingHomeBefore2025'), 13);
  assert.equal(requiredStaff(50, 'nursingHomeBefore2025'), 22);
  assert.equal(requiredStaff(70, 'nursingHomeBefore2025'), 30);
  assert.equal(requiredStaff(100, 'nursingHomeBefore2025'), 43);
});

test('치매전담실 — 2명당 1명, 정확히 .5는 올린다', () => {
  // 1/2 = 0.5 → 1, 3/2 = 1.5 → 2, 13/2 = 6.5 → 7, 16/2 = 8
  assert.equal(requiredStaff(1, 'dementiaUnit'), 1);
  assert.equal(requiredStaff(3, 'dementiaUnit'), 2);
  assert.equal(requiredStaff(13, 'dementiaUnit'), 7);
  assert.equal(requiredStaff(16, 'dementiaUnit'), 8);
});

test('노인요양공동생활가정 — 3명당 1명, 치매전담형 2.5명당 1명', () => {
  // 5/3 = 1.67 → 2, 7/3 = 2.33 → 2, 8/3 = 2.67 → 3, 9/3 = 3
  assert.equal(requiredStaff(5, 'groupHome'), 2);
  assert.equal(requiredStaff(7, 'groupHome'), 2);
  assert.equal(requiredStaff(8, 'groupHome'), 3);
  assert.equal(requiredStaff(9, 'groupHome'), 3);
  // 5/2.5 = 2, 6/2.5 = 2.4 → 2, 7/2.5 = 2.8 → 3, 8/2.5 = 3.2 → 3, 9/2.5 = 3.6 → 4
  assert.equal(requiredStaff(5, 'groupHomeDementia'), 2);
  assert.equal(requiredStaff(6, 'groupHomeDementia'), 2);
  assert.equal(requiredStaff(7, 'groupHomeDementia'), 3);
  assert.equal(requiredStaff(8, 'groupHomeDementia'), 3);
  assert.equal(requiredStaff(9, 'groupHomeDementia'), 4);
  // 1/3 = 0.33 → 0.5 미만이라 기본 1명
  assert.equal(requiredStaff(1, 'groupHome'), 1);
});

test('간호사 또는 간호조무사·조리원 — 25명당 1명', () => {
  // 30/25 = 1.2 → 1, 37/25 = 1.48 → 1, 38/25 = 1.52 → 2, 62/25 = 2.48 → 2, 63/25 = 2.52 → 3, 87/25 = 3.48 → 3, 88/25 = 3.52 → 4
  assert.equal(requiredStaff(30, 'perTwentyFive'), 1);
  assert.equal(requiredStaff(37, 'perTwentyFive'), 1);
  assert.equal(requiredStaff(38, 'perTwentyFive'), 2);
  assert.equal(requiredStaff(62, 'perTwentyFive'), 2);
  assert.equal(requiredStaff(63, 'perTwentyFive'), 3);
  assert.equal(requiredStaff(87, 'perTwentyFive'), 3);
  assert.equal(requiredStaff(88, 'perTwentyFive'), 4);
});

test('입소자 수가 1 미만이거나 정수가 아니면 계산하지 않는다', () => {
  assert.throws(() => requiredStaff(0, 'nursingHome'), RangeError);
  assert.throws(() => requiredStaff(30.5, 'nursingHome'), RangeError);
});

test('구간 묶음 — 노인요양시설 10~100명', () => {
  const bands = staffBands('nursingHome', 10, 100);
  assert.deepEqual(bands.slice(0, 3), [
    { from: 10, to: 11, staff: 5 },
    { from: 12, to: 13, staff: 6 },
    { from: 14, to: 15, staff: 7 },
  ]);
  // 20/2.1 = 9.52 → 10, 22/2.1 = 10.48 → 10
  assert.ok(bands.some((b) => b.from === 20 && b.to === 22 && b.staff === 10));
  // 28/2.1 = 13.33 → 13, 29 → 14, 30 → 14, 31 → 15
  assert.ok(bands.some((b) => b.from === 29 && b.to === 30 && b.staff === 14));
  // 97/2.1 = 46.19 → 46, 98/2.1 = 46.67 → 47, 99/2.1 = 47.14 → 47, 100 → 48
  assert.deepEqual(bands.slice(-2), [
    { from: 98, to: 99, staff: 47 },
    { from: 100, to: 100, staff: 48 },
  ]);
  for (let i = 1; i < bands.length; i += 1) {
    assert.equal(bands[i].from, bands[i - 1].to + 1);
    assert.equal(bands[i].staff, bands[i - 1].staff + 1);
  }
});

test('구간 묶음 — 치매전담실 1~16명, 공동생활가정 5~9명', () => {
  assert.deepEqual(staffBands('dementiaUnit', 1, 16), [
    { from: 1, to: 2, staff: 1 },
    { from: 3, to: 4, staff: 2 },
    { from: 5, to: 6, staff: 3 },
    { from: 7, to: 8, staff: 4 },
    { from: 9, to: 10, staff: 5 },
    { from: 11, to: 12, staff: 6 },
    { from: 13, to: 14, staff: 7 },
    { from: 15, to: 16, staff: 8 },
  ]);
  assert.deepEqual(staffBands('groupHome', 5, 9), [
    { from: 5, to: 7, staff: 2 },
    { from: 8, to: 9, staff: 3 },
  ]);
  assert.deepEqual(staffBands('groupHomeDementia', 5, 9), [
    { from: 5, to: 6, staff: 2 },
    { from: 7, to: 8, staff: 3 },
    { from: 9, to: 9, staff: 4 },
  ]);
});

test('입소자 수별 예시 — 29·30·50·70·100명', () => {
  const rows = nursingHomeExample([29, 30, 50, 70, 100]);
  const get = (role: string) => rows.find((row) => row.role === role)?.values;
  // 29명은 '30명 미만 10명 이상' 행: 사무국장·사회복지사 합친 칸 1명, 물리(작업)치료사 칸 비어 있음
  assert.deepEqual(get('사무국장'), ['1명 (사회복지사 칸과 합침)', '—', '1명', '1명', '1명']);
  assert.deepEqual(get('사회복지사'), ['사무국장 칸과 합침', '1명', '1명', '1명', '1명']);
  assert.deepEqual(get('물리치료사 또는 작업치료사'), ['—', '1명', '1명', '1명', '1명']);
  // 요양보호사 29/2.1 = 13.81 → 14, 30 → 14, 50 → 24, 70 → 33, 100 → 48
  assert.deepEqual(get('요양보호사'), ['14명', '14명', '24명', '33명', '48명']);
  // 간호·조리원: 29명은 1명, 30명 이상은 25명당(30 → 1, 50 → 2, 70 → 2.8 → 3, 100 → 4)
  assert.deepEqual(get('간호사 또는 간호조무사'), ['1명', '1명', '2명', '3명', '4명']);
  assert.deepEqual(get('조리원'), ['1명', '1명', '2명', '3명', '4명']);
  // 사무원·관리인은 입소자 50명 이상일 때만
  assert.deepEqual(get('사무원'), ['—', '—', '1명', '1명', '1명']);
  assert.deepEqual(get('관리인'), ['—', '—', '1명', '1명', '1명']);
  assert.deepEqual(get('위생원'), ['—', '1명', '1명', '1명', '1명']);
  assert.deepEqual(get('의사 또는 계약의사'), ['1명', '1명 이상', '1명 이상', '1명 이상', '1명 이상']);
  assert.throws(() => nursingHomeExample([9]), RangeError);
  assert.throws(() => nursingHomeExample([101]), RangeError);
});
