// 답장 인용문이 (1) 중간에 잘리지 않고 아래로 흐르는지 (2) 누르면 원본으로 가는지.
//
// 인용문은 "무슨 말에 답한 건지" 읽으라고 있는 자리다. 한 줄로 잘라 "..."을 붙이면
// 정작 그 말이 안 보여 쓸모가 없다. 그리고 눌러도 아무 일이 없으면, 원본을 찾으려
// 스크롤을 한참 올려야 한다(카톡은 눌러서 바로 간다).
//
// 채팅 화면이 셋(관리자·직원 탭, 플로팅 채팅, 앱)이라 한 곳만 고치고 끝내기 쉽다.
import { APP, WEB, read, want, done } from './_lib.mjs';

// --- 웹: 관리자·직원이 같이 쓰는 채팅 탭 ---
const chat = read(`${WEB}/src/components/ChatManagement.tsx`);
const chatQuote = chat.slice(chat.indexOf('{/* 답글 원본 미리보기'), chat.indexOf('{photoGroup ?'));

want(chatQuote.length > 0, '채팅 탭에서 답장 인용문을 찾지 못했다 (검사 기준이 낡았다)');
want(!/whiteSpace: "nowrap"/.test(chatQuote), '채팅 탭 인용문이 아직 한 줄로 잘린다');
want(!/textOverflow: "ellipsis"/.test(chatQuote), '채팅 탭 인용문에 "..." 잘림이 남아 있다');
want(/whiteSpace: "pre-wrap"/.test(chatQuote), '채팅 탭 인용문이 아래로 흐르지 않는다');
want(/jumpToMessageId\(/.test(chatQuote), '채팅 탭 인용문을 눌러도 원본으로 가지 않는다');
want(/const jumpToMessageId = async/.test(chat), '채팅 탭에 원본으로 가는 길이 없다');

// 부드러운 스크롤에 맡기면 이 목록의 다른 스크롤 장치(맨 아래 고정·옛 대화 위치 보정)에
// 밀려 원래 자리로 되돌아온다. 실제로 화면 밖 원본을 눌러도 아무 일이 없었다.
const jumpFn = chat.slice(chat.indexOf('const scrollToMessageAndHighlight'), chat.indexOf('const handleSearchResultClick'));
want(jumpFn.length > 0, '이동 함수를 찾지 못했다 (검사 기준이 낡았다)');
want(
    !/behavior: "smooth"/.test(jumpFn),
    '이동이 부드러운 스크롤에 맡겨져 있다 — 다른 스크롤 장치에 밀려 되돌아온다',
);
want(
    /container\.scrollTop = Math\.max\(0, offset\)/.test(jumpFn),
    '채팅 탭이 목록 안 위치를 직접 계산해 옮기지 않는다',
);

// --- 웹: 플로팅 채팅 (다른 탭에서 띄워 쓰는 창) ---
const floating = read(`${WEB}/src/components/FloatingChat/FloatingChatMessages.tsx`);
const floatingQuote = floating.slice(floating.indexOf('const renderReplyPreview'), floating.indexOf('const renderReplyPreview') + 2200);

want(!/maxLines=\{1\}/.test(floatingQuote), '플로팅 채팅 인용문이 아직 한 줄로 잘린다');
want(/whiteSpace: "pre-wrap"/.test(floatingQuote), '플로팅 채팅 인용문이 아래로 흐르지 않는다');
want(/jumpToMessageId\(/.test(floatingQuote), '플로팅 채팅 인용문을 눌러도 원본으로 가지 않는다');
want(/floating-chat-message-\$\{message\.id\}/.test(floating), '플로팅 채팅 메시지에 찾아갈 표식이 없다');
want(
    /container\.scrollTop = Math\.max\(0, offset\)/.test(floating),
    '플로팅 채팅이 목록 안 위치를 직접 계산해 옮기지 않는다',
);

// --- 앱 ---
const screen = read(`${APP}/lib/screens/chat_room_screen.dart`);
const appQuote = screen.slice(screen.indexOf('Widget _buildReplyQuote'), screen.indexOf('Widget _buildMessageBody'));

want(appQuote.length > 0, '앱에서 답장 인용문을 찾지 못했다 (검사 기준이 낡았다)');
want(!/TextOverflow\.ellipsis/.test(appQuote), '앱 인용문에 "..." 잘림이 남아 있다');
want(!/maxLines:/.test(appQuote), '앱 인용문이 아직 줄 수로 잘린다');
want(/_jumpToRepliedMessage\(/.test(appQuote), '앱 인용문을 눌러도 원본으로 가지 않는다');
want(/Future<void> _jumpToRepliedMessage/.test(screen), '앱에 원본으로 가는 길이 없다');
// 데려다 놓고 아무 표시가 없으면 어느 줄인지 알 수 없다
want(/_highlightedMessageId/.test(screen), '앱이 찾아온 메시지를 알려 주지 않는다');
// 목록은 화면 밖 항목을 만들지 않는다 — 한 번 보고 없다고 포기하면 옛 메시지에는 못 간다
want(/Future<void> _scrollToProbe/.test(screen), '앱이 아직 안 그려진 메시지를 찾아가지 못한다');

done('답장 인용문 잘림·이동 확인');
