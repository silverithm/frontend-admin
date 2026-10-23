import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resetErrorMessage, validateNewPassword } from './passwordReset.ts';

test('8자 미만·불일치는 거절, 맞으면 null', () => {
  assert.match(validateNewPassword('short', 'short') ?? '', /8자 이상/);
  assert.match(validateNewPassword('long-enough-1', 'long-enough-2') ?? '', /일치하지/);
  assert.equal(validateNewPassword('long-enough-1', 'long-enough-1'), null);
  assert.equal(validateNewPassword('12345678', '12345678'), null);
  assert.match(validateNewPassword('x'.repeat(101), 'x'.repeat(101)) ?? '', /100자 이하/);
});

test('서버 사유를 우선하고 없으면 기본 문구', () => {
  assert.equal(resetErrorMessage({ message: '링크가 만료되었습니다' }), '링크가 만료되었습니다');
  assert.equal(resetErrorMessage({ error: '오류' }), '오류');
  assert.match(resetErrorMessage(null), /다시 시도/);
  assert.match(resetErrorMessage({ message: 5 }), /다시 시도/);
});

console.log('password-reset rules verified');
