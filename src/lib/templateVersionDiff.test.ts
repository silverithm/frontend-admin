/**
 * 양식 버전 사이 변화 요약 — `node --test src/lib/templateVersionDiff.test.ts`
 *
 * 여기서 못 박는 것:
 * - 항목은 id로 비교한다 — '행정 업무'를 복제한 뒤 원본을 지우면 '추가: 행정 업무 사본 · 삭제: 행정 업무'(2026-11-16 숲속)
 * - 같은 항목의 이름이 바뀌면 '이름 바꿈', 이름은 그대로 설정만 바뀌면 '설정 바꿈', 순서만 바뀌면 '순서 바꿈'
 * - 양식 이름·분류·기본 결재선(JSON 띄어쓰기 무시)·파일 변화도 잡는다, 처음 버전은 변화 없음
 * - 요약은 앞 두 이름 + '외 n개'
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { FormFieldSchema } from '../types/formSchema.ts';
import { diffVersions, parseVersionSchema, summarizeChanges, type VersionShape } from './templateVersionDiff.ts';

const f = (id: string, label: string, extra: Partial<FormFieldSchema> = {}): FormFieldSchema => ({
  id,
  type: 'textarea',
  label,
  required: false,
  ...extra,
});
const v = (fields: FormFieldSchema[], extra: Partial<VersionShape> = {}): VersionShape => ({
  name: '업무일지',
  category: '공문',
  templateType: 'form',
  formSchema: JSON.stringify({ version: 1, fields }),
  ...extra,
});

const 원래 = v([f('sec', '금일 실시 사항', { type: 'section' }), f('content', '행정 업무'), f('issues', '어르신 특이사항')]);

test('복제한 뒤 원본을 지우면 — 추가: 사본, 삭제: 원본', () => {
  const 사본만 = v([f('sec', '금일 실시 사항', { type: 'section' }), f('mwimrby44qj5y9343e3', '행정 업무 사본'), f('issues', '어르신 특이사항')]);
  const changes = diffVersions(원래, 사본만);
  assert.deepEqual(changes, [
    { kind: '추가', items: ['행정 업무 사본'] },
    { kind: '삭제', items: ['행정 업무'] },
  ]);
  assert.equal(summarizeChanges(changes), '추가: 행정 업무 사본 · 삭제: 행정 업무');
});

test('이름 바꿈·설정 바꿈·순서 바꿈', () => {
  const 고침 = v([f('sec', '금일 실시 사항', { type: 'section' }), f('issues', '어르신 특이사항', { required: true }), f('content', '행정 업무 내용')]);
  assert.deepEqual(diffVersions(원래, 고침).map((c) => c.kind), ['이름 바꿈', '설정 바꿈', '순서 바꿈']);
  assert.deepEqual(diffVersions(원래, 고침)[0].items, ['행정 업무 → 행정 업무 내용']);
});

test('양식 이름·분류·기본 결재선·파일', () => {
  const next = { ...원래, name: '업무일지(시간별)', category: null, defaultApprovalLine: '[{"approverType":"ADMIN","approverId":1}]', fileName: 'a.hwp' };
  assert.deepEqual(diffVersions(원래, next).map((c) => c.kind), ['양식 이름', '분류', '기본 결재선', '파일']);
  assert.equal(diffVersions(원래, next)[1].items[0], '공문 → 미분류');
});

test('기본 결재선은 JSON 띄어쓰기가 달라도 같다', () => {
  const a = { ...원래, defaultApprovalLine: '[{"approverType":"ADMIN","approverId":1}]' };
  const b = { ...원래, defaultApprovalLine: '[{"approverType": "ADMIN", "approverId": 1}]' };
  assert.deepEqual(diffVersions(a, b), []);
});

test('처음 버전·같은 모습은 변화 없음', () => {
  assert.deepEqual(diffVersions(undefined, 원래), []);
  assert.deepEqual(diffVersions(원래, { ...원래 }), []);
});

test('요약 — 앞 두 이름 + 외 n개', () => {
  assert.equal(
    summarizeChanges([{ kind: '추가', items: ['08:20 ~ 09:00', '09:00 ~ 10:00', '10:00 ~ 11:00', '11:00 ~12:00'] }]),
    '추가: 08:20 ~ 09:00, 09:00 ~ 10:00 외 2개',
  );
});

test('양식 내용 읽기 — 문자열·객체·깨진 값', () => {
  assert.equal(parseVersionSchema('{"fields":[]}')?.fields.length, 0);
  assert.equal(parseVersionSchema({ version: 1, fields: [] })?.version, 1);
  assert.equal(parseVersionSchema('깨짐'), null);
  assert.equal(parseVersionSchema(null), null);
});
