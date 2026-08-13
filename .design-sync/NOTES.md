# design-sync 메모 (케어브이)

## 이 레포의 특수 사정 — 반드시 먼저 읽을 것

- **이 레포는 컴포넌트 라이브러리가 아니라 Next.js 앱이다.** 동기화 대상은
  `node_modules/@astryxdesign/core`(Astryx, 169개) + 이 레포의 케어브이 테마다.
  그래서 `--entry`와 `--node-modules`를 항상 명시해야 한다:
  ```sh
  node .ds-sync/package-build.mjs --config .design-sync/config.json \
    --node-modules ./node_modules --entry ./node_modules/@astryxdesign/core/dist/index.js --out ./ds-bundle
  ```
- `cfg.*`의 상대경로는 **패키지 디렉터리(`node_modules/@astryxdesign/core`) 기준**이다.
  레포 루트로 가려면 `../../../`. 처음에 `../../`로 적어 조용히 `— skipped` 되고
  테마가 통째로 빠진 채 빌드가 성공했다. 로그의 `! extraEntries: … not found — skipped`를
  반드시 확인할 것.

## 테마가 적용되는 조건 (가장 중요)

- 케어브이 테마 CSS는 `@scope ([data-astryx-theme="neutral"])` 안에 있고, 그 속성은
  Astryx `<Theme>`가 건다. 그래서 `cfg.provider`로 모든 프리뷰를 감싼다:
  `{"component":"Theme","props":{"theme":{"$ref":"carevTheme"},"mode":"light"}}`
  **이게 빠지면 컴포넌트는 멀쩡히 그려지지만 Astryx 기본 파란색이 된다.** 조용히 잘못되는
  종류의 실패라 매번 카드 하나는 눈으로 색을 확인할 것.
- `Theme`는 메인 엔트리(`dist/index.js`)에 없고 `@astryxdesign/core/theme` 서브패스에 있다.
  `carevTheme`은 `.design-sync/ds-theme-entry.mjs`가 레포의 `src/theme/carev/neutral.js`를
  다시 내보낸 것. 둘 다 `cfg.extraEntries`로 번들에 들어간다.

## CSS 순서 — cssEntry를 쓰지 않는 이유

`cfg.cssEntry`는 번들 CSS **뒤에** 덧붙는다. 그러면 astryx.css가 우리 테마를 덮어쓴다.
그래서 `.design-sync/ds-styles.mjs`가 `reset → astryx → 케어브이 테마 → ds-vars` 순서로
import하고, esbuild 그래프 순서가 그대로 최종 CSS 순서가 된다. 앱의 `globals.css`와 같은 순서다.

## 폰트

앱은 next/font로 Figtree를 받지만 번들에는 그 주입이 없다. `--font-figtree`가 비면 테마의
글꼴 스택이 첫 순위를 잃고 시스템 폰트로 떨어진다. 그래서:
- `.design-sync/fonts/*.woff2` — Google Fonts에서 받은 Figtree(SIL OFL 1.1), latin/latin-ext 8종
- `.design-sync/ds-fonts.css` — `cfg.extraFonts`가 읽어 `fonts/`로 복사
- `.design-sync/ds-vars.css` — `:root { --font-figtree: "Figtree" }`
한글은 Figtree에 없어 스택 뒤쪽 시스템 폰트로 렌더된다 (앱과 동일, 의도된 동작).

## 이번 실행에서 검증하지 못한 것

- **렌더 체크(playwright)를 돌리지 않았다.** 사용자가 설치를 원치 않아
  `--no-render-check`로 통과시켰고, 대신 Chrome으로 카드를 직접 열어 확인했다:
  Button/Card/Text/TextInput/Table/Banner/Dialog/SegmentedControl/Selector/DateInput/
  ClickableCard/Grid/Avatar — 모두 정상. 나머지 12개 작성 프리뷰와 144개 기본 카드는
  **눈으로 확인하지 않았다.**
- 그래서 `.design-sync/.cache/review/*.grade.json` 등급 파일이 없다. 다음 동기화는
  전부 다시 검증 대상으로 잡힐 수 있다. playwright를 깔면 그때부터 정상 흐름이 된다.

## 작성 중 실제로 걸린 것

- `TextInput`의 `startIcon`에 Astryx `Icon` 컴포넌트를 넘겼더니 그 셀이 통째로 빈 카드가
  됐다. `startIcon`은 SVG 컴포넌트를 받는다(react-icons 등). 지금은 그 셀을 뺐다.
- `ClickableCard` 안의 `Text` 두 개가 한 줄로 붙었다. `Text`는 기본이 inline —
  줄을 나누려면 `VStack`으로 감싼다.
- `Dialog`는 오버레이라 카드에서 잘린다. `cfg.overrides.Dialog`에 `cardMode: "single"` +
  `viewport` 지정.

## 다시 동기화할 때

```sh
S=<skill-base-dir>; cp -r "$S"/package-build.mjs "$S"/package-validate.mjs "$S"/package-capture.mjs "$S"/resync.mjs "$S"/lib "$S"/storybook .ds-sync/
(cd .ds-sync && npm i esbuild ts-morph @types/react)
node .ds-sync/resync.mjs --config .design-sync/config.json --node-modules ./node_modules \
  --entry ./node_modules/@astryxdesign/core/dist/index.js --out ./ds-bundle \
  --remote .design-sync/.cache/remote-sync.json
```
(`_ds_sync.json`을 프로젝트에서 먼저 받아 `.design-sync/.cache/remote-sync.json`에 둔다.)

## Re-sync 위험 목록 — 다음 실행이 지켜볼 것

- **Astryx 버전이 오르면** 컴포넌트 수·프롭이 바뀐다. `conventions.md`에 적어둔 토큰·아이콘
  이름이 실제 산출물에 남아 있는지 다시 확인해야 한다(특히 26개 시맨틱 아이콘 목록).
- **`src/theme/carev/neutral.css`를 다시 빌드하면**(`astryx theme build`) 번들 CSS가 바뀐다.
  테마 색을 바꿨다면 반드시 재동기화할 것.
- **Figtree woff2는 Google Fonts에서 받은 시점 고정본**이다. 폰트가 갱신돼도 자동으로 따라가지
  않는다. 문제 없으면 그대로 두는 편이 낫다(재현성).
- 프리뷰 25개는 이 레포가 실제로 쓰는 것만이다. 나머지 144개는 기본 카드 상태이며,
  언제든 `.design-sync/previews/<Name>.tsx`를 추가해 채울 수 있다.
