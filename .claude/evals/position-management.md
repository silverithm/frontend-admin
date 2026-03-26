# EVAL: position-management (직책관리 기능)

## Capability Evals

### Backend
1. Position Entity 컴파일 성공
2. Position CRUD API 엔드포인트 존재 (Controller)
3. Flyway 마이그레이션 SQL 유효
4. ChatMessage에 senderPosition 필드 존재
5. Member에 positionEntity 관계 존재
6. MemberDTO에 positionId 필드 존재

### Frontend
7. TypeScript 컴파일 에러 없음
8. PositionManagement 컴포넌트 존재
9. API 프록시 라우트 존재 (positions, positions/[id], positions/assign)
10. apiService에 position CRUD 함수 존재
11. admin page에 membersSubTab 상태 존재
12. 채팅 타입에 senderPosition 필드 존재
13. 채팅 메시지 렌더링에 직책 표시 로직 존재
14. UserManagement에 position 배지 표시 존재
15. 로그인 시 userPosition localStorage 저장

### Regression
16. 기존 백엔드 코드 컴파일 정상
17. 프론트엔드 TypeScript 체크 통과
18. 기존 탭 구조 유지

## Success Metrics
- pass@1 for code graders: 100%
- All regression evals: PASS
