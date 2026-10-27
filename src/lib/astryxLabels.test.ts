import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { patchFieldLabel, clearStaleWebpackCache, FIELD_LABEL_PATH } from '../../scripts/patch-astryx-labels.mjs';

const ORIGINAL = "const statusText = isOptional ? 'Optional' : isRequired ? 'Required' : null;";

test('영어 필수·선택 표시를 한국어로 바꾸고, 두 번 돌려도 그대로다', () => {
  const once = patchFieldLabel(ORIGINAL);
  assert.equal(once.status, 'patched');
  assert.equal(once.source, "const statusText = isOptional ? '선택' : isRequired ? '필수' : null;");
  const twice = patchFieldLabel(once.source);
  assert.equal(twice.status, 'already');
  assert.equal(twice.source, once.source);
});

test('고친 뒤에는 지난 webpack 캐시만 지운다 — 다른 빌드 산출물은 그대로', () => {
  const root = mkdtempSync(join(tmpdir(), 'astryx-cache-'));
  try {
    mkdirSync(join(root, '.next', 'cache', 'webpack', 'client-production'), { recursive: true });
    writeFileSync(join(root, '.next', 'cache', 'webpack', 'client-production', '0.pack'), 'old');
    mkdirSync(join(root, '.next', 'cache', 'images'), { recursive: true });
    assert.equal(clearStaleWebpackCache(root, '.next'), true);
    assert.equal(existsSync(join(root, '.next', 'cache', 'webpack')), false);
    assert.equal(existsSync(join(root, '.next', 'cache', 'images')), true);
    assert.equal(clearStaleWebpackCache(root, '.next'), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('원문이 바뀌었으면 손대지 않고 알린다', () => {
  const changed = "const statusText = isRequired ? 'Mandatory' : null;";
  assert.deepEqual(patchFieldLabel(changed), { source: changed, status: 'missing' });
});

test('설치된 Astryx FieldLabel에 한국어 표시가 들어가 있다 (postinstall이 돌았다)', () => {
  const installed = readFileSync(join(process.cwd(), FIELD_LABEL_PATH), 'utf8');
  assert.ok(installed.includes("'필수'"), 'npm install(postinstall) 또는 node scripts/patch-astryx-labels.mjs를 먼저 돌려야 한다');
  assert.ok(!installed.includes("'Required'"));
});
