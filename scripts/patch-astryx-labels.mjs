// Astryx 0.1.2의 FieldLabel은 필수·선택 표시를 영어('Required'·'Optional')로 박아 둔다 —
// 한국어 화면의 입력칸마다 "이메일 · Required"처럼 영어가 섞여 보였다(2026-10-27).
// 라이브러리에 글자를 바꾸는 설정이 없어 설치·빌드 직후 한국어로 바꾼다. 몇 번을 돌려도 결과는 같다.
// 라이브러리를 올려 원문이 바뀌면 바꿀 곳을 못 찾았다고 알린다 — src/lib/astryxLabels.test.ts가 같은 것을 확인한다.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export const FIELD_LABEL_PATH = join('node_modules', '@astryxdesign', 'core', 'dist', 'Field', 'FieldLabel.js');
const ENGLISH = "isOptional ? 'Optional' : isRequired ? 'Required' : null";
const KOREAN = "isOptional ? '선택' : isRequired ? '필수' : null";

export function patchFieldLabel(source) {
  if (source.includes(KOREAN)) return { source, status: 'already' };
  if (!source.includes(ENGLISH)) return { source, status: 'missing' };
  return { source: source.replace(ENGLISH, KOREAN), status: 'patched' };
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop());
if (isMain) {
  const file = join(process.cwd(), FIELD_LABEL_PATH);
  if (!existsSync(file)) {
    console.warn(`[patch-astryx-labels] ${FIELD_LABEL_PATH}이 없어 건너뜁니다`);
  } else {
    const { source, status } = patchFieldLabel(readFileSync(file, 'utf8'));
    if (status === 'patched') writeFileSync(file, source);
    if (status === 'missing') console.warn('[patch-astryx-labels] FieldLabel 원문이 바뀌어 필수·선택 표시를 한국어로 바꾸지 못했습니다');
    else console.log(`[patch-astryx-labels] 필수·선택 표시 한국어 (${status})`);
  }
}
