// 케어브이 디자인 토큰 (프레임워크 비의존 순수 객체).
// Astryx 마이그레이션 이후에도 인라인 스타일에서 참조하는 색상/그림자/그라데이션/애니메이션 값.
// 과거 Mantine createTheme는 실사용되지 않아 제거함.

// Design Tokens for direct use
export const tokens = {
  colors: {
    // Primary
    primary: '#1A1F36',
    accent: '#20C997',
    accentLight: 'rgba(32, 201, 151, 0.1)',
    accentHover: '#12B886',

    // Secondary
    coral: '#FF6B6B',
    amber: '#FFB347',
    skyBlue: '#4DABF7',
    lavender: '#9775FA',

    // Text
    textPrimary: '#1A1F36',
    textSecondary: '#5A6178',
    textTertiary: '#9CA3AF',

    // Background
    background: '#FFFFFF',
    backgroundAlt: '#F8FAFC',
    backgroundDark: '#1A1F36',

    // Border
    border: '#E5E7EB',
    borderLight: '#F3F4F6',
  },

  shadows: {
    xs: '0 1px 3px rgba(0, 0, 0, 0.05)',
    sm: '0 4px 24px rgba(26, 31, 54, 0.08)',
    md: '0 8px 32px rgba(26, 31, 54, 0.12)',
    lg: '0 12px 40px rgba(26, 31, 54, 0.15)',
    xl: '0 20px 60px rgba(26, 31, 54, 0.2)',
    card: '0 4px 24px rgba(26, 31, 54, 0.08)',
    button: '0 4px 14px rgba(32, 201, 151, 0.4)',
  },

  gradients: {
    primary: 'linear-gradient(135deg, #20C997 0%, #4DABF7 100%)',
    secondary: 'linear-gradient(135deg, #FF6B6B 0%, #FFB347 100%)',
    dark: 'linear-gradient(180deg, #1A1F36 0%, #0e1322 100%)',
  },

  animation: {
    fast: '150ms',
    normal: '250ms',
    slow: '400ms',
    curve: 'cubic-bezier(0.4, 0, 0.2, 1)',
    bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  },
} as const;
