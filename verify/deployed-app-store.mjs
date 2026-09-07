// 앱이 실제로 스토어에 올라갔는지 본다 — pubspec 버전과 대조한다.
//
// "업로드했다"는 말은 증거가 아니다. 애플 App Store Connect와 구글 Play에
// **pubspec.yaml의 버전이 실제로 존재하는지**를 각 스토어 API로 직접 확인한다.
// (fastlane 로그를 tail로 잘라 성공 여부를 놓친 전례가 있다.)
import { execFileSync } from 'node:child_process';
import { APP, read, want, done } from './_lib.mjs';

const version = /^version:\s*([0-9.]+)\+(\d+)/m.exec(read(`${APP}/pubspec.yaml`));
want(Boolean(version), 'pubspec.yaml에서 버전을 못 읽었다');
const [, versionName, buildNumber] = version ?? [];

function python(script) {
  return execFileSync('python3', ['-c', script], { encoding: 'utf8' }).trim();
}

// 1) 애플 — 그 버전의 앱스토어 버전이 존재하는지 (심사 대기/심사중/판매중 무엇이든)
let appleState = '';
try {
  appleState = python(`
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
} catch (error) {
  want(false, `App Store Connect 조회 실패: ${error.message}`);
}
const appleLine = appleState.split('\n').find((line) => line.startsWith(`${versionName}=`));
want(Boolean(appleLine), `애플에 ${versionName} 버전이 없다 (있는 것: ${appleState.split('\n').join(', ')})`);

// 버전이 '만들어졌다'는 것과 '제출됐다'는 것은 다르다.
// PREPARE_FOR_SUBMISSION은 아무에게도 안 나간 상태다 — 그걸 배포로 세면 안 된다.
const SUBMITTED = [
  'WAITING_FOR_REVIEW', 'IN_REVIEW', 'PENDING_DEVELOPER_RELEASE',
  'PENDING_APPLE_RELEASE', 'PROCESSING_FOR_APP_STORE', 'READY_FOR_SALE',
];
const appleStateName = appleLine?.split('=')[1] ?? '없음';
want(
  SUBMITTED.includes(appleStateName),
  `애플 ${versionName}이 아직 제출되지 않았다 (상태: ${appleStateName})`,
);

// 2) 구글 — 프로덕션 트랙에 그 빌드 번호가 올라가 있는지
let playState = '';
try {
  playState = python(`
import json, time, urllib.request, jwt
sa = json.load(open("/Users/gimjunhyeong/keys/liftupai-fastlane-play.json"))
now = int(time.time())
assertion = jwt.encode({"iss": sa["client_email"], "scope": "https://www.googleapis.com/auth/androidpublisher",
                        "aud": "https://oauth2.googleapis.com/token", "iat": now, "exp": now + 600},
                       sa["private_key"], algorithm="RS256")
body = urllib.parse.urlencode({"grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                               "assertion": assertion}).encode()
tok = json.load(urllib.request.urlopen("https://oauth2.googleapis.com/token", body))["access_token"]
pkg = "com.silverithm.carev.app"
base = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/" + pkg
def api(path, method="GET"):
    req = urllib.request.Request(base + path, method=method,
                                 headers={"Authorization": "Bearer " + tok})
    return json.load(urllib.request.urlopen(req))
edit = api("/edits", "POST")["id"]
track = api("/edits/" + edit + "/tracks/production")
for release in track.get("releases", []):
    print(release.get("status", "?") + ":" + ",".join(str(c) for c in release.get("versionCodes", [])))
`);
} catch (error) {
  want(false, `Play Console 조회 실패: ${error.message}`);
}
want(
  playState.split('\n').some((line) => line.split(':')[1]?.split(',').includes(buildNumber)),
  `구글 프로덕션 트랙에 빌드 ${buildNumber}가 없다 (있는 것: ${playState.split('\n').join(' / ')})`,
);

console.log(`애플: ${appleLine ?? '없음'}`);
console.log(`구글: ${playState.split('\n').join(' / ')}`);
done(`앱 ${versionName}+${buildNumber} 두 스토어 반영 확인`);
