import test from 'node:test';
import assert from 'node:assert/strict';
import { actorRefOf } from './notificationActor.ts';

const n = (type: string | null, title: string, message: string, actorId: string | null = null) => ({ type, title, message, actorId });

test('서버가 적어 준 사람이 먼저다', () => {
  assert.deepEqual(actorRefOf(n('VACATION_SUBMITTED', '새 휴가 신청', '한희정(조리원)님이 2026-12-26 휴가를 신청했습니다.', '41')), { id: '41' });
  assert.deepEqual(actorRefOf(n('APPROVAL', '결재 요청 도착', '…', 'admin_3')), { id: 'admin_3' });
});

test('배포 전 휴가 신청 — 글의 주어에서 이름을 읽는다(직책 괄호는 뗀다)', () => {
  assert.deepEqual(actorRefOf(n('VACATION_SUBMITTED', '새 휴가 신청', '한희정(조리원)님이 2026-12-26 휴가를 신청했습니다.')), { name: '한희정' });
  assert.deepEqual(actorRefOf(n('VACATION_SUBMITTED', '새 휴가 신청', '박소향님이 2026-12-05 휴가를 신청했습니다.')), { name: '박소향' });
});

test('결재·업무 — "님의", "님이"', () => {
  assert.deepEqual(actorRefOf(n('APPROVAL', '결재 요청 도착', "이수나님의 '퇴소 체크리스트' 결재가 결재를 기다리고 있습니다.")), { name: '이수나' });
  assert.deepEqual(actorRefOf(n('WORK_TASK', '업무를 마쳤습니다', "김도형(원장)님이 '식단표' 업무를 마쳤습니다")), { name: '김도형' });
});

test('채팅은 제목이 보낸 사람', () => {
  assert.deepEqual(actorRefOf(n('CHAT', '한희정(조리원)', '점심추가반찬입니다')), { name: '한희정' });
  assert.deepEqual(actorRefOf(n('CHAT', '박소향', '확인 부탁드려요')), { name: '박소향' });
});

test('이름을 읽지 않는 알림 — 가입 요청(아직 직원 아님)·결과 알림·리마인더', () => {
  assert.equal(actorRefOf(n('MEMBER_JOIN_REQUESTED', '회원가입 요청', '홍길동님이 회원가입을 요청했습니다.')), null);
  assert.equal(actorRefOf(n('VACATION_APPROVED', '휴가 승인 알림', '2026-12-26 휴가 신청이 승인되었습니다.')), null);
  assert.equal(actorRefOf(n('VACATION_REMINDER', '휴무 신청 마감', '내일까지 다음 달 휴무를 신청해 주세요.')), null);
  assert.equal(actorRefOf(n(null, '알림', '내용')), null);
});

test('주어가 사람 이름 모양이 아니면 읽지 않는다', () => {
  assert.equal(actorRefOf(n('APPROVAL', '결재 완료', "'퇴소 체크리스트' 결재가 승인되었습니다.")), null);
  assert.equal(actorRefOf(n('CHAT', '[공지] 3층 회의', '내용')), null);
  assert.equal(actorRefOf(n('VACATION_SUBMITTED', '새 휴가 신청', '  ')), null);
});
