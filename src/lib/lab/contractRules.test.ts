/**
 * 계약·인정 규칙 테스트 — `node --test src/lib/lab/contractRules.test.ts`
 * 왜: 갱신 신청 창(유효기간 90일 전~30일 전)과 14일·시작일 기한은 하루 차이로 위험·주의가 갈린다. 경계를 하루 단위로 확인한다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { VALIDITY_RULE, contractAlerts, expectedValidYears, missedDayEligible, renewalWindow, gradeReport } from './contractRules.ts';
import type { LtcCareGrade } from './labTypes.ts';

const base = {
  id: 1,
  elderlyId: 1,
  status: 'ACTIVE' as const,
  contractStart: '2025-01-01',
  validTo: '2030-12-31',
  signedOn: '2024-12-30',
  copyGiven: true,
  contractNotifiedOn: '2024-12-31' as string | null,
  planNotifiedOn: '2025-01-01' as string | null,
  rightsGuidedOn: '2025-01-05' as string | null,
};
const codes = (c: Partial<typeof base>, today: string) => contractAlerts([{ ...base, ...c }], today).map((a) => a.code);

test('expectedValidYears — 최초 2년, 갱신은 등급별(1등급 5년·2~4등급 4년·5등급·인지지원 2년)', () => {
  const grades: LtcCareGrade[] = ['1', '2', '3', '4', '5', 'cognitive'];
  assert.deepEqual(grades.map((g) => expectedValidYears(g, 0)), [2, 2, 2, 2, 2, 2]);
  assert.deepEqual(grades.map((g) => expectedValidYears(g, 1)), [5, 4, 4, 4, 2, 2]);
  assert.equal(expectedValidYears('1', 7), 5);
  assert.equal(expectedValidYears('1', -1), 2);
  assert.equal(expectedValidYears('9' as LtcCareGrade, 1), 2);
  assert.match(VALIDITY_RULE.note, /6개월/);
});

test('renewalWindow — 90일 전~30일 전, 윤년·연초 경계', () => {
  assert.deepEqual(renewalWindow('2026-12-31'), { opensOn: '2026-10-02', closesOn: '2026-12-01' });
  assert.deepEqual(renewalWindow('2027-03-01'), { opensOn: '2026-12-01', closesOn: '2027-01-30' });
  assert.deepEqual(renewalWindow('2028-03-01'), { opensOn: '2027-12-02', closesOn: '2028-01-31' }); // 2028 윤년: 3/1 − 30일 = 1/31
  assert.deepEqual(renewalWindow('2028-01-15'), { opensOn: '2027-10-17', closesOn: '2027-12-16' });
  assert.equal(renewalWindow('2026-02-30'), null);
  assert.equal(renewalWindow(''), null);
});

test('contractAlerts — 갱신 창 경계: 열리기 30일 전 INFO, 열린 날 WARN, 닫힌 다음 날 DANGER, 유효기간 다음 날 만료', () => {
  const validTo = '2026-12-31'; // 창 10/02 ~ 12/01
  assert.deepEqual(codes({ validTo }, '2026-09-01'), []);
  assert.deepEqual(codes({ validTo }, '2026-09-02'), ['RENEWAL_SOON']);
  assert.deepEqual(codes({ validTo }, '2026-10-01'), ['RENEWAL_SOON']);
  assert.deepEqual(codes({ validTo }, '2026-10-02'), ['RENEWAL_OPEN']);
  assert.deepEqual(codes({ validTo }, '2026-12-01'), ['RENEWAL_OPEN']);
  assert.deepEqual(codes({ validTo }, '2026-12-02'), ['RENEWAL_LATE']);
  assert.deepEqual(codes({ validTo }, '2026-12-31'), ['RENEWAL_LATE']);
  assert.deepEqual(codes({ validTo }, '2027-01-01'), ['EXPIRED']);
});

test('contractAlerts — 기한(dueOn)과 단계', () => {
  const find = (today: string, code: string) => contractAlerts([{ ...base, validTo: '2026-12-31' }], today).find((a) => a.code === code);
  assert.deepEqual([find('2026-09-15', 'RENEWAL_SOON')?.dueOn, find('2026-09-15', 'RENEWAL_SOON')?.level], ['2026-10-02', 'INFO']);
  assert.deepEqual([find('2026-10-15', 'RENEWAL_OPEN')?.dueOn, find('2026-10-15', 'RENEWAL_OPEN')?.level], ['2026-12-01', 'WARN']);
  assert.deepEqual([find('2026-12-15', 'RENEWAL_LATE')?.dueOn, find('2026-12-15', 'RENEWAL_LATE')?.level], ['2026-12-31', 'DANGER']);
  assert.deepEqual([find('2027-02-01', 'EXPIRED')?.dueOn, find('2027-02-01', 'EXPIRED')?.level], ['2026-12-31', 'DANGER']);
});

test('contractAlerts — 끝난(ENDED) 계약은 알리지 않는다', () => {
  assert.deepEqual(codes({ status: 'ENDED' as 'ACTIVE', validTo: '2020-01-01', signedOn: null as unknown as string }, '2026-10-15'), []);
});

test('contractAlerts — 서명 없으면 NOT_SIGNED만(교부·통보는 서명이 있어야 묻는다)', () => {
  assert.deepEqual(codes({ signedOn: null as unknown as string, copyGiven: false, contractNotifiedOn: null }, '2026-10-15'), ['NOT_SIGNED']);
  assert.deepEqual(codes({ copyGiven: false }, '2026-10-15'), ['COPY_NOT_GIVEN']);
  assert.deepEqual(codes({ contractNotifiedOn: null }, '2026-10-15'), ['NOT_NOTIFIED']);
});

test('contractAlerts — 계획 통보: 시작일 당일 통보는 통과, 하루 늦으면 DANGER, 시작일이 되도록 없으면 DANGER, 시작 전이면 아직', () => {
  assert.deepEqual(codes({ contractStart: '2026-10-15', planNotifiedOn: '2026-10-15', signedOn: '2026-10-10', contractNotifiedOn: '2026-10-10', rightsGuidedOn: null }, '2026-10-15'), []);
  const late = contractAlerts([{ ...base, contractStart: '2026-10-15', planNotifiedOn: '2026-10-16' }], '2026-10-20').find((a) => a.code === 'PLAN_NOT_NOTIFIED');
  assert.equal(late?.level, 'DANGER');
  assert.equal(late?.dueOn, '2026-10-15');
  assert.deepEqual(codes({ contractStart: '2026-10-16', planNotifiedOn: null, rightsGuidedOn: null }, '2026-10-15'), []);
  assert.deepEqual(codes({ contractStart: '2026-10-15', planNotifiedOn: null, rightsGuidedOn: null }, '2026-10-15'), ['PLAN_NOT_NOTIFIED']);
});

test('contractAlerts — 인권 안내 14일: 시작+14일 당일까지 괜찮고 다음 날부터 WARN, 늦게 안내한 것도 WARN', () => {
  const start = '2026-10-01'; // +14일 = 10/15
  const opts = { contractStart: start, planNotifiedOn: start, signedOn: '2026-09-30', contractNotifiedOn: '2026-09-30', rightsGuidedOn: null as string | null };
  assert.deepEqual(codes(opts, '2026-10-15'), []);
  assert.deepEqual(codes(opts, '2026-10-16'), ['RIGHTS_GUIDE_LATE']);
  assert.deepEqual(codes({ ...opts, rightsGuidedOn: '2026-10-15' }, '2026-10-20'), []);
  const late = contractAlerts([{ ...base, ...opts, rightsGuidedOn: '2026-10-16' }], '2026-10-20').find((a) => a.code === 'RIGHTS_GUIDE_LATE');
  assert.equal(late?.dueOn, '2026-10-15');
  assert.equal(late?.level, 'WARN');
  // 윤년: 2/20 + 14일 = 3/5, 평년이면 3/6
  assert.equal(contractAlerts([{ ...base, ...opts, contractStart: '2028-02-20', planNotifiedOn: '2028-02-20', rightsGuidedOn: null }], '2028-03-10').find((a) => a.code === 'RIGHTS_GUIDE_LATE')?.dueOn, '2028-03-05');
});

test('contractAlerts — 정렬: 위험 → 주의 → 안내, 같은 단계는 기한 순(기한 없는 것 뒤)', () => {
  const list = contractAlerts(
    [
      { ...base, id: 1, elderlyId: 1, validTo: '2026-11-20' }, // INFO? 11/20 − 90 = 8/22 → 열림 WARN(기한 9/... )
      { ...base, id: 2, elderlyId: 2, validTo: '2026-10-01' }, // EXPIRED DANGER
      { ...base, id: 3, elderlyId: 3, copyGiven: false }, // WARN, 기한 없음
      { ...base, id: 4, elderlyId: 4, validTo: '2027-01-20' }, // INFO(소규모)
    ],
    '2026-10-15',
  );
  const levels = list.map((a) => a.level);
  assert.deepEqual(levels, [...levels].sort((a, b) => ({ DANGER: 0, WARN: 1, INFO: 2 })[a] - ({ DANGER: 0, WARN: 1, INFO: 2 })[b]));
  assert.equal(list[0].code, 'EXPIRED');
  assert.equal(list[list.length - 1].code, 'RENEWAL_SOON');
  const warn = list.filter((a) => a.level === 'WARN');
  assert.equal(warn[warn.length - 1].dueOn, null);
});

test('contractAlerts — 알림에는 이름이 없고 잘못된 날짜는 건너뛴다', () => {
  const list = contractAlerts([{ ...base, validTo: '2026-12-31' }], '2026-10-15');
  assert.ok(list.every((a) => !('elderlyName' in a)));
  assert.deepEqual(contractAlerts([base], 'bad'), []);
  assert.deepEqual(codes({ validTo: 'bad', contractStart: 'bad' }, '2026-10-15'), []);
});

test('missedDayEligible — 월 15일 이상만', () => {
  assert.equal(missedDayEligible({ plannedDaysPerMonth: 15 }), true);
  assert.equal(missedDayEligible({ plannedDaysPerMonth: 31 }), true);
  assert.equal(missedDayEligible({ plannedDaysPerMonth: 14 }), false);
  assert.equal(missedDayEligible({ plannedDaysPerMonth: null }), false);
});

// ---------- 등급 현황·변동 ----------

const gc = (elderlyId: number, name: string, grade: '1' | '2' | '3' | '4' | '5' | 'cognitive', validFrom: string, o: Partial<{ status: 'ACTIVE' | 'ENDED'; contractEnd: string | null }> = {}) => ({
  elderlyId,
  elderlyName: name,
  careGrade: grade,
  validFrom,
  contractStart: validFrom,
  contractEnd: o.contractEnd ?? null,
  status: o.status ?? 'ACTIVE',
});

test('등급 현황은 진행 중인 수급자를 가장 최근 계약의 등급으로 센다', () => {
  const r = gradeReport(
    [
      gc(1, '김말순', '4', '2025-01-01', { status: 'ENDED', contractEnd: '2025-12-31' }),
      gc(1, '김말순', '3', '2026-01-01'),
      gc(2, '박봉례', '5', '2026-02-01'),
      gc(3, '이순남', '3', '2026-03-01'),
      gc(4, '최점례', '2', '2026-01-01', { status: 'ENDED', contractEnd: '2026-06-30' }),
    ],
    2026,
  );
  assert.equal(r.activeElders, 3);
  assert.deepEqual(r.byGrade.filter((g) => g.count > 0).map((g) => [g.grade, g.count]), [['3', 2], ['5', 1]]);
  assert.equal(r.endedInYear, 1); // 최점례 — 김말순의 2025 종료는 올해가 아니다
});

test('등급 변동은 같은 수급자의 앞뒤 등급이 다른 지점이고, 그 해 것만 센다', () => {
  const r = gradeReport(
    [
      gc(1, '김말순', '4', '2024-01-01', { status: 'ENDED', contractEnd: '2024-12-31' }),
      gc(1, '김말순', '3', '2026-01-01'), // 4→3: 등급이 무거워짐(UP)
      gc(2, '박봉례', '3', '2025-01-01', { status: 'ENDED', contractEnd: '2025-12-31' }),
      gc(2, '박봉례', '3', '2026-02-01'), // 같은 등급 갱신은 변동이 아니다
      gc(3, '이순남', '2', '2025-03-01', { status: 'ENDED', contractEnd: '2026-03-31' }),
      gc(3, '이순남', '4', '2026-04-01'), // 2→4: DOWN
      gc(4, '최점례', '5', '2025-05-01', { status: 'ENDED', contractEnd: '2026-04-30' }),
      gc(4, '최점례', 'cognitive', '2026-05-01'), // 인지지원등급이 끼면 방향 없음
      gc(5, '한갑수', '4', '2025-02-01', { status: 'ENDED', contractEnd: '2025-12-31' }),
      gc(5, '한갑수', '2', '2025-06-01'), // 작년 변동
    ],
    2026,
  );
  assert.deepEqual(r.changes.map((c) => [c.elderlyName, c.from, c.to, c.direction]), [
    ['김말순', '4', '3', 'UP'],
    ['이순남', '2', '4', 'DOWN'],
    ['최점례', '5', 'cognitive', null],
  ]);
  assert.equal(r.changes[0].on, '2026-01-01');
});

test('계약이 없으면 모두 0', () => {
  const r = gradeReport([], 2026);
  assert.equal(r.activeElders, 0);
  assert.equal(r.byGrade.every((g) => g.count === 0), true);
  assert.deepEqual(r.changes, []);
});
