// G4a: 읽음 수를 참가자별 lastReadMessageId로 세고,
// 참가자를 아직 못 받은 상태와 "정말 다 읽음"을 구분하는지.
// 구분하지 않으면 탭을 옮겼다 올 때 숫자가 사라진다(예전 사고).
import { WEB, read, want, done } from './_lib.mjs';

const src = read(`${WEB}/src/components/ChatManagement.tsx`);
want(/lastReadMessageId/.test(src),
     '읽음 수를 lastReadMessageId로 세지 않는다');
want(/participantsReady/.test(src),
     '참가자 로딩 중과 다 읽음을 구분하는 상태가 없다');
want(/participantsReady[\s\S]{0,300}?(null|return)/.test(src),
     '참가자를 못 받은 동안 0을 그리지 않도록 막는 처리가 없다');
// readCount를 그리기에 쓰면 수정·삭제 이벤트가 0을 보낼 때 숫자가 튄다.
const drawsFromReadCount = /countUnreadReaders[\s\S]{0,400}?readCount/.test(src);
want(!drawsFromReadCount,
     '읽음 수를 서버 readCount로 그린다 — 수정·삭제 이벤트가 0을 보내면 숫자가 사라진다');

done('unread-guard-ok');
