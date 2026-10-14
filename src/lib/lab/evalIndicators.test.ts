/**
 * 평가 지표 목록·준비율 테스트 — `node --test src/lib/lab/evalIndicators.test.ts`
 * 왜: 지표 코드는 서버에 저장되는 키라 중복·형식 오류가 곧 데이터 오류다. 준비율 계산이 한 칸 어긋나면 점검표가 거짓 안심을 준다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { EVAL_AUTO_SOURCE_LABEL, EVAL_GROUPS, EVAL_INDICATORS, groupLabel, indicatorByCode, indicatorsByGroup, readinessSummary } from './evalIndicators.ts';

test('지표 24개 이상, 코드는 서버 규칙(^[A-Z0-9_-]{2,40}$)에 맞고 중복이 없다', () => {
  assert.ok(EVAL_INDICATORS.length >= 24);
  const codes = EVAL_INDICATORS.map((i) => i.code);
  assert.equal(new Set(codes).size, codes.length);
  for (const code of codes) assert.match(code, /^[A-Z0-9_-]{2,40}$/);
});

test('모든 지표에 제목·묶음·요건(문장)이 있다', () => {
  const groupIds = new Set(EVAL_GROUPS.map((g) => g.id));
  for (const i of EVAL_INDICATORS) {
    assert.ok(i.title.length >= 4, i.code);
    assert.ok(groupIds.has(i.group), `${i.code} 묶음`);
    assert.ok(i.requirements.length >= 2, `${i.code} 요건 수`);
    for (const r of i.requirements) assert.ok(r.length >= 8 && r.length <= 300, `${i.code}: ${r}`);
  }
});

test('일곱 묶음이 모두 채워져 있다', () => {
  assert.deepEqual(EVAL_GROUPS.map((g) => g.label), ['운영', '안전·위생', '급여제공', '간호·건강', '이동서비스', '프로그램', '권익·소통']);
  for (const g of indicatorsByGroup()) assert.ok(g.indicators.length > 0, g.label);
  assert.equal(indicatorsByGroup().reduce((n, g) => n + g.indicators.length, 0), EVAL_INDICATORS.length);
  assert.equal(groupLabel('SAFETY'), '안전·위생');
});

test('자동 근거 연결 — 위험도 반기·제공대장·문구 점검이 각각 한 지표에 붙어 있다', () => {
  const by = (src: string) => EVAL_INDICATORS.filter((i) => i.autoSource === src);
  assert.equal(by('RISK_HALF_YEAR').length, 1);
  assert.equal(by('CARE_RECORD_DELIVERY').length, 1);
  assert.equal(by('CARE_RECORD_QUALITY').length, 1);
  assert.match(by('RISK_HALF_YEAR')[0].requirements.join(' '), /반기/);
  assert.match(by('CARE_RECORD_DELIVERY')[0].requirements.join(' '), /월 1회/);
});

test('indicatorByCode', () => {
  assert.equal(indicatorByCode('SAFE-09')?.autoSource, 'RISK_HALF_YEAR');
  assert.equal(indicatorByCode('NOPE'), undefined);
});

test('readinessSummary — 기록 없는 지표는 준비 안 됨, 해당 없음은 대상에서 제외', () => {
  const n = EVAL_INDICATORS.length;
  assert.deepEqual(readinessSummary([]), { ready: 0, partial: 0, missing: n, total: n, percent: 0 });
  const s = readinessSummary([
    { indicatorCode: 'OPS-01', status: 'READY' },
    { indicatorCode: 'OPS-02', status: 'READY' },
    { indicatorCode: 'OPS-03', status: 'PARTIAL' },
    { indicatorCode: 'OPS-04', status: 'MISSING' },
    { indicatorCode: 'TRN-01', status: 'NOT_APPLICABLE' },
    { indicatorCode: 'TRN-02', status: 'NOT_APPLICABLE' },
  ]);
  assert.equal(s.total, n - 2);
  assert.equal(s.ready, 2);
  assert.equal(s.partial, 1);
  assert.equal(s.missing, n - 2 - 3);
  assert.equal(s.percent, Math.round((2 / (n - 2)) * 100));
});

test('readinessSummary — 목록에 없는 코드는 세지 않고, 중복 코드는 마지막 값', () => {
  const s = readinessSummary([
    { indicatorCode: 'OLD-99', status: 'READY' },
    { indicatorCode: 'OPS-01', status: 'READY' },
    { indicatorCode: 'OPS-01', status: 'MISSING' },
  ]);
  assert.equal(s.ready, 0);
  assert.equal(s.missing, EVAL_INDICATORS.length);
});

test('readinessSummary — 전부 준비 완료면 100%', () => {
  const all = EVAL_INDICATORS.map((i) => ({ indicatorCode: i.code, status: 'READY' as const }));
  assert.deepEqual(readinessSummary(all), { ready: EVAL_INDICATORS.length, partial: 0, missing: 0, total: EVAL_INDICATORS.length, percent: 100 });
  const none = EVAL_INDICATORS.map((i) => ({ indicatorCode: i.code, status: 'NOT_APPLICABLE' as const }));
  assert.deepEqual(readinessSummary(none), { ready: 0, partial: 0, missing: 0, total: 0, percent: 0 });
});

test('2차 자동 근거 — 인지 프로그램 주 3회·법정 교육 이수·급여계획 동의가 각각 한 지표에 붙어 있다', () => {
  const by = (src: string) => EVAL_INDICATORS.filter((i) => i.autoSource === src);
  assert.deepEqual(by('PROGRAM_COGNITIVE_WEEKLY').map((i) => i.code), ['PRG-01']);
  assert.deepEqual(by('TRAINING_COVERAGE').map((i) => i.code), ['OPS-04']);
  assert.deepEqual(by('CARE_PLAN_AGREEMENT').map((i) => i.code), ['SVC-04']);
  assert.match(by('PROGRAM_COGNITIVE_WEEKLY')[0].requirements.join(' '), /주 3회/);
  assert.match(by('TRAINING_COVERAGE')[0].requirements.join(' '), /법정 교육/);
  assert.match(by('CARE_PLAN_AGREEMENT')[0].requirements.join(' '), /동의/);
});

test('자동 근거 이름표 — 모든 자동 근거에 화면용 문구가 있다', () => {
  for (const i of EVAL_INDICATORS) if (i.autoSource) assert.ok(EVAL_AUTO_SOURCE_LABEL[i.autoSource].length > 3, i.code);
  assert.equal(Object.keys(EVAL_AUTO_SOURCE_LABEL).length, 6);
});

test('위험도평가 지표 — 욕창·낙상·인지기능 세 기준을 요건에 적는다', () => {
  const text = indicatorByCode('SAFE-09')!.requirements.join(' ');
  assert.match(text, /인지기능/);
  assert.match(text, /K-MMSE/);
  assert.match(text, /Braden/);
  assert.match(text, /Morse/);
  assert.match(indicatorByCode('SAFE-09')!.title, /인지기능/);
});
