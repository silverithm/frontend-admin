## EVAL: tab-restructure

### Context
관리자 대시보드 탭 구조 리팩토링:
- "정보관리" -> "회원관리" (서브탭 제거, UserManagement만 직접 렌더링)
- "배차관리"를 "월간일정" 달력에 모드 전환으로 통합
- "결재승인", "휴무승인" 서브탭 제거

### Phase 1: Capability Evals

1. [TYPE_SAFETY] TypeScript 컴파일 에러 없음
2. [TAB_RENAME] "정보관리" -> "회원관리" 이름 변경 완료
3. [TAB_STATE] MainTab 타입에 "members" 존재, "info" 제거
4. [SCHEDULE_MODE] ScheduleMode 타입 ("schedule" | "dispatch") 존재
5. [DISPATCH_IN_CALENDAR] ScheduleCalendar가 mode prop 수용
6. [DISPATCH_CELL_RENDER] 배차 모드에서 달력 셀에 정상/대체/미운행 표시 코드 존재
7. [DISPATCH_LEGEND] 배차 모드 헤더에 범례(정상/대체/운행없음/휴일) 존재
8. [DISPATCH_SETTINGS_BTN] 배차 모드 헤더에 "배차 설정" 버튼 존재
9. [DISPATCH_DAY_DETAIL] 배차 모드에서 DispatchDayDetail 모달 연결
10. [DISPATCH_SETTINGS_MODAL] 배차 모드에서 DispatchSettings 모달 연결
11. [REMOVED_SUBTABS] 정보관리 서브탭(배치관리/결재승인/휴무승인) 코드 제거
12. [REMOVED_IMPORTS] VacationApproval, DispatchManagement import 제거 (admin/page.tsx)
13. [DASHBOARD_TAB_REF] AdminDashboard.tsx의 tab 참조가 'members'로 변경

### Phase 2: Regression Evals

1. [BUILD] 프로젝트 빌드 성공 (tsc --noEmit)
2. [SCHEDULE_MODE_DEFAULT] 일정 모드가 기본값 ("schedule")
3. [EXISTING_TABS] 기존 탭들(대시보드/공지/채팅/전자결재/근무조정) 영향 없음
4. [APPROVAL_SUBTAB] 전자결재 서브탭(결재관리/양식관리) 정상 유지

### Success Metrics
- pass@1 for all capability evals
- pass^3 = 100% for regression evals (build)
