/**
 * 주간 식단표 규칙 테스트 — `node --test src/lib/lab/mealRules.test.ts`
 * 왜: 식단표는 월요일 기준 한 주 단위라 날짜가 하루 밀리면 다른 주 식단을 덮어쓴다. 주찬 중복 판정이 공백·대소문자 하나로 빗나가면
 * 같은 반찬이 이틀 나가도 화면이 조용하다. 지난주 복사가 원본을 건드리면 지난주 기록이 사라진다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MEAL_SLOTS,
  MEAL_TEXT_LIMIT,
  copyWeek,
  currentWeekStart,
  daysMissingMain,
  dishKey,
  emptyWeek,
  getSlot,
  hasAnyMenu,
  isAvoidedDish,
  isMonday,
  mainsOf,
  menuRepeats,
  nextWeekStart,
  repeatedMainDates,
  softDietCount,
  softDietTotal,
  weekDates,
  weekStartsInMonth,
  weekdayLabel,
  withSlot,
} from './mealRules.ts';

test('emptyWeek — 월~토 6일, 칸은 모두 빈 글, 날짜는 월요일부터 이어진다', () => {
  const week = emptyWeek('2026-10-12');
  assert.equal(week.length, 6);
  assert.deepEqual(week.map((d) => d.date), ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17']);
  for (const d of week) {
    assert.deepEqual(d.lunch, { rice: '', soup: '', main: '', side1: '', side2: '', kimchi: '' });
    assert.equal(d.amSnack, '');
    assert.equal(d.pmSnack, '');
    assert.equal(d.soft, '');
  }
});

test('emptyWeek — 날마다 다른 객체(한 칸을 고쳐도 다른 날이 안 바뀐다)', () => {
  const week = emptyWeek('2026-10-12');
  week[0].lunch.main = '고등어조림';
  assert.equal(week[1].lunch.main, '');
});

test('emptyWeek — 월 경계·연 경계를 넘는 주, 윤년 2월', () => {
  assert.deepEqual(weekDates('2026-12-28'), ['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']);
  assert.deepEqual(weekDates('2028-02-28'), ['2028-02-28', '2028-02-29', '2028-03-01', '2028-03-02', '2028-03-03', '2028-03-04']);
});

test('emptyWeek — 월요일이 아니면 그 주 월요일로, 잘못된 날짜는 빈 배열', () => {
  assert.equal(emptyWeek('2026-10-15')[0].date, '2026-10-12');
  assert.equal(emptyWeek('2026-10-18')[0].date, '2026-10-12'); // 일요일은 그 주의 끝
  assert.deepEqual(emptyWeek('2026-02-30'), []);
  assert.deepEqual(emptyWeek(''), []);
  assert.deepEqual(emptyWeek('abc'), []);
});

test('isMonday·weekdayLabel', () => {
  assert.equal(isMonday('2026-10-12'), true);
  assert.equal(isMonday('2026-10-13'), false);
  assert.equal(isMonday('2026-13-01'), false);
  assert.deepEqual(['2026-10-12', '2026-10-17', '2026-10-18'].map(weekdayLabel), ['월', '토', '일']);
  assert.equal(weekdayLabel('nope'), '');
});

test('주찬 중복 — 공백·대소문자를 정리해 같은 것이 2일 이상이면 묶어서 돌려준다', () => {
  const week = emptyWeek('2026-10-12');
  week[0].lunch.main = '고등어조림';
  week[2].lunch.main = ' 고등어조림 ';
  week[4].lunch.main = '닭볶음탕';
  const rep = menuRepeats(week);
  assert.equal(rep.length, 1);
  assert.equal(rep[0].dish, '고등어조림');
  assert.deepEqual(rep[0].dates, ['2026-10-12', '2026-10-14']);
});

test('주찬 중복 — 가운데 공백이 다른 표기·영문 대소문자도 같은 반찬이다', () => {
  assert.equal(dishKey('고등어 조림'), dishKey('고등어조림'));
  assert.equal(dishKey('  Pork  Cutlet '), dishKey('pork cutlet'));
  const week = emptyWeek('2026-10-12');
  week[0].lunch.main = '돈가스 (Pork Cutlet)';
  week[1].lunch.main = '돈가스(pork cutlet)';
  assert.equal(menuRepeats(week).length, 1);
});

test('주찬 중복 — 같은 반찬이 3일이면 한 묶음에 날짜 셋, 서로 다른 중복 둘이면 묶음 둘', () => {
  const week = emptyWeek('2026-10-12');
  ['불고기', '두부조림', '불고기', '두부조림', '불고기'].forEach((m, i) => (week[i].lunch.main = m));
  const rep = menuRepeats(week);
  assert.equal(rep.length, 2);
  assert.deepEqual(rep.map((r) => r.dish), ['불고기', '두부조림']);
  assert.equal(rep[0].dates.length, 3);
  assert.equal(rep[1].dates.length, 2);
});

test('주찬 중복 — 빈 칸끼리·공백뿐인 칸은 겹침이 아니고, 주찬이 아닌 칸(부찬)이 같아도 아니다', () => {
  const week = emptyWeek('2026-10-12');
  week[0].lunch.main = '   ';
  week[1].lunch.main = '';
  week[2].lunch.side1 = '시금치나물';
  week[3].lunch.side1 = '시금치나물';
  assert.deepEqual(menuRepeats(week), []);
  assert.deepEqual(menuRepeats([]), []);
});

test('repeatedMainDates·mainsOf·daysMissingMain', () => {
  const week = emptyWeek('2026-10-12');
  week[0].lunch.main = '불고기';
  week[1].lunch.main = '불고기 ';
  week[2].lunch.main = '생선구이';
  assert.deepEqual([...repeatedMainDates(week)].sort(), ['2026-10-12', '2026-10-13']);
  assert.deepEqual(mainsOf(week), ['불고기', '생선구이']); // 중복은 한 번만
  assert.deepEqual(daysMissingMain(week), ['2026-10-15', '2026-10-16', '2026-10-17']);
});

test('피할 주찬 — 지난주 주찬과 같은 것(공백·대소문자 무시)만 걸린다', () => {
  assert.equal(isAvoidedDish('고등어 조림', ['고등어조림', '불고기']), true);
  assert.equal(isAvoidedDish('닭볶음탕', ['고등어조림']), false);
  assert.equal(isAvoidedDish('', ['']), false); // 빈 칸은 걸리지 않는다
  assert.equal(isAvoidedDish(null, ['불고기']), false);
});

test('softDietCount — 식사 형태별 인원, 값 없음·모르는 값은 일반식', () => {
  const s = softDietCount([{ mealType: 'REGULAR' }, { mealType: 'CHOPPED' }, { mealType: 'CHOPPED' }, { mealType: 'PORRIDGE' }, { mealType: null }, {}, { mealType: 'MIXED' }, { mealType: 'WHAT' }]);
  assert.deepEqual(s, { regular: 4, chopped: 2, porridge: 1, mixed: 1 });
  assert.equal(softDietTotal(s), 3);
});

test('softDietCount — 빈 명단은 전부 0', () => {
  assert.deepEqual(softDietCount([]), { regular: 0, chopped: 0, porridge: 0, mixed: 0 });
});

test('copyWeek — 날짜만 새 주로 바뀌고 글은 그대로, 원본은 바뀌지 않는다', () => {
  const week = emptyWeek('2026-10-12');
  week[0].lunch.main = '고등어조림';
  week[0].soft = '다진식은 생선살 으깸';
  week[5].pmSnack = '고구마';
  const snapshot = JSON.parse(JSON.stringify(week));
  const copied = copyWeek(week, '2026-10-19');
  assert.deepEqual(copied.map((d) => d.date), ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24']);
  assert.equal(copied[0].lunch.main, '고등어조림');
  assert.equal(copied[0].soft, '다진식은 생선살 으깸');
  assert.equal(copied[5].pmSnack, '고구마');
  assert.deepEqual(week, snapshot);
});

test('copyWeek — 사본을 고쳐도 원본이 안 바뀐다(깊은 복사)', () => {
  const week = emptyWeek('2026-10-12');
  week[1].lunch.main = '불고기';
  const copied = copyWeek(week, '2026-10-19');
  copied[1].lunch.main = '제육볶음';
  copied[1].lunch.rice = '흑미밥';
  assert.equal(week[1].lunch.main, '불고기');
  assert.equal(week[1].lunch.rice, '');
  assert.notEqual(copied[1].lunch, week[1].lunch);
});

test('copyWeek — 월요일이 아닌 날짜는 그 주 월요일로, 잘못된 날짜는 빈 배열, 빈 입력은 빈 배열', () => {
  const week = emptyWeek('2026-10-12');
  assert.equal(copyWeek(week, '2026-10-22')[0].date, '2026-10-19');
  assert.deepEqual(copyWeek(week, 'nope'), []);
  assert.deepEqual(copyWeek([], '2026-10-19'), []);
});

test('copyWeek — 연말을 넘어도 날짜가 이어진다, 칸이 빠진 옛 데이터도 빈 글로 채운다', () => {
  const copied = copyWeek([{ date: 'x', lunch: { main: '국수' } } as never], '2026-12-28');
  assert.equal(copied[0].date, '2026-12-28');
  assert.deepEqual(copied[0].lunch, { rice: '', soup: '', main: '국수', side1: '', side2: '', kimchi: '' });
  assert.equal(copied[0].soft, '');
});

test('칸 읽고 쓰기 — withSlot은 새 하루를 돌려주고 60자에서 자른다', () => {
  const day = emptyWeek('2026-10-12')[0];
  const next = withSlot(day, 'main', '불고기');
  assert.equal(getSlot(next, 'main'), '불고기');
  assert.equal(getSlot(day, 'main'), '');
  assert.equal(getSlot(withSlot(day, 'soft', '가'.repeat(100)), 'soft').length, MEAL_TEXT_LIMIT);
  assert.equal(getSlot(withSlot(day, 'amSnack', '두유'), 'amSnack'), '두유');
  assert.equal(MEAL_SLOTS.length, 9);
});

test('hasAnyMenu — 한 칸이라도 있으면 true, 공백만이면 false', () => {
  const week = emptyWeek('2026-10-12');
  assert.equal(hasAnyMenu(week), false);
  week[3].lunch.side2 = '  ';
  assert.equal(hasAnyMenu(week), false);
  week[3].pmSnack = '요거트';
  assert.equal(hasAnyMenu(week), true);
});

test('weekStartsInMonth — 그 달에 걸친 주(1일이 주 중간이면 전달 월요일 포함)', () => {
  // 2026-10-01은 목요일: 9/28 주부터, 10/26 주까지(10/31 토요일)
  assert.deepEqual(weekStartsInMonth('2026-10'), ['2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26']);
  // 2026-02는 1일이 일요일(1/26 주) ~ 2/23 주
  assert.deepEqual(weekStartsInMonth('2026-02'), ['2026-01-26', '2026-02-02', '2026-02-09', '2026-02-16', '2026-02-23']);
  assert.deepEqual(weekStartsInMonth('2026-13'), []);
  assert.deepEqual(weekStartsInMonth(''), []);
});

test('서울 기준 이번 주·다음 주 — UTC로는 아직 일요일이어도 서울은 월요일이면 새 주다', () => {
  // 2026-10-18(일) 15:30 UTC = 서울 10-19(월) 00:30
  const kst = new Date('2026-10-18T15:30:00Z');
  assert.equal(currentWeekStart(kst), '2026-10-19');
  assert.equal(nextWeekStart(kst), '2026-10-26');
  // 서울 일요일 23:59 = 아직 지난주
  assert.equal(currentWeekStart(new Date('2026-10-18T14:59:00Z')), '2026-10-12');
  assert.equal(nextWeekStart(new Date('2026-10-14T03:00:00Z')), '2026-10-19');
});
