/**
 * 인지 프로그램 주 3회 점검 테스트 — `node --test src/lib/lab/programRules.test.ts`
 * 왜: 평가는 "주 3회 이상"을 일지로 확인한다. 중복 입력으로 횟수가 부풀거나 일요일·월요일 경계가 하루 밀리면 거짓 충족이 된다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { addDays, cognitiveWeeklyStatus, mondayOf, recentWeeklyStatuses, underParticipated, weeksMet } from './programRules.ts';

const P = (programDate: string, title: string | null, ids: number[], category: 'COGNITIVE' | 'PHYSICAL' = 'COGNITIVE') => ({
  programDate,
  title,
  category,
  participantIds: ids,
});

test('주 3회 — 월~일 안의 인지 프로그램만 센다(다음 주 월요일·신체 프로그램 제외)', () => {
  const progs = [P('2026-10-12', '회상', [1, 2]), P('2026-10-14', '퍼즐', [1]), P('2026-10-18', '계산', [2]), P('2026-10-15', '체조', [1, 2], 'PHYSICAL'), P('2026-10-19', '회상', [1])];
  const s = cognitiveWeeklyStatus(progs, '2026-10-12');
  assert.equal(s.count, 3);
  assert.equal(s.met, true);
  assert.equal(s.days, 3);
  assert.deepEqual(s.perElder, { 1: 2, 2: 2 });
});

test('2회는 미충족, 0회도 미충족, 지난주 일요일은 이번 주가 아니다', () => {
  assert.equal(cognitiveWeeklyStatus([P('2026-10-12', 'a', [1]), P('2026-10-14', 'b', [1])], '2026-10-12').met, false);
  assert.equal(cognitiveWeeklyStatus([], '2026-10-12').count, 0);
  assert.equal(cognitiveWeeklyStatus([P('2026-10-11', 'a', [1])], '2026-10-12').count, 0);
});

test('같은 주에 같은 프로그램이 중복 입력돼도 (날짜, 제목) 기준으로 한 번만 센다', () => {
  const progs = [
    P('2026-10-12', '회상 활동', [1]),
    P('2026-10-12', '  회상   활동 ', [2]), // 공백만 다른 중복
    P('2026-10-12', '회상 활동', [1]), // 완전 중복
    P('2026-10-13', '회상 활동', [1]),
  ];
  const s = cognitiveWeeklyStatus(progs, '2026-10-12');
  assert.equal(s.count, 2);
  assert.deepEqual(s.perElder, { 1: 2, 2: 1 }); // 참여자는 합치되 한 프로그램에서 한 번만
});

test('같은 날 제목이 다른 인지 프로그램은 둘로 센다, 제목이 없으면 날짜만으로 묶는다', () => {
  const two = cognitiveWeeklyStatus([P('2026-10-12', '오전 회상', [1]), P('2026-10-12', '오후 퍼즐', [1])], '2026-10-12');
  assert.equal(two.count, 2);
  assert.equal(two.days, 1);
  const untitled = cognitiveWeeklyStatus([P('2026-10-12', null, [1]), P('2026-10-12', '', [2])], '2026-10-12');
  assert.equal(untitled.count, 1);
});

test('잘못된 날짜·참여자 배열 이상·잘못된 weekStart에도 죽지 않는다', () => {
  const progs = [P('2026-02-30', 'a', [1]), P('', 'b', [1]), { programDate: '2026-10-12', title: 'c', category: 'COGNITIVE' as const, participantIds: null as unknown as number[] }];
  const s = cognitiveWeeklyStatus(progs, '2026-10-12');
  assert.equal(s.count, 1);
  assert.deepEqual(s.perElder, {});
  assert.deepEqual(cognitiveWeeklyStatus(progs, 'nope'), { count: 0, met: false, perElder: {}, days: 0 });
});

test('programDate에 시각이 붙어 있어도 날짜로 읽는다', () => {
  assert.equal(cognitiveWeeklyStatus([P('2026-10-12T09:30:00', 'a', [1])], '2026-10-12').count, 1);
});

test('mondayOf·addDays — 일요일은 그 주 월요일로, 월·연 경계를 넘는다', () => {
  assert.equal(mondayOf('2026-10-18'), '2026-10-12'); // 일
  assert.equal(mondayOf('2026-10-12'), '2026-10-12'); // 월
  assert.equal(mondayOf('2026-01-01'), '2025-12-29'); // 목 → 전년도 월요일
  assert.equal(mondayOf('nope'), null);
  assert.equal(addDays('2026-12-30', 3), '2027-01-02');
  assert.equal(addDays('2024-02-28', 2), '2024-03-01');
});

test('recentWeeklyStatuses — 기본은 끝난 4주(오래된 주부터), 일요일이면 그 주도 끝난 것', () => {
  const progs = [
    P('2026-10-05', 'a', [1]), P('2026-10-06', 'b', [1]), P('2026-10-07', 'c', [1]), // 10/5 주 충족
    P('2026-10-12', 'a', [1]), P('2026-10-13', 'b', [1]), // 10/12 주 미충족
  ];
  const wed = recentWeeklyStatuses(progs, '2026-10-14'); // 이번 주(10/12)는 진행 중
  assert.deepEqual(wed.map((w) => w.weekStart), ['2026-09-14', '2026-09-21', '2026-09-28', '2026-10-05']);
  assert.equal(weeksMet(wed).met, 1);
  assert.equal(weeksMet(wed).total, 4);
  const sun = recentWeeklyStatuses(progs, '2026-10-18');
  assert.equal(sun[sun.length - 1].weekStart, '2026-10-12');
  const withCurrent = recentWeeklyStatuses(progs, '2026-10-14', 2, true);
  assert.deepEqual(withCurrent.map((w) => w.weekStart), ['2026-10-05', '2026-10-12']);
  assert.equal(withCurrent[1].weekEnd, '2026-10-18');
  assert.deepEqual(recentWeeklyStatuses(progs, 'nope'), []);
  assert.deepEqual(recentWeeklyStatuses(progs, '2026-10-14', 0), []);
});

test('underParticipated — 참여가 기준 미만인 어르신(참여 기록이 없으면 0회)', () => {
  assert.deepEqual(underParticipated({ 1: 3, 2: 2 }, [1, 2, 3]), [2, 3]);
  assert.deepEqual(underParticipated({ 1: 1 }, [1], 1), []);
});
