import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeUploadFailures } from './chatUploadFailures.ts';

test('실패가 없으면 알리지 않는다', () => {
    assert.equal(describeUploadFailures([], 100), null);
});

test('한 개면 그 파일 이름을 말한다 — 어느 파일인지 알아야 다시 첨부한다', () => {
    assert.equal(describeUploadFailures([{ name: 'IMG_0412.jpg', reason: 'failed' }], 100), 'IMG_0412.jpg을(를) 보내지 못했습니다. 다시 첨부해 주세요');
    assert.equal(describeUploadFailures([{ name: '행사.mp4', reason: 'tooLarge' }], 100), '행사.mp4은(는) 100MB를 넘어 보낼 수 없습니다');
});

test('여러 개면 한 문장에 모두 — 용량 초과는 표시한다', () => {
    const text = describeUploadFailures([
        { name: 'a.jpg', reason: 'failed' },
        { name: 'b.mp4', reason: 'tooLarge' },
    ], 100);
    assert.equal(text, '2개를 보내지 못했습니다: a.jpg, b.mp4(100MB 초과). 다시 첨부해 주세요');
});

test('많으면 다섯 개까지만 늘어놓고 나머지는 개수로', () => {
    const failures = Array.from({ length: 8 }, (_, i) => ({ name: `p${i + 1}.jpg`, reason: 'failed' as const }));
    const text = describeUploadFailures(failures, 100) ?? '';
    assert.match(text, /^8개를 보내지 못했습니다: p1\.jpg, p2\.jpg, p3\.jpg, p4\.jpg, p5\.jpg 외 3개\./);
});
