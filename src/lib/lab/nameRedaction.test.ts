import test from 'node:test';
import assert from 'node:assert/strict';
import { forgetNames, redactDeep, redactNames, rememberElderNames, rememberStaffNames } from './nameRedaction.ts';

test.beforeEach(() => forgetNames());

test('어르신 이름과 붙은 호칭을 "어르신"으로 바꾼다', () => {
  rememberElderNames(['김말순', '박봉례']);
  assert.equal(redactNames('김말순 어르신 점심 절반, 박봉례님은 다 드심'), '어르신 점심 절반, 어르신은 다 드심');
  assert.equal(redactNames('김말순어르신 화장실 3회'), '어르신 화장실 3회');
});

test('직원 이름은 "직원"으로 바꾸고, 어르신 이름과 겹치면 어르신으로 본다', () => {
  rememberElderNames(['이순남']);
  rememberStaffNames(['정다혜', '이순남']);
  assert.equal(redactNames('정다혜 선생님이 혈압 측정, 이순남 어르신 협조'), '직원이 혈압 측정, 어르신 협조');
});

test('긴 이름부터 바꿔 일부만 지워지지 않는다', () => {
  rememberElderNames(['김말', '김말순']);
  assert.equal(redactNames('김말순 어르신'), '어르신');
});

test('한 글자 이름은 기억하지 않는다 — 일반 낱말이 지워지면 안 된다', () => {
  rememberElderNames(['김', '']);
  assert.equal(redactNames('김치를 드심'), '김치를 드심');
});

test('정규식 특수문자가 든 이름도 안전하게 바꾼다', () => {
  rememberElderNames(['홍(길)동']);
  assert.equal(redactNames('홍(길)동님 낙상 위험'), '어르신 낙상 위험');
});

test('객체 안의 문자열만 바꾸고 숫자·배열 모양은 그대로 둔다', () => {
  rememberElderNames(['서옥자']);
  const input = { note: '서옥자 어르신 미열', readings: [{ date: '2026-10-14', systolic: 130 }], needs: { family: '서옥자님 따님 방문' } };
  assert.deepEqual(redactDeep(input), { note: '어르신 미열', readings: [{ date: '2026-10-14', systolic: 130 }], needs: { family: '어르신 따님 방문' } });
  assert.equal(input.note, '서옥자 어르신 미열', '원본은 바꾸지 않는다');
});
