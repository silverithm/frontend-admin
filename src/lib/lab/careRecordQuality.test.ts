/**
 * 형식적 문구 감지 테스트 — `node --test src/lib/lab/careRecordQuality.test.ts`
 * 왜: 너무 좁으면 평가에서 인정 안 되는 기록이 그냥 저장되고, 너무 넓으면 경고를 직원이 무시한다. 양쪽 경계를 고정한다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { findVaguePhrases, isRecordEmpty, isVagueOnly, summarizeQuality } from './careRecordQuality.ts';

const fieldsOf = (hits: Array<{ field: string }>) => hits.map((h) => h.field).sort();

test('계약 예시 — 특이사항 없음·지난주와 동일은 걸리고 구체적 기록은 통과', () => {
  const hits = findVaguePhrases({ physical: '오전 체조 참여', specialNote: '특이사항 없음', cognitive: '지난주와 동일' });
  assert.deepEqual(fieldsOf(hits), ['cognitive', 'specialNote']);
  assert.ok(hits.every((h) => h.phrase && h.hint));
});

test('같은 뜻의 다른 표기를 모두 잡는다', () => {
  const vague = [
    '특이사항 없음', '특이사항없음', '특이 없음', '특이사항 없습니다.', '특이점 없음', '이상 없음', '이상없음', '변화 없음',
    '지난주와 동일', '지난주와 동일함', '저번주와 같음', '전일과 동일', '어제와 같습니다', '상동', '상기와 같음',
    '평소와 같음', '평소와 동일함', '평소대로', '평상시와 같음', '동일함', '양호함', '양호', '좋음', '보통', '무난함', '없음', '문제 없음',
    '금일 특이사항 없음', '오늘도 동일', '식사 양호함', '상태는 양호', '컨디션 좋음', '배설 이상 없음', '전반적으로 양호함', '대체로 무난',
  ];
  for (const text of vague) {
    assert.equal(findVaguePhrases({ specialNote: text }).length, 1, `못 잡음: ${text}`);
    assert.equal(isVagueOnly(text), true, `isVagueOnly: ${text}`);
  }
});

test('구체적인 문장은 통과한다 (거짓 경고 방지)', () => {
  const ok = [
    '오전 체조 참여', '점심 밥 2/3 드심, 국은 남김', '보행기 이용해 화장실 3회 이동', '혈압 130/80 이상 없음',
    '오후 색칠하기 40분 집중, 색 이름을 맞힘', '미역국을 좋아해서 한 그릇 더 드심', '식사 양호하게 드심',
    '양손으로 컵을 잡고 물 200ml 마심', '체온 36.5도로 변화 없음', '혈압 정상 범위(120/80)', '식사 도중 기침을 두 번 함',
  ];
  for (const text of ok) assert.deepEqual(findVaguePhrases({ meal: text }), [], `거짓 경고: ${text}`);
});

test('긴 문장 안에 끼어 있어도 문구 자체는 잡는다', () => {
  const hits = findVaguePhrases({ specialNote: '오전 산책 참여하였으며 특이사항 없음' });
  assert.equal(hits.length, 1);
  assert.match(hits[0].phrase, /특이사항 없음/);
  const same = findVaguePhrases({ cognitive: '회상 활동을 했고 반응은 지난주와 동일' });
  assert.equal(same.length, 1);
  assert.match(same[0].phrase, /지난주와 동일/);
});

test('쉼표로 이어 붙인 형식적 문구는 각각 잡고, 내용 있는 문장은 남긴다', () => {
  const hits = findVaguePhrases({ specialNote: '특이사항 없음, 양호함' });
  assert.equal(hits.length, 2);
  const mixed = findVaguePhrases({ specialNote: '낮잠 30분. 특이사항 없음' });
  assert.equal(mixed.length, 1);
  assert.equal(isVagueOnly('낮잠 30분. 특이사항 없음'), false);
  assert.equal(isVagueOnly('특이사항 없음. 양호함'), true);
});

test('같은 칸에서 같은 문구는 한 번만, 다른 칸은 각각', () => {
  const hits = findVaguePhrases({ specialNote: '특이사항 없음. 특이사항 없음', nursing: '특이사항 없음' });
  assert.equal(hits.filter((h) => h.field === 'specialNote').length, 1);
  assert.equal(hits.filter((h) => h.field === 'nursing').length, 1);
});

test('참여함 단독은 걸리고 활동 이름이 있으면 통과', () => {
  assert.equal(findVaguePhrases({ training: '참여함' }).length, 1);
  assert.equal(findVaguePhrases({ training: '프로그램 참여' }).length, 1);
  assert.equal(findVaguePhrases({ training: '손가락 근력 운동 참여' }).length, 0);
});

test('메모 원문(rawNote)·비문자열·빈 값은 검사하지 않는다', () => {
  assert.deepEqual(findVaguePhrases({ rawNote: '특이사항 없음' }), []);
  assert.deepEqual(findVaguePhrases({ physical: null, cognitive: undefined, meal: '   ' }), []);
  assert.deepEqual(findVaguePhrases({}), []);
  assert.equal(isVagueOnly(''), false);
  assert.equal(isVagueOnly(null), false);
});

test('isRecordEmpty — 공백만 있어도 비어 있다, 메모 원문만 있어도 내용이 있다', () => {
  assert.equal(isRecordEmpty({}), true);
  assert.equal(isRecordEmpty({ physical: '  ', specialNote: null }), true);
  assert.equal(isRecordEmpty({ physical: '체조' }), false);
  assert.equal(isRecordEmpty({ rawNote: '메모만' }), false);
});

test('summarizeQuality — 비어 있는 기록은 빼고 형식적 비율을 센다', () => {
  const s = summarizeQuality([
    { physical: '체조 참여 30분', specialNote: '' },
    { specialNote: '특이사항 없음' },
    {},
    { meal: '밥 2/3' },
  ]);
  assert.deepEqual(s, { total: 4, vague: 1, empty: 1, goodPercent: 67 });
  assert.equal(summarizeQuality([]).goodPercent, null);
  assert.equal(summarizeQuality([{}]).goodPercent, null);
});
