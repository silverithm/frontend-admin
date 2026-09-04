# Gates: 케어브이 현장 개선 12건

OWNS: BACKLOG.md, GATES.md, verify/**

Scope: 사장님이 현장에서 확인하신 12건을 고치고, 각각 실제로 눌러서 되는 것을 확인한 뒤 캡처와 함께 완료 처리한다.

## 원칙

되지도 않았는데 완료로 표시하지 않는다. 코드로 확인할 수 있는 것은 명령으로 못박고, 화면으로만 판단되는 것은 캡처를 남긴다. 각 항목은 **코드 게이트 + 화면 게이트** 두 겹으로 본다.

경로 약칭: `WEB=/Users/gimjunhyeong/Develop/silverithm/frontend-admin`, `APP=/Users/gimjunhyeong/Develop/silverithm/frontend-app`, `API=/Users/gimjunhyeong/Develop/silverithm/api-server`

---

## 1. 채팅 실시간 반영

- [x] G1a: 웹소켓 재연결 처리가 코드에 있다 — 끊긴 뒤 다시 붙고 놓친 메시지를 메운다
  CHECK: node verify/has-reconnect.mjs
  EXPECT: reconnect-handling-present
  EVIDENCE: automatic-evidence=v1; definition-sha256=dd31f65e1ae577dd25ea964521d8349fffb9dc4daa6a28620656b8da56e5ed76; exit=0; EXPECT=matched; output-sha256=9c78c1ae110c963018223b0066107fd2e6b1f4bbfffe5dfcdbab47fc86c7aba4; output-bytes=27; shell=/bin/sh; cwd=/Users/gimjunhyeong/Develop/silverithm/frontend-admin; path=7156b96cfa87/39 entries

- [x] G1b: 창 두 개에서 한쪽이 보낸 메시지가 다른 쪽에 즉시 나타난다
  EVIDENCE: 브라우저 창 두 개에서 같은 임시방을 열고, 둘째 창에서 보낸 메시지가
  첫째 창을 건드리지 않은 채 바로 떴다. 말풍선과 왼쪽 목록 미리보기가 함께 갱신되고,
  시간이 "in a few seconds"로 찍혔다 (verify/shots/01_realtime_web.jpg).
  원인은 소켓이 툭 끊길 때 onDisconnect가 안 불려 isConnected가 true로 남고,
  재연결해도 방 구독이 다시 안 붙던 것. 프레임으로 확인한 내용은 BACKLOG.md 1-1에 있다.

## 2. 스크롤 시 날짜 배지

- [x] G2a: 날짜 배지 위젯이 앱·웹 양쪽에 있고 기존 날짜 규칙을 재사용한다
  CHECK: node verify/has-date-badge.mjs
  EXPECT: date-badge-both-platforms
  EVIDENCE: automatic-evidence=v1; definition-sha256=cf23f2be3629c3d5aea13b7a7cdc90550d7d6e44b34cbc98dcc83d980b9e872f; exit=0; EXPECT=matched; output-sha256=f82d4329ab5a3481878bde39ca023da71a03fa7d6305c2a82c40997ff32c942e; output-bytes=26; shell=/bin/sh; cwd=/Users/gimjunhyeong/Develop/silverithm/frontend-admin; path=7156b96cfa87/39 entries

- [ ] G2b: 위로 스크롤하면 상단에 날짜가 보인다 — 웹 확인 완료, 앱은 화면 미확인
  EVIDENCE: 웹은 확인했다 — 채팅방에서 위로 올리자 화면 상단 가운데에 "8월 24일"이 떴다
  (verify/shots/02_date_badge_web.png). 앱 쪽은 시뮬레이터를 띄웠으나 로그인 화면에서 막혔다.
  나는 비밀번호를 입력하지 않는다. 사장님이 시뮬레이터에서 로그인해 주시면 바로 확인한다.

## 3. 웹 채팅 이름 위치

- [x] G3a: 아바타와 이름줄이 가로로 배치된다 (세 화면 모두)
  CHECK: node verify/name-beside-avatar.mjs
  EXPECT: name-beside-avatar-ok
  EVIDENCE: automatic-evidence=v1; definition-sha256=b661a3af6cd67e2fd07ddc219c5df49580deb738db67f6241e6d9ae8e0e6bd33; exit=0; EXPECT=matched; output-sha256=2ee05ca43901b439b6d6b9e876df24f8989e234eb5b26c94bb964507f14c045b; output-bytes=22; shell=/bin/sh; cwd=/Users/gimjunhyeong/Develop/silverithm/frontend-admin; path=7156b96cfa87/39 entries

- [x] G3b: 화면에서 이름이 아바타 우측 한 줄로 보이고 긴 직종이 안 잘린다
  EVIDENCE: 운영 데이터로 브라우저 확인 (2026-09-04). "이광성 (요양팀장)", "강부옥 (요양보호사)"가
  아바타 오른쪽 한 줄에 오고, 같은 사람이 연달아 보낸 메시지에는 아바타를 반복하지 않고 자리만
  비워 말풍선이 세로로 정렬됨. 캡처: verify/shots/03_name_beside_avatar.png

## 4. 웹 체크표시

- [x] G4a: 읽음 수를 참가자 기준으로 세고, 로딩 중과 "다 읽음"을 구분한다
  CHECK: node verify/unread-count-guard.mjs
  EXPECT: unread-guard-ok
  EVIDENCE: automatic-evidence=v1; definition-sha256=75847bd8eae2e38f616ef22309c68b28fe31c1002872dc100d07144bcfac5231; exit=0; EXPECT=matched; output-sha256=071276cd15048c1ea4b2bfb718c37c2cc47209cda3b27323a90921171384203c; output-bytes=16; shell=/bin/sh; cwd=/Users/gimjunhyeong/Develop/silverithm/frontend-admin; path=7156b96cfa87/39 entries

- [x] G4b: 사라지던 경로를 재현하고 고친 뒤 유지된다
  EVIDENCE: 경로 — 채팅 탭 → 근무조정 탭 → 채팅 탭. 탭을 옮기면 ChatManagement가 통째로
  언마운트돼 participants가 빈 배열로 다시 시작하는데, 그것이 "다 읽음"과 구분되지 않아
  숫자가 잠깐 사라졌다. 고친 뒤 같은 경로로 눌러 확인 —
  "고마워요 보경샘…", "늦은 시간까지…", "넵 내일 봐요" 세 메시지의 읽음 1이 모두 남아 있다
  (verify/shots/04_read_marks_persist.png).

## 5. 앱 답장 기능

- [x] G5a: 앱 모델·화면·전송 경로에 답장이 구현돼 있다
  CHECK: node verify/app-reply.mjs
  EXPECT: app-reply-ok
  EVIDENCE: automatic-evidence=v1; definition-sha256=0bd9604bb0389bbac6d92046a127787649bd5ca9b26d738fc41f73dbd6ca806f; exit=0; EXPECT=matched; output-sha256=8854de5ef32e577fe96f51de32d35ada4801da8c7f78f71af8665350bab85984; output-bytes=13; shell=/bin/sh; cwd=/Users/gimjunhyeong/Develop/silverithm/frontend-admin; path=7156b96cfa87/39 entries

- [ ] G5b: 앱에서 답장을 달면 말풍선 위에 원문 인용이 보인다 — 사장님 로그인 필요
  EVIDENCE: 코드 게이트(G5a)와 flutter analyze 0 에러는 통과했다. 화면 확인은 시뮬레이터
  로그인이 필요해 멈춰 있다 — 나는 비밀번호를 입력하지 않는다.
  게이트 문구를 고쳤다: 처음엔 "눌러서 원문으로 이동한다"까지 적었는데, 확인해 보니
  **웹에도 없는 기능**이었다. 요청은 "앱 채팅에는 답장기능이없음"이었고 기준은 웹이므로,
  없는 것을 앱에만 요구하는 조건이었다. 그 항목은 지우지 않고 PARITY.md의 빈칸으로 남겼다.

## 6. 메시지 수정 오류

- [x] G6a: 수정 실패 원인이 코드에서 제거됐다 — 프록시가 PUT을 받는다
  CHECK: node verify/proxy-routes-complete.mjs
  EXPECT: proxy-routes-ok
  EVIDENCE: automatic-evidence=v1; definition-sha256=c3bef532da6ee0d7559f874a946f48752ebcad8dc1ddf819dd4f65638dbb6cfc; exit=0; EXPECT=matched; output-sha256=6aca1d1ba3b565b6d31c69dd910e453d2d46036aa7b9d4b0289653788f8bf867; output-bytes=16; shell=/bin/sh; cwd=/Users/gimjunhyeong/Develop/silverithm/frontend-admin; path=7156b96cfa87/39 entries

- [x] G6b: 실제로 수정이 저장되고 목록 미리보기까지 바뀐다
  EVIDENCE: 임시방에서 "수정하기 전 원본"을 보낸 뒤 실제로 고쳐 저장했다.
  말풍선이 "수정된 내용입니다 (수정됨)"으로 바뀌고 왼쪽 목록 미리보기도 함께 바뀌었다
  (verify/shots/06_message_edit.jpg). 확인 후 그 임시방은 나갔다.
  원인: 화면·API 함수·백엔드 모두 PUT인데 프록시 파일만 DELETE만 내보내고 있었다 —
  채팅방 나가기와 같은 형태의 누락이다.

## 7. 웹 채팅방 나가기

- [x] G7a: 웹에 나가기 동작이 있고 앱과 같은 API를 부른다
  CHECK: node verify/web-leave-room.mjs
  EXPECT: web-leave-ok
  EVIDENCE: automatic-evidence=v1; definition-sha256=dcf70525064a6db71998f2d31761f8a0484afbbdd41aaf827020891375b6b392; exit=0; EXPECT=matched; output-sha256=1b3d9b30f6fd1cf3dcc25ec05dddcdba2ecfa891eac4deb05eeb9bb68f18098c; output-bytes=13; shell=/bin/sh; cwd=/Users/gimjunhyeong/Develop/silverithm/frontend-admin; path=7156b96cfa87/39 entries

- [x] G7b: 실제로 나가지고 목록에서 사라진다
  EVIDENCE: 저만 참여한 임시방("나가기 확인용 임시방")을 만들어 목록 ⋯ → 나가기까지 실제로 눌렀다.
  처음엔 "채팅방 나가기에 실패했습니다"가 떴고, 네트워크 기록에 POST .../193/leave 404,
  서버 로그에는 나가기 기록이 아예 없었다 — 프록시 라우트 파일이 없어 백엔드에 닿지도 못했다.
  라우트를 만든 뒤 다시 누르니 "채팅방에서 나갔습니다"가 뜨고 목록 9 → 8, 새로고침 후에도
  사라진 채였다(verify/shots/07_web_leave_room.jpg, 07b_web_leave_done.jpg).

## 8. 앱 공지 긴 글 스크롤

- [x] G8a: 공지 보기가 스크롤 가능한 구조다
  CHECK: node verify/app-notice-scroll.mjs
  EXPECT: notice-scroll-ok
  EVIDENCE: automatic-evidence=v1; definition-sha256=277133025d8cd811b8bdcc739169675c583b82fdf6f7ab3a0b6e154924c148d4; exit=0; EXPECT=matched; output-sha256=0090e9972bd5d05f8807bdefbb4e9bce2cc2e0daf139203822497243de84b43d; output-bytes=17; shell=/bin/sh; cwd=/Users/gimjunhyeong/Develop/silverithm/frontend-admin; path=7156b96cfa87/39 entries

- [ ] G8b: 앱에서 긴 공지가 끝까지 읽힌다 — 사장님 로그인 필요
  EVIDENCE: 코드 게이트(G8a)와 flutter analyze 0 에러는 통과했다. 화면 확인은 시뮬레이터
  로그인이 필요해 멈춰 있다.

## 9. 전자결재 기안 생성 오류

- [x] G9a: 결재 양식 저장 실패(500) 원인이 제거됐다
  CHECK: node verify/template-viewer-update.mjs
  EXPECT: template-viewer-ok
  EVIDENCE: automatic-evidence=v1; definition-sha256=a036209e13efa7ccd3a31377b343e7b105775eddd4098b2536a1975d29869aa2; exit=0; EXPECT=matched; output-sha256=42621ca6d04cabfb6c02fe946bcf7e4d58e2c68cce3b4dac15c8e35f2963bd1e; output-bytes=19; shell=/bin/sh; cwd=/Users/gimjunhyeong/Develop/silverithm/frontend-admin; path=7156b96cfa87/39 entries

- [x] G9b: 양식을 고쳐 저장하면 500 없이 저장된다
  EVIDENCE: 백엔드 배포(4c70211) 후 같은 자리를 다시 눌렀다 — 양식 관리 → 수급자 퇴소
  체크리스트 → 편집 → 저장. "수정 완료 — 양식이 수정되었습니다"가 떴다
  (verify/shots/09_template_save_fixed.jpg). 배포 전에는 같은 조작이
  "저장 실패 — 백엔드 서버 오류: 500"이었다.

## 10. 앱·웹 기능 대조

- [x] G10a: 홈·채팅·일정·전자결재 대조표가 작성됐고 각 항목에 근거 파일·줄이 있다
  CHECK: node verify/parity-doc.mjs
  EXPECT: parity-doc-ok
  EVIDENCE: automatic-evidence=v1; definition-sha256=0dca4dede2d145bfe973d86b7afd5fa48f389e435c1b32194f8f1a778b5bfc5e; exit=0; EXPECT=matched; output-sha256=47f39637bb27a2e91e768cff836585407b89cae2b6d09b32ae7353f12e19ca5a; output-bytes=14; shell=/bin/sh; cwd=/Users/gimjunhyeong/Develop/silverithm/frontend-admin; path=7156b96cfa87/39 entries

## 11. 웹 채팅 레일 통일

- [x] G11a: 직원 화면에도 채팅 레일이 붙어 있다
  CHECK: node verify/employee-chatrail.mjs
  EXPECT: employee-chatrail-ok
  EVIDENCE: automatic-evidence=v1; definition-sha256=d425de8451c27fa9ffda8bc0f48f7aa1b65f4d7029212c5221023806dd2b9ece; exit=0; EXPECT=matched; output-sha256=8b7307512c249d6e9d0e1acd0330c35e717625bce16cb393bf56b441f6f43969; output-bytes=21; shell=/bin/sh; cwd=/Users/gimjunhyeong/Develop/silverithm/frontend-admin; path=7156b96cfa87/39 entries

- [x] G11b: 화면에서 직원·관리자가 같은 구성으로 보인다
  EVIDENCE: verify/shots/11_employee_chatrail.jpg — /employee 화면 우측에 레일이 서고
  "직원 3/27" 접속 현황과 대화방 8개가 관리자 화면과 같은 구성으로 렌더된다. 관리자 계정은
  /employee 접근 시 /admin으로 보내지므로 로컬 브라우저에서 loginType만 잠시 member로 두고
  확인한 뒤 되돌렸다(서버·계정 변경 없음). 실제 직원 계정 확인은 사장님께 요청.

## 12. 역할관리 시설장

- [x] G12a: 역할 인원 집계가 관리자(app_user)를 포함한다
  CHECK: node verify/role-count-includes-admin.mjs
  EXPECT: role-count-ok
  EVIDENCE: automatic-evidence=v1; definition-sha256=fb1f29bf0664ac689e455da3a376c7df4ff87456d1694c7d4022e01e2ced5861; exit=0; EXPECT=matched; output-sha256=969eddd551dded889633c0ac845987452d3977a0ba9b261a5f03bcaaf43c7610; output-bytes=14; shell=/bin/sh; cwd=/Users/gimjunhyeong/Develop/silverithm/frontend-admin; path=7156b96cfa87/39 entries

- [x] G12b: 화면 숫자가 운영 DB 실제 수와 일치한다
  EVIDENCE: 운영 DB(숲속재활어르신재가복지센터) 조회 — members에 position='시설장'인 직원 0명,
  app_user(미삭제)에 1명. 합 1명. 화면도 "시설장 1명"으로 같다(verify/shots/12_role_facility_admin.jpg).
  고치기 전 0명이던 이유도 이 숫자로 그대로 설명된다 — 직원 테이블만 세면 0이다.

## 13. 대시보드 현황 카드

- [x] G13a: 수급자(총원·출석·결석), 종사자(총원·근무·휴무) 카드가 대시보드에 있다
  CHECK: node verify/dashboard-cards.mjs
  EXPECT: dashboard-cards-ok
  EVIDENCE: automatic-evidence=v1; definition-sha256=bd6ffb36fd13c42385a9cd7189027bad2a3ac4a1e35a40792a76d8c0a7fa6095; exit=0; EXPECT=matched; output-sha256=6475673fbc83ea5841f4dfec5dcd284d1f5646409653075b6766390b0c2a3b37; output-bytes=19; shell=/bin/sh; cwd=/Users/gimjunhyeong/Develop/silverithm/frontend-admin; path=7156b96cfa87/39 entries

- [x] G13b: 숫자가 운영 DB와 일치한다
  EVIDENCE: 화면 수급자 83/0/83, 종사자 27/0/0 (verify/shots/13_dashboard_cards.jpg).
  운영 DB: elderly(company 4) 83건, members ACTIVE 27건 — 총원이 둘 다 같다.
  출석·근무 0은 새벽 0시 41분이라 아직 아무도 출근 체크를 안 한 상태이며,
  API 응답(elder present 0/absent 83, employee present 0/vacation 0)과도 정확히 같다.
  (수동: DB 조회 결과 + 화면 캡처 대조)

## 회귀

- [x] G14: 웹 타입 검사 통과
  CHECK: cd /Users/gimjunhyeong/Develop/silverithm/frontend-admin && npx tsc --noEmit && echo "web-tsc-clean"
  EXPECT: web-tsc-clean
  EVIDENCE: automatic-evidence=v1; definition-sha256=13b180429bf8f919ea74547c4ac6d1693c89f02534d09ba5c8becd93e7102689; exit=0; EXPECT=matched; output-sha256=ff86d1f085b9e724f108b906e8c409c5c4b81bafd5874afb2f96e3da4ba75ae2; output-bytes=14; shell=/bin/sh; cwd=/Users/gimjunhyeong/Develop/silverithm/frontend-admin; path=7156b96cfa87/39 entries

- [x] G15: 앱 analyze 에러 0, 테스트 실패는 기존 2건뿐
  CHECK: node verify/app-regression.mjs
  EXPECT: app-regression-ok
  EVIDENCE: automatic-evidence=v1; definition-sha256=5bdaddd58629ce0eb4de24c526b23a097912879fb03632c8ad396df656d86cdd; exit=0; EXPECT=matched; output-sha256=21bcc80efc439fef83ed0f965a9f1d38444af7ba3d104985b5549c68e7eb7f90; output-bytes=18; shell=/bin/sh; cwd=/Users/gimjunhyeong/Develop/silverithm/frontend-admin; path=7156b96cfa87/39 entries

- [x] G16: 백엔드 테스트 실패가 기준선(34건)을 넘지 않는다
  CHECK: node verify/api-regression.mjs
  EXPECT: api-regression-ok
  EVIDENCE: automatic-evidence=v1; definition-sha256=d1491d180dc79d97a613c01d6838d3babf22f58469cfeb06abd9ac42026df34a; exit=0; EXPECT=matched; output-sha256=49073de1a1da70711299bacd529d97b5d9565833ec04be462a7b801479309c4c; output-bytes=18; shell=/bin/sh; cwd=/Users/gimjunhyeong/Develop/silverithm/frontend-admin; path=7156b96cfa87/39 entries

- [x] G18: 프론트가 부르는 모든 경로에 프록시가 있고 그 메서드를 받는다
  CHECK: node verify/proxy-routes-complete.mjs
  EXPECT: proxy-routes-ok
  EVIDENCE: automatic-evidence=v1; definition-sha256=c3bef532da6ee0d7559f874a946f48752ebcad8dc1ddf819dd4f65638dbb6cfc; exit=0; EXPECT=matched; output-sha256=6aca1d1ba3b565b6d31c69dd910e453d2d46036aa7b9d4b0289653788f8bf867; output-bytes=16; shell=/bin/sh; cwd=/Users/gimjunhyeong/Develop/silverithm/frontend-admin; path=7156b96cfa87/39 entries
  (나가기·메시지 수정·이모지 반응·결재 양식 순서가 모두 이 한 가지 이유로 죽어 있었다.
   눈으로 세지 않도록 전수로 본다. 통제 표본 두 개로 확인함 — 경로 폴더를 지우면
   "프록시 경로가 없는 호출 1건", PUT을 PATCH로 바꾸면 "그 메서드를 안 받는 호출 1건"으로 실패한다.)

- [x] G17: 최근 배포된 채팅 기능이 하나도 사라지지 않았다 — 옛 대화 로딩·검색 점프·수정·사진 묶음·동영상·드래그 선택·Shift+Enter
  CHECK: node verify/no-feature-loss.mjs
  EXPECT: no-feature-loss-ok
  EVIDENCE: automatic-evidence=v1; definition-sha256=d59c91ece4e86b07e59b71fc62890b495ae7db753d97b080331d366a2c82a75d; exit=0; EXPECT=matched; output-sha256=3814b31a30b39520279b0a03ca6bfa29196d959aff521da86788a73bb52d82ed; output-bytes=19; shell=/bin/sh; cwd=/Users/gimjunhyeong/Develop/silverithm/frontend-admin; path=7156b96cfa87/39 entries

<!--
검사 스크립트는 verify/ 아래 저장소 소유 Node 스크립트로 둔다.
각 스크립트는 모든 단언을 통과한 뒤에만 성공 토큰을 출력한다.
부재를 확인하는 검사는 알려진 양성 표본으로 먼저 실패하는지 확인한다.
캡처는 verify/shots/ 에 두고 BACKLOG.md에서 참조한다.
-->
