// Design System Tokens — single source of truth
// Use Tailwind classes in components; this file is for JS-level references only.

export const COLORS = {
  primary: 'hsl(var(--gold))',
  primaryLight: 'hsl(var(--gold-light))',
  primaryBorder: 'hsl(var(--gold-border))',
  success: 'hsl(var(--los-green))',
  successLight: 'hsl(var(--los-green-light))',
  warning: 'hsl(var(--los-orange))',
  warningLight: 'hsl(var(--los-orange-light))',
  danger: 'hsl(var(--los-red))',
  dangerLight: 'hsl(var(--los-red-light))',
  info: 'hsl(var(--los-blue))',
  infoLight: 'hsl(var(--los-blue-light))',
  purple: 'hsl(var(--los-purple))',
  purpleLight: 'hsl(var(--los-purple-light))',
  teal: 'hsl(var(--los-teal))',
  tealLight: 'hsl(var(--los-teal-light))',
  background: 'hsl(var(--background))',
  foreground: 'hsl(var(--foreground))',
  card: 'hsl(var(--card))',
  cardForeground: 'hsl(var(--card-foreground))',
  muted: 'hsl(var(--muted))',
  mutedForeground: 'hsl(var(--muted-foreground))',
  border: 'hsl(var(--border))',
  surface1: 'hsl(var(--surface-1))',
  surface2: 'hsl(var(--surface-2))',
  surface3: 'hsl(var(--surface-3))',
  codeBg: 'hsl(var(--code-bg))',
} as const;

export const SPACING = {
  xs: '0.25rem',   // 4px
  sm: '0.5rem',    // 8px
  md: '1rem',      // 16px
  lg: '1.5rem',    // 24px
  xl: '2rem',      // 32px
  '2xl': '3rem',   // 48px
  '3xl': '4rem',   // 64px
} as const;

export const BORDER_RADIUS = {
  sm: '0.5rem',
  md: '0.75rem',
  lg: '1rem',
  xl: '1.5rem',
  full: '9999px',
} as const;

export const FONT_FAMILY = {
  sans: "'DM Sans', sans-serif",
  serif: "'Noto Serif SC', serif",
  mono: "'JetBrains Mono', monospace",
} as const;

export const FONT_SIZE = {
  xs: '0.75rem',   // 12px
  sm: '0.875rem',  // 14px
  base: '1rem',    // 16px
  lg: '1.125rem',  // 18px
  xl: '1.25rem',   // 20px
  '2xl': '1.5rem', // 24px
  '3xl': '2rem',   // 32px
} as const;

export const SHADOWS = {
  sm: '0 1px 2px hsl(var(--background) / 0.3)',
  md: '0 4px 12px hsl(var(--background) / 0.4)',
  lg: '0 10px 30px -10px hsl(var(--primary) / 0.3)',
  glow: '0 0 20px hsl(var(--gold) / 0.15)',
} as const;

// Tailwind class helpers for consistent component styling
export const TW = {
  card: 'bg-card text-card-foreground border border-border rounded-lg',
  cardHover: 'hover:border-gold/30 hover:shadow-lg transition-all duration-200',
  sectionTitle: 'font-serif-sc text-lg text-foreground',
  label: 'text-sm text-muted-foreground',
  badge: 'text-xs px-2 py-0.5 rounded-full',
} as const;
