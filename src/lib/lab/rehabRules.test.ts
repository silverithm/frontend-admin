/**
 * 기능회복훈련 규칙 테스트 — `node --test src/lib/lab/rehabRules.test.ts`
 * 왜: 기록지 '기능회복훈련' 칸에 들어가는 문장과 월간 합계가 어긋나면 급여제공기록과 훈련 기록이 서로 모순된다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { REHAB_KINDS, isRehabKind, rehabCareRecordText, rehabKindLabel, rehabMonthly } from './rehabRules.ts';

const label = (v: string) => rehabKindLabel(v);

test('훈련 종류 — 계약의 여섯 값과 한글 이름', () => {
  assert.deepEqual(REHAB_KINDS.map((k) => k.value), ['PHYSICAL_FUNCTION', 'BASIC_MOTION', 'ADL', 'PHYSIO', 'OCCUPATIONAL', 'COGNITIVE']);
  assert.equal(label('PHYSICAL_FUNCTION'), '신체기능 훈련');
  assert.equal(label('COGNITIVE'), '인지기능 향상 훈련');
  assert.equal(label('UNKNOWN'), 'UNKNOWN');
  assert.equal(isRehabKind('ADL'), true);
  assert.equal(isRehabKind('adl'), false);
  assert.equal(isRehabKind(null), false);
});

test('기록지 문장 — 종류별로 묶고 분을 더하고 항목은 중복 없이 처음 순서로', () => {
  assert.equal(
    rehabCareRecordText([
      { kind: 'PHYSICAL_FUNCTION', minutes: 30, items: ['평행봉 걷기'] },
      { kind: 'OCCUPATIONAL', minutes: 20, items: [] },
      { kind: 'PHYSICAL_FUNCTION', minutes: 15, items: ['계단 오르기', '평행봉 걷기'] },
    ]),
    '신체기능 훈련 45분(평행봉 걷기, 계단 오르기), 작업치료 20분',
  );
});

test('기록지 문장 — 세션이 없으면 빈 문장, 항목이 모두 비면 괄호를 쓰지 않고 공백 항목은 버린다', () => {
  assert.equal(rehabCareRecordText([]), '');
  assert.equal(rehabCareRecordText([{ kind: 'PHYSIO', minutes: 30, items: ['', '  '] }]), '물리치료 30분');
  assert.equal(rehabCareRecordText([{ kind: 'ADL', minutes: 10, items: [' 옷 갈아입기 '] }]), '일상생활동작 훈련 10분(옷 갈아입기)');
});

const S = (elderlyId: number, elderlyName: string, sessionDate: string, kind: string, minutes: number) => ({ elderlyId, elderlyName, sessionDate, kind, minutes }) as never;

test('월간 요약 — 그 달만, 이름 가나다순, 같은 날 여러 번은 하루로 센다', () => {
  const rows = rehabMonthly(
    [
      S(2, '나어르신', '2026-10-02', 'PHYSIO', 30),
      S(1, '가어르신', '2026-10-02', 'PHYSIO', 30),
      S(1, '가어르신', '2026-10-02', 'ADL', 10),
      S(1, '가어르신', '2026-10-09', 'PHYSIO', 20),
      S(1, '가어르신', '2026-09-30', 'PHYSIO', 99),
      S(1, '가어르신', '2026-11-01', 'PHYSIO', 99),
    ],
    '2026-10',
  );
  assert.deepEqual(rows.map((r) => r.elderlyName), ['가어르신', '나어르신']);
  const a = rows[0];
  assert.deepEqual([a.sessions, a.minutes, a.days], [3, 60, 2]);
  assert.deepEqual(a.byKind.PHYSIO, { count: 2, minutes: 50 });
  assert.deepEqual(a.byKind.ADL, { count: 1, minutes: 10 });
  // 하지 않은 종류도 0으로 채워져 화면이 undefined를 만나지 않는다
  assert.deepEqual(a.byKind.COGNITIVE, { count: 0, minutes: 0 });
});

test('월간 요약 — 세션이 없는 달은 빈 목록, 분이 비정상이면 0분으로 센다', () => {
  assert.deepEqual(rehabMonthly([S(1, '가', '2026-09-01', 'ADL', 10)], '2026-10'), []);
  const [row] = rehabMonthly([S(1, '가', '2026-10-01', 'ADL', Number.NaN), S(1, '가', '2026-10-01', 'ADL', -5)], '2026-10');
  assert.equal(row.sessions, 2);
  assert.equal(row.minutes, 0);
});
