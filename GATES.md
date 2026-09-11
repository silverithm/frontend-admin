# Gates: 어르신 케어 정보 + 채팅 답장/이동 수정

Scope: 어르신 케어 정보(주민번호·등급·낙상·욕창·인지·식사·목욕·투약·차량·자리)를 백엔드 암호화 저장 + 웹 등록/수정/목록/엑셀 + 앱 열람/수정으로 만들고, 웹 채팅 답장 말풍선 늘어짐과 같은 방 재진입 문제를 고친 뒤, 화면 캡처로 사용자 승인을 받아 머지·배포한다.

- [ ] G1: 백엔드(api-server 워크트리)가 컴파일된다
  CHECK: sh -c 'cd /Users/gimjunhyeong/Develop/silverithm/api-server/.claude/worktrees/elder-care-info && ./gradlew compileJava compileTestJava --console=plain 2>&1 | tail -5'
  EXPECT: BUILD SUCCESSFUL
  EVIDENCE: pending

- [ ] G2: 케어 프로필 단위·JPA 테스트(마스킹·주민번호 파생·저장 시 암호화·삭제 시 캐스케이드·관리자만 전체 번호 열람)가 통과한다
  CHECK: sh -c 'cd /Users/gimjunhyeong/Develop/silverithm/api-server/.claude/worktrees/elder-care-info && ./gradlew test --tests "*ElderCareProfile*" --console=plain 2>&1 | tail -8'
  EXPECT: BUILD SUCCESSFUL
  EVIDENCE: pending

- [ ] G3: Flyway V1.91.0 마이그레이션이 있고 origin/main·로컬 어디에도 같은 번호가 없다
  CHECK: node verify/elder-care-migration.mjs
  EXPECT: MIGRATION_OK
  EVIDENCE: pending

- [ ] G4: 웹(frontend-admin 워크트리) 타입체크가 통과한다
  CHECK: sh -c 'npx tsc --noEmit && echo TSC_OK'
  EXPECT: TSC_OK
  EVIDENCE: pending

- [ ] G5: 엑셀 파서(새 열 인식·검증)와 케어 정보 표시 유틸 테스트 + 기존 테스트가 통과한다
  CHECK: sh -c 'node --test src/lib/elderExcel.test.ts src/lib/elderCare.test.ts src/lib/chatMessageGrouping.test.ts src/lib/chatReconnect.test.ts src/lib/proxyRoutes.test.ts && echo FE_TESTS_OK'
  EXPECT: FE_TESTS_OK
  EVIDENCE: pending

- [ ] G6: 채팅 말풍선(메인 탭·플로팅)이 긴 답장 인용문에도 부모 폭(min(70%,560px)/75%)을 넘지 않는다 — 실제 브라우저에서 긴 원문에 답장해 말풍선 폭을 측정
  CHECK: node verify/chat-reply-width.mjs
  EXPECT: REPLY_WIDTH_OK
  EVIDENCE: pending

- [ ] G7: 우측 레일·새 메시지 토스트에서 같은 방을 두 번째 눌러도(목록으로 나갔다가) 그 방이 다시 열린다 — 관리자·직원 화면 모두
  CHECK: node verify/chat-reopen-same-room.mjs
  EXPECT: REOPEN_OK
  EVIDENCE: pending

- [ ] G8: 앱(frontend-app 워크트리) 정적 분석에 오류가 없다
  CHECK: sh -c 'cd /Users/gimjunhyeong/Develop/silverithm/frontend-app/.claude/worktrees/elder-care-info && flutter analyze --no-fatal-infos --no-fatal-warnings lib 2>&1 | tail -3 && echo FLUTTER_ANALYZE_OK'
  EXPECT: FLUTTER_ANALYZE_OK
  EVIDENCE: pending

- [ ] G9: 로컬 백엔드 + 웹 실구동으로 등록→목록 표시→수정→주민번호 열람(관리자)→삭제가 API·화면에서 동작한다
  CHECK: node verify/elder-care-e2e.mjs
  EXPECT: ELDER_CARE_E2E_OK
  EVIDENCE: pending

- [ ] G10: 웹 화면 캡처(어르신 목록·추가 폼·수정 폼·엑셀 양식·채팅 답장)와 앱 화면 캡처(어르신 목록·상세·수정)를 사용자에게 보여 승인을 받았다
  EVIDENCE: pending

- [ ] G11: 승인 후 세 리포 모두 main에 머지·푸시되고, 백엔드는 운영 배포(flyway V1.91.0 success, 컨테이너 교체 확인), 웹은 Vercel 배포 확인
  EVIDENCE: pending
