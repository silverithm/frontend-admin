/**
 * 평가 지표 목록·준비율 테스트 — `node --test src/lib/lab/evalIndicators.test.ts`
 * 왜: 지표 코드는 서버에 저장되는 키라 중복·형식 오류가 곧 데이터 오류다. 준비율 계산이 한 칸 어긋나면 점검표가 거짓 안심을 준다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { EVAL_AUTO_SOURCE_LABEL, EVAL_GROUPS, EVAL_INDICATORS, groupLabel, indicatorByCode, indicatorsByGroup, readinessSummary } from './evalIndicators.ts';

/** 2026판에서 삭제된 지표를 뺀, 준비율에 드는 지표 */
const ACTIVE = EVAL_INDICATORS.filter((i) => !i.deletedIn2026);

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
  const n = ACTIVE.length;
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
  assert.equal(s.missing, ACTIVE.length);
});

test('readinessSummary — 전부 준비 완료면 100%', () => {
  const all = EVAL_INDICATORS.map((i) => ({ indicatorCode: i.code, status: 'READY' as const }));
  assert.deepEqual(readinessSummary(all), { ready: ACTIVE.length, partial: 0, missing: 0, total: ACTIVE.length, percent: 100 });
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
  assert.equal(Object.keys(EVAL_AUTO_SOURCE_LABEL).length, 15);
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

test('외부기관연계 요건 — 기준①(진료 기록)은 HLT-04, 기준②(연계기록지·제공대장, 제공자명 포함)는 HLT-05', () => {
  const clinic = indicatorByCode('HLT-04')!;
  assert.match(clinic.requirements.join(' '), /동행한 진료/);
  assert.equal(clinic.autoSource, 'RESOURCE_LINKS');
  const text = indicatorByCode('HLT-05')!.requirements.join(' ');
  assert.match(text, /연계기록지/);
  assert.match(text, /제공자명/);
  assert.match(text, /퇴소자가 없으면/);
  assert.match(text, /사망/);
});

test('6차 자동 근거 — 약품 점검·퇴소 연계기록지·계획 통보·인권 안내가 각각 한 지표에 붙어 있다', () => {
  const by = (src: string) => EVAL_INDICATORS.filter((i) => i.autoSource === src).map((i) => i.code);
  assert.deepEqual(by('MEDICINE_QUARTERLY'), ['HLT-02']);
  assert.deepEqual(by('DISCHARGE_REFERRAL'), ['HLT-05']);
  assert.deepEqual(by('PLAN_NOTIFIED_BY_START'), ['SVC-08']);
  assert.deepEqual(by('RIGHTS_GUIDE_14D'), ['RGT-03']);
  // 기존 연결은 그대로
  assert.deepEqual(by('CARE_PLAN_AGREEMENT'), ['SVC-04']);
  assert.deepEqual(by('RESOURCE_LINKS'), ['HLT-04']);
});

test('투약 및 약품관리 요건 — 잠금(냉장고 포함)·분기 점검 항목(폐기일자)·사용기한 지난 약 불인정·6원칙 면담', () => {
  const store = indicatorByCode('HLT-02')!.requirements.join(' ');
  assert.match(store, /냉장고도 잠금/);
  assert.match(store, /분기별 1회 이상/);
  assert.match(store, /폐기일자/);
  assert.match(store, /사용기한이 지난 약품을 보관하고 있으면 불인정/);
  const dosing = indicatorByCode('HLT-01')!.requirements.join(' ');
  assert.match(dosing, /투약 6원칙/);
  assert.match(dosing, /시설장과 면담/);
});

test('급여제공계획 통보·노인인권 안내 요건 — 시작일까지·14일 이내', () => {
  assert.match(indicatorByCode('SVC-08')!.requirements.join(' '), /급여제공 시작일까지 공단에 통보/);
  assert.match(indicatorByCode('RGT-03')!.requirements.join(' '), /14일 이내/);
  assert.match(EVAL_AUTO_SOURCE_LABEL.RIGHTS_GUIDE_14D, /14일/);
  assert.match(EVAL_AUTO_SOURCE_LABEL.PLAN_NOTIFIED_BY_START, /시작일까지/);
});

test('2026판에서 삭제된 계약체결·통보 지표는 삭제됐다고 표시하고 준비율에서 뺀다', () => {
  const deleted = EVAL_INDICATORS.filter((i) => i.deletedIn2026).map((i) => i.code);
  assert.deepEqual(deleted, ['SVC-01', 'SVC-02']);
  for (const code of deleted) assert.match(indicatorByCode(code)!.title, /2026판 평가에서 삭제/);
  assert.equal(ACTIVE.length, EVAL_INDICATORS.length - 2);
  // 삭제된 지표에 READY를 적어 두어도 세지 않는다
  const s = readinessSummary([{ indicatorCode: 'SVC-01', status: 'READY' }, { indicatorCode: 'SVC-02', status: 'READY' }]);
  assert.equal(s.ready, 0);
  assert.equal(s.total, ACTIVE.length);
});
