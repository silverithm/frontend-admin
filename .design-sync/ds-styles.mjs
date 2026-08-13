/*
 * 디자인 시스템 번들의 CSS 진입점 (cfg.extraEntries로 esbuild 그래프에 들어간다).
 *
 * cfg.cssEntry를 쓰지 않는 이유: cssEntry는 번들 CSS 뒤에 덧붙여지므로 astryx.css가
 * 우리 테마를 덮어쓴다. 케어브이 테마는 astryx 기본 토큰을 재정의하는 값이라
 * 반드시 뒤에 와야 한다. 여기 import 순서가 곧 최종 CSS 순서다.
 *
 * 앱의 globals.css와 같은 순서: reset → astryx → 케어브이 테마.
 */
import '@astryxdesign/core/reset.css';
import '@astryxdesign/core/astryx.css';
import '../src/theme/carev/neutral.css';
import './ds-vars.css';
