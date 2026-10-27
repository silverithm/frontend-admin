// Astryx 0.1.2의 FieldLabel은 필수·선택 표시를 영어('Required'·'Optional')로 박아 둔다 —
// 한국어 화면의 입력칸마다 "이메일 · Required"처럼 영어가 섞여 보였다(2026-10-27).
// 라이브러리에 글자를 바꾸는 설정이 없어 설치·빌드 직후 한국어로 바꾼다. 몇 번을 돌려도 결과는 같다.
// 라이브러리를 올려 원문이 바뀌면 바꿀 곳을 못 찾았다고 알린다 — src/lib/astryxLabels.test.ts가 같은 것을 확인한다.
import { readFileSync, writeFileSync, existsSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export const FIELD_LABEL_PATH = join('node_modules', '@astryxdesign', 'core', 'dist', 'Field', 'FieldLabel.js');
const ENGLISH = "isOptional ? 'Optional' : isRequired ? 'Required' : null";
const KOREAN = "isOptional ? '선택' : isRequired ? '필수' : null";

export function patchFieldLabel(source) {
  if (source.includes(KOREAN)) return { source, status: 'already' };
  if (!source.includes(ENGLISH)) return { source, status: 'missing' };
  return { source: source.replace(ENGLISH, KOREAN), status: 'patched' };
}

// webpack은 node_modules 파일을 패키지 버전으로만 알아본다 — 버전이 같으면 고친 FieldLabel을 못 보고
// 지난 빌드 캐시의 영어 컴파일 결과를 그대로 쓴다. Vercel은 이전 배포의 캐시(.next/cache)를 되살리므로
// 운영에 'Required'가 남았다(2026-10-28). 한국어로 고친 뒤 만든 캐시에는 표시 파일을 두고,
// 표시가 없는 캐시는 webpack 부분만 한 번 지워 다시 컴파일하게 한다.
export const CACHE_STAMP = 'astryx-labels-ko-1';

export function clearStaleWebpackCache(root, distDir = process.env.NEXT_DIST_DIR || '.next') {
  const dir = join(root, distDir, 'cache', 'webpack');
  if (!existsSync(dir)) return false;
  rmSync(dir, { recursive: true, force: true });
  return true;
}

export function ensureKoreanBuildCache(root, distDir = process.env.NEXT_DIST_DIR || '.next') {
  const cacheDir = join(root, distDir, 'cache');
  const stamp = join(cacheDir, 'astryx-labels.stamp');
  if (existsSync(stamp) && readFileSync(stamp, 'utf8').trim() === CACHE_STAMP) return false;
  const cleared = clearStaleWebpackCache(root, distDir);
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(stamp, CACHE_STAMP);
  return cleared;
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop());
if (isMain) {
  const file = join(process.cwd(), FIELD_LABEL_PATH);
  if (!existsSync(file)) {
    console.warn(`[patch-astryx-labels] ${FIELD_LABEL_PATH}이 없어 건너뜁니다`);
  } else {
    const { source, status } = patchFieldLabel(readFileSync(file, 'utf8'));
    if (status === 'patched') writeFileSync(file, source);
    if (status !== 'missing' && ensureKoreanBuildCache(process.cwd())) {
      console.log('[patch-astryx-labels] 고치기 전에 만든 webpack 캐시를 지웠습니다 (한국어 표시로 다시 컴파일)');
    }
    if (status === 'missing') console.warn('[patch-astryx-labels] FieldLabel 원문이 바뀌어 필수·선택 표시를 한국어로 바꾸지 못했습니다');
    else console.log(`[patch-astryx-labels] 필수·선택 표시 한국어 (${status})`);
  }
}
