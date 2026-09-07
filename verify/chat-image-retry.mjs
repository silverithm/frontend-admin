// 채팅 사진을 그리는 자리가 전부 ChatImage를 거치는지 본다.
//
// ChatImage는 깨져 온 사진을 스스로 다시 받는다(캐시 우회 → 같은 출처 프록시).
// 한 자리라도 맨 <img>로 남으면 그 자리만 예전처럼 깨진 채로 남고,
// "종종 사진 깨짐" 제보가 거기서 계속 나온다.
import { WEB, read, want, done } from './_lib.mjs';

const CHAT_FILES = [
  'src/components/ChatManagement.tsx',
  'src/components/FloatingChat/FloatingChatMessages.tsx',
  'src/components/chat/ChatPhotoGroup.tsx',
  'src/components/chat/ChatImageLightbox.tsx',
];

/** 소스에서 규칙 위반을 찾는다 — 자체 점검이 같은 함수를 쓴다 */
export function findViolations(label, source) {
  const problems = [];
  for (const m of source.matchAll(/<img[\s>]/g)) {
    const line = source.slice(0, m.index).split('\n').length;
    problems.push(`${label}:${line} 맨 <img>로 사진을 그린다 — ChatImage를 써야 재시도가 붙는다`);
  }
  for (const m of source.matchAll(/<ChatImage[^>]*\ssrc=\{(?:message|m)\.fileUrl/g)) {
    const line = source.slice(0, m.index).split('\n').length;
    problems.push(`${label}:${line} 목록이 원본을 그린다 — chatListImageUrl(축소본)을 써야 한다`);
  }
  return problems;
}

// 규칙이 위반을 실제로 잡는지부터 확인한다 — 못 잡으면 이 검사는 아무것도 지키지 못한다
want(findViolations('f', '<img src={chatListImageUrl(m)} />').length === 1, '자체 점검: 맨 <img>를 못 잡는다');
want(findViolations('f', '<ChatImage src={message.fileUrl} />').length === 1, '자체 점검: 원본 직접 사용을 못 잡는다');
want(findViolations('f', '<ChatImage src={chatListImageUrl(m)} />').length === 0, '자체 점검: 멀쩡한 코드를 위반으로 본다');

let usages = 0;
for (const rel of CHAT_FILES) {
  const source = read(`${WEB}/${rel}`);
  usages += (source.match(/<ChatImage[\s>]/g) || []).length;
  for (const problem of findViolations(rel, source)) want(false, problem);
}

// 전부 지워 놓고 통과하는 일이 없도록 사용처 수도 본다 (말풍선·묶음·서랍·크게보기)
want(usages >= 5, `ChatImage 사용처가 ${usages}곳뿐이다 — 사진을 그리는 자리를 빠뜨렸다`);

done('목록은 모두 축소본을 쓴다');
