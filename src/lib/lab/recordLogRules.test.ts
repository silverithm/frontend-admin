/**
 * 종류별 기록 규칙 테스트 — `node --test src/lib/lab/recordLogRules.test.ts`
 * 왜: 서버가 400으로 거절할 입력을 화면이 먼저 알려 줘야 하고, 안전관리 설명 현황이 한 칸 어긋나면
 * 설명 안 한 수급자를 놓친다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  RECORD_LOG_KINDS,
  briefingMissing,
  briefingStatus,
  checkLabel,
  formatWon,
  josa,
  newRecordLogDraft,
  normalizeChecks,
  receiptTotal,
  recordLogInput,
  recordLogProblems,
} from './recordLogRules.ts';

const TODAY = '2026-10-21';

test('종류마다 허용 항목이 다르다', () => {
  assert.equal(RECORD_LOG_KINDS.PROGRAM_MANAGER_LOG.checks.length, 5);
  assert.equal(RECORD_LOG_KINDS.CASH_RECEIPT.exactlyOne, true);
  assert.equal(checkLabel('SAFETY_BRIEFING', 'FALL'), '낙상 예방');
  assert.equal(checkLabel('FACILITY_DIARY', 'NOPE'), 'NOPE');
});

test('항목은 허용 순서로 정리하고 중복·허용 밖 값은 뺀다', () => {
  assert.deepEqual(normalizeChecks('PROGRAM_MANAGER_LOG', ['RECORD_REVIEW', 'COGNITIVE_CHECK', 'RECORD_REVIEW', 'FIELD_GUIDE']), ['COGNITIVE_CHECK', 'RECORD_REVIEW']);
});

test('업무수행일지는 작성자와 수행 업무가 필수', () => {
  const d = newRecordLogDraft(TODAY);
  assert.deepEqual(recordLogProblems('PROGRAM_MANAGER_LOG', d, TODAY), ['작성자 이름을 적어 주세요', '수행한 업무를 적어 주세요']);
  const ok = { ...d, author: '이프로그램', body: '인지활동형 확인' };
  assert.deepEqual(recordLogProblems('PROGRAM_MANAGER_LOG', ok, TODAY), []);
});

test('기록일은 오늘 이후일 수 없다', () => {
  const d = { ...newRecordLogDraft('2026-10-22'), author: '이운영', body: '내용' };
  assert.deepEqual(recordLogProblems('FACILITY_DIARY', d, TODAY), ['기록일은 오늘 이후일 수 없습니다']);
  assert.deepEqual(recordLogProblems('FACILITY_DIARY', { ...d, entryDate: '' }, TODAY), ['기록일을 골라 주세요']);
});

test('안전관리 설명은 어르신·설명 항목·대상이 필요하다', () => {
  const d = { ...newRecordLogDraft(TODAY, '박간호') };
  assert.deepEqual(recordLogProblems('SAFETY_BRIEFING', d, TODAY), ['어르신을 골라 주세요', '설명한 안전 항목을 하나 이상 골라 주세요', '설명한 대상(수급자·보호자)을 하나 이상 골라 주세요']);
  assert.deepEqual(recordLogProblems('SAFETY_BRIEFING', { ...d, elderId: 3, checks: ['FALL', 'TO_GUARDIAN'] }, TODAY), []);
  assert.deepEqual(recordLogProblems('SAFETY_BRIEFING', { ...d, elderId: 3, checks: ['TO_ELDER'] }, TODAY), ['설명한 안전 항목을 하나 이상 골라 주세요']);
});

test('현금영수증은 금액과 구분 하나가 필요하다', () => {
  const d = { ...newRecordLogDraft(TODAY, '정경리'), elderId: 3 };
  assert.deepEqual(recordLogProblems('CASH_RECEIPT', d, TODAY), ['발행 구분을 하나 골라 주세요', '금액을 1원 이상으로 적어 주세요']);
  assert.deepEqual(recordLogProblems('CASH_RECEIPT', { ...d, checks: ['INCOME_DEDUCTION', 'EXPENSE_PROOF'], amount: 1000 }, TODAY), ['발행 구분을 하나 골라 주세요']);
  assert.deepEqual(recordLogProblems('CASH_RECEIPT', { ...d, checks: ['EXPENSE_PROOF'], amount: 0 }, TODAY), ['금액을 1원 이상으로 적어 주세요']);
  assert.deepEqual(recordLogProblems('CASH_RECEIPT', { ...d, checks: ['EXPENSE_PROOF'], amount: 85000 }, TODAY), []);
});

test('서버로 보내는 모양 — 종류에 없는 칸은 비운다', () => {
  const d = { ...newRecordLogDraft(TODAY, ' 이운영 '), elderId: 9, body: ' 내용 ', action: '', extra: '승인', amount: 500, checks: ['VISITOR', 'MEAL'] };
  const input = recordLogInput('FACILITY_DIARY', d);
  assert.equal(input.elderlyId, null);
  assert.equal(input.authorName, '이운영');
  assert.deepEqual(input.checks, ['MEAL', 'VISITOR']);
  assert.equal(input.body, '내용');
  assert.equal(input.action, null);
  assert.equal(input.extra, null);
  assert.equal(input.amount, null);

  const receipt = recordLogInput('CASH_RECEIPT', { ...d, checks: ['INCOME_DEDUCTION'], amount: 85000 });
  assert.equal(receipt.elderlyId, 9);
  assert.equal(receipt.extra, '승인');
  assert.equal(receipt.amount, 85000);
});

test('안전관리 설명 현황 — 안 한 수급자를 앞에, 올해 것만 센다', () => {
  const elders = [
    { id: 1, name: '김말순' },
    { id: 2, name: '박봉례' },
    { id: 3, name: '이순남' },
  ];
  const rows = briefingStatus(
    elders,
    [
      { elderlyId: 1, entryDate: '2026-03-02' },
      { elderlyId: 1, entryDate: '2026-09-10' },
      { elderlyId: 2, entryDate: '2025-12-30' }, // 작년 것은 세지 않는다
      { elderlyId: null, entryDate: '2026-01-01' },
    ],
    2026,
  );
  assert.deepEqual(rows.map((r) => r.elderlyName), ['박봉례', '이순남', '김말순']);
  assert.equal(rows[2].lastOn, '2026-09-10');
  assert.equal(rows[2].count, 2);
  assert.equal(briefingMissing(rows), 2);
});

test('금액 표시와 합계', () => {
  assert.equal(formatWon(85000), '85,000원');
  assert.equal(formatWon(null), '-');
  assert.equal(receiptTotal([{ amount: 1000 }, { amount: null }, { amount: 2500 }]), 3500);
});

test('조사는 마지막 한글 글자의 받침으로 고른다', () => {
  assert.equal(josa('업무', '을', '를'), '업무를');
  assert.equal(josa('발행 구분', '을', '를'), '발행 구분을');
  assert.equal(josa('시설운영일지', '이', '가'), '시설운영일지가');
  assert.equal(josa('프로그램 관리자 업무수행일지', '이', '가'), '프로그램 관리자 업무수행일지가');
  assert.equal(josa('현금영수증 발행', '이', '가'), '현금영수증 발행이');
  assert.equal(josa('대상(수급자)', '을', '를'), '대상(수급자)을');
});
