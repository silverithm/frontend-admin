#!/usr/bin/env node
/**
 * 앱이 실제로 스토어에 **출시된 뒤에만** 광장에 업데이트 안내를 올린다.
 *
 * 심사 중에 올리면 "새 기능이 있다는데 업데이트가 안 보인다"는 문의가 온다.
 * 그래서 애플이 READY_FOR_SALE이 되고 구글 프로덕션에 그 빌드가 올라간 뒤에만 올린다.
 * 아직이면 아무것도 하지 않고 그대로 끝난다(여러 번 돌려도 안전하다).
 *
 * 사용법:
 *   node scripts/post-release-notice.mjs            # 조건이 되면 올린다
 *   node scripts/post-release-notice.mjs --dry-run  # 무엇을 할지만 보여준다
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const APP = resolve(here, '..', '..', 'frontend-app');
const DRY_RUN = process.argv.includes('--dry-run');

const pubspec = readFileSync(`${APP}/pubspec.yaml`, 'utf8');
const parsed = /^version:\s*([0-9.]+)\+(\d+)/m.exec(pubspec);
if (!parsed) {
    console.error('pubspec.yaml에서 버전을 못 읽었다');
    process.exit(1);
}
const [, versionName, buildNumber] = parsed;

/** 릴리즈 노트를 그대로 안내문에 쓴다 — 두 곳에 따로 적으면 어긋난다 */
const releaseNotes = readFileSync(`${APP}/ios/fastlane/metadata/ko/release_notes.txt`, 'utf8').trim();

function python(script) {
    return execFileSync('python3', ['-c', script], { encoding: 'utf8' }).trim();
}

function sqlOnProd(sql) {
    const remote =
        `sudo docker exec -i silverithm_db sh -c 'mysql -u root -p"$MYSQL_ROOT_PASSWORD" ` +
        `--default-character-set=utf8mb4 -N "$MYSQL_DATABASE"'`;
    return execFileSync('ssh', ['silverithm', remote], { encoding: 'utf8', input: sql }).trim();
}

// 1) 애플이 실제로 판매 중인가
const appleStates = python(`
import json, time, urllib.request, jwt
key = open("/Users/gimjunhyeong/keys/liftupai-asc-key.p8").read()
token = jwt.encode({"iss": "3a7331ed-e39f-4631-9738-a664230a6b0c",
                    "exp": int(time.time()) + 600, "aud": "appstoreconnect-v1"},
                   key, algorithm="ES256", headers={"kid": "4HRHDTP47U", "typ": "JWT"})
def get(path):
    req = urllib.request.Request("https://api.appstoreconnect.apple.com/v1/" + path,
                                 headers={"Authorization": "Bearer " + token})
    return json.load(urllib.request.urlopen(req))
app = get("apps?filter[bundleId]=com.silverithm.app.frontendApp")["data"][0]["id"]
for v in get("apps/" + app + "/appStoreVersions?limit=10")["data"]:
    a = v["attributes"]
    print(a["versionString"] + "=" + a["appStoreState"])
`);
const appleState = appleStates.split('\n')
    .find((line) => line.startsWith(`${versionName}=`))?.split('=')[1];

// 미리보기에 한해 "출시됐다고 치고" 무엇을 올릴지 확인할 수 있게 한다.
// 무인으로 돌 스크립트라 올리는 경로도 미리 눈으로 봐야 한다(쓰기는 하지 않는다).
const ASSUME_LIVE = DRY_RUN && process.argv.includes('--assume-live');

if (!ASSUME_LIVE && appleState !== 'READY_FOR_SALE') {
    console.log(`아직 출시 전이라 공지를 올리지 않는다 (애플 ${versionName}: ${appleState ?? '없음'})`);
    process.exit(0);
}

// 2) 같은 버전 공지가 이미 있으면 두 번 올리지 않는다
const title = `[운영] 케어브이 업데이트 안내 v${versionName}`;
const already = sqlOnProd(
    `SELECT COUNT(*) FROM plaza_posts WHERE title = ${escapeSql(title)};`,
);
if (Number(already) > 0) {
    console.log(`이미 올라간 공지가 있다: ${title}`);
    process.exit(0);
}

const content = [
    '안녕하세요, 케어브이입니다.',
    '',
    '이번 업데이트에서 고친 내용입니다.',
    '',
    releaseNotes,
    '',
    '스토어에서 업데이트하시면 바로 쓰실 수 있습니다.',
].join('\n');

if (DRY_RUN) {
    console.log(`[미리보기] 올릴 공지\n제목: ${title}\n---\n${content}`);
    process.exit(0);
}

// 3) 등록 — 목록 API는 is_official = 1만 보여준다(빠뜨리면 아무도 못 본다)
sqlOnProd(`INSERT INTO plaza_posts
  (board, category, title, content, author_id, author_name, company_name,
   is_anonymous, is_pinned, is_hidden, view_count, created_at, modified_at,
   is_official, contact_info, contact_public)
 VALUES
  ('FREE', NULL, ${escapeSql(title)}, ${escapeSql(content)},
   'ggprgrkjh@naver.com', '케어브이', NULL,
   0, 1, 0, 0, NOW(), NOW(), 1, NULL, 0);`);

// 4) 실제로 목록에 보이는지, 한글이 깨지지 않았는지 확인한다
const shown = execFileSync('curl', ['-s', 'https://silverithm.site/api/v1/plaza/notices?size=3'], {
    encoding: 'utf8',
});
if (!shown.includes(`v${versionName}`)) {
    console.error(`공지를 넣었는데 목록에 안 보인다 — 확인 필요\n${shown.slice(0, 400)}`);
    process.exit(1);
}
if (!shown.includes('케어브이입니다')) {
    console.error('공지 본문의 한글이 깨졌다 — utf8mb4 확인 필요');
    process.exit(1);
}

console.log(`공지 등록 완료: ${title}`);

/** 작은따옴표만 쓰는 안전한 문자열 리터럴 — 사용자 입력이 아니라 우리가 쓴 문구다 */
function escapeSql(text) {
    return `'${text.replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
}
