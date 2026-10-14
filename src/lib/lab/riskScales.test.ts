/**
 * 위험도 점수·반기 규칙 테스트 — `node --test src/lib/lab/riskScales.test.ts`
 * 왜: 구간 경계(9/10, 12/13, 14/15, 18/19, 24/25, 44/45)와 6/30↔7/1 반기 경계가 한 칸만 틀어도 평가 증빙이 틀린다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ALL_RISK_KINDS,
  COGNITIVE_TOOLS,
  RISK_ITEMS,
  RISK_KINDS,
  allowedValues,
  cleanCognitiveScores,
  elderHalfYearStatus,
  halfYearSummary,
  isRiskKind,
  isScaleKind,
  riskKindLabel,
  suggestCognitiveJudgment,
  currentHalfLabel,
  daysUntilHalfEnd,
  halfYearEnd,
  halfYearStatus,
  riskItemKeys,
  riskLevelLabel,
  riskLevelTone,
  scoreAssessment,
} from './riskScales.ts';

const braden = (v: number[]) => ({ sensory: v[0], moisture: v[1], activity: v[2], mobility: v[3], nutrition: v[4], friction: v[5] });
const morse = (v: number[]) => ({ history: v[0], secondaryDiagnosis: v[1], ambulatoryAid: v[2], ivTherapy: v[3], gait: v[4], mentalStatus: v[5] });

test('Braden 구간 경계 — 9/10, 12/13, 14/15, 18/19', () => {
  const cases: Array<[number[], number, string]> = [
    [[1, 1, 1, 1, 1, 1], 6, 'VERY_HIGH'],
    [[2, 2, 1, 1, 2, 1], 9, 'VERY_HIGH'],
    [[2, 2, 2, 1, 2, 1], 10, 'HIGH'],
    [[2, 2, 2, 2, 2, 2], 12, 'HIGH'],
    [[3, 2, 2, 2, 2, 2], 13, 'MODERATE'],
    [[3, 3, 2, 2, 2, 2], 14, 'MODERATE'],
    [[3, 3, 3, 2, 2, 2], 15, 'MILD'],
    [[4, 3, 3, 3, 3, 2], 18, 'MILD'],
    [[4, 4, 3, 3, 3, 2], 19, 'NONE'],
    [[4, 4, 4, 4, 4, 3], 23, 'NONE'],
  ];
  for (const [v, total, level] of cases) {
    assert.deepEqual(scoreAssessment('BRADEN', braden(v)), { total, riskLevel: level }, `Braden ${v}`);
  }
});

test('Morse 구간 경계 — 24/25, 44/45', () => {
  const cases: Array<[number[], number, string]> = [
    [[0, 0, 0, 0, 0, 0], 0, 'LOW'],
    [[0, 15, 0, 0, 0, 0], 15, 'LOW'],
    [[25, 0, 0, 0, 0, 0], 25, 'MODERATE'],
    [[25, 15, 0, 0, 0, 0], 40, 'MODERATE'],
    [[25, 0, 0, 20, 0, 0], 45, 'HIGH'],
    [[25, 15, 30, 20, 20, 15], 125, 'HIGH'],
  ];
  for (const [v, total, level] of cases) {
    assert.deepEqual(scoreAssessment('MORSE', morse(v)), { total, riskLevel: level }, `Morse ${v}`);
  }
  // 허용값 조합으로는 24점이 나올 수 없다(15+10=25가 가장 가까움) — 25점이 곧바로 '중간'이어야 한다
  assert.equal((scoreAssessment('MORSE', morse([0, 15, 0, 0, 10, 0])) as { total: number }).total, 25);
});

test('Braden 허용 범위 밖·누락·모르는 항목은 오류', () => {
  assert.ok(scoreAssessment('BRADEN', { ...braden([1, 1, 1, 1, 1, 1]), friction: 4 }).error);
  assert.ok(scoreAssessment('BRADEN', { ...braden([1, 1, 1, 1, 1, 1]), sensory: 0 }).error);
  assert.ok(scoreAssessment('BRADEN', { sensory: 1 }).error);
  assert.ok(scoreAssessment('BRADEN', { ...braden([1, 1, 1, 1, 1, 1]), extra: 1 }).error);
  assert.ok(scoreAssessment('BRADEN', { ...braden([1, 1, 1, 1, 1, 1]), moisture: 2.5 }).error);
  assert.ok(scoreAssessment('BRADEN', { ...braden([1, 1, 1, 1, 1, 1]), moisture: '2' }).error);
});

test('Morse 허용값 밖은 오류 (gait 13, history 10)', () => {
  assert.ok(scoreAssessment('MORSE', { ...morse([0, 0, 0, 0, 0, 0]), gait: 13 }).error);
  assert.ok(scoreAssessment('MORSE', { ...morse([0, 0, 0, 0, 0, 0]), history: 10 }).error);
  assert.ok(scoreAssessment('MORSE', { ...morse([0, 0, 0, 0, 0, 0]), ambulatoryAid: 20 }).error);
});

test('잘못된 입력 형태와 도구 이름은 오류', () => {
  assert.ok(scoreAssessment('BRADEN', null).error);
  assert.ok(scoreAssessment('BRADEN', []).error);
  assert.ok(scoreAssessment('BRADEN', 'x').error);
  assert.ok(scoreAssessment('NORTON' as never, {}).error);
});

test('항목 정의: Braden 6항목(마찰만 3단계), Morse 6항목, 옵션에 안내 문구가 있다', () => {
  assert.deepEqual(riskItemKeys('BRADEN'), ['sensory', 'moisture', 'activity', 'mobility', 'nutrition', 'friction']);
  assert.deepEqual(riskItemKeys('MORSE'), ['history', 'secondaryDiagnosis', 'ambulatoryAid', 'ivTherapy', 'gait', 'mentalStatus']);
  assert.deepEqual(allowedValues('BRADEN', 'friction'), [1, 2, 3]);
  assert.deepEqual(allowedValues('MORSE', 'ambulatoryAid'), [0, 15, 30]);
  assert.deepEqual(allowedValues('MORSE', 'nope'), []);
  for (const kind of ['BRADEN', 'MORSE'] as const) {
    for (const item of RISK_ITEMS[kind]) {
      assert.ok(item.label && item.question);
      for (const o of item.options) assert.ok(o.label && o.hint, `${item.key}:${o.value}`);
    }
  }
});

test('반기 규칙 — 7/1부터 하반기, 6/30은 상반기', () => {
  const today = new Date('2026-10-14T09:00:00+09:00');
  assert.equal(halfYearStatus('2026-07-01', today), 'DONE');
  assert.equal(halfYearStatus('2026-12-31', today), 'DONE');
  assert.equal(halfYearStatus('2026-06-30', today), 'DUE');
  assert.equal(halfYearStatus('2025-12-31', today), 'DUE');
  assert.equal(halfYearStatus(null, today), 'NEVER');
  assert.equal(halfYearStatus(undefined, today), 'NEVER');
  assert.equal(halfYearStatus('not-a-date', today), 'NEVER');
  assert.equal(halfYearStatus('2026-02-30', today), 'NEVER');
});

test('반기 규칙 — 상반기 안에서는 1/1~6/30 모두 DONE, 전년 하반기는 DUE', () => {
  const today = new Date('2026-03-02T09:00:00+09:00');
  assert.equal(halfYearStatus('2026-01-01', today), 'DONE');
  assert.equal(halfYearStatus('2026-06-30', today), 'DONE');
  assert.equal(halfYearStatus('2025-12-31', today), 'DUE');
  assert.equal(halfYearStatus('2026-03-02T10:00:00', today), 'DONE');
});

test('반기 경계는 한국 날짜 기준 — UTC로는 6/30이어도 KST 7/1 새벽이면 하반기', () => {
  const kstJuly1Early = new Date('2026-06-30T16:30:00Z'); // KST 2026-07-01 01:30
  assert.equal(halfYearStatus('2026-06-30', kstJuly1Early), 'DUE');
  assert.equal(currentHalfLabel(kstJuly1Early), '2026년 하반기');
  const kstJune30Late = new Date('2026-06-30T14:59:00Z'); // KST 2026-06-30 23:59
  assert.equal(halfYearStatus('2026-06-30', kstJune30Late), 'DONE');
  assert.equal(currentHalfLabel(kstJune30Late), '2026년 상반기');
  // 연말 경계: UTC 12/31 16:00 = KST 1/1 01:00 → 새해 상반기
  assert.equal(currentHalfLabel(new Date('2026-12-31T16:00:00Z')), '2027년 상반기');
});

test('반기 라벨·끝나는 날·남은 날수', () => {
  assert.equal(currentHalfLabel(new Date('2026-10-14T09:00:00+09:00')), '2026년 하반기');
  assert.equal(halfYearEnd(new Date('2026-10-14T09:00:00+09:00')), '2026-12-31');
  assert.equal(halfYearEnd(new Date('2026-02-01T09:00:00+09:00')), '2026-06-30');
  assert.equal(daysUntilHalfEnd(new Date('2026-12-31T09:00:00+09:00')), 0);
  assert.equal(daysUntilHalfEnd(new Date('2026-12-01T09:00:00+09:00')), 30);
});

test('등급 이름과 색 단계', () => {
  assert.equal(riskLevelLabel('VERY_HIGH'), '매우 높음');
  assert.equal(riskLevelLabel('LOW'), '낮음');
  assert.equal(riskLevelTone('HIGH'), 'danger');
  assert.equal(riskLevelTone('MODERATE'), 'warning');
  assert.equal(riskLevelTone('MILD'), 'caution');
  assert.equal(riskLevelTone('NONE'), 'ok');
  assert.equal(riskLevelTone('LOW'), 'ok');
});

// ---------- 인지기능 평가 ----------

test('인지 판정 제안 — K-MMSE 경계 24/23/18/17, 범위 밖·소수·없음은 제안하지 않는다', () => {
  const j = (score?: number | null) => suggestCognitiveJudgment('KMMSE', score);
  assert.equal(j(30), 'NORMAL');
  assert.equal(j(24), 'NORMAL');
  assert.equal(j(23), 'SUSPECTED');
  assert.equal(j(18), 'SUSPECTED');
  assert.equal(j(17), 'IMPAIRED');
  assert.equal(j(0), 'IMPAIRED');
  assert.equal(j(31), null);
  assert.equal(j(-1), null);
  assert.equal(j(23.5), null);
  assert.equal(j(undefined), null);
  assert.equal(j(null), null);
});

test('인지 판정 제안 — CIST·외부기관은 제안 없음, 치매 진단은 인지저하가 기본', () => {
  assert.equal(suggestCognitiveJudgment('CIST', 20), null);
  assert.equal(suggestCognitiveJudgment('EXTERNAL'), null);
  assert.equal(suggestCognitiveJudgment('DIAGNOSIS'), 'IMPAIRED');
  assert.equal(suggestCognitiveJudgment('DIAGNOSIS', 28), 'IMPAIRED');
});

test('인지 평가 도구 정의 — 네 가지, 점수·기관 필수 조건', () => {
  assert.deepEqual(COGNITIVE_TOOLS.map((t) => t.id), ['KMMSE', 'CIST', 'EXTERNAL', 'DIAGNOSIS']);
  assert.deepEqual(COGNITIVE_TOOLS.filter((t) => t.scoreRequired).map((t) => t.id), ['KMMSE', 'CIST']);
  assert.deepEqual(COGNITIVE_TOOLS.filter((t) => t.institutionRequired).map((t) => t.id), ['EXTERNAL']);
});

test('scoreAssessment(COGNITIVE) — total은 점수(없으면 0), riskLevel은 판정 그대로', () => {
  assert.deepEqual(scoreAssessment('COGNITIVE', { tool: 'KMMSE', score: 22, judgment: 'SUSPECTED' }), { total: 22, riskLevel: 'SUSPECTED' });
  assert.deepEqual(scoreAssessment('COGNITIVE', { tool: 'EXTERNAL', institution: '강남구 치매안심센터', judgment: 'NORMAL' }), { total: 0, riskLevel: 'NORMAL' });
  assert.deepEqual(scoreAssessment('COGNITIVE', { tool: 'DIAGNOSIS', judgment: 'IMPAIRED' }), { total: 0, riskLevel: 'IMPAIRED' });
  assert.deepEqual(scoreAssessment('COGNITIVE', { tool: 'CIST', score: 0, judgment: 'IMPAIRED' }), { total: 0, riskLevel: 'IMPAIRED' }, '0점도 점수다');
});

test('scoreAssessment(COGNITIVE) — 검증 실패는 모두 오류', () => {
  const bad = (scores: unknown) => assert.ok('error' in scoreAssessment('COGNITIVE', scores), JSON.stringify(scores));
  bad(null);
  bad([]);
  bad({});
  bad({ tool: 'MMSE', score: 20, judgment: 'NORMAL' });
  bad({ tool: 'KMMSE', judgment: 'NORMAL' }); // 점수 필수
  bad({ tool: 'CIST', score: null, judgment: 'NORMAL' });
  bad({ tool: 'KMMSE', score: 31, judgment: 'NORMAL' });
  bad({ tool: 'KMMSE', score: -1, judgment: 'NORMAL' });
  bad({ tool: 'KMMSE', score: 20.5, judgment: 'NORMAL' });
  bad({ tool: 'KMMSE', score: '20', judgment: 'NORMAL' });
  bad({ tool: 'KMMSE', score: 20 }); // 판정 없음
  bad({ tool: 'KMMSE', score: 20, judgment: 'HIGH' });
  bad({ tool: 'EXTERNAL', judgment: 'NORMAL' }); // 기관 필수
  bad({ tool: 'EXTERNAL', institution: '   ', judgment: 'NORMAL' });
  bad({ tool: 'EXTERNAL', institution: '가'.repeat(51), judgment: 'NORMAL' });
  bad({ tool: 'DIAGNOSIS', score: 40, judgment: 'IMPAIRED' }); // 선택 점수도 범위는 본다
  bad({ tool: 'KMMSE', score: 20, judgment: 'NORMAL', extra: 1 });
});

test('cleanCognitiveScores — 필요 없는 칸은 빼고 기관명은 외부기관일 때만 남긴다', () => {
  assert.deepEqual(cleanCognitiveScores({ tool: 'KMMSE', score: 20, judgment: 'SUSPECTED', institution: '무관한 기관' }), { tool: 'KMMSE', score: 20, judgment: 'SUSPECTED' });
  assert.deepEqual(cleanCognitiveScores({ tool: 'EXTERNAL', score: null, judgment: 'NORMAL', institution: ' 보건소 ' }), { tool: 'EXTERNAL', judgment: 'NORMAL', institution: '보건소' });
  assert.deepEqual(cleanCognitiveScores({ tool: 'DIAGNOSIS', judgment: 'IMPAIRED' }), { tool: 'DIAGNOSIS', judgment: 'IMPAIRED' });
});

test('평가 종류 — 세 가지가 있고, 점수 합산 도구는 두 가지, 라벨·색 단계에 인지 판정도 포함', () => {
  assert.deepEqual(ALL_RISK_KINDS.map((k) => k.id), ['BRADEN', 'MORSE', 'COGNITIVE']);
  assert.deepEqual(RISK_KINDS.map((k) => k.id), ['BRADEN', 'MORSE']);
  assert.equal(isRiskKind('COGNITIVE'), true);
  assert.equal(isScaleKind('COGNITIVE'), false);
  assert.equal(isScaleKind('MORSE'), true);
  assert.equal(riskKindLabel('COGNITIVE'), '인지기능 평가');
  assert.equal(riskLevelLabel('NORMAL'), '정상');
  assert.equal(riskLevelLabel('SUSPECTED'), '의심');
  assert.equal(riskLevelLabel('IMPAIRED'), '인지저하');
  assert.equal(riskLevelTone('NORMAL'), 'ok');
  assert.equal(riskLevelTone('SUSPECTED'), 'caution');
  assert.equal(riskLevelTone('IMPAIRED'), 'danger');
  assert.deepEqual(RISK_ITEMS.COGNITIVE, []);
  assert.deepEqual(riskItemKeys('COGNITIVE'), []);
});

// ---------- 반기 점검 세 기준 ----------

const entry = (assessedOn: string) => ({ assessedOn, total: 10, riskLevel: 'HIGH' as const });
const NOW = new Date('2026-10-14T09:00:00+09:00');

test('어르신별 반기 점검 — 욕창·낙상·인지를 따로 본다, 인지 응답이 없으면(옛 서버) 기록 없음', () => {
  const status = elderHalfYearStatus({ braden: entry('2026-09-01'), morse: entry('2026-03-01'), cognitive: null }, NOW);
  assert.deepEqual(status, { BRADEN: 'DONE', MORSE: 'DUE', COGNITIVE: 'NEVER' });
  const legacy = elderHalfYearStatus({ braden: entry('2026-09-01'), morse: entry('2026-09-01') }, NOW);
  assert.equal(legacy.COGNITIVE, 'NEVER');
});

test('반기 점검은 서울 날짜 기준 — 6/30 23:30 KST까지는 상반기, 7/1 00:10 KST부터 하반기', () => {
  const june = new Date('2026-06-30T23:30:00+09:00');
  const july = new Date('2026-07-01T00:10:00+09:00');
  const last = { braden: entry('2026-06-30'), morse: entry('2026-06-30'), cognitive: entry('2026-06-30') };
  assert.equal(elderHalfYearStatus(last, june).COGNITIVE, 'DONE');
  assert.equal(elderHalfYearStatus(last, july).COGNITIVE, 'DUE');
});

test('halfYearSummary — 세 가지를 모두 마쳐야 완료, 남은 어르신과 빠진 종류를 알려 준다', () => {
  const list = [
    { elderlyId: 1, braden: entry('2026-08-01'), morse: entry('2026-08-01'), cognitive: entry('2026-08-01') },
    { elderlyId: 2, braden: entry('2026-08-01'), morse: entry('2026-08-01'), cognitive: null },
    { elderlyId: 3, braden: null, morse: null, cognitive: entry('2026-02-01') },
  ];
  const s = halfYearSummary(list, NOW);
  assert.equal(s.total, 3);
  assert.equal(s.allDone, 1);
  assert.deepEqual(s.done, { BRADEN: 2, MORSE: 2, COGNITIVE: 1 });
  assert.deepEqual(s.pending, [
    { elderlyId: 2, missing: ['COGNITIVE'] },
    { elderlyId: 3, missing: ['BRADEN', 'MORSE', 'COGNITIVE'] },
  ]);
  assert.deepEqual(halfYearSummary([], NOW), { total: 0, done: { BRADEN: 0, MORSE: 0, COGNITIVE: 0 }, allDone: 0, pending: [] });
});
