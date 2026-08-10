// MASL — Powered by THE TICKER : design tokens (from the official Brand Guide).
// Black base, white primary, lime-green (Rayo / play-by-play) + blue (Casey / analyst) accents.

export const colors = {
  bg: "#05070C",
  bgElev: "#0B0E15",
  surface: "#10141C",
  surfaceAlt: "#171C26",
  surfaceHi: "#212834",
  border: "#20262F",
  borderStrong: "#343C49",

  text: "#F4F7FA",
  textDim: "#98A2B3",
  textFaint: "#5B6472",

  // Brand accents (sampled from the Brand Guide)
  green: "#64F705", // Rayo / play-by-play / positive stat / tagline
  greenDim: "#16330A",
  greenSoft: "#0F1E07",
  blue: "#2E6BFF", // Casey / analyst / cool
  blueDim: "#0E1E44",
  blueSoft: "#0E1830",
  red: "#FA2A2A", // LIVE badge
  redDim: "#3A1113",
  gold: "#F5B301",
  white: "#FFFFFF",
} as const;

export const fonts = {
  display: "Rajdhani", // headline — ALL CAPS, bold
  accent: "Oswald", // accent labels / kickers
  body: "Inter", // body / UI / long-form
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 6,
  md: 12,
  lg: 20,
  pill: 999,
} as const;

export const fontSize = {
  xs: 11,
  sm: 12,
  base: 14,
  lg: 16,
  xl: 20,
  xxl: 26,
  xxxl: 34,
  giant: 56,
} as const;

// Per-host styling used across Cold Open + Talk.
export const hostStyle = {
  rayo: { accent: colors.green, soft: colors.greenSoft, label: "PLAY-BY-PLAY", handle: "@RayoOnTheCall" },
  casey: { accent: colors.blue, soft: colors.blueSoft, label: "ANALYST", handle: "@CaseyWhitefield_" },
} as const;
