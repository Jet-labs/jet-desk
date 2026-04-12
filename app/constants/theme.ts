/**
 * JetDesk Design System — Supabase-inspired dark-mode tokens.
 *
 * Structure
 * ─────────
 * colors      → semantic palette (never use raw hex outside this file)
 * spacing     → strict 8-pt grid
 * radius      → border radius scale (6px standard, 9999px pill)
 * fontSize    → type size scale
 * fontWeight  → 400 (default) and 500 (interactive only)
 * shadow      → minimal — depth via border hierarchy, not shadows
 * animation   → durations for consistent motion
 *
 * Design Philosophy:
 *   - Near-black backgrounds (#0f0f0f, #171717) — never pure black
 *   - Emerald green accent (#3ecf8e) used sparingly as identity marker
 *   - Depth through border color hierarchy (#242424 → #2e2e2e → #363636)
 *   - Weights 400/500 only — hierarchy through size, not weight
 */

export const Theme = {
  colors: {
    // ── Backgrounds ──────────────────────────────────────────────────────
    background:        '#171717', // Page-level canvas
    surface:           '#1c1c1c', // Cards, bottom sheets
    surfaceElevated:   '#222222', // Inputs, raised elements
    surfaceHighlight:  '#2a2a2a', // Hover / subtle highlight
    surfacePressed:    '#333333', // Active / pressed state

    // ── Borders (depth hierarchy) ─────────────────────────────────────────
    border:            '#2e2e2e', // Standard card/section border
    borderLight:       '#363636', // Elevated border / prominent dividers
    borderSubtle:      '#242424', // Barely-visible hairline dividers

    // ── Typography ────────────────────────────────────────────────────────
    textPrimary:       '#fafafa',
    textSecondary:     '#b4b4b4',
    textTertiary:      '#898989',
    textDisabled:      '#4d4d4d',

    // ── Brand Accent — emerald green, used sparingly ──────────────────────
    accent:            '#3ecf8e',
    accentLink:        '#00c573', // Interactive green for links/actions
    accentDim:         'rgba(62, 207, 142, 0.08)',
    accentMuted:       'rgba(62, 207, 142, 0.20)',
    accentBorder:      'rgba(62, 207, 142, 0.30)',
    accentBright:      '#4ade80', // Light variant for emphasis

    // ── Semantic states ───────────────────────────────────────────────────
    success:           '#3ecf8e',
    successDim:        'rgba(62, 207, 142, 0.12)',
    warning:           '#f5a623',
    warningDim:        'rgba(245, 166, 35, 0.12)',
    error:             '#e5484d',
    errorDim:          'rgba(229, 72, 77, 0.12)',

    // ── Extended palette (Radix-inspired) ──────────────────────────────────
    purple:            '#a78bfa',
  },

  // ── 8-point spacing grid ──────────────────────────────────────────────
  spacing: {
    xs:   4,
    sm:   8,
    md:   16,
    lg:   24,
    xl:   32,
    xxl:  48,
    xxxl: 64,
  },

  // ── Border radius scale ───────────────────────────────────────────────
  // Standard (6px) for secondary elements, pill (9999px) for primary CTAs
  radius: {
    xs:   4,
    sm:   6,     // Ghost buttons, small elements
    md:   8,     // Cards, containers
    lg:   12,    // Mid-size panels
    xl:   16,    // Feature cards, major containers
    xxl:  24,
    full: 9999,  // Pill buttons, tab indicators
  },

  // ── Type sizes ────────────────────────────────────────────────────────
  fontSize: {
    display: 44,
    h1:      32,
    h2:      24,
    h3:      20,
    body:    16,
    sm:      14,
    caption: 12,
    micro:   11,
  },

  // ── Font weights — 400 default, 500 for interactive only ──────────────
  fontWeight: {
    black:     '900' as const,
    extraBold: '800' as const,
    bold:      '700' as const,
    semiBold:  '600' as const,
    medium:    '500' as const,  // Buttons, nav links only
    regular:   '400' as const,  // Everything else
  },

  // ── Shadows — minimal, depth through borders not shadows ──────────────
  shadow: {
    sm: {
      shadowColor:   '#000',
      shadowOffset:  { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius:  4,
      elevation:     2,
    },
    md: {
      shadowColor:   '#000',
      shadowOffset:  { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius:  8,
      elevation:     4,
    },
    lg: {
      shadowColor:   '#000',
      shadowOffset:  { width: 0, height: 6 },
      shadowOpacity: 0.5,
      shadowRadius:  16,
      elevation:     8,
    },
    accent: {
      shadowColor:   '#3ecf8e',
      shadowOffset:  { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius:  12,
      elevation:     6,
    },
  },

  // ── Motion durations (ms) ─────────────────────────────────────────────
  animation: {
    instant: 80,
    fast:    150,
    normal:  250,
    slow:    380,
  },
} as const;

// ── Convenience re-exports for common patterns ────────────────────────────
export type ThemeColors  = typeof Theme.colors;
export type ThemeSpacing = typeof Theme.spacing;