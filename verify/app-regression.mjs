// G15: 앱 analyze 에러 0, 테스트 실패는 기존 2건뿐.
// 기존 실패는 채팅과 무관한 것들이라 그 둘만 허용한다.
import { execSync } from 'node:child_process';
import { APP, want, done } from './_lib.mjs';

const KNOWN = [
  '서버 JSON 왕복 아직 사람을 고르지 않은 빈 운전자 자리는 저장하지 않는다',
  'Counter increments smoke test',
];

const analyze = execSync(`cd ${APP} && flutter analyze lib/ 2>&1 || true`, { encoding: 'utf8', maxBuffer: 64e6 });
const errors = (analyze.match(/^ +error/gm) || []).length;
want(errors === 0, `analyze 에러 ${errors}건`);

const raw = execSync(`cd ${APP} && flutter test test/ --reporter json 2>/dev/null || true`, { encoding: 'utf8', maxBuffer: 256e6 });
const names = new Map();
const fails = [];
for (const line of raw.split('\n')) {
  let e; try { e = JSON.parse(line); } catch { continue; }
  if (e.type === 'testStart') names.set(e.test.id, e.test.name);
  if (e.type === 'testDone' && e.result !== 'success' && !e.hidden) fails.push(names.get(e.testID) || '?');
}
const unexpected = fails.filter(f => !KNOWN.includes(f));
want(unexpected.length === 0, `새 테스트 실패: ${unexpected.join(' / ')}`);
want(fails.length <= KNOWN.length, `실패 ${fails.length}건 (기준선 ${KNOWN.length}건)`);

done('app-regression-ok');
