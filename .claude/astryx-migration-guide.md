# Astryx 마이그레이션 가이드 (에이전트용)

케어브이 프론트엔드를 Tailwind → **Astryx 디자인 시스템**(@astryxdesign/core, Beta v0.1.2)으로 전환 중.
**철칙: 비즈니스 로직/상태/API 호출/props 시그니처는 100% 보존. UI(시각) 레이어만 Astryx로 교체.**

## 컴포넌트 API 조회 (반드시 활용)
- 목록: `node node_modules/@astryxdesign/core/docs.mjs --list`
- 상세(props/example): `node node_modules/@astryxdesign/core/docs.mjs <Component>`  (예: `docs.mjs TextInput`)
- 아이콘 시맨틱명: `node node_modules/@astryxdesign/cli/bin/astryx.mjs docs`  안의 icons 문서
> 추측 금지. 모르는 prop/컴포넌트는 반드시 docs.mjs로 확인.

## import 규칙 (서브패스 방식)
```ts
import { Button } from '@astryxdesign/core/Button';
import { TextInput } from '@astryxdesign/core/TextInput';
import { TextArea } from '@astryxdesign/core/TextArea';
import { Card } from '@astryxdesign/core/Card';
import { Banner } from '@astryxdesign/core/Banner';
import { VStack, HStack, Stack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Heading } from '@astryxdesign/core/Heading';
import { Icon } from '@astryxdesign/core/Icon';
import { Link } from '@astryxdesign/core/Link';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Layout, LayoutContent, LayoutFooter, LayoutHeader, LayoutPanel } from '@astryxdesign/core/Layout';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { Selector } from '@astryxdesign/core/Selector';        // Select 대체 (docs 확인)
import { Table } from '@astryxdesign/core/Table';
import { Badge } from '@astryxdesign/core/Badge';
import { Spinner } from '@astryxdesign/core/Spinner';
```
루트 레이아웃에 `<Theme>` 프로바이더가 이미 있으므로 페이지/컴포넌트에서 프로바이더를 다시 감싸지 말 것.

## 핵심 컴포넌트 규칙
- **Button**: `<Button label="저장" variant="primary|secondary|ghost|destructive" size="sm|md|lg" isLoading={} onClick={} type="submit" />` — `label` 필수. 아이콘은 `icon={<Icon .../>}`.
- **TextInput**: `<TextInput label="이메일" type="text|password|email" value={v} onChange={(value)=>...} placeholder="" isRequired isDisabled status={{type:'error',message:''}} />` — label 필수, onChange는 (value)를 받음(이벤트 아님).
- **TextArea**: docs.mjs로 확인. 대략 value/onChange(value)/label.
- **CheckboxInput**: `value={bool} onChange={(checked)=>...}` label 필수.
- **SegmentedControl**: 탭/토글 대체. `value onChange={(v)=>} label` + 자식 `<SegmentedControlItem value="" label="" />`.
- **Dialog(모달)**:
  ```tsx
  <Dialog isOpen={open} onOpenChange={(o)=>{ if(!o) close(); }} purpose="form|info|required" width={440}>
    <Layout
      header={<DialogHeader title="제목" onOpenChange={(o)=>{ if(!o) close(); }} />}
      content={<LayoutContent><VStack gap={4}>...</VStack></LayoutContent>}
      footer={<LayoutFooter hasDivider><HStack gap={2} hAlign="end"><Button.../></HStack></LayoutFooter>}
    />
  </Dialog>
  ```
- **Banner(인라인 알림)**: `<Banner status="info|warning|error|success" title="" description="" isDismissable onDismiss={} />`.
- **Text**: `<Text type="body|large|label|supporting|display-1..3" color="primary|secondary|disabled|accent" weight="normal|medium|semibold|bold">내용</Text>`.
- **Icon**: `<Icon icon="close" size="xsm|sm|md|lg" color="primary|secondary|tertiary|accent|success|error|warning|inherit" />`.
  시맨틱명 26개(close, chevronDown/Left/Right, check, success, error, warning, info, calendar, clock, externalLink, menu, moreHorizontal, search, arrowUp/Down, arrowsUpDown, funnel, eyeSlash, viewColumns, copy, checkDouble, wrench, stop, microphone).
  **목록 밖 아이콘은 SVG 컴포넌트 직접 전달**: `<Icon icon={FiUser} size="md" />` (react-icons/@tabler 그대로 OK).

## Stack (레이아웃)
- `<VStack gap={4}>` 세로, `<HStack gap={2}>` 가로. gap은 SpacingStep: `0,0.5,1,1.5,2,3,4,5,6,8,10` (px 아님, 스케일).
- 정렬: `hAlign`/`vAlign`. 값 = 메인축 `start|center|end|between|around`, 교차축 `start|center|end|stretch`. **`space-between` 아님 → `between`**.

## Tailwind 제거 원칙
- className의 Tailwind 유틸리티는 전부 제거. 대체 우선순위:
  1) Astryx 컴포넌트/props로 표현 가능하면 그것으로
  2) 레이아웃은 VStack/HStack/Stack
  3) 나머지 잔여 스타일은 **인라인 style 객체**(하드코딩 색은 최소화, 필요시 유지)
- 반응형 `hidden md:flex` 등은 globals.css에 커스텀 클래스 + `@media`로 이관(예: Navbar의 `.carev-nav-desktop`).
- framer-motion(motion.div 등)은 유지 가능 — Astryx는 애니 라이브러리 아님.

## 참고 예시 (이미 전환 완료된 파일)
- `src/app/login/page.tsx` — 폼/SegmentedControl/Dialog/Card 종합 예시
- `src/components/Alert.tsx` — Banner + framer-motion 토스트
- `src/components/ConfirmDialog.tsx` — Dialog + Layout + 훅 보존
- `src/components/Navbar.tsx` — Button/Icon + 인라인 스타일 + 반응형 CSS

## 검증
전환 후 반드시 타입/빌드가 깨지지 않게. 확신 없는 prop은 docs.mjs로 재확인.

---

# Astryx 디자인 토큰 전체 레퍼런스 (공식 문서 기준 — 하드코딩 금지, 반드시 토큰 사용)

인라인 style에서 `style={{ fontSize: 'var(--font-size-base)' }}` 처럼 CSS 변수를 쓴다(theme.css가 전역 로드됨). 하드코딩 px/hex 금지.

## 색상 (Color)
- 표면 계층: `--color-background-body`(최하단) → `--color-background-surface`(#262626 다크) → `--color-background-card` → `--color-background-popover`. 중첩 표면은 이 계층으로.
- 텍스트: `--color-text-primary`(본문), `--color-text-secondary`(부제/캡션), `--color-text-disabled`, `--color-text-accent`.
- 보더: `--color-border`, `--color-border-emphasized`.
- **상태(status)는 시맨틱 토큰**: 성공 `--color-success` / `--color-success-muted`(배경) / `--color-on-success`(그 위 텍스트). 오류 `--color-error/-muted/on-error`. 경고 `--color-warning/-muted/on-warning`. → 승인=success, 거절=error, 대기=warning.
- 카테고리(역할/일정종류 등 비상태): 데이터-비주얼 팔레트 `--color-background-<blue|green|teal|purple|orange|pink|cyan|yellow|red>` + `--color-text-<...>` + `--color-border-<...>`.
- 아이콘 색: `--color-icon-primary/secondary/disabled/accent`. Astryx `Icon color="primary|secondary|accent|success|error|warning"` 사용.
- 규칙: accent와 status를 같은 맥락에서 섞지 말 것. 하드코딩 hex 금지(흰/검 텍스트 제외).

## 타이포그래피 (Typography)
- 폰트: `--font-family-body`, `--font-family-heading`, `--font-family-code`.
- **가능하면 Astryx `Text type=` / `Heading`를 쓴다**(인라인 fontSize 대신). type: body(14)/large/label/supporting/code + Display 1~3 + Heading H1~H6.
- 인라인 불가피할 때만 토큰: `--font-size-4xs(6) 3xs(7) 2xs(8) xs(10) sm(12) base(14) lg(17) xl(20) 2xl(24) 3xl(29) 4xl(35) 5xl(42)`(px 근사). 가장 가까운 스텝으로.
- 굵기: `--font-weight-normal(400) medium(500) semibold(600) bold(700)`.

## 스페이싱 (Spacing) — 4px 베이스
- **Stack `gap`/Card `padding` prop 우선**(스텝 0~12). 
- 인라인 padding/margin/gap px → `--spacing-*`: 0(0) 0-5(2) 1(4) 1-5(6) 2(8) 3(12) 4(16) 5(20) 6(24) 7(28) 8(32) 9(36) 10(40) 11(44) 12(48). 임의 px 금지, 가장 가까운 스텝.

## 쉐이프/Radius (Shape)
- `--radius-none(0) inner(8) element(12) container(16) chat(28) page(32) full(9999)`.
- 인터랙티브 컨트롤=`--radius-element`, 콘텐츠 영역=`--radius-container`, pill=`--radius-full`. 하드코딩 borderRadius 금지.

## 모션 (Motion)
- duration: `--duration-fast(175) fast-min(130) fast-max(230) medium(410) slow(975)` (+min/max).
- easing: `--ease-standard: cubic-bezier(0.24,1,0.4,1)`.
- CSS transition: `transition: background var(--duration-fast) var(--ease-standard)`. 작은 인터랙션=fast, 레이아웃 전환=medium.

## 컴포넌트 강제 (Components)
- **커스텀 하드빌드(raw <div>/<button> + 인라인 스타일)로 UI를 만들지 말 것.** 항상 적절한 Astryx 컴포넌트를 쓴다: 버튼=Button/IconButton, 카드/박스=Card, 배지/칩=Badge, 텍스트=Text/Heading, 표=Table, 입력=TextInput/Selector/..., 탭=SegmentedControl/TabList, 모달=Dialog+Layout, 알림=Banner, 목록빈상태=EmptyState, 아바타=Avatar, 구분선=Divider, 로딩=Spinner/Skeleton, 아이콘=Icon.
- Astryx로 표현 불가한 bespoke 레이아웃(캘린더 그리드 등)만 인라인 style + 토큰. 그 안의 요소도 최대한 Astryx.
