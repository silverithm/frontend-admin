import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { MeetingMinutes } from '@/types/meetingMinutes';
import { filterMinutesByTitle, groupMinutesByMonth, monthLabel } from './meetingMinutesList.ts';

const make = (id: number, title: string, start: string): MeetingMinutes =>
  ({ id, title, meetingStartAt: start } as MeetingMinutes);

const items = [
  make(1, '11월 직원회의', '2026-11-10T10:00:00'),
  make(2, '낙상 예방 교육', '2026-11-02T09:00:00'),
  make(3, '10월 운영회의', '2026-10-20T14:00:00'),
  make(4, '9월 직원회의', '2026-09-01T10:00:00'),
];

describe('filterMinutesByTitle', () => {
  it('빈 검색어는 전체', () => assert.equal(filterMinutesByTitle(items, '  ').length, 4));
  it('대소문자·공백 구분 단어 모두 포함', () => {
    assert.deepEqual(filterMinutesByTitle(items, '직원 회의').map((i) => i.id), [1, 4]);
    assert.deepEqual(filterMinutesByTitle(items, '직원회의 낙상').map((i) => i.id), []);
    assert.deepEqual(filterMinutesByTitle(items, '월 직원').map((i) => i.id), [1, 4]);
  });
});

describe('monthLabel', () => {
  it('월 앞자리 0을 뗀다', () => assert.equal(monthLabel('2026-09-01T10:00:00'), '2026년 9월'));
  it('형식이 어긋나면 날짜 없음', () => assert.equal(monthLabel(''), '날짜 없음'));
});

describe('groupMinutesByMonth', () => {
  it('월별로 묶고 순서를 지킨다', () => {
    const sections = groupMinutesByMonth(items);
    assert.deepEqual(sections.map((s) => s.label), ['2026년 11월', '2026년 10월', '2026년 9월']);
    assert.deepEqual(sections[0].items.map((i) => i.id), [1, 2]);
  });
  it('고정 항목은 맨 위 별도 묶음이고 월 묶음에서 빠진다', () => {
    const sections = groupMinutesByMonth(items, { label: '서명 필요', predicate: (i) => i.id === 3 });
    assert.deepEqual(sections.map((s) => s.label), ['서명 필요', '2026년 11월', '2026년 9월']);
  });
  it('고정 항목이 없으면 고정 묶음을 만들지 않는다', () => {
    const sections = groupMinutesByMonth(items, { label: '서명 필요', predicate: () => false });
    assert.equal(sections[0].label, '2026년 11월');
  });
});
