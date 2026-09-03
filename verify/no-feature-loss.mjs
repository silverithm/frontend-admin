// G17: 최근 배포된 채팅 기능이 하나도 사라지지 않았는지.
// 레이아웃을 바꾸다 조용히 없어지기 쉬운 것들이다. 예전에 실제로 그런 사고가 있었다.
import { WEB, APP, read, want, done } from './_lib.mjs';

const admin = read(`${WEB}/src/components/ChatManagement.tsx`);
const floating = read(`${WEB}/src/components/FloatingChat/FloatingChatMessages.tsx`);
const css = read(`${WEB}/src/app/globals.css`);
const appChat = read(`${APP}/lib/screens/chat_room_screen.dart`);

// 웹 — 옛 대화 로딩(세 화면이 공유 훅을 쓴다)
want(/useOlderChatMessages/.test(admin), '웹 관리자: 옛 대화 로딩이 사라졌다');
want(/useOlderChatMessages/.test(floating), '웹 플로팅: 옛 대화 로딩이 사라졌다');
want(/대화의 시작입니다/.test(admin), '웹: 대화 끝 표시가 사라졌다');

// 웹 — 검색 점프
want(/fetchChatMessagesAround/.test(admin), '웹: 검색 결과 점프가 사라졌다');

// 웹 — 새 메시지 배지
want(/showNewMessageBadge/.test(admin), '웹: 새 메시지 배지가 사라졌다');

// 웹 — 메시지 수정
want(/수정됨/.test(admin), '웹 관리자: 수정됨 표시가 사라졌다');
want(/수정됨/.test(floating), '웹 플로팅: 수정됨 표시가 사라졌다');
want(/editedAt/.test(admin), '웹: editedAt 처리가 사라졌다');

// 웹 — 사진 묶음, 동영상
want(/chatMessageGrouping|groupPhotos|photoGroup/i.test(admin), '웹: 사진 묶음이 사라졌다');
want(/preload=["']metadata["']|video/i.test(admin), '웹: 동영상 처리가 사라졌다');

// 웹 — 드래그 선택 표시
want(/carev-selection-on-accent/.test(css), '웹: 드래그 선택 색 규칙이 사라졌다');
want(/carev-selection-on-accent/.test(admin), '웹 관리자: 내 말풍선 선택 표시가 사라졌다');

// 웹 — Shift+Enter (한 줄 input이면 줄바꿈이 불가능해진다)
want(/TextArea/.test(admin), '웹: 여러 줄 입력이 사라졌다 — Shift+Enter가 안 된다');

// 앱 — 날짜 구분선, 이름 레이아웃, 사진 묶음, 동영상 썸네일 데이터 가드
want(/shouldShowDateSeparatorAbove/.test(appChat), '앱: 날짜 구분선이 사라졌다');
want(/ChatSenderHeader|ChatAvatarSlot/.test(appChat), '앱: 이름·아바타 레이아웃이 사라졌다');
want(/resolveChatImageUrl/.test(appChat), '앱: 썸네일 우선 사용이 사라졌다');
want(/_keepAsIsImageExtensions/.test(appChat), '앱: GIF·PNG 원본 유지 규칙이 사라졌다');

done('no-feature-loss-ok');
