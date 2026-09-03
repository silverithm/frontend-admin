// G2a: 스크롤 중 화면 위에 뜨는 날짜 배지가 앱·웹 양쪽에 있고,
// 날짜 문구를 새로 만들지 않고 기존 구분선 규칙을 재사용하는지.
//
// 규칙이 두 벌이 되면 배지와 구분선이 서로 다른 날을 가리킬 수 있다.
import { existsSync, readFileSync } from 'node:fs';
import { WEB, APP, read, want, done } from './_lib.mjs';

const readIfAny = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');

// --- 웹: 관리자 채팅탭과 플로팅(레일 도크 공용) 둘 다 있어야 한다 ---
const badgeLib = readIfAny(`${WEB}/src/components/chat/ChatScrollDateBadge.tsx`);
want(badgeLib.length > 0, '웹: 날짜 배지 컴포넌트가 없다');
want(/formatDateSeparator|chatMessageGrouping/.test(badgeLib),
     '웹: 배지가 기존 날짜 규칙을 재사용하지 않는다 — 규칙이 두 벌이 된다');
// 드래그 선택을 막으면 안 된다(방금 고친 기능이다).
want(/pointerEvents:\s*["']none["']|pointer-events:\s*none/.test(badgeLib),
     '웹: 배지가 마우스를 가로채 드래그 선택을 막는다');

for (const [file, label] of [
  [`${WEB}/src/components/ChatManagement.tsx`, '관리자 채팅탭'],
  [`${WEB}/src/components/FloatingChat/FloatingChatMessages.tsx`, '플로팅·레일 공용'],
]) {
  const src = read(file);
  want(/ChatScrollDateBadge/.test(src), `${label}: 날짜 배지를 쓰지 않는다`);
  want(/chatDateMarkerProps/.test(src),
       `${label}: 날짜 구분선에 표시를 안 달아 배지가 읽을 근거가 없다`);
}

// --- 앱 ---
const appSrc = read(`${APP}/lib/screens/chat_room_screen.dart`)
  + readIfAny(`${APP}/lib/widgets/chat/chat_date_badge.dart`);
want(/DateBadge|dateBadge/.test(appSrc), '앱: 스크롤 날짜 배지가 없다');
want(/formatDateSeparatorLabel/.test(appSrc),
     '앱: 배지가 기존 날짜 규칙(formatDateSeparatorLabel)을 재사용하지 않는다');
// 짧은 방(Column)과 긴 방(ListView) 두 경로 모두에 붙어야 한다.
want(/_withScrollDateBadge|withScrollDateBadge/.test(appSrc),
     '앱: 배지를 목록에 감싸는 지점이 없다');
// 정의(Widget _withScrollDateBadge)는 빼고 '호출'만 센다 — 정의까지 세면
// 한 경로만 붙여도 통과해 버린다(대조군으로 실제로 새는 것을 확인했다).
const calls = (appSrc.match(/return\s+_withScrollDateBadge\(/g) || []).length;
want(calls >= 2,
     `앱: 짧은 방·긴 방 두 경로 모두에 배지가 붙어야 하는데 호출이 ${calls}곳뿐이다`);

done('date-badge-both-platforms');
