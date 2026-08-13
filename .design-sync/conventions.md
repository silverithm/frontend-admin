# CareV (케어브이) — how to build with this design system

This is the component library of CareV, a Korean admin dashboard for adult day-care and
long-term-care centers (근무표 / 휴무 / 전자결재 / 배차). It is **Astryx** (`@astryxdesign/core`)
carrying CareV's own theme. Every component below is Astryx's real shipped code — the only
CareV-specific things are the theme tokens, the brand font, and the conventions on this page.

## 1. Wrap everything in `Theme` — nothing is on-brand without it

The CareV palette lives inside a CSS `@scope ([data-astryx-theme="neutral"])` block. That attribute
is set by the `Theme` component. **Without this wrapper the components still render, but in Astryx's
default blue instead of CareV's teal** — and nothing downstream will flag it.

```jsx
<Theme theme={carevTheme} mode="light">
  {/* every screen goes inside */}
</Theme>
```

`carevTheme` is exported from the bundle alongside the components. `mode="light"` is deliberate:
CareV is a light-only product — do not build dark variants.

## 2. There are no CSS classes — style through props, then tokens

Astryx components take **no `className` styling vocabulary**. There is no Tailwind, no utility
classes, no StyleX compiler here. Style in this order:

1. **Component props.** `variant`, `size`, `padding`, `gap`, `color`, `weight` cover most of it.
   `<Button variant="primary" size="sm" />`, `<Card variant="muted" padding={4} />`,
   `<Text type="supporting" color="secondary" />`.
2. **Layout components, never raw divs.** `VStack` (column) / `HStack` (row) with `gap`,
   `hAlign` / `vAlign`, and `Grid` + `GridSpan` for grids. `gap` is a step scale, not pixels:
   `0, 0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10`. Alignment values are `start | center | end | between |
   around` — it is `between`, never `space-between`.
3. **Residual styling: an inline `style` object using CSS variables.** For the few things props
   can't express (a calendar grid, an absolute overlay, a fixed panel), write
   `style={{ border: '1px solid var(--color-border)', padding: 'var(--spacing-2)' }}`.
   **Never hard-code a hex or a px color** — every color, radius, and shadow has a token.

Tokens you will use constantly (all defined in the bundle's stylesheet):
`--color-accent` (CareV teal), `--color-icon-teal`, `--color-background-teal`,
`--color-border`, `--color-border-emphasized`, `--color-background-muted`,
`--color-background-card`, `--color-text-secondary`, `--spacing-1` … `--spacing-10`,
`--radius-inner`, `--radius-container`, `--radius-full`, `--shadow-low`, `--shadow-high`.

## 3. Text and headings

`Text` takes `type` — `body | large | label | supporting | code | display-1 | display-2 | display-3`
— **not `variant`**, and never a raw `<p>` / `<span>`. Section titles use `Heading level={1..6}`.
`color` accepts theme roles only (`primary | secondary | disabled | accent | inherit`), so a custom
color goes on a parent element with `<Text color="inherit">` inside.

Two details that matter in this product: `hasTabularNumbers` on any column of counts (인원, 건수)
so digits line up, and `maxLines={1}` on names and titles in dense lists.

The type scale is deliberately small — base 13px, ratio 1.2 — because these are dense admin screens
with a lot of rows on one page. Do not push font sizes back up.

## 4. Icons and icon-only buttons

`<Icon icon="calendar" size="sm" />` — 26 semantic names are built in (`close, chevronDown/Left/Right,
check, success, error, warning, info, calendar, clock, externalLink, menu, moreHorizontal, search,
arrowUp/Down, arrowsUpDown, funnel, eyeSlash, viewColumns, copy, checkDouble, wrench, stop,
microphone`). `size` has four steps only: `xsm | sm | md | lg`. For anything outside that list, pass
an SVG component as `icon`.

An icon-only control is `IconButton`, and its `label` is **required** — it is the accessible name.
Form inputs likewise require `label`; hide it visually with `isLabelHidden` rather than dropping it.

## 5. Product conventions worth copying

- Korean UI text throughout. Realistic content: 요양보호사 / 사회복지사 names, 8월 21일 dates,
  근무표 / 휴무 / 결재 / 배차 as the domain nouns.
- Status is a `Badge`: `teal`=승인, `orange`=대기, `error`=반려, `neutral`=임시저장.
- Inline notices are `Banner` with `status="info | success | warning | error"`, not custom boxes.
- Empty screens use `EmptyState` with an icon, a title, and an action — never a bare sentence.
- Modals are `Dialog` + `Layout` (`header` / `content` / `footer`), which brings backdrop, ESC, and
  focus handling with it.

## 6. Read the real files before styling

The stylesheet reachable from `styles.css` (its `@import` closure) is the whole truth about tokens
and component CSS — read it rather than guessing a token name. Each component's own
`<Name>.prompt.md` carries its props and usage; read that before inventing an API.
