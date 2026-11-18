/**
 * LiveWire Premium Cyber Streaming App Theme
 * Designed for high-contrast live streaming, deep obsidian dark canvas,
 * electric cyan/azure accents matching the brand apex logo, and neon live badges.
 */

export const THEME = {
  // Canvas / Backgrounds
  bg: '#080B14',
  bgSecondary: '#0D1222',
  bgElevated: '#12192F',
  
  // Surfaces & Cards
  card: '#0F162A',
  cardElevated: '#151E38',
  cardBorder: 'rgba(56, 189, 248, 0.12)',
  cardBorderHover: 'rgba(0, 229, 255, 0.35)',
  
  // Brand Accents (Apex Electric Cyan & Sapphire)
  primary: '#00E5FF',
  primaryDeep: '#0284C7',
  primaryDark: '#0369A1',
  primaryGlow: 'rgba(0, 229, 255, 0.22)',
  accent: '#38BDF8',
  accentSubtle: 'rgba(56, 189, 248, 0.15)',

  // Status & Streaming Badges
  live: '#FF2A54',
  liveGlow: 'rgba(255, 42, 84, 0.35)',
  liveBadgeBg: 'rgba(255, 42, 84, 0.16)',
  online: '#10B981',
  warning: '#F59E0B',
  
  // Text Colors
  text: '#FFFFFF',
  textSecondary: '#F1F5F9',
  textMuted: '#94A3B8',
  textSubtle: '#64748B',

  // Tab & Header Navigation
  tabBar: '#070A12',
  tabBarBorder: 'rgba(56, 189, 248, 0.08)',
  tabActive: '#00E5FF',
  tabInactive: '#64748B',
} as const;

export default THEME;
