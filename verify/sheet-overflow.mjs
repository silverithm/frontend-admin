// G23: 아래에서 올라오는 시트가 화면을 넘칠 때 스크롤되는지.
//
// 실제로 겪은 것: 채팅 메시지를 길게 눌렀더니 메뉴가 화면을 넘쳐
// "BOTTOM OVERFLOWED BY 84 PIXELS"가 뜨고 '수정'과 '삭제'가 화면 밖으로 밀렸다.
// 기능은 멀쩡한데 보이지가 않아서 "수정 기능이 없다"가 됐다.
// 채팅방 공지가 안 읽히던 것과 같은 종류다 — 시트에 스크롤이 없으면 넘친 부분은 못 본다.
import { readFileSync, existsSync } from 'node:fs';
import { APP, want, done } from './_lib.mjs';

/**
 * 항목 수가 상황에 따라 달라지는 시트들 — 여기가 넘치면 사용자는 기능이 없다고 느낀다.
 * 파일:줄 이 아니라 '무엇을 여는 시트인지'로 짚는다.
 */
const mustScroll = [
    { file: 'lib/screens/chat_room_screen.dart', fn: '_showMessageOptions',
      why: '메시지 길게 누르기 메뉴 — 답장·수정·삭제가 잘렸던 자리' },
    { file: 'lib/screens/chat_room_screen.dart', fn: '_showNoticeDetail',
      why: '공지 보기 — 긴 글이 잘렸던 자리' },
    { file: 'lib/screens/chat_room_screen.dart', fn: '_showMessageReaders',
      why: '읽은 사람 보기 — 28명 방에서 명단이 길어진다' },
];

for (const { file, fn, why } of mustScroll) {
    const f = `${APP}/${file}`;
    want(existsSync(f), `${file} 이 없다`);
    const src = readFileSync(f, 'utf8');

    // 정의부(들여쓰기 2칸)에서 시작해 다음 최상위 메서드 직전까지를 본문으로 본다
    const defRe = new RegExp(`\\n  (?:void|Future<[^>]*>|Widget) ${fn}\\(`);
    const m = defRe.exec(src);
    want(m !== null, `${fn} 정의를 못 찾았다 — 이름이 바뀌었으면 이 검사도 같이 고쳐야 한다`);

    const start = m.index;
    const rest = src.slice(start + 1);
    // 다음 메서드 정의(들여쓰기 2칸 + 반환형) 또는 클래스 끝까지
    const nextDef = rest.search(/\n  (?:void|Future<|Widget|String|bool|int|double|List<|Map<|static|@override)\s/);
    const body = rest.slice(0, nextDef > 0 ? nextDef : rest.length);

    want(/AppBottomSheet\.show|showModalBottomSheet/.test(body),
         `${fn} 이 시트를 열지 않는다 — 검사 대상이 바뀌었다`);
    want(/SingleChildScrollView|ListView(?!\.builder\(\s*shrinkWrap)|DraggableScrollableSheet/.test(body),
         `${fn}: 시트에 스크롤이 없다 (${why}) — 항목이 늘면 화면 밖으로 밀려 안 보인다`);
    want(/maxHeight/.test(body),
         `${fn}: 시트 높이 상한이 없다 (${why}) — 스크롤이 있어도 화면을 덮어 버린다`);
}

done('sheet-overflow-ok');
