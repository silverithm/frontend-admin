// 백엔드와 웹이 실제로 최신 커밋으로 서비스 중인지 본다.
//
// "배포했다"는 말은 증거가 아니다. 서버 저장소가 origin/main과 같은지, 앱이 살아 있는지,
// 웹의 최신 프로덕션 배포가 carev.kr에 붙어 있는지를 직접 확인한다.
// (2026-08-08에 pull만 되고 배포는 실패해 21시간 방치된 전례가 있다.)
import { execFileSync } from 'node:child_process';
import { WEB, want, done } from './_lib.mjs';

function sh(command, options = {}) {
  return execFileSync('sh', ['-c', command], { encoding: 'utf8', ...options }).trim();
}

// 1) 백엔드 — 서버 저장소가 origin/main과 같은 커밋인지
let serverState = '';
try {
  serverState = sh(
    `ssh silverithm 'cd ~/backend && git fetch -q origin && ` +
    `echo "HEAD=$(git rev-parse --short HEAD) BEHIND=$(git rev-list --count HEAD..origin/main)"'`,
  );
} catch (error) {
  want(false, `서버 접속 실패: ${error.message}`);
}
const behind = /BEHIND=(\d+)/.exec(serverState)?.[1];
want(behind === '0', `백엔드가 origin/main보다 ${behind ?? '?'}커밋 뒤처져 있다 (${serverState})`);

// 2) 백엔드가 살아 있는지 — 배포는 됐는데 컨테이너가 안 뜬 경우를 잡는다
let health = '';
try {
  health = sh(`curl -s --max-time 15 https://silverithm.site/health`);
} catch (error) {
  want(false, `헬스체크 실패: ${error.message}`);
}
want(/"status"\s*:\s*"UP"/.test(health), `백엔드 헬스체크가 UP이 아니다: ${health}`);

// 3) 웹 — 최신 프로덕션 배포가 Ready이고 carev.kr에 붙어 있는지
let inspect = '';
try {
  const list = sh(`cd ${WEB} && npx vercel ls 2>&1`);
  const url = /https:\/\/silverithm-frontend-admin-mksj-[a-z0-9]+\.vercel\.app/.exec(list)?.[0];
  want(Boolean(url), 'Vercel 배포 목록에서 최신 배포 주소를 못 찾았다');
  if (url) inspect = sh(`cd ${WEB} && npx vercel inspect ${url} 2>&1`);
} catch (error) {
  want(false, `Vercel 조회 실패: ${error.message}`);
}
want(/●\s*Ready/.test(inspect), '웹 최신 배포가 Ready 상태가 아니다');
want(/https:\/\/carev\.kr/.test(inspect), '웹 최신 배포가 carev.kr에 연결돼 있지 않다');

done('백엔드·웹 배포 확인');
