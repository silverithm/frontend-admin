---
name: 케어브이 관리자 웹
description: 장기요양기관의 근무표·휴무·운영을 한 화면에서 다루는 관리자 도구
colors:
  care-teal: "#0f766e"
  deep-teal: "#005348"
  teal-pale: "#CAE1DF"
  teal-hairline: "#A9CFCB"
  on-accent: "#ffffff"
  ink: "#171717"
  mid-gray: "#737373"
  soft-gray: "#a3a3a3"
  hairline: "#d4d4d4"
  hairline-strong: "#b8b8b8"
  header-teal: "#0f766e"
  header-line: "#0b5d57"
  header-ink: "#ffffff"
  header-ink-soft: "#E1F0EE"
  subheader-teal: "#F1F7F6"
  subheader-line: "#C3DDDB"
  paper-gray: "#f1f1f1"
  card-white: "#ffffff"
  approve-green: "#007004"
  approve-green-pale: "#c5e5c0"
  reject-red: "#a50c25"
  reject-red-pale: "#facecb"
  pending-yellow: "#745b00"
  pending-yellow-pale: "#f8da9d"
  info-blue: "#00458c"
  info-blue-pale: "#c4ddfb"
typography:
  display:
    fontFamily: "Figtree, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "2.4375rem"
    fontWeight: 400
    lineHeight: 1.2308
  headline:
    fontFamily: "Figtree, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 600
    lineHeight: 1.4545
  title:
    fontFamily: "Figtree, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.5
  body:
    fontFamily: "Figtree, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.5385
  label:
    fontFamily: "Figtree, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.5385
  supporting:
    fontFamily: "Figtree, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 400
    lineHeight: 1.4545
  code:
    fontFamily: "ui-monospace, SFMono-Regular, SF Mono, Monaco, Consolas, Liberation Mono, Courier New, monospace"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.5385
rounded:
  none: "4px"
  inner: "6px"
  element: "10px"
  container: "12px"
  page: "28px"
  full: "9999px"
spacing:
  "0.5": "2px"
  "1": "4px"
  "1.5": "6px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  "8": "32px"
  "10": "40px"
components:
  button-primary:
    backgroundColor: "{colors.care-teal}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.inner}"
  nav-item-active:
    backgroundColor: "{colors.paper-gray}"
    textColor: "{colors.ink}"
    rounded: "{rounded.element}"
  nav-item-rest:
    textColor: "{colors.mid-gray}"
    rounded: "{rounded.element}"
  panel-card:
    backgroundColor: "{colors.card-white}"
    rounded: "{rounded.container}"
    padding: "0"
  badge-approved:
    backgroundColor: "{colors.teal-pale}"
    textColor: "{colors.deep-teal}"
    rounded: "{rounded.full}"
  badge-pending:
    backgroundColor: "{colors.pending-yellow-pale}"
    textColor: "{colors.pending-yellow}"
    rounded: "{rounded.full}"
  badge-rejected:
    backgroundColor: "{colors.reject-red-pale}"
    textColor: "{colors.reject-red}"
    rounded: "{rounded.full}"
---

# Design System: 케어브이 관리자 웹

## Overview

**Creative North Star: "조용한 작업대"**

센터장이 아침에 열어서 퇴근할 때 닫는 창이다. 하루 여덟 시간을 같이 보내는 화면은 스스로를 내세우면 안 된다. 여기서 눈에 띄어야 하는 것은 인터페이스가 아니라 오늘 누가 쉬는지, 결재가 몇 건 밀렸는지, 이번 주 일정이 어떻게 겹치는지다. 그래서 이 시스템은 장식을 먼저 덜어낸다. 면은 평평하고, 경계는 1px 선으로 긋고, 색은 상태를 말할 때만 쓴다.

밀도는 타협 대상이 아니라 설계의 출발점이다. 본문 기준 글자를 13px로 낮춘 것도, 달력 칸이 격자선을 직접 그리는 것도, 한 화면에 최대한 많은 사실을 담기 위해서다. 여백을 늘려 숨통을 틔우는 방향의 개선은 이 제품에서는 개선이 아니다. 관리자는 스크롤을 내리는 대신 한눈에 보기를 원한다.

브랜드 색인 틸은 아껴 쓴다. 화면 대부분은 흰 면과 회색 글자이고, 틸은 지금 선택된 것·승인된 것·눌러야 할 것에만 나타난다. 단 하나의 예외는 화면 맨 위 머리줄 띠(아래 "헤더 틸")다. 틸이 흔해지면 그 색이 가지던 "여기를 보라"는 뜻이 사라진다.

**Key Characteristics:**
- 평면 위에 1px 선. 그림자는 반응할 때만
- 본문 13px, 밀도 우선
- 틸은 강조에만, 나머지는 흰색과 회색 (맨 위 머리줄 띠만 예외)
- 상태는 색으로 말한다 — 승인은 녹색, 대기는 노랑, 거절은 빨강
- 달력이 주인공인 화면이 여러 개다

## Colors

흰 종이 위에 회색 글씨, 그리고 필요한 자리에만 색. 팔레트의 90%는 무채색이고 유채색은 전부 상태나 강조를 위한 것이다.

### Primary
- **케어 틸** (#0f766e): 브랜드 색. 기본 버튼 배경, 선택된 항목, 링크, 강조 아이콘. 화면 어디서든 "이것이 지금 활성이다" 또는 "여기를 누르라"는 뜻이다. `--color-accent`, `--color-text-accent`로 쓴다.
- **딥 틸** (#005348): 틸의 어두운 짝. 전역 포커스 링과 틸 배경 위 텍스트에 쓴다. `--color-icon-teal`, `--color-text-teal`.
- **틸 페일** (#CAE1DF, 선 #A9CFCB — 기본 틸을 옅게 섞은 색. 예전 민트 #a5e3d6은 형광처럼 떠 보여 2026-10-04 교체): 승인된 휴무 필, 오늘 날짜 뱃지 같은 "확정된 좋은 상태"의 배경. `--color-background-teal`.

### Neutral
- **잉크** (#171717): 본문과 제목. 순검정이 아니라 한 단계 눌러 눈부심을 줄인다. `--color-text-primary`.
- **미드 그레이** (#737373): 보조 설명, 비활성 탭, placeholder. `--color-text-secondary`.
- **소프트 그레이** (#a3a3a3): 비활성 상태 글자. `--color-text-disabled`.
- **헤어라인** (#d4d4d4): 이 시스템에서 가장 많이 쓰는 색. 카드 테두리, 표 구분선, 패널 경계. 코드베이스 162곳에서 참조한다. `--color-border`. 흰 카드가 바탕(#f1f1f1)에 묻힌다는 고객 의견으로 #ebebeb에서 한 단계 진하게 했다. 사이드바 오른쪽 경계도 틸이 아니라 이 중립 회색이다.
- **헤어라인 스트롱** (#b8b8b8): 달력 격자선처럼 구조를 또렷하게 그어야 할 때. `--color-border-emphasized`. 헤어라인이 #d4d4d4가 되면서 같은 값이 되지 않도록 올렸고, 촘촘한 달력 격자가 너무 검어 보이지 않는 선에서 멈췄다. 스위치·진행 막대의 트랙 색도 이 값을 따른다.
- **헤더 틸** (#0f766e / 선 #0b5d57 / 글자 #ffffff / 보조 글자 #E1F0EE): 화면 맨 위 머리줄 전용. 로고·버튼과 같은 케어브이 기본 틸 면에 흰 글씨다(2026-10-04 시안 B 승인 — 그 전의 민트 #79E4BE는 형광처럼 떠 보였다). 공지 롤링 줄, 사이드바 맨 위 로고·기관명 줄(관리자·직원 공통), 모바일 상단 바, 기관 프로필·공지 작성·공지 상세의 상단 고정 바에만 쓴다. 두 줄의 높이는 `--carev-header-height`(52px)로 맞춰 가로 한 줄의 띠로 이어진다. `--color-header-background`, `--color-header-border`, `--color-header-text`, `--color-header-text-secondary`. 이 면을 쓰는 요소에는 반드시 `.carev-header-band` 클래스를 함께 단다 — 안쪽 글씨·아이콘을 흰색으로 물려받게 하고, 탭·보조 버튼은 흰 반투명 면(`--color-header-selected`), 주 버튼은 흰 면 + 틸 글씨로 뒤집는다(같은 틸 위에서 묻히므로). 대비 흰 글씨 5.5:1, 보조 글자 4.7:1. 배지·긴급 표시처럼 제 면을 가진 요소는 그 색을 그대로 둔다.
- **2단 머리** (#F1F7F6 / 선 #C3DDDB): 페이지 안쪽 카드·패널의 머리줄 전용으로, 기본 틸을 아주 옅게(6%) 섞은 면이다. 면 + 아래 1px 선으로 "여기서부터 이 카드"를 표시한다. `--color-subheader-background`, `--color-subheader-border`. 다크 값은 어두운 틸 #12302b / 선 #1f5a4d. 본문 글자는 `--color-text-primary`(라이트 16.9:1, 다크 #fafafa 13.6:1)를 그대로 쓴다.
  - **쓰는 곳:** 대시보드 카드 머리(내 할 일·공지사항·전자결재·요양 소식), 대시보드 월간일정 카드의 제목+조작 줄, 커뮤니티 홈 위젯 머리, 일정·직원 달력 카드의 머리줄, 날짜 상세 패널 머리, 채팅의 대화방 목록 머리·대화방 머리줄·채팅방 정보 패널 머리. 면은 카드 가장자리까지 꽉 차고 위쪽 둥근 모서리는 카드의 overflow 잘림이 맞춰 준다.
  - **페이지 제목(`PageHeader`)은 면 없이** 아래 1px `--color-subheader-border` 선과 아래 여백(spacing-3)만 둔다. 바로 아래에 이미 선이 있으면(연간일정 연도 이동 줄) 아래쪽 선을 없애 두 줄이 되지 않게 한다.
  - **달력 요일 줄은 틸이 아니라 중립 면**(`--color-background-muted`)이다. 오늘·승인 강조가 틸 계열이라 겹치지 않게 한다.
  - **쓰지 않는 곳:** 모달·서랍 제목(DialogHeader), 컨트롤 자체(SegmentedControl·TabList), 상태색 영역(경고·오류 배너 등), 공개 마케팅 페이지, 문서 미리보기(`.carev-doc-*`·OfficialDocument), 배차표 캡처 배경, 달력 날짜 칸 격자, 직원 채팅 레일(맨 위 헤더 틸 바로 아래라 면을 두지 않는다), 안쪽 padding 컨테이너 안에 있는 머리줄(근무조정 달력은 요일 줄만 중립 면).
- **페이퍼 그레이** (#f1f1f1): 바탕면, 행 hover, 비활성 배경. `--color-background-muted`.
- **카드 화이트** (#ffffff): 카드와 다이얼로그 면. `--color-background-card`.

### Semantic
- **승인 그린** (#007004 / 배경 #c5e5c0): 승인 완료, 진행도 채움, 접속 중. `--color-text-green`, `--color-background-green`.
- **거절 레드** (#a50c25 / 배경 #facecb): 반려, 삭제, 결석, 마감 임박. `--color-error`, `--color-background-red`.
- **대기 옐로** (#745b00 / 배경 #f8da9d): 승인 대기, 주의. 노랑 계열은 눈이 밝게 인식해 채도를 한 단계 낮춰 두었다(H=85, C=0.085). `--color-text-yellow`.
- **인포 블루** (#00458c / 배경 #c4ddfb): 정보성 안내, 블로그 본문의 강조와 인용. `--color-text-blue`.

### Named Rules

**The 아껴 쓰는 틸 Rule.** 한 화면에서 틸이 칠해진 면적은 10%를 넘지 않는다. 활성 탭 하나, 기본 버튼 하나, 선택된 행 하나면 충분하다. 틸이 세 곳 넘게 보이면 무엇이 중요한지 알 수 없다. 예외: 맨 위 머리줄 띠(헤더 틸)는 "여기가 화면의 머리"라는 구조 표시이지 강조가 아니므로 면적 계산에서 뺀다. 이 예외는 머리줄 한 줄에만 적용되며, 카드·탭·표 머리 등 페이지 안쪽 요소에는 진한 틸 면을 칠하지 않는다. 페이지 안쪽 카드·패널 머리줄에는 한 단계 옅은 "2단 머리"(위 색 목록)만 쓰고, 이것도 구조 표시라 면적 계산에서 뺀다.

**The 색은 상태만 Rule.** 유채색은 상태를 뜻할 때만 쓴다. 카테고리를 구분하려고 파랑·보라·주황을 돌려 쓰지 않는다. 구분이 필요하면 글자와 위치로 한다.

**The 토큰만 Rule.** 색은 언제나 `var(--color-*)`로 쓴다(머리줄 색도 `--color-header-*`·`--color-subheader-*` 토큰으로만). `#0d9488`은 대비 3.0:1로 이미 기각된 값이라 어떤 이유로도 되살리지 않는다.

## Typography

**Body / Display Font:** Figtree (`--font-figtree`, next/font로 로드). 제목과 본문이 같은 가족이다.
**Code Font:** 플랫폼 기본 모노스페이스 (SF Mono / Consolas 등)

**Character:** 한 가족으로 통일한 대신 크기와 굵기로만 위계를 만든다. 서체가 말을 걸지 않고 숫자와 이름이 먼저 읽히게 하는 선택이다.

### Hierarchy
- **Display** (400, 39px, 1.23): 랜딩·가입 화면의 큰 문구. 관리자 화면 안에서는 거의 쓰지 않는다. 실사용에서는 `weight="bold"`로 눌러 쓰는 경우가 많다.
- **Headline / h1** (600, 22px, 1.45): 화면 제목.
- **h2** (600, 19px, 1.47): 섹션 제목.
- **h3 / Title** (700, 16px, 1.5): 패널 제목. h3와 h4만 bold를 주어 하위 구획을 또렷하게 한다.
- **h4** (700, 13px, 1.54): 카드 안 소제목.
- **Body** (400, 13px, 1.54): 본문 기준. 이 13px이 이 제품 밀도의 기준선이다.
- **Label** (500, 13px, 1.54): 폼 라벨, 버튼 글자.
- **Supporting** (400, 11px, 1.45): 날짜, 부가 설명, 메타 정보.

### Named Rules

**The 13px 기준선 Rule.** 본문은 13px이고 스케일 비율은 1.2다. 개별 요소의 `font-size`를 직접 만지지 않는다. 크기를 바꿔야 하면 테마의 base/ratio를 바꿔 전체를 함께 움직인다.

**The 한 가족 Rule.** 새 서체를 들이지 않는다. 위계는 크기·굵기·색으로 만든다. 유일한 예외는 코드 블록의 모노스페이스다.

## Layout

셸은 좌측 고정 사이드바(224px)와 본문, 그리고 넓은 화면에서는 우측 채팅 레일(264px)로 이뤄진다. 1024px 미만에서 사이드바는 상단 가로 스크롤 탭바로 바뀌고, 1280px 미만에서 채팅 레일은 플로팅 위젯으로 접힌다.

높이를 채우는 화면은 예외 없이 **`flex: 1` + `min-height: 0` 체인**으로 잇는다. 셸(100dvh) → 본문 → 탭 콘텐츠 → 카드까지 3~4단이 이어지며, 뷰포트 계산식(`calc(100vh - 200px)`)은 쓰지 않는다. 한 군데라도 체인이 끊기면 안쪽이 내용 높이만큼만 잡혀 빈 공간이 생긴다.

주요 기준점: **640px**(푸터·달력 셀 정사각형), **768px**(광장 목록), **1024px**(사이드바 고정, 대시보드 2열), **1280px**(2단 분할, 채팅 레일), **1440px / 1600px**(대시보드 3열, 연간일정 6열).

간격은 4px 배수의 Astryx 스케일을 쓴다(2·4·6·8·12·16·20·24·32·40px). 카드 안쪽은 `padding={4}`(16px)가 기본이고, 목록 아이템 사이는 `gap={2}`(8px), 섹션 사이는 `gap={5~6}`(20~24px)이다.

### Named Rules

**The 체인 끊지 않기 Rule.** 화면을 채워야 하는 요소는 부모부터 자신까지 모든 단계에 `flex: 1; min-height: 0`이 이어져야 한다. 빈 상태(EmptyState)도 같은 규칙을 따른다.

## Elevation & Depth

**평면이 기본이다.** 가만히 있는 면은 그림자가 없고, 경계는 1px `--color-border` 선이 만든다(맨 위 머리줄 아래 선만 `--color-header-border`, 카드·패널 머리줄 아래 선만 `--color-subheader-border`). 깊이는 배경 단계(바탕 `#f1f1f1` → 카드 `#ffffff`)로 표현한다.

그림자는 **반응하거나 떠 있을 때만** 나타난다. hover로 들리는 카드, 다이얼로그, 드롭다운, 플로팅 채팅 패널이 전부다.

### Shadow Vocabulary
- **`--shadow-low`** (`0 2px 4px oklch(0 0 0 / 5%), 0 4px 8px oklch(0 0 0 / 10%)`): hover로 살짝 들린 카드.
- **`--shadow-med`** (`0 2px 4px …, 0 4px 12px …`): 드롭다운, 팝오버.
- **`--shadow-high`** (`0 4px 6px oklch(0 0 0 / 10%), 0 12px 24px oklch(0 0 0 / 15%)`): 다이얼로그처럼 화면 위로 완전히 떠오른 것.
- **inset 링** (`inset 0 0 0 2px …`): 선택·상태 표시. 바깥으로 번지는 그림자 대신 안쪽 테두리로 표현해 레이아웃을 흔들지 않는다.

### Named Rules

**The 가만히 있으면 평면 Rule.** 정지 상태의 카드·패널·행에는 그림자를 넣지 않는다. 그림자가 보인다면 그것은 사용자의 행동에 대한 응답이거나, 그 요소가 실제로 다른 층에 떠 있다는 뜻이어야 한다.

## Shapes

모서리는 용도에 따라 다섯 단계다. **6px**(`inner`)은 포커스 링과 작은 칩, **10px**(`element`)은 누를 수 있는 카드형 표면, **12px**(`container`)은 섹션·패널 컨테이너, **28px**(`page`)은 다이얼로그 같은 페이지급 표면, **9999px**(`full`)은 상태 필과 토글이다.

테두리는 거의 언제나 1px 실선이다. 굵은 컬러 보더로 강조하지 않는다 — 색으로 구분해야 한다면 배경을 옅게 깔고 글자색을 맞춘다.

### Named Rules

**The 굵은 막대 금지 Rule.** `border-left: 4px solid <color>` 같은 한쪽 굵은 컬러 보더를 쓰지 않는다. 인용구든 알림이든 배경 색면으로 구분한다.

## Components

### Buttons
- **Shape:** 6px 라운드(`--radius-inner`)
- **Primary:** 케어 틸 배경(#0f766e) + 흰 글자. 화면당 하나가 원칙이다.
- **Secondary:** 회색 면. 활성 탭과 보조 동작에 쓴다.
- **Ghost:** 배경 없음. 패널 헤더의 "전체보기", 목록 안 인라인 동작.
- **Destructive:** 삭제. 확인 다이얼로그와 함께 쓴다.
- 아이콘만 있는 버튼은 반드시 `IconButton` + `label`(aria)로 만든다.

### Cards / Panels
- **Corner:** 12px(`--radius-container`)
- **Background:** 카드 화이트(#ffffff), 테두리 1px 헤어라인
- **Padding:** 목록형 패널은 `padding={0}`으로 감싸고 내부에서 헤더(16px)와 스크롤 영역을 나눈다. 일반 카드는 `padding={4}`.
- **중첩 금지:** 카드 안에 카드를 넣지 않는다. 하위 그룹이 필요하면 `Card variant="muted"` 콜아웃을 다이얼로그 안에서만 쓴다.

### Badges
상태 어휘는 세 가지로 고정한다: **승인/확정 → teal 또는 green**, **대기 → yellow**, **거절/오류 → red**. 카테고리 구분용으로 blue·purple·orange를 돌려 쓰지 않는다.

### Inputs
- Astryx `TextInput` / `Selector` / `DateInput`을 쓰고 `label`은 필수다(시각적으로 숨길 때는 `isLabelHidden`).
- **Focus:** 전역 포커스 링(`*:focus-visible`, 딥 틸 계열 2px)이 자동으로 붙는다. 개별 컴포넌트에서 다시 정의하지 않는다.
- 페이지 안 탭·토글은 `SegmentedControl`이 표준이다. `TabList`는 페이지를 통째로 바꿀 때만 쓴다.

### Navigation
- 사이드바 항목은 폭 100% Button을 좌측 정렬해 만든다. 활성은 `variant="secondary"` + 아이콘 `color="accent"`, 비활성은 `ghost`.
- 대기 건수는 `endContent`에 Badge로 붙인다.

### Signature: 달력 칸 2분할
월간일정과 대시보드 미니 달력은 날짜 칸을 좌우로 나눠 왼쪽에 여러 날을 잇는 일정 바를, 오른쪽에 그날 휴무자 명단을 둔다. "이날 무슨 일이 있나"와 "이날 누가 빠지나"를 같이 봐야 근무표를 짤 수 있기 때문이다. 격자선은 gap이 아니라 각 셀이 자신의 오른쪽·아래 테두리를 직접 그려 만든다.

### Signature: A4 기안문
전자결재 문서 미리보기는 이 시스템에서 유일하게 디자인 토큰을 쓰지 않는 구역이다. 794px × 1123px(A4 210mm @96dpi) 고정 픽셀로 종이를 재현한다. 인쇄물과 1:1로 맞아야 하므로 반응형·토큰 규칙의 예외다.

## Do's and Don'ts

### Do:
- **Do** 색을 `var(--color-*)` 토큰으로 쓴다. 브랜드 틸이 필요하면 `--color-accent`.
- **Do** 화면을 채워야 하는 요소는 부모부터 `flex: 1; min-height: 0` 체인을 잇는다.
- **Do** 상태 배지는 승인=teal/green, 대기=yellow, 거절=red 세 갈래만 쓴다.
- **Do** 페이지 내 보기 전환은 `SegmentedControl`로 만든다.
- **Do** 아이콘 단독 버튼에 `IconButton` + `label`을, 폼 입력에 `label`을 반드시 붙인다.
- **Do** 폭·높이 대신 `transform`과 `opacity`를 애니메이션한다.

### Don't:
- **Don't** 밀도를 낮추지 않는다. 여백을 늘려 스크롤이 길어지는 변경은 이 제품에서 개선이 아니다.
- **Don't** 개별 요소의 `font-size`를 직접 만지지 않는다. 테마의 base/ratio로 조정한다.
- **Don't** `border-left: 4px solid <color>` 같은 굵은 한쪽 컬러 보더를 쓰지 않는다.
- **Don't** 정지 상태의 면에 그림자를 넣지 않는다.
- **Don't** 새 서체를 들이지 않는다.
- **Don't** 카드 안에 카드를 넣지 않는다.
- **Don't** `#0d9488`을 쓰지 않는다 — 대비 3.0:1로 이미 기각된 값이다.
- **Don't** 되튀는 이징(`cubic-bezier(…, -0.55, …, 1.55)`)을 쓰지 않는다. 감속은 `--ease-standard`.
