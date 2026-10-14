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
  assert.equal(Object.keys(EVAL_AUTO_SOURCE_LABEL).length, 11);
});

test('위험도평가 지표 — 욕창·낙상·인지기능 세 기준을 요건에 적는다', () => {
  const text = indicatorByCode('SAFE-09')!.requirements.join(' ');
  assert.match(text, /인지기능/);
  assert.match(text, /K-MMSE/);
  assert.match(text, /Braden/);
  assert.match(text, /Morse/);
  assert.match(indicatorByCode('SAFE-09')!.title, /인지기능/);
});

test('3차 자동 근거 — 점검 주기 이행은 위생·식품·감염·안전환경 지표에, 재난훈련 연 2회는 재난 지표에 붙어 있다', () => {
  const by = (src: string) => EVAL_INDICATORS.filter((i) => i.autoSource === src).map((i) => i.code);
  assert.deepEqual(by('SAFETY_CHECKS'), ['SAFE-02', 'SAFE-03', 'SAFE-04', 'SAFE-06']);
  assert.deepEqual(by('DRILL_TWICE'), ['SAFE-07']);
  assert.match(indicatorByCode('SAFE-07')!.requirements.join(' '), /연 2회/);
  // 안전·위생 묶음 안에서만 붙는다
  for (const code of [...by('SAFETY_CHECKS'), ...by('DRILL_TWICE')]) assert.equal(indicatorByCode(code)!.group, 'SAFETY');
});

test('5차 자동 근거 — 사고 후속은 응급상황 대응, 보호자 월간 안내는 소통, 연계 건수는 외부기관 연계 지표에 붙어 있다', () => {
  const by = (src: string) => EVAL_INDICATORS.filter((i) => i.autoSource === src).map((i) => i.code);
  assert.deepEqual(by('CARE_EVENT_FOLLOWUP'), ['SAFE-08']);
  assert.deepEqual(by('GUARDIAN_NOTICE_MONTHLY'), ['RGT-01']);
  assert.deepEqual(by('RESOURCE_LINKS'), ['HLT-04']);
});

test('응급상황대응 요건 — 담당 역할·응급벨 위치·면담이 매뉴얼대로 적혀 있다', () => {
  const text = indicatorByCode('SAFE-08')!.requirements.join(' ');
  assert.match(text, /담당 역할/);
  assert.match(text, /심정지·질식·경련·화상·낙상/);
  assert.match(text, /화장실\(칸마다\)/);
  assert.match(text, /면담/);
  // 2026 지표에는 기록 필수사항이 없다 — 기관 자체 기록임을 밝힌다
  assert.match(text, /자체 기록/);
});

test('소통노력 요건 — 보호자 상담 분기 1회, 기관 소식 월 1회, 일방향 안내만으로는 인정 안 됨', () => {
  const text = indicatorByCode('RGT-01')!.requirements.join(' ');
  assert.match(text, /분기별 1회 이상/);
  assert.match(text, /월 1회 이상/);
  assert.match(text, /일방향 안내만으로는 상담으로 인정되지 않는다/);
  assert.match(text, /30일 이내/);
  // 화면 문구에도 같은 한계가 드러난다
  assert.match(EVAL_AUTO_SOURCE_LABEL.GUARDIAN_NOTICE_MONTHLY, /분기 1회/);
  assert.match(EVAL_AUTO_SOURCE_LABEL.GUARDIAN_NOTICE_MONTHLY, /일방향/);
});

test('외부기관연계 요건 — 진료 기록과 연계기록지·제공대장(제공자명 포함)', () => {
  const text = indicatorByCode('HLT-04')!.requirements.join(' ');
  assert.match(text, /연계기록지/);
  assert.match(text, /제공자명/);
  assert.match(text, /퇴소자가 없으면/);
});
