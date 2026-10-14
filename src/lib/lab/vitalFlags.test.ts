/**
 * 바이탈 판정 테스트 — `node --test src/lib/lab/vitalFlags.test.ts`
 * 왜: 경계값(160/159, 100/99, 37.8/37.7, 70/69 …)이 한 칸만 어긋나도 간호일지 배지가 거짓 안심 또는 거짓 경보를 낸다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { closestPreviousWeight, daysBetween, evaluateVitalSeries, evaluateVitals, worstVitalLevel } from './vitalFlags.ts';

const level = (reading: Parameters<typeof evaluateVitals>[0], metric: string, previous?: Parameters<typeof evaluateVitals>[1], today?: string) =>
  evaluateVitals(reading, previous, today).find((f) => f.metric === metric)?.level ?? 'NONE';

test('혈압 경계 — 수축기 160/159/140/139/90/89', () => {
  const cases: Array<[number, string]> = [[160, 'HIGH'], [159, 'WATCH'], [140, 'WATCH'], [139, 'NONE'], [90, 'NONE'], [89, 'LOW']];
  for (const [systolic, want] of cases) assert.equal(level({ systolic, diastolic: 70 }, 'bloodPressure'), want, `수축기 ${systolic}`);
});

test('혈압 경계 — 이완기 100/99/90/89', () => {
  const cases: Array<[number, string]> = [[100, 'HIGH'], [99, 'WATCH'], [90, 'WATCH'], [89, 'NONE']];
  for (const [diastolic, want] of cases) assert.equal(level({ systolic: 125, diastolic }, 'bloodPressure'), want, `이완기 ${diastolic}`);
});

test('혈압 — 한쪽만 높아도 높은 쪽 단계, 수축기만 입력해도 판정한다', () => {
  assert.equal(level({ systolic: 135, diastolic: 101 }, 'bloodPressure'), 'HIGH');
  assert.equal(level({ systolic: 165 }, 'bloodPressure'), 'HIGH');
  assert.equal(level({ diastolic: 95 }, 'bloodPressure'), 'WATCH');
  assert.equal(level({ systolic: 85 }, 'bloodPressure'), 'LOW');
});

test('혈압 — 수축기가 이완기보다 낮은 입력 오류는 판정하지 않는다', () => {
  assert.equal(level({ systolic: 80, diastolic: 120 }, 'bloodPressure'), 'NONE');
});

test('체온 경계 — 37.8/37.7/37.3/37.2/35.5/35.4', () => {
  const cases: Array<[number, string]> = [[37.8, 'HIGH'], [37.7, 'WATCH'], [37.3, 'WATCH'], [37.2, 'NONE'], [35.5, 'NONE'], [35.4, 'LOW']];
  for (const [temperature, want] of cases) assert.equal(level({ temperature }, 'temperature'), want, `${temperature}℃`);
});

test('혈당 경계 — 69/70/179/180/249/250', () => {
  const cases: Array<[number, string]> = [[69, 'LOW'], [70, 'NONE'], [179, 'NONE'], [180, 'WATCH'], [249, 'WATCH'], [250, 'HIGH']];
  for (const [bloodSugar, want] of cases) assert.equal(level({ bloodSugar }, 'bloodSugar'), want, `${bloodSugar}`);
});

test('맥박 경계 — 49/50/110/111 (관찰 단계만 있다)', () => {
  const cases: Array<[number, string]> = [[49, 'WATCH'], [50, 'NONE'], [110, 'NONE'], [111, 'WATCH']];
  for (const [pulse, want] of cases) assert.equal(level({ pulse }, 'pulse'), want, `${pulse}`);
});

test('값이 없으면 판정하지 않는다 — 빈 객체·null·undefined·NaN·문자열', () => {
  assert.deepEqual(evaluateVitals({}), []);
  assert.deepEqual(evaluateVitals({ systolic: null, diastolic: null, pulse: null, temperature: null, bloodSugar: null, weight: null }), []);
  assert.deepEqual(evaluateVitals({ temperature: Number.NaN, pulse: undefined }), []);
  assert.deepEqual(evaluateVitals({ temperature: '38' as unknown as number }), []);
});

test('여러 항목이 동시에 걸리면 항목마다 한 줄씩, 메시지에 수치가 들어간다', () => {
  const flags = evaluateVitals({ systolic: 170, diastolic: 105, temperature: 38.2, bloodSugar: 60 });
  assert.deepEqual(flags.map((f) => f.metric).sort(), ['bloodPressure', 'bloodSugar', 'temperature']);
  assert.match(flags.find((f) => f.metric === 'bloodPressure')!.message, /170\/105/);
  assert.match(flags.find((f) => f.metric === 'temperature')!.message, /38\.2/);
  assert.equal(worstVitalLevel(flags), 'HIGH');
  assert.equal(worstVitalLevel([]), null);
  assert.equal(worstVitalLevel([{ level: 'WATCH' }, { level: 'LOW' }]), 'LOW');
});

test('체중 — 5% 정확히는 관찰, 4.9%는 아님, 감소도 본다', () => {
  assert.equal(level({ weight: 52.5 }, 'weight', { weight: 50, logDate: '2026-10-01' }, '2026-10-20'), 'WATCH');
  assert.equal(level({ weight: 52.4 }, 'weight', { weight: 50, logDate: '2026-10-01' }, '2026-10-20'), 'NONE');
  assert.equal(level({ weight: 47.5 }, 'weight', { weight: 50, logDate: '2026-10-01' }, '2026-10-20'), 'WATCH');
  const down = evaluateVitals({ weight: 45 }, { weight: 50, logDate: '2026-10-01' }, '2026-10-20')[0];
  assert.match(down.message, /-10\.0%/);
  assert.match(down.message, /19일 전/);
});

test('체중 — 30일 경계: 30일은 비교, 31일은 비교하지 않는다', () => {
  assert.equal(level({ weight: 55 }, 'weight', { weight: 50, logDate: '2026-09-20' }, '2026-10-20'), 'WATCH'); // 30일
  assert.equal(level({ weight: 55 }, 'weight', { weight: 50, logDate: '2026-09-19' }, '2026-10-20'), 'NONE'); // 31일
});

test('체중 — 같은 날·미래 날짜·잘못된 날짜·0kg 이전 기록은 비교하지 않는다', () => {
  assert.equal(level({ weight: 60 }, 'weight', { weight: 50, logDate: '2026-10-20' }, '2026-10-20'), 'NONE');
  assert.equal(level({ weight: 60 }, 'weight', { weight: 50, logDate: '2026-10-25' }, '2026-10-20'), 'NONE');
  assert.equal(level({ weight: 60 }, 'weight', { weight: 50, logDate: '2026-13-40' }, '2026-10-20'), 'NONE');
  assert.equal(level({ weight: 60 }, 'weight', { weight: 0, logDate: '2026-10-01' }, '2026-10-20'), 'NONE');
  assert.equal(level({ weight: 60 }, 'weight', undefined, '2026-10-20'), 'NONE');
});

test('daysBetween — 월 경계·윤년·잘못된 날짜', () => {
  assert.equal(daysBetween('2026-10-01', '2026-10-20'), 19);
  assert.equal(daysBetween('2024-02-28', '2024-03-01'), 2);
  assert.equal(daysBetween('2025-12-31', '2026-01-01'), 1);
  assert.equal(daysBetween('2026-02-30', '2026-03-01'), null);
});

test('closestPreviousWeight — 30일 안에서 가장 가까운 이전 기록, 체중 없는 날·같은 날·먼 기록은 건너뛴다', () => {
  const logs = [
    { logDate: '2026-09-01', weight: 50 }, // 49일 전: 범위 밖
    { logDate: '2026-10-05', weight: 51 },
    { logDate: '2026-10-12', weight: null }, // 체중 없음
    { logDate: '2026-10-10', weight: 52 },
    { logDate: '2026-10-20', weight: 53 }, // 같은 날
  ];
  assert.deepEqual(closestPreviousWeight(logs, '2026-10-20'), { weight: 52, logDate: '2026-10-10' });
  assert.equal(closestPreviousWeight(logs.slice(0, 1), '2026-10-20'), null);
  assert.equal(closestPreviousWeight([], '2026-10-20'), null);
});

test('evaluateVitalSeries — 날짜순으로 판정하고 체중은 직전 값과 비교, 잘못된 날짜 줄은 건너뛴다', () => {
  const result = evaluateVitalSeries([
    { date: '2026-10-14', weight: 52.6 },
    { date: '2026-10-01', weight: 50, systolic: 150, diastolic: 80 },
    { date: 'bad', temperature: 39 },
  ]);
  assert.deepEqual(result.map((r) => r.date), ['2026-10-01', '2026-10-14']);
  assert.deepEqual(result[0].flags.map((f) => f.metric), ['bloodPressure']);
  assert.deepEqual(result[1].flags.map((f) => f.metric), ['weight']);
});
