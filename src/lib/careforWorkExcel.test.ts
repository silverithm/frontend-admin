/**
 * 케어포 직원근무일정 변환 규칙 테스트 — `node --test src/lib/careforWorkExcel.test.ts`
 *
 * 왜 이걸 테스트하나: 이 파일을 케어포 8-2에 올리면 파일에 있는 직원의 그 달 근무일정이
 * 통째로 다시 써진다. 칸 하나가 어긋나면 수십 명의 한 달 일정이 틀린 채 들어가고,
 * 근무표는 공단 가산·감액의 근거다. 실제 케어포 파일에서 확인한 규칙을 여기서 묶어 둔다.
 * (아래 이름·생년월일은 지어낸 값이다)
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCareforWorkRows,
  CAREFOR_WORK_HEADERS,
  describeTimes,
  parseCareforWorkGrid,
  toCareforDayMark,
} from './careforWorkExcel.ts';

const H = [...CAREFOR_WORK_HEADERS];
const WEEK = ['일', '월', '화', '수', '목', '금', '토'];

/** 케어포 파일 한 줄 — 비운 칸은 '' */
const row = (
  name: string,
  birth: string,
  period: string,
  job: string,
  day: number,
  weekday: number,
  times: string[] = [],
  tail: { code?: string; hours?: string; status?: string } = {},
) => {
  const t = Array.from({ length: 12 }, (_, i) => times[i] ?? '');
  return [
    name, birth, period, job, String(day).padStart(2, '0'), WEEK[weekday], ...t,
    tail.code ?? '', tail.hours ?? '', '', '', '', tail.status ?? '근무',
  ];
};

const DAY = ['0820', '1720', '1'];
const DRIVER = ['0800', '1000', '', '', '', '', '1600', '1800'];

/** 2026년 11월 1일은 일요일 — 견본 격자 */
const sampleGrid = () => [
  H,
  H.map(() => ''),
  // 요양보호사: 월~토 근무, 한 번은 다른 시간
  row('김하늘', '800101', '2025-04-01~9999-12-31', '11.요양보호사 1급', 1, 0),
  row('김하늘', '800101', '2025-04-01~9999-12-31', '11.요양보호사 1급', 2, 1, DAY),
  row('김하늘', '800101', '2025-04-01~9999-12-31', '11.요양보호사 1급', 3, 2, DAY),
  row('김하늘', '800101', '2025-04-01~9999-12-31', '11.요양보호사 1급', 4, 3, ['0800', '1740', '1']),
  row('김하늘', '800101', '2025-04-01~9999-12-31', '11.요양보호사 1급', 5, 4, DAY),
  row('김하늘', '800101', '2025-04-01~9999-12-31', '11.요양보호사 1급', 6, 5, [], { code: '01', hours: '8', status: '휴가' }),
  row('김하늘', '800101', '2025-04-01~9999-12-31', '11.요양보호사 1급', 7, 6, DAY),
  // 운전원: 하루 두 번, 토요일도 근무
  row('이바다', '750505', '2024-03-02~9999-12-31', '19.보조원 운전사', 2, 1, DRIVER),
  row('이바다', '750505', '2024-03-02~9999-12-31', '19.보조원 운전사', 7, 6, DRIVER),
  // 사회복지사: 토요일엔 안 나온다
  row('박구름', '900909', '2023-11-06~9999-12-31', '3.사회복지사', 2, 1, DAY),
  row('박구름', '900909', '2023-11-06~9999-12-31', '3.사회복지사', 7, 6),
  // 케어브이에 없는 직원
  row('최별', '010203', '2026-02-05~9999-12-31', '16.조리원', 2, 1, ['1000', '1430', '', '30']),
];

test('헤더가 다르면 케어포 파일이 아니라고 알려준다', () => {
  assert.throws(() => parseCareforWorkGrid([['이름', '주소']]), /케어포 8-2에서 받은 직원근무일정 파일이 아닙니다/);
});

test('평소 근무시간은 가장 많이 쓴 시간, 근무 요일은 일한 요일', () => {
  const { staff } = parseCareforWorkGrid(sampleGrid());
  assert.equal(staff.length, 4);
  const sky = staff.find((p) => p.name === '김하늘')!;
  assert.deepEqual(sky.times.slice(0, 3), DAY);
  assert.equal(sky.times.length, 12);
  // 금요일은 연차뿐이지만 연차는 일하는 날에 쓰므로 근무 요일이다
  assert.deepEqual(sky.workWeekdays, [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(sky.periods, [
    { text: '2025-04-01~9999-12-31', start: '2025-04-01', end: '9999-12-31', job: '11.요양보호사 1급' },
  ]);

  const cloud = staff.find((p) => p.name === '박구름')!;
  assert.deepEqual(cloud.workWeekdays, [1]);
});

test('평소 시간을 읽는 글 — 두 번 나뉘는 근무도 보인다', () => {
  assert.equal(describeTimes(['0820', '1720', '1']), '08:20~17:20');
  assert.equal(describeTimes(DRIVER), '08:00~10:00 · 16:00~18:00');
  assert.equal(describeTimes([]), '근무 기록 없음');
});

test('휴무 종류 → 케어포 표시: 화면과 같은 기준으로 가른다', () => {
  assert.equal(toCareforDayMark({ type: 'regular', duration: 'FULL_DAY' }), 'annual');
  assert.equal(toCareforDayMark({ type: 'regular', duration: 'HALF_DAY_AM' }), 'half');
  assert.equal(toCareforDayMark({ type: 'regular', duration: 'HALF_DAY_PM' }), 'half');
  assert.equal(toCareforDayMark({ type: 'regular', duration: 'UNUSED' }), 'off');
  assert.equal(toCareforDayMark({ type: 'substitute', duration: 'UNUSED' }), 'off');
  assert.equal(toCareforDayMark({ type: 'mandatory', duration: 'UNUSED' }), 'off');
});

const build = (vacations: Parameters<typeof buildCareforWorkRows>[0]['vacations'] = []) => {
  const { staff } = parseCareforWorkGrid(sampleGrid());
  // 2026년 12월: 1일 화요일, 6일 일요일, 31일
  return buildCareforWorkRows({
    year: 2026,
    month: 11,
    staff,
    memberNames: ['김하늘', ' 이 바다 ', '박구름', '정새봄'],
    vacations,
  });
};

const pick = (rows: string[][], name: string, day: number) =>
  rows.find((r) => r[0] === name && r[4] === String(day).padStart(2, '0'))!;
const col = (name: string) => CAREFOR_WORK_HEADERS.indexOf(name as (typeof CAREFOR_WORK_HEADERS)[number]);

test('양식: 1행 헤더 24칸, 2행 빈 행, 직원마다 그 달 날짜 수만큼', () => {
  const { rows } = build();
  assert.deepEqual(rows[0], H);
  assert.equal(rows[1].every((v) => v === ''), true);
  assert.equal(rows.length, 2 + 3 * 31);
  assert.equal(rows.every((r) => r.length === 24), true);
});

test('이름이 맞는 직원만 넣고, 맞지 않는 직원은 양쪽 목록으로 알려준다', () => {
  const { staff, careforOnly, carevOnly } = build();
  assert.deepEqual(staff.map((s) => s.name), ['김하늘', '이바다', '박구름']); // 띄어쓰기는 무시
  assert.deepEqual(careforOnly, ['최별']);
  assert.deepEqual(carevOnly, ['정새봄']);
});

test('일하는 날은 평소 시간, 일요일·안 나오는 요일은 근무 + 빈 시간', () => {
  const { rows } = build();
  const tue = pick(rows, '김하늘', 1);
  assert.equal(tue[col('생년월일')], '800101');
  assert.equal(tue[col('근무기간')], '2025-04-01~9999-12-31');
  assert.equal(tue[col('직종')], '11.요양보호사 1급');
  assert.equal(tue[col('요일')], '화');
  assert.equal(tue[col('근무시작')], '0820');
  assert.equal(tue[col('근무종료')], '1720');
  assert.equal(tue[col('주간휴식시')], '1');
  assert.equal(tue[col('근무휴일상세여부')], '근무');

  const sun = pick(rows, '김하늘', 6);
  assert.equal(sun[col('요일')], '일');
  assert.equal(sun[col('근무시작')], '');
  assert.equal(sun[col('근무휴일상세여부')], '근무');

  // 박구름은 토요일에 안 나온다 (12/5 토)
  assert.equal(pick(rows, '박구름', 5)[col('근무시작')], '');
  assert.equal(pick(rows, '박구름', 7)[col('근무시작')], '0820');

  // 운전원은 두 번 나뉜 시간이 그대로
  const driver = pick(rows, '이바다', 5);
  assert.equal(driver[col('근무시작')], '0800');
  assert.equal(driver[col('근무종료')], '1000');
  assert.equal(driver[col('근무시작2')], '1600');
  assert.equal(driver[col('근무종료2')], '1800');
});

test('승인된 연차·반차·휴무만 반영하고, 대기·반려는 근무로 둔다', () => {
  const { rows, staff } = build([
    { userName: '김하늘', date: '2026-12-01', status: 'APPROVED', type: 'regular', duration: 'FULL_DAY' },
    { userName: '김하늘', date: '2026-12-02', status: 'approved', type: 'regular', duration: 'HALF_DAY_PM' },
    { userName: '김하늘', date: '2026-12-03', status: 'approved', type: 'regular', duration: 'UNUSED' },
    { userName: '김하늘', date: '2026-12-04', status: 'pending', type: 'regular', duration: 'FULL_DAY' },
    { userName: '김하늘', date: '2026-12-05', status: 'rejected', type: 'regular', duration: 'UNUSED' },
  ]);

  const annual = pick(rows, '김하늘', 1);
  assert.equal(annual[col('근무휴일상세여부')], '휴가');
  assert.equal(annual[col('휴가코드')], '01');
  assert.equal(annual[col('휴가시간')], '8');
  assert.equal(annual[col('근무시작')], '');

  const half = pick(rows, '김하늘', 2);
  assert.equal(half[col('근무휴일상세여부')], '휴가');
  assert.equal(half[col('휴가코드')], '02');
  assert.equal(half[col('휴가시간')], '4');
  assert.equal(half[col('근무시작')], '');

  const off = pick(rows, '김하늘', 3);
  assert.equal(off[col('근무휴일상세여부')], '근무');
  assert.equal(off[col('근무시작')], '');
  assert.equal(off[col('휴가코드')], '');

  assert.equal(pick(rows, '김하늘', 4)[col('근무시작')], '0820'); // 대기
  assert.equal(pick(rows, '김하늘', 5)[col('근무시작')], '0820'); // 반려 (토요일 근무자)

  const sky = staff.find((s) => s.name === '김하늘')!;
  assert.equal(sky.annualDays, 1);
  assert.equal(sky.halfDays, 1);
  assert.equal(sky.offDays, 1);
  assert.equal(sky.offWeekdays, '일');
});

test('근무기간 밖의 날은 시간을 넣지 않고, 그 달과 겹치지 않는 사람은 뺀다', () => {
  const grid = [
    H,
    row('김하늘', '800101', '2025-04-01~2026-12-10', '11.요양보호사 1급', 2, 1, DAY),
    row('이바다', '750505', '2024-03-02~2026-11-20', '19.보조원 운전사', 2, 1, DRIVER),
  ];
  const parsed = parseCareforWorkGrid(grid);
  const { rows, staff } = buildCareforWorkRows({
    year: 2026, month: 11, staff: parsed.staff, memberNames: ['김하늘', '이바다'], vacations: [],
  });
  assert.deepEqual(staff.map((s) => s.name), ['김하늘']);
  assert.equal(pick(rows, '김하늘', 7)[col('근무시작')], '0820'); // 12/7 월
  assert.equal(pick(rows, '김하늘', 14)[col('근무시작')], ''); // 퇴사 뒤
  assert.equal(pick(rows, '김하늘', 14)[col('근무휴일상세여부')], '근무');
});

test('근무기간이 둘이면 날마다 그날을 품는 기간 중 먼저 끝나는 줄에 적는다 (케어포와 같게)', () => {
  const grid = [
    H,
    row('김하늘', '800101', '2026-01-20~2026-12-07', '11.요양보호사 1급', 2, 1, DAY),
    row('김하늘', '800101', '2026-01-20~9999-12-31', '11.요양보호사 1급', 9, 1, DAY),
  ];
  const parsed = parseCareforWorkGrid(grid);
  assert.equal(parsed.staff.length, 1);
  assert.equal(parsed.staff[0].periods.length, 2);
  const { rows } = buildCareforWorkRows({
    year: 2026, month: 11, staff: parsed.staff, memberNames: ['김하늘'], vacations: [],
  });
  assert.equal(rows.length, 2 + 31); // 사람 하나 = 날짜 수만큼, 기간 수와 무관
  assert.equal(pick(rows, '김하늘', 7)[col('근무기간')], '2026-01-20~2026-12-07');
  assert.equal(pick(rows, '김하늘', 8)[col('근무기간')], '2026-01-20~9999-12-31');
  assert.equal(pick(rows, '김하늘', 14)[col('근무시작')], '0820'); // 견본에서 월요일만 일했다 — 12/14 월
});

test('케어포에 같은 이름이 둘이면(생년월일 다름) 누구 휴무인지 몰라 뺀다', () => {
  const grid = [
    H,
    row('김하늘', '800101', '2025-04-01~9999-12-31', '11.요양보호사 1급', 2, 1, DAY),
    row('김하늘', '950505', '2025-04-01~9999-12-31', '15.사무원', 2, 1, DAY),
  ];
  const parsed = parseCareforWorkGrid(grid);
  const result = buildCareforWorkRows({
    year: 2026, month: 11, staff: parsed.staff, memberNames: ['김하늘'], vacations: [],
  });
  assert.equal(result.staff.length, 0);
  assert.deepEqual(result.sameName, ['김하늘']);
  assert.equal(result.rows.length, 2);
});

test('일요일·평소 안 나오는 요일에 잡힌 연차는 넣지 않고 알린다 (케어포 연차를 깎지 않게)', () => {
  const { rows, leaveOnRestDays } = build([
    { userName: '김하늘', date: '2026-12-06', status: 'approved', type: 'regular', duration: 'FULL_DAY' }, // 일
    { userName: '박구름', date: '2026-12-05', status: 'approved', type: 'regular', duration: 'HALF_DAY_AM' }, // 토 — 안 나오는 날
  ]);
  const sun = pick(rows, '김하늘', 6);
  assert.equal(sun[col('근무휴일상세여부')], '근무');
  assert.equal(sun[col('휴가코드')], '');
  assert.equal(pick(rows, '박구름', 5)[col('휴가코드')], '');
  assert.deepEqual(leaveOnRestDays, [
    { name: '김하늘', date: '2026-12-06' },
    { name: '박구름', date: '2026-12-05' },
  ]);
});

test('견본 달에 근무시간 없이 연차만 있던 사람(휴직 등)도 연차는 그대로 넣는다', () => {
  const grid = [
    H,
    row('김하늘', '800101', '2025-04-01~9999-12-31', '11.요양보호사 1급', 2, 1, [], { code: '01', hours: '8', status: '휴가' }),
  ];
  const parsed = parseCareforWorkGrid(grid);
  const { rows } = buildCareforWorkRows({
    year: 2026, month: 11, staff: parsed.staff, memberNames: ['김하늘'],
    vacations: [{ userName: '김하늘', date: '2026-12-07', status: 'approved', type: 'regular', duration: 'FULL_DAY' }],
  });
  assert.equal(pick(rows, '김하늘', 7)[col('휴가코드')], '01'); // 12/7 월
  assert.equal(pick(rows, '김하늘', 8)[col('근무시작')], ''); // 평소 시간을 몰라 비운다
});

test('달력 API처럼 종류가 vacationType으로 와도 대체·필수 휴무를 연차로 보지 않는다', () => {
  assert.equal(toCareforDayMark({ vacationType: 'substitute', duration: 'FULL_DAY' }), 'off');
  assert.equal(toCareforDayMark({ vacationType: 'mandatory', duration: 'FULL_DAY' }), 'off');
  assert.equal(toCareforDayMark({ vacationType: 'regular', duration: 'FULL_DAY' }), 'annual');
});
