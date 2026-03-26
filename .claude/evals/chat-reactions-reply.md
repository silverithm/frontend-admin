## EVAL DEFINITION: chat-reactions-reply

Date: 2026-03-26

### Scope
채팅 메시지 이모지 리액션 기능 + 답글(reply) 기능 구현 (프론트엔드 + 백엔드)

---

## EVAL REPORT: chat-reactions-reply

### Capability Evals

| # | Eval | Result |
|---|------|--------|
| CAP-1 | floatingChatTypes.ts에 ReactionSummary + reply 필드 존재 | **PASS** |
| CAP-2 | FloatingChatMessages에 리액션 렌더링 + 롱프레스 메뉴 + 답글 UI | **PASS** |
| CAP-3 | FloatingChat sendMessage에 replyToId 전달 | **PASS** |
| CAP-4 | ChatManagement에 리액션/답글 동일 구현 | **PASS** |
| CAP-5 | 백엔드 마이그레이션 (reply_to_id + FK + index) | **PASS** |
| CAP-6 | ChatMessage 엔티티에 @ManyToOne replyTo (LAZY) | **PASS** |
| CAP-7 | ChatMessageDTO에 reply 필드 + fromEntity 매핑 | **PASS** |
| CAP-8 | ChatService.sendMessage()에서 replyToId 조회/설정 | **PASS** |
| CAP-9 | ChatMessageCreateRequest에 replyToId 필드 | **PASS** |

**Overall: 9/9 passed**

### Regression Evals

| # | Eval | Result |
|---|------|--------|
| REG-1 | 채팅 관련 TypeScript 컴파일 에러 없음 | **PASS** |
| REG-2 | 기존 ChatMessage 필수 필드 보존 (id, senderId, content 등) | **PASS** |
| REG-3 | WebSocket 메시지 흐름 보존 (/app/chat, /topic/chat, STOMP) | **PASS** |
| REG-4 | React Hooks 순서 올바름 (useState < useRef < useEffect) | **PASS** |
| REG-5 | 기존 리액션 API 엔드포인트 보존 (toggleReaction, getReactions) | **PASS** |

**Overall: 5/5 passed**

### Metrics

```
Capability:  pass@1 = 100% (9/9)
Regression:  pass^1 = 100% (5/5)
```

### Grader: Code-Based (deterministic grep/tsc checks)

### Files Changed

**Backend (api-server):**
- `db/migration/V1.17.1__Add_Reply_To_Chat_Messages.sql` (NEW)
- `entity/ChatMessage.java` (replyTo field added)
- `dto/ChatMessageCreateRequest.java` (replyToId field added)
- `dto/ChatMessageDTO.java` (reply fields + fromEntity mapping)
- `service/ChatService.java` (replyTo lookup in sendMessage)

**Frontend (frontend-admin):**
- `FloatingChat/floatingChatTypes.ts` (ReactionSummary + reply fields)
- `FloatingChat/FloatingChatMessages.tsx` (reaction UI + longpress menu + reply)
- `FloatingChat/FloatingChat.tsx` (replyToId in sendMessage + onMessagesUpdate)
- `ChatManagement.tsx` (same reaction/reply features)

### Status: PASS - ALL EVALS GREEN
