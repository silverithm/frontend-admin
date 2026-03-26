## EVAL: elderly-attendance-system

### Feature Description
어르신(수급자) 관리 시스템 + 출석 추적 + 대시보드 확장 + 배차관리 드롭다운 전환

### Phase 1: Capability Evals

#### Backend
- [ ] BE-1: Elderly 엔티티에 company 관계가 추가되었는가
- [ ] BE-2: DB 마이그레이션 파일이 올바르게 작성되었는가 (V1.18.0, V1.19.0)
- [ ] BE-3: ElderRepository에 company 기반 쿼리 메서드가 있는가
- [ ] BE-4: AttendanceService가 직원/어르신 출석 요약을 반환하는가
- [ ] BE-5: ElderController에 company 기반 CRUD 엔드포인트가 있는가
- [ ] BE-6: AttendanceController가 출석 체크/조회/일괄 엔드포인트를 제공하는가
- [ ] BE-7: EmployeeAttendance/ElderAttendance 엔티티가 올바르게 정의되었는가

#### Frontend
- [ ] FE-1: TypeScript 타입 체크 통과 (tsc --noEmit)
- [ ] FE-2: Next.js 빌드 성공 (npm run build)
- [ ] FE-3: apiService.ts에 어르신 CRUD 함수 존재
- [ ] FE-4: apiService.ts에 출석 관리 함수 존재
- [ ] FE-5: UserManagement에 어르신 관리 탭 존재
- [ ] FE-6: AdminDashboard에 6개 통계 카드 존재
- [ ] FE-7: DispatchSettings에서 드롭다운으로 어르신 선택
- [ ] FE-8: API 프록시 라우트가 올바르게 생성됨
- [ ] FE-9: dispatch.ts의 Senior 인터페이스에 elderlyId 필드 추가됨

### Phase 2: Regression Evals
- [ ] REG-1: 기존 ElderController의 userId 기반 API가 유지됨
- [ ] REG-2: 기존 UserManagement의 가입신청/기존회원 탭이 정상 동작
- [ ] REG-3: 기존 AdminDashboard의 하단 패널(공지/결재/일정)이 유지됨
- [ ] REG-4: 기존 DispatchSettings의 노선/운전자 관리 기능이 유지됨

### Success Metrics
- pass@1 >= 80% for capability evals
- pass@3 = 100% for regression evals
