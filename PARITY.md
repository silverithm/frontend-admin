# 앱과 웹, 기능이 같은가 — 전수 대조

> "앱에서 구현된 홈, 채팅, 일정, 전자결재의 내용은 웹과 똑같이 기능이 다 구현되어야함"
> "혹시 전체적으로 앱과 웹의 기능이 같이 구현되어있는지 AI로 점검을못할까 준아"

네 화면을 코드로 하나씩 대조했습니다. 표의 **근거** 칸은 전부 실제 파일과 줄 번호입니다 —
"있다/없다"를 눈대중으로 적지 않고 그 자리를 짚었습니다.

- 앱 경로는 `frontend-app/` 기준, 웹 경로는 `frontend-admin/` 기준입니다.
- `다름`은 양쪽에 다 있지만 할 수 있는 일이 다른 경우입니다.

---

## 먼저, 결론

**웹이 앞선 곳이 대부분입니다.** 앱에 아예 없는 기능이 16가지, 웹에 없는 기능이 1가지입니다.
(그 밖에 양쪽에 다 있지만 할 수 있는 일이 다른 것이 3가지 더 있습니다.)
채팅은 거의 같아졌고(이번 작업으로 답장·날짜 배지가 맞춰졌습니다), 벌어진 곳은
**홈·일정·전자결재**입니다.

특히 **전자결재 양식 관리**가 앱에서 반쪽입니다 — 파일 첨부형 양식은 등록되지만
온라인 폼 만들기, 기본 열람자 지정, 대량 등록, 과거 문서 가져오기가 전부 없습니다.
관리자가 앱만으로는 양식을 제대로 못 만듭니다.

### 앱에 없는 것 (16)

| 화면 | 없는 기능 | 무게 |
|---|---|---|
| 홈 | 오늘 출근 현황 카드(수급자·종사자) | 중 — 방금 웹에 새로 넣은 것 |
| 홈 | 내 할 일 미완료 패널 | 중 |
| 홈 | 업계 뉴스 | 하 |
| 홈 | 홈에서 바로 일정 등록·할 일 처리 (앱은 텍스트 목록만) | 중 |
| 일정 | 일정 담당자 지정 (앱은 참석자만) | **상** |
| 일정 | '내 업무만' 필터 | 중 |
| 일정 | 직종으로 참석자 좁혀 일괄 선택 | 중 |
| 일정 | 연간 일정 보기 | 중 |
| 일정 | 이번 달 진행도(완료/전체) | 하 |
| 채팅 | 검색 결과를 눌러 그 메시지로 이동 | 중 — 목록은 뜨는데 눌러도 안 감 |
| 채팅 | 참여자 추가 (버튼은 있는데 안내 문구만 뜨는 미완성) | **상** |
| 전자결재 | 날짜·양식별 필터 | 중 |
| 전자결재 | 양식에 온라인 폼 필드 만들기 | **상** |
| 전자결재 | 양식에 기본 열람자 지정 | 중 |
| 전자결재 | 양식 대량 등록(폴더 통째로) | 중 |
| 전자결재 | 과거 종이 문서 가져오기 | 중 |

### 웹에 없는 것 (1)

| 화면 | 없는 기능 | 무게 |
|---|---|---|
| 홈 | 당겨서 새로고침 | 하 — 웹에서는 새로고침 키가 그 역할을 합니다 |

### 양쪽에 다 있지만 할 수 있는 일이 다른 것 (3)

- **결재 문서 검색 범위** — 앱은 제목·요청자만, 웹은 내용·첨부·결재자·열람자까지 찾습니다.
  앱에서 "분명 있는데 안 나온다"가 나올 수 있는 자리입니다.
- **홈의 오늘 일정** — 앱은 전용 요약 카드, 웹은 아래 월간 달력의 오늘 칸이 대신합니다.
  둘 다 오늘 것을 보여주므로 빠진 것은 아닙니다.
- **채팅 공지** — 웹은 채팅 탭 전체 화면에만 있고, 오른쪽 레일의 작은 대화창에는 없습니다.

---

## 홈(대시보드)

| 기능 | 앱 | 웹 | 근거 |
|---|---|---|---|
| 공지사항 미리보기 카드 | 있음 | 있음 | `lib/screens/home_screen.dart:423` / `src/components/AdminDashboard.tsx:1101` |
| 전자결재 미리보기 카드(내 차례 강조) | 있음 | 있음 | `lib/screens/home_screen.dart:474` / `src/components/AdminDashboard.tsx:1190` |
| 오늘 일정 요약 | 있음 | 다름(전용 카드 없이 아래 월간 달력의 오늘 칸) | `lib/screens/home_screen.dart:161` / `src/components/AdminDashboard.tsx:1310` |
| 오늘 휴무자 요약 | 있음 | 있음 | `lib/screens/home_screen.dart:168` / `src/components/AdminDashboard.tsx:565` |
| 접속 시 오늘 일정 알림(하루 1회) | 있음 | 있음 | `lib/screens/home_screen.dart:135` / `src/components/AdminDashboard.tsx:2101` |
| 오늘 출근 현황(수급자·종사자 카드) | **없음** | 있음 | `src/components/AdminDashboard.tsx:961` (앱 `home_screen.dart`에 `attendance`·`출석` 없음) |
| 내 할 일 미완료 패널 | **없음** | 있음 | `src/components/AdminDashboard.tsx:1023` (앱에 `myTasks`·`할 일` 없음) |
| 업계 뉴스 | **없음** | 있음 | `src/components/AdminDashboard.tsx:1264` |
| 홈에서 바로 일정 등록·상세·할 일 처리 | **없음**(텍스트 목록만) | 있음 | `lib/screens/home_screen.dart:187` / `src/components/AdminDashboard.tsx:1714` |
| 당겨서 새로고침 | 있음 | **없음** | `lib/screens/home_screen.dart:337` (`RefreshIndicator`) |

## 일정

| 기능 | 앱 | 웹 | 근거 |
|---|---|---|---|
| 월간 달력 그리드 | 있음 | 있음 | `lib/screens/calendar_screen.dart:398` / `src/components/ScheduleCalendar.tsx:1064` |
| 일정 등록(제목·장소·구분·색) | 있음 | 있음 | `lib/screens/calendar_screen.dart:1703` / `src/components/ScheduleCalendar.tsx:871` |
| 일정 알림 발송 | 있음 | 있음 | `lib/screens/calendar_screen.dart:2330` / `src/components/ScheduleCalendar.tsx:1905` |
| 일정 구분 직접 관리(이름·색·숨김) | 있음 | 있음 | `lib/screens/calendar_screen.dart:2451` / `src/components/ScheduleCalendar.tsx:2452` |
| 담당자별 할 일 추가·완료·수정·삭제 | 있음 | 있음 | `lib/screens/calendar_screen.dart:688` / `src/components/ScheduleCalendar.tsx:613` |
| 일정 담당자 지정(참석자와 별개) | **없음**(참석자만) | 있음 | `lib/screens/calendar_screen.dart:2249` / `src/components/ScheduleCalendar.tsx:1911` |
| '내 업무만' 필터 | **없음** | 있음 | `src/components/ScheduleCalendar.tsx:274` (앱에 `showMyTasksOnly`·`내 업무만` 없음) |
| 직종으로 참석자 좁혀 일괄 선택 | **없음**(전체 체크리스트) | 있음 | `lib/screens/calendar_screen.dart:2249` / `src/components/ScheduleCalendar.tsx:1033` |
| 연간 일정 보기 | **없음** | 있음 | `src/components/AnnualScheduleView.tsx`, `src/app/admin/page.tsx:1463` |
| 근무조정(휴무) 신청·달력 | 있음 | 있음 | `lib/screens/calendar_screen.dart:1091` / `src/components/VacationCalendar.tsx` |
| 다음 달만 신청·마감일 안내 | 있음 | 있음 | `lib/screens/calendar_screen.dart:1105` / `src/components/DispatchSettings.tsx` |
| 이번 달 진행도(완료/전체) | **없음** | 있음 | `src/components/ScheduleCalendar.tsx:557` |

## 채팅

| 기능 | 앱 | 웹 | 근거 |
|---|---|---|---|
| 메시지 전송 | 있음 | 있음 | `lib/screens/chat_room_screen.dart:468` / `src/components/ChatManagement.tsx:849` |
| 사진 전송 | 있음 | 있음(파일 첨부로 통합) | `lib/screens/chat_room_screen.dart:675` / `src/components/ChatManagement.tsx:1158` |
| 사진 여러 장 묶어 보기 | 있음 | 있음 | `lib/screens/chat_room_screen.dart:2858` / `src/components/ChatManagement.tsx:1942` |
| 동영상 전송·재생 | 있음 | 있음 | `lib/screens/chat_room_screen.dart:760` / `src/components/ChatManagement.tsx:2119` |
| 파일 첨부 | 있음 | 있음 | `lib/screens/chat_room_screen.dart:1008` / `src/components/ChatManagement.tsx:934` |
| 답장 | 있음 | 있음 | `lib/screens/chat_room_screen.dart:450` / `src/components/ChatManagement.tsx:278` — **이번에 앱에 넣었습니다** |
| 답장 인용을 눌러 원문으로 이동 | 없음 | 없음 | 양쪽 다 없습니다 — 인용은 보여주지만 눌러도 원문으로 가지 않습니다 (`lib/screens/chat_room_screen.dart:3392` `_buildReplyQuote`에 탭 처리 없음, 웹도 같음) |
| 메시지 수정 | 있음 | 있음 | `lib/providers/chat_provider.dart:1401` / `src/components/ChatManagement.tsx:766` |
| 메시지 삭제 | 있음 | 있음 | `lib/screens/chat_room_screen.dart:2700` / `src/components/ChatManagement.tsx:744` |
| 이모지 반응 | 있음 | 있음 | `lib/screens/chat_room_screen.dart:2365` / `src/components/ChatManagement.tsx:824` |
| 읽음 표시 | 있음 | 있음 | `lib/screens/chat_room_screen.dart:3147` / `src/components/ChatManagement.tsx:141` |
| 날짜 구분선 | 있음 | 있음 | `lib/screens/chat_room_screen.dart:3082` / `src/components/ChatManagement.tsx:1960` |
| 스크롤 날짜 배지 | 있음 | 있음 | `lib/screens/chat_room_screen.dart:143` / `src/components/ChatManagement.tsx:12` — **이번에 양쪽에 넣었습니다** |
| 옛 대화 불러오기 | 있음 | 있음 | `lib/providers/chat_provider.dart:81` / `src/components/ChatManagement.tsx:391` |
| 대화 검색 | 있음 | 있음 | `lib/screens/chat_room_screen.dart:1916` / `src/components/ChatManagement.tsx:1052` |
| 검색 결과 눌러 그 메시지로 이동 | **없음**(목록만 뜨고 눌러도 안 감) | 있음 | `lib/screens/chat_room_screen.dart:2011`(`onTap` 없음) / `src/components/ChatManagement.tsx:1064` |
| 공지 등록·보기 | 있음 | 다름(채팅 탭에만, 레일 대화창엔 없음) | `lib/screens/chat_room_screen.dart:1175` / `src/components/ChatManagement.tsx:1139` |
| 참여자 보기 | 있음 | 있음 | `lib/screens/chat_room_info_screen.dart:268` / `src/components/ChatManagement.tsx:1272` |
| 참여자 추가 | **없음**(버튼은 있으나 안내만 뜨는 미완성) | 있음 | `lib/screens/chat_room_info_screen.dart:137`(`TODO` 주석) / `src/components/ChatManagement.tsx:1258` |
| 채팅방 나가기 | 있음 | 있음 | `lib/screens/chat_room_info_screen.dart:62` / `src/components/ChatManagement.tsx:1328` |
| 채팅방 삭제 | 있음 | 있음 | `lib/screens/chat_room_list_screen.dart:319` / `src/components/ChatManagement.tsx:1306` |
| 새 채팅방 만들기 | 있음 | 있음 | `lib/screens/chat_room_list_screen.dart:112` / `src/components/ChatManagement.tsx:1228` |
| 1:1 대화 시작 | 있음 | 있음 | `lib/widgets/chat/chat_member_list.dart:109` / `src/components/ChatManagement.tsx:1012` |
| 접속 상태 표시 | 있음 | 있음 | `lib/providers/chat_provider.dart:85` / `src/components/ChatManagement.tsx:307` |
| 새 메시지 알림 | 있음(푸시) | 있음(레일 토스트) | `lib/services/fcm_service.dart:373` / `src/components/ChatManagement.tsx:1295` |

## 전자결재

| 기능 | 앱 | 웹 | 근거 |
|---|---|---|---|
| 결재 신청(상신·임시저장) | 있음 | 있음 | `lib/screens/approval_form_screen.dart:335` / `src/components/EmployeeApproval.tsx:1250` |
| 첨부파일 업로드 | 있음 | 있음 | `lib/screens/approval_form_screen.dart:213` / `src/components/EmployeeApproval.tsx:859` |
| 온라인 폼으로 작성 | 있음 | 있음 | `lib/widgets/approval/document_form_fields.dart:24` / `src/components/approval/FormRenderer.tsx:562` |
| HWP 양식을 열어 바로 작성 | 있음 | 있음 | `lib/screens/approval_form_screen.dart:268` / `src/components/EmployeeApproval.tsx:1186` |
| 결재선 표시·처리 | 있음 | 있음 | `lib/screens/approval_detail_screen.dart:374` / `src/components/ApprovalDetail.tsx` |
| 열람 대상 표시 | 있음 | 있음 | `lib/screens/approval_detail_screen.dart:377` / `src/components/approval/ViewerSelector.tsx:39` |
| 서명 등록·승인 시 자동 날인 | 있음 | 있음 | `lib/screens/signature_manage_screen.dart:63` / `src/components/approval/MySignatureCard.tsx:51` |
| 승인 시 즉석 서명 | 있음 | 있음 | `lib/screens/admin_approval_management_screen.dart:222` / `src/components/approval/SignatureCanvas.tsx` |
| 직권 승인·반려 | 있음 | 있음 | `lib/screens/admin_approval_management_screen.dart:306` / `src/components/ApprovalManagement.tsx:744` |
| 일괄 승인·반려 | 있음 | 있음 | `lib/screens/admin_approval_management_screen.dart:349` / `src/components/ApprovalManagement.tsx:301` |
| 문서 검색 | 다름(제목·요청자만) | 다름(내용·첨부·결재자·열람자까지) | `lib/screens/admin_approval_management_screen.dart:188` / `src/components/ApprovalManagement.tsx:479` |
| 날짜·양식별 필터 | **없음** | 있음 | `src/components/ApprovalManagement.tsx:133` |
| 양식 등록(파일 첨부형) | 있음 | 있음 | `lib/screens/admin_approval_template_screen.dart:63` / `src/components/ApprovalTemplateManager.tsx:1015` |
| 양식에 온라인 폼 필드 만들기 | **없음** | 있음 | `src/components/ApprovalTemplateManager.tsx:1002`(`FormSchemaBuilder`) |
| 양식에 기본 열람자 지정 | **없음** | 있음 | `src/components/ApprovalTemplateManager.tsx:995` |
| 양식 대량 등록 | **없음** | 있음 | `src/components/approval/TemplateBulkUploadDialog.tsx:19` |
| 과거 종이 문서 가져오기 | **없음** | 있음 | `src/components/approval/ApprovalImportDialog.tsx:19` |

---

# 앱에 칸은 있는데, 안 되거나 뒤진 것

> "웹에는 있는데 앱에는 없는 것들... 앱에는 그 기능 칸은 있는데 없는 그런 것들?"

사장님이 말씀하신 그 형태만 골랐습니다. **화면이나 자리는 앱에도 있는데** 그 안이 비었거나
웹보다 덜 되는 것들입니다. 앱에 화면 자체가 아예 없는 것(연간일정, 뉴스 등)은 뺐습니다.

세 종류로 나뉩니다.

> **먼저, 말씀하신 휴무부터.** 걱정하신 것보다 앱이 잘 따라와 있습니다. 신청·취소·승인·반려·
> **일괄 승인/반려**·관리자 대신 신청·**직종별 인원 한도 설정**·휴무 종류 구분·배차 중복 경고·
> 한도 초과 즉시 알림까지 앱에 다 있습니다. 빠진 건 **일괄 삭제**와 **마감일 지정** 둘뿐입니다
> (마감일은 앱이 읽기만 합니다). 아래 3번 표 마지막 두 줄입니다.

---

## 1. 눌러도 아무 일이 안 나는 것 (1건)

가장 나쁜 형태입니다. 있는 줄 알고 누르는데 안 됩니다.

| 화면 | 있는 것 | 안 되는 것 | 근거 |
|---|---|---|---|
| 채팅방 정보 | "참가자 초대" 버튼이 보입니다 | 누르면 **"추후 구현됩니다"** 안내만 뜹니다 | `lib/screens/chat_room_info_screen.dart:137` (`TODO` 주석 그대로), `:289` (버튼 연결) |

---

## 2. 보여주기만 하고 손댈 수 없는 것 (2건)

값은 화면에 뜨는데, 앱에서는 바꿀 방법이 없습니다.

| 화면 | 보여주는 것 | 못 하는 것 | 근거 |
|---|---|---|---|
| 일정 | 일정에 **"담당: 홍길동"**을 표시합니다 | **담당자를 지정·변경하는 칸이 없습니다.** 웹에서 지정한 것만 읽습니다 | 앱 `lib/screens/calendar_screen.dart:879` (표시만) — 등록 화면에는 참석자만 있음 `:2249`. 웹은 `src/components/ScheduleCalendar.tsx:1911` 담당자 선택 |
| 채팅 | 대화 검색 결과 목록이 뜹니다 | **결과를 눌러도 그 메시지로 가지 않습니다** (탭 처리가 없음) | 앱 `lib/screens/chat_room_screen.dart:2011` (`SeedListCell`에 `onTap` 없음). 웹은 `src/components/ChatManagement.tsx:1064` 스크롤·하이라이트 |

---

## 3. 같은 칸인데 앱이 덜 하는 것

칸은 똑같이 있는데 할 수 있는 범위가 좁습니다.

| 화면 | 칸 | 앱 | 웹 | 근거 |
|---|---|---|---|---|
| 전자결재 | 문서 검색창 | **제목·기안자만** 찾습니다 | 제목·기안자·양식·결재자·열람자·첨부파일·**내용**까지 | 앱 `lib/screens/admin_approval_management_screen.dart:190` / 웹 `src/components/ApprovalManagement.tsx:484` |
| 전자결재 | 문서 목록 필터 | **상태(대기/승인/반려)만** | 상태 + **날짜·양식별** | 앱 `:36` (`_statusFilter` 하나뿐) / 웹 `src/components/ApprovalManagement.tsx:133,186` |
| 일정 | 참석자 고르기 | 전체 명단 체크리스트 | **직종으로 좁혀 일괄 선택** | 앱 `lib/screens/calendar_screen.dart:2249` / 웹 `src/components/ScheduleCalendar.tsx:1033` |
| 일정 | 월간 달력 | 내 것/남의 것 구분 없음 | **'내 업무만' 필터** | 웹 `src/components/ScheduleCalendar.tsx:274` (앱에 해당 코드 없음) |
| 홈 | 오늘 브리핑 | 오늘 일정을 **글로만** 보여줍니다 | 달력에서 **바로 일정 등록·할 일 처리** | 앱 `lib/screens/home_screen.dart:187` / 웹 `src/components/AdminDashboard.tsx:1714` |
| 홈 | 요약 카드들 | 공지·결재·오늘 일정 | + **수급자/종사자 출근 현황**, **내 할 일 미완료** | 웹 `src/components/AdminDashboard.tsx:961`, `:1023` |
| 전자결재 | 양식 관리 | 파일 첨부형 양식만 등록 | + **온라인 폼 만들기**, **기본 열람자 지정**, **대량 등록** | 웹 `src/components/ApprovalTemplateManager.tsx:1002`, `:995`, `approval/TemplateBulkUploadDialog.tsx:19` |
| 회원관리 | 회원 상세에 **직책**이 뜹니다 | 남의 직책을 **바꿀 수 없습니다** — 앱은 자기 직책만(`updateMyPosition`) | 앱 `lib/screens/admin_user_management_screen.dart:500` (읽기), `lib/screens/profile_screen.dart:1715` (내 것만) / 웹 `src/components/PositionManagement.tsx` 역할 배정 |
| 근무조정(휴무) | 관리자 휴무 관리 화면 | 개별 삭제만 됩니다 | **일괄 삭제** | 앱 `lib/screens/admin_vacation_management_screen.dart:1171` (개별만) / 웹 `src/app/admin/page.tsx:957` |
| 근무조정(휴무) | 마감일 안내 배너 | 마감일을 **읽기만** 합니다 | 웹은 **월별 마감일을 지정**할 수 있습니다 | 앱 `lib/providers/vacation_provider.dart:306` (조회만) / 웹 `src/components/AdminPanel.tsx:286` (저장) |

---

## 이 표를 어떻게 쓰면 좋을지

전부 메우는 것이 답은 아닙니다. 큰 화면에서 하는 게 자연스러운 일이 있습니다 —
양식 대량 등록이나 과거 문서 가져오기를 폰에서 할 일은 드뭅니다.

**앱에 먼저 넣을 값어치가 있는 것 셋**을 꼽자면:

1. **채팅 참여자 추가** — 버튼이 있는데 눌러도 안 되는 상태입니다. 없는 것보다 나쁩니다.
2. **일정 담당자 지정** — 웹으로 지정한 담당자를 앱에서는 바꿀 수 없습니다.
   (다만 이건 서버가 관리자를 담당자 후보로 안 내려주는 문제와 얽혀 있습니다.)
3. **검색 결과 눌러 이동** — 찾아 놓고 못 가면 검색한 보람이 없습니다.

나머지는 사장님이 현장에서 아쉬우신 순서대로 정하시면 그대로 따르겠습니다.
