// ── DESIGN TOKENS ───────────────────────────────────────────
// Single source of truth for color, spacing, radius, typography, shadow, and
// motion values. Every screen (popup, decision strip, library, clipboard)
// imports from here instead of hardcoding hex values — that's what keeps the
// whole extension reading as one product instead of independently-styled
// screens.
//
// Kept as plain TS objects (not CSS custom properties) because this codebase
// styles everything via inline `style={{...}}` in React and `Object.assign`
// on vanilla DOM nodes (the crop overlay) — both consume plain JS values
// identically, so this is the lowest-friction shared format for both.

export const color = {
  // Brand — the vivid mint stays reserved for accents/actions/active states,
  // not as a default text color for everything (that was the single biggest
  // "everything is green" issue in the previous version).
  brand: "#4ADE80",
  brandHover: "#3BC46E",
  brandPressed: "#2FA85C",
  brandTextOn: "#0B1710", // text placed on top of a solid brand-green fill

  // Neutral dark surfaces — same dark identity as before, but toned neutral
  // rather than saturated green, with a real elevation scale.
  bgBase: "#141815", // page background
  bgSurface: "#1B211C", // cards, panels, rows
  bgElevated: "#232A24", // popovers, lightbox, floating menus, tooltips
  bgHover: "#28322B", // hover fill for rows/menu items
  bgSubtle: "rgba(255,255,255,0.05)", // faint fill, e.g. secondary button

  // Text — a real hierarchy instead of everything in brand green.
  textPrimary: "#EBF2ED",
  textSecondary: "#98A69B",
  textMuted: "#647065",

  // Borders
  border: "rgba(255,255,255,0.09)",
  borderStrong: "rgba(255,255,255,0.16)",
  borderBrand: "rgba(74,222,128,0.55)",

  // Semantic — reusing the product's existing amber/red identity rather than
  // inventing new ones, just applied consistently instead of ad hoc.
  success: "#4ADE80",
  warning: "#F59E0B", // also the Temp-folder accent, unchanged
  warningText: "#F59E0B",
  error: "#E2685F",
  errorText: "#E2685F",

  focusRing: "rgba(74,222,128,0.45)",
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radius = {
  sm: 6,
  md: 8,
  lg: 12,
} as const;

export const font = {
  family:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  size: {
    xs: 11,
    sm: 12,
    base: 13,
    md: 14,
    lg: 16,
    xl: 18,
  },
  weight: {
    regular: 400,
    medium: 500,
    semibold: 600,
  },
} as const;

export const shadow = {
  sm: "0 1px 2px rgba(0,0,0,0.35)",
  md: "0 6px 20px rgba(0,0,0,0.35)",
  lg: "0 16px 40px rgba(0,0,0,0.45)",
} as const;

export const motion = {
  fast: "120ms ease",
  base: "180ms ease",
  slow: "300ms ease",
} as const;
