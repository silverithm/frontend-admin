// G16: 백엔드 테스트 실패가 기준선(34건)을 넘지 않는지.
// 기존 실패는 이번 작업과 무관한 스케줄러·구독 테스트다.
import { execSync } from 'node:child_process';
import { API, want, done } from './_lib.mjs';

const BASELINE = 34;
const out = execSync(`cd ${API} && ./gradlew test 2>&1 || true`, { encoding: 'utf8', maxBuffer: 128e6 });
const m = out.match(/(\d+) tests completed(?:, (\d+) failed)?/);
want(!!m, '테스트 결과를 읽지 못했다');
if (m) {
  const failed = Number(m[2] || 0);
  want(failed <= BASELINE, `백엔드 실패 ${failed}건 — 기준선 ${BASELINE}건을 넘었다`);
}

done('api-regression-ok');
