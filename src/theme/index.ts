'use client';

import { createTheme, MantineColorsTuple } from '@mantine/core';

// 케어브이 Primary Accent - Mint Green (#20C997)
const mintGreen: MantineColorsTuple = [
  '#e6fcf5',
  '#c3fae8',
  '#96f2d7',
  '#63e6be',
  '#38d9a9',
  '#20c997', // [5] Primary accent
  '#12b886',
  '#0ca678',
  '#099268',
  '#087f5b',
];

// 케어브이 Primary Dark - Deep Navy (#1A1F36)
const deepNavy: MantineColorsTuple = [
  '#eef3ff',
  '#dce4f5',
  '#b8c9e8',
  '#94acdc',
  '#7593d1',
  '#5f83ca',
  '#1A1F36', // [6] Primary dark
  '#161b30',
  '#121729',
  '#0e1322',
];

// Secondary Colors
const coral: MantineColorsTuple = [
  '#fff5f5',
  '#ffe3e3',
  '#ffc9c9',
  '#ffa8a8',
  '#ff8787',
  '#ff6b6b', // [5] Coral
  '#fa5252',
  '#f03e3e',
  '#e03131',
  '#c92a2a',
];

const amber: MantineColorsTuple = [
  '#fff9db',
  '#fff3bf',
  '#ffec99',
  '#ffe066',
  '#ffd43b',
  '#ffb347', // [5] Amber
  '#fab005',
  '#f59f00',
  '#f08c00',
  '#e67700',
];

const skyBlue: MantineColorsTuple = [
  '#e7f5ff',
  '#d0ebff',
  '#a5d8ff',
  '#74c0fc',
  '#4dabf7', // [4] Sky Blue
  '#339af0',
  '#228be6',
  '#1c7ed6',
  '#1971c2',
  '#1864ab',
];

const lavender: MantineColorsTuple = [
  '#f3f0ff',
  '#e5dbff',
  '#d0bfff',
  '#b197fc',
  '#9775fa', // [4] Lavender
  '#845ef7',
  '#7950f2',
  '#7048e8',
  '#6741d9',
  '#5f3dc4',
];

export const theme = createTheme({
  // Primary Color
  primaryColor: 'mintGreen',
  primaryShade: 5,

  // Custom Colors
  colors: {
    mintGreen,
    deepNavy,
    coral,
    amber,
    skyBlue,
    lavender,
  },

  // Typography
  fontFamily: '"Outfit", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  fontFamilyMonospace: '"Space Mono", Monaco, "Courier New", monospace',
  headings: {
    fontFamily: '"Outfit", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontWeight: '600',
    sizes: {
      h1: { fontSize: '3.5rem', lineHeight: '1.1' },
      h2: { fontSize: '2.625rem', lineHeight: '1.2' },
      h3: { fontSize: '1.75rem', lineHeight: '1.3' },
      h4: { fontSize: '1.375rem', lineHeight: '1.4' },
      h5: { fontSize: '1.125rem', lineHeight: '1.5' },
      h6: { fontSize: '1rem', lineHeight: '1.5' },
    },
  },

  // Spacing (8px base grid)
  spacing: {
    xs: '0.5rem',   // 8px
    sm: '1rem',     // 16px
    md: '1.5rem',   // 24px
    lg: '2rem',     // 32px
    xl: '2.5rem',   // 40px
  },

  // Border Radius
  radius: {
    xs: '0.25rem',  // 4px
    sm: '0.5rem',   // 8px - small (badges)
    md: '0.75rem',  // 12px - medium (buttons, inputs)
    lg: '1rem',     // 16px - large (cards, modals)
    xl: '1.5rem',   // 24px - extra large
  },
  defaultRadius: 'md',

  // Shadows
  shadows: {
    xs: '0 1px 3px rgba(0, 0, 0, 0.05)',
    sm: '0 4px 24px rgba(26, 31, 54, 0.08)',
    md: '0 8px 32px rgba(26, 31, 54, 0.12)',
    lg: '0 12px 40px rgba(26, 31, 54, 0.15)',
    xl: '0 20px 60px rgba(26, 31, 54, 0.2)',
  },

  // Component Defaults
  components: {
    Button: {
      defaultProps: {
        radius: 'md',
      },
      styles: {
        root: {
          fontWeight: 600,
          transition: 'all 0.2s ease',
        },
      },
    },
    Card: {
      defaultProps: {
        radius: 'lg',
        shadow: 'sm',
      },
    },
    Paper: {
      defaultProps: {
        radius: 'lg',
        shadow: 'sm',
      },
    },
    Modal: {
      defaultProps: {
        radius: 'lg',
        centered: true,
      },
    },
    TextInput: {
      defaultProps: {
        radius: 'md',
      },
    },
    PasswordInput: {
      defaultProps: {
        radius: 'md',
      },
    },
    Select: {
      defaultProps: {
        radius: 'md',
      },
    },
    Textarea: {
      defaultProps: {
        radius: 'md',
      },
    },
    Badge: {
      defaultProps: {
        radius: 'sm',
      },
    },
    Notification: {
      defaultProps: {
        radius: 'md',
      },
    },
    Tabs: {
      defaultProps: {
        radius: 'md',
      },
    },
    Table: {
      styles: {
        th: {
          fontWeight: 600,
        },
      },
    },
  },

  // Other Settings
  cursorType: 'pointer',
  focusRing: 'auto',
  respectReducedMotion: true,
});

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
