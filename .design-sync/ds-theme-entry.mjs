/*
 * 케어브이 테마 객체를 번들 export로 노출한다 (cfg.provider의 $ref 대상).
 *
 * 테마 CSS는 [data-astryx-theme="neutral"] 스코프 안에서만 적용된다. 그 속성은
 * Astryx <Theme theme={...}>가 건다. 그래서 프리뷰와 디자인 에이전트가 그리는 화면은
 * 모두 이 테마로 감싸져야 하고, 감싸지 않으면 Astryx 기본 파란색으로 돌아간다.
 * 앱의 AstryxProvider가 하는 일과 같다.
 */
export { neutralTheme as carevTheme } from '../src/theme/carev/neutral.js';
