// G8a: 앱에서 채팅방 공지를 열었을 때 긴 글이 스크롤되는지.
import { APP, read, want, done } from './_lib.mjs';

const files = [
  `${APP}/lib/screens/chat_room_screen.dart`,
  `${APP}/lib/screens/chat_room_info_screen.dart`,
];
const src = files.map(f => { try { return read(f); } catch { return ''; } }).join('\n');

// 공지 상세를 그리는 자리를 찾고, 그 안에 스크롤 가능한 위젯이 있어야 한다.
const noticeBlocks = src.match(/공지[\s\S]{0,1500}/g) || [];
want(noticeBlocks.length > 0, '공지를 그리는 곳을 못 찾았다');
const scrollable = noticeBlocks.some(b =>
  /SingleChildScrollView|ListView|scrollable|DraggableScrollableSheet/.test(b));
want(scrollable, '공지 보기에 스크롤 가능한 위젯이 없다 — 긴 글이 잘린다');

done('notice-scroll-ok');
