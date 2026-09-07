#!/usr/bin/env node
/**
 * 운영에 저장된 채팅 사진이 온전한지 확인한다.
 *
 * "종종 사진 깨짐" 제보의 원인이 **저장이 아니라 표시**임을 못박기 위한 검사다.
 * 파일이 실제로 잘려 있다면 화면 쪽 재시도로는 절대 고쳐지지 않으므로,
 * 고친 방향이 맞는지는 이 검사에 달려 있다.
 *
 * 파일 끝 1KB만 Range로 받아 종료 표시를 찾는다:
 *  - JPEG는 FFD9로 끝나야 한다. 다만 삼성 모션포토는 그 뒤에 SEF 꼬리(수백 바이트)를
 *    덧붙이므로, 끝 1KB 안에 FFD9가 있으면 온전한 것으로 본다.
 *  - PNG는 IEND 청크로 끝난다.
 */
import { execFileSync } from 'node:child_process';

const SINCE = process.env.CAREV_IMAGE_SINCE ?? '2026-08-01';
const WORKERS = 12;

const sql = `SELECT id, file_url, thumbnail_url FROM chat_messages
  WHERE type = 'IMAGE' AND is_deleted = 0 AND created_at > '${SINCE}'`;

const remote =
    `sudo docker exec -i silverithm_db sh -c 'mysql -u root -p"$MYSQL_ROOT_PASSWORD" ` +
    `--default-character-set=utf8mb4 -N "$MYSQL_DATABASE"'`;

selfTest();

let rows;
try {
    rows = execFileSync('ssh', ['silverithm', remote], { encoding: 'utf8', input: sql, maxBuffer: 32 * 1024 * 1024 })
        .split('\n')
        .map((line) => line.split('\t'))
        .filter((cols) => cols.length >= 2 && cols[1].startsWith('http'));
} catch (error) {
    console.error('운영 DB 조회 실패 — ssh silverithm 접근을 확인할 것');
    console.error(error.stderr?.toString?.() ?? error.message);
    process.exit(1);
}

const targets = [];
for (const [id, fileUrl, thumbnailUrl] of rows) {
    targets.push({ id, url: fileUrl, kind: '원본' });
    if (thumbnailUrl && thumbnailUrl !== 'NULL' && thumbnailUrl.startsWith('http')) {
        targets.push({ id, url: thumbnailUrl, kind: '축소본' });
    }
}

/**
 * 파일 끝 조각만 보고 온전한지 판정한다.
 *
 * 삼성 모션포토는 완성된 JPEG 뒤에 영상까지 통째로 덧붙이고 맨 끝에 'SEFT' 표시를 남긴다
 * (갤럭시 S24 사진에서 확인했고, 그 파일은 4000x3000으로 정상 디코딩됐다).
 * 그런 파일은 EOI가 끝에서 수 MB 앞에 있으므로, 맨 끝의 SEFT 표시를 완결 신호로 인정한다.
 * 전송이 중간에 끊겼다면 그 표시도 남지 않는다.
 */
export function tailVerdict(tail, ext) {
    if (ext === 'png') {
        return tail.includes(Buffer.from('IEND'))
            ? { ok: true }
            : { ok: false, why: 'PNG 종료 청크(IEND) 없음' };
    }
    if (tail.includes(Buffer.from([0xff, 0xd9]))) return { ok: true };
    if (tail.subarray(-4).equals(Buffer.from('SEFT'))) {
        return { ok: true, note: '삼성 모션포토 꼬리' };
    }
    return { ok: false, why: 'JPEG 종료 표시(FFD9)도 삼성 꼬리(SEFT)도 없음' };
}

/** 규칙이 실제로 잘린 파일을 잡는지 — 못 잡으면 이 검사는 아무것도 지키지 못한다 */
function selfTest() {
    const truncated = Buffer.from([0x12, 0x34, 0x56, 0x78]);
    const complete = Buffer.concat([Buffer.from([0x11]), Buffer.from([0xff, 0xd9])]);
    const samsung = Buffer.concat([Buffer.from([0x11, 0x22]), Buffer.from('SEFT')]);
    const png = Buffer.concat([Buffer.from('IEND'), Buffer.from([0xae, 0x42, 0x60, 0x82])]);

    if (tailVerdict(truncated, 'jpg').ok) throw new Error('잘린 파일을 온전하다고 봤다');
    if (!tailVerdict(complete, 'jpg').ok) throw new Error('온전한 JPEG를 깨졌다고 봤다');
    if (!tailVerdict(samsung, 'jpg').ok) throw new Error('삼성 모션포토를 깨졌다고 봤다');
    if (!tailVerdict(png, 'png').ok) throw new Error('온전한 PNG를 깨졌다고 봤다');
    if (tailVerdict(truncated, 'png').ok) throw new Error('잘린 PNG를 온전하다고 봤다');
    console.log('자체 점검 통과 — 규칙이 잘린 파일을 잡는다');
}

/** 끝 1KB를 받아 판정한다 */
async function isComplete(url) {
    const response = await fetch(url, { headers: { Range: 'bytes=-1024' } });
    if (!response.ok && response.status !== 206) return { ok: false, why: `HTTP ${response.status}` };
    const tail = Buffer.from(await response.arrayBuffer());
    const ext = url.split('?')[0].split('.').pop().toLowerCase();
    return tailVerdict(tail, ext);
}

const broken = [];
let checked = 0;
let cursor = 0;

await Promise.all(
    Array.from({ length: WORKERS }, async () => {
        while (cursor < targets.length) {
            const item = targets[cursor++];
            let verdict;
            try {
                verdict = await isComplete(item.url);
            } catch (error) {
                verdict = { ok: false, why: `받기 실패: ${error.message}` };
            }
            checked++;
            if (!verdict.ok) broken.push({ ...item, why: verdict.why });
        }
    }),
);

console.log(`${SINCE} 이후 사진 ${rows.length}건, 파일 ${checked}개(원본+축소본) 검사`);

if (checked === 0) {
    console.error('검사한 파일이 하나도 없다 — 조회 조건을 확인할 것');
    process.exit(1);
}

if (broken.length > 0) {
    console.error(`깨진 저장 파일 ${broken.length}개:`);
    for (const item of broken) console.error(`  id=${item.id} ${item.kind} — ${item.why}\n    ${item.url}`);
    process.exit(1);
}

console.log('깨진 저장 파일 0개');
