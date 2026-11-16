/**
 * 양식에서 지운 항목 — `node --test src/lib/retiredFields.test.ts`
 *
 * 여기서 못 박는 것:
 * - 양식을 고친 뒤에도 지난 문서에 쓴 값은 '지금 양식에 없는 항목'으로 잡힌다(2026-11-16 업무일지 'content')
 * - 빈 값·지금 양식에 있는 값은 잡히지 않는다, 기간은 시작·끝을 한 항목으로
 * - 양식을 저장할 때 지운 항목의 이름·종류가 남고, 다시 넣은 항목·구역 제목은 남지 않는다
 * - 이전 기안 불러오기는 지금 양식 항목 값만 옮긴다
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { FormFieldSchema, FormSchema } from '../types/formSchema.ts';
import {
  isEmptyFormValue,
  isGeneratedFieldId,
  orphanEntries,
  pickLiveFormData,
  withRetiredFields,
  withoutRetiredFields,
} from './retiredFields.ts';

const f = (id: string, type: FormFieldSchema['type'], label: string, extra: Partial<FormFieldSchema> = {}): FormFieldSchema => ({
  id,
  type,
  label,
  required: false,
  ...extra,
});

/** 운영 업무일지(기관 4, 양식 108)를 줄인 모양 — 원래 'content'(행정 업무)를 복제한 뒤 원본을 지웠다 */
const before: FormSchema = {
  version: 1,
  fields: [
    f('report-date', 'date', '업무 일자'),
    f('msod0n45pxcbv0rb40k', 'section', '금일 실시 사항'),
    f('content', 'textarea', '행정 업무'),
    f('issues', 'textarea', '어르신 특이사항'),
  ],
};
const after: FormSchema = {
  version: 1,
  fields: [
    f('report-date', 'date', '업무 일자'),
    f('msod0n45pxcbv0rb40k', 'section', '금일 실시 사항'),
    f('mwimrby44qj5y9343e3', 'textarea', '행정 업무 사본'),
    f('issues', 'textarea', '어르신 특이사항'),
    f('mwion1yt9nvk6thwaui', 'text', '시간', { width: 'quarter' }),
  ],
};
const oldDoc = {
  'report-date': '2026-11-14',
  content: '09:00 출근 체크\n10:00 급여 서류 정리',
  issues: '없음',
  msocv159to0qjd38i7d: '',
};

test('업무일지: 지운 항목(content)에 쓴 내용이 지금 양식에 없는 항목으로 잡힌다', () => {
  assert.deepEqual(orphanEntries(after, oldDoc), [{ key: 'content' }]);
});

test('지운 항목 이름이 남아 있으면 그 이름·종류로 잡힌다', () => {
  const saved = withRetiredFields(after, before);
  const entries = orphanEntries(saved, oldDoc);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].key, 'content');
  assert.equal(entries[0].field?.label, '행정 업무');
  assert.equal(entries[0].field?.type, 'textarea');
});

test('빈 값과 지금 양식에 있는 값은 잡히지 않는다', () => {
  // 고치기 전 양식으로 보면 남는 것이 없다(빈 '기타'는 건너뛴다)
  assert.deepEqual(orphanEntries(before, oldDoc), []);
  assert.deepEqual(orphanEntries(after, { ...oldDoc, content: '  ' }), []);
  assert.deepEqual(orphanEntries(after, null), []);
});

test('기간 — 이름 모르는 시작·끝은 한 항목, 지운 기간 항목은 그 이름으로', () => {
  const doc = { gone_start: '2026-11-01', gone_end: '2026-11-03', solo_start: '오전' };
  const entries = orphanEntries(after, doc);
  assert.deepEqual(entries.map((e) => [e.key, e.field?.type]), [['gone', 'dateRange'], ['solo_start', undefined]]);

  const withRange: FormSchema = { ...after, retiredFields: [f('gone', 'dateRange', '휴가 기간')] };
  const named = orphanEntries(withRange, doc);
  assert.equal(named[0].field?.label, '휴가 기간');
  assert.equal(named.length, 2);
});

test('지금 양식의 기간 항목(_start·_end)은 잡히지 않는다', () => {
  const schema: FormSchema = { version: 1, fields: [f('period', 'dateRange', '기간')] };
  assert.deepEqual(orphanEntries(schema, { period_start: '2026-11-01', period_end: '2026-11-02' }), []);
});

test('반복 항목이 빈 줄뿐이면 빈 값이다', () => {
  assert.equal(isEmptyFormValue([{ a: '', b: null }]), true);
  assert.equal(isEmptyFormValue([{ a: '', b: '3' }]), false);
  assert.equal(isEmptyFormValue({ fileUrl: '/uploads/a.png', fileName: 'a.png' }), false);
  assert.equal(isEmptyFormValue(0), false);
});

test('저장 — 지운 항목만 남기고, 다시 넣은 항목과 구역 제목은 남기지 않는다', () => {
  const removedSection: FormSchema = { ...after, fields: after.fields.filter((x) => x.type !== 'section') };
  const saved = withRetiredFields(removedSection, before);
  assert.deepEqual(saved.retiredFields?.map((x) => x.id), ['content']);

  // 'content'를 다시 넣으면 남긴 기록에서 빠진다
  const readded: FormSchema = { ...saved, fields: [...saved.fields, f('content', 'textarea', '행정 업무')] };
  assert.equal(withRetiredFields(readded, saved).retiredFields, undefined);
});

test('저장 — 예전에 남긴 지운 항목은 다음 저장에도 이어진다', () => {
  const first = withRetiredFields(after, before);
  const second = withRetiredFields({ ...after, fields: after.fields.filter((x) => x.id !== 'issues') }, first);
  assert.deepEqual(second.retiredFields?.map((x) => x.id).sort(), ['content', 'issues']);
});

test('저장 — 지운 항목은 값을 읽는 데 필요한 것만 남긴다', () => {
  const prev: FormSchema = {
    version: 1,
    fields: [
      f('kind', 'select', '구분', {
        required: true,
        placeholder: '고르세요',
        options: [{ label: '연차', value: 'annual' }],
        visibleWhen: { match: 'all', conditions: [{ fieldId: 'x', operator: 'isNotEmpty' }] },
      }),
    ],
  };
  const saved = withRetiredFields({ version: 1, fields: [] }, prev);
  assert.deepEqual(saved.retiredFields, [
    { id: 'kind', type: 'select', label: '구분', required: false, options: [{ label: '연차', value: 'annual' }] },
  ]);
});

test('새 양식으로 만들 때는 다른 양식의 지운 항목을 가져오지 않는다', () => {
  const saved = withRetiredFields(after, before);
  assert.equal('retiredFields' in withoutRetiredFields(saved), false);
});

test('이전 기안 불러오기 — 지금 양식 항목 값만 옮긴다', () => {
  const schema: FormSchema = { version: 1, fields: [...after.fields, f('period', 'dateRange', '기간')] };
  const picked = pickLiveFormData(schema, { ...oldDoc, period_start: '2026-11-01', period_end: '2026-11-02' });
  assert.deepEqual(Object.keys(picked ?? {}).sort(), ['issues', 'period_end', 'period_start', 'report-date']);
  assert.equal(pickLiveFormData(undefined, oldDoc), oldDoc);
  assert.equal(pickLiveFormData(schema, null), null);
});

test('빌더가 만든 id는 사람이 읽을 이름이 아니다', () => {
  assert.equal(isGeneratedFieldId('msocv159to0qjd38i7d'), true);
  assert.equal(isGeneratedFieldId('content'), false);
  assert.equal(isGeneratedFieldId('report-type'), false);
});
