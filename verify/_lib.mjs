// 검사 스크립트 공용 도구.
// 모든 단언이 통과한 뒤에만 성공 토큰을 낸다 — 부분 성공은 실패다.
import { readFileSync, existsSync } from 'node:fs';

export const WEB = '/Users/gimjunhyeong/Develop/silverithm/frontend-admin';
export const APP = '/Users/gimjunhyeong/Develop/silverithm/frontend-app';
export const API = '/Users/gimjunhyeong/Develop/silverithm/api-server';

export function read(path) {
  if (!existsSync(path)) fail(`파일이 없다: ${path}`);
  return readFileSync(path, 'utf8');
}

const problems = [];

/** 조건이 거짓이면 문제로 기록한다. 즉시 죽지 않고 전부 모아 보여준다. */
export function want(ok, message) {
  if (!ok) problems.push(message);
}

/** 파일에 정규식이 맞는 곳이 최소 n번 있어야 한다. */
export function wantMatch(path, re, n, label) {
  const src = read(path);
  const hits = (src.match(re) || []).length;
  want(hits >= n, `${label} — ${path}에서 ${re} 가 ${n}회 이상이어야 하는데 ${hits}회`);
}

export function fail(message) {
  console.error(`FAIL ${message}`);
  process.exit(1);
}

/** 문제가 하나도 없을 때만 성공 토큰을 출력한다. */
export function done(token) {
  if (problems.length) {
    for (const p of problems) console.error(`FAIL ${p}`);
    process.exit(1);
  }
  console.log(token);
}
