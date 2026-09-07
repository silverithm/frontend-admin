#!/usr/bin/env node
/**
 * 운영에서 "축소본 없이 남은 무거운 사진"이 없는지 센다.
 *
 * 축소본이 없으면 채팅 목록이 원본을 그대로 그린다. 2026-09-01 이전 사진은 전부 그랬고
 * (평균 2.4MB, 최대 7.7MB), 옛 대화를 훑을 때 사진이 깨져 보인다는 제보의 방아쇠였다.
 *
 * 작은 사진은 축소본이 없어도 상관없다(서버도 만들지 않는다). 그래서 기준은
 * **500KB를 넘는데 축소본이 없는 사진이 0건**이다.
 */
import { execFileSync } from 'node:child_process';

const THRESHOLD_BYTES = 500 * 1024;

const sql = `SELECT id, file_url, file_size, created_at FROM chat_messages
  WHERE type = 'IMAGE' AND is_deleted = 0
    AND thumbnail_url IS NULL AND file_url IS NOT NULL
    AND file_size > ${THRESHOLD_BYTES}`;

const remote =
    `sudo docker exec -i silverithm_db sh -c 'mysql -u root -p"$MYSQL_ROOT_PASSWORD" ` +
    `--default-character-set=utf8mb4 -N "$MYSQL_DATABASE"'`;

let output;
try {
    output = execFileSync('ssh', ['silverithm', remote], { encoding: 'utf8', input: sql });
} catch (error) {
    console.error('운영 DB 조회 실패 — ssh silverithm 접근을 확인할 것');
    console.error(error.stderr?.toString?.() ?? error.message);
    process.exit(1);
}

const rows = output
    .split('\n')
    .map((line) => line.split('\t'))
    .filter((cols) => cols.length >= 2 && /^\d+$/.test(cols[0].trim()));

// S3로 옮기기 전(2026-01) 로컬 업로드 경로에 남은 것들은 파일 자체가 이미 없다.
// 축소본을 만들 길이 없고 목록에 그려지지도 않는다 — 숨기지 않고 이름을 찍어 남긴다.
const onS3 = rows.filter((cols) => cols[1].startsWith('https://dearglobe'));
const legacy = rows.filter((cols) => !cols[1].startsWith('https://dearglobe'));

console.log(`축소본 없이 남은 500KB 초과 사진: ${rows.length}건`);
console.log(`  그 중 S3에 있는 것: ${onS3.length}건`);
if (legacy.length > 0) {
    console.log(`  S3 이전 옛 경로(파일 없음, 축소본 불가): ${legacy.length}건`);
    for (const cols of legacy) console.log(`    id=${cols[0]} ${cols[1]}`);
}

if (onS3.length > 0) {
    console.error('S3에 있는데 축소본이 없다 — 백필을 더 돌려야 한다');
    for (const cols of onS3) console.error(`  id=${cols[0]} ${cols[1]}`);
    process.exit(1);
}

console.log('축소본 없는 사진 0건');
