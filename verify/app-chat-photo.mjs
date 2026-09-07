// 앱에서 채팅 사진을 그리는 자리가 전부 ChatPhoto(재시도가 붙은 길)를 거치는지 본다.
//
// 앱은 웹보다 나쁜 조건이다 — CachedNetworkImage는 깨진 응답까지 캐시에 저장해
// 다음에 열어도 계속 깨진 채로 나온다. 한 자리라도 맨 CachedNetworkImage로 남으면
// 그 자리만 예전처럼 남고 "종종 사진 깨짐" 제보가 거기서 계속 나온다.
import { APP, read, want, done } from './_lib.mjs';

/** 채팅 사진을 그리는 파일들 */
const PHOTO_FILES = [
  'lib/screens/chat_room_screen.dart',
  'lib/widgets/chat/chat_photo_group.dart',
  'lib/widgets/chat/chat_image_viewer.dart',
];

/** 맨 CachedNetworkImage가 허용되는 곳 — 재시도를 구현하는 당사자 */
const OWNER = 'lib/widgets/chat/chat_photo.dart';

/** 소스에서 규칙 위반을 찾는다 — 자체 점검이 같은 함수를 쓴다 */
export function findRawUses(label, source) {
  const problems = [];
  for (const m of source.matchAll(/CachedNetworkImage\(/g)) {
    const line = source.slice(0, m.index).split('\n').length;
    problems.push(`${label}:${line} 맨 CachedNetworkImage로 사진을 그린다 — ChatPhoto를 써야 재시도가 붙는다`);
  }
  return problems;
}

// 규칙이 위반을 실제로 잡는지부터 확인한다
want(findRawUses('f', 'child: CachedNetworkImage(imageUrl: url)').length === 1, '자체 점검: 맨 CachedNetworkImage를 못 잡는다');
want(findRawUses('f', 'child: ChatPhoto(imageUrl: url)').length === 0, '자체 점검: 멀쩡한 코드를 위반으로 본다');

let usages = 0;
for (const rel of PHOTO_FILES) {
  const source = read(`${APP}/${rel}`);
  usages += (source.match(/ChatPhoto\(/g) || []).length;
  for (const problem of findRawUses(rel, source)) want(false, problem);
}

// 재시도를 구현하는 쪽은 당연히 CachedNetworkImage를 쓴다 — 그게 사라지면 재시도가 없어진 것이다
const owner = read(`${APP}/${OWNER}`);
want(/CachedNetworkImage\(/.test(owner), `${OWNER}에 CachedNetworkImage가 없다 — 사진을 그리지 못한다`);
want(/evictFromCache/.test(owner), `${OWNER}가 캐시를 지우지 않는다 — 깨진 응답이 캐시에 남아 다시 받아도 소용없다`);

// 전부 지워 놓고 통과하는 일이 없도록 사용처 수도 본다 (말풍선·묶음·크게보기·파일함)
want(usages >= 4, `ChatPhoto 사용처가 ${usages}곳뿐이다 — 사진을 그리는 자리를 빠뜨렸다`);

done('앱 사진은 모두 재시도를 거친다');
