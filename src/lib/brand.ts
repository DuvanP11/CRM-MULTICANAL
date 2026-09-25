export type Brand = {
  /** Nombre de la empresa que se ve en la cabecera del menú. */
  name: string;
  /** Logo como data URL o URL http(s). Vacío = se usan las iniciales. */
  logo: string;
  /** Color principal corporativo (#rrggbb). */
  primary: string;
  /** Color de acento corporativo (#rrggbb). */
  accent: string;
};

export const DEFAULT_BRAND: Brand = {
  name: "CRM · WA",
  logo: "",
  primary: "#2563eb",
  accent: "#2563eb",
};

export const BRAND_NAME_MAX = 60;
export const BRAND_LOGO_MAX_LENGTH = 1_500_000;

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function isValidHex(value: string): boolean {
  return HEX_RE.test((value || "").trim());
}

export function normalizeHex(value: string, fallback = ""): string {
  const match = (value || "").trim().match(HEX_RE);
  if (!match) return fallback;
  const hex = match[1];
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((c) => c + c)
          .join("")
      : hex;
  return `#${full.toLowerCase()}`;
}

type Rgb = { r: number; g: number; b: number };

export function hexToRgb(hex: string): Rgb {
  const full = normalizeHex(hex, "#000000").slice(1);
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function toHexPair(value: number): string {
  return clampChannel(value).toString(16).padStart(2, "0");
}

export function rgbToHex({ r, g, b }: Rgb): string {
  return `#${toHexPair(r)}${toHexPair(g)}${toHexPair(b)}`;
}

export function mix(from: string, to: string, weight: number): string {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  const t = Math.max(0, Math.min(1, weight));
  return rgbToHex({
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  });
}

export const lighten = (hex: string, amount: number) => mix(hex, "#ffffff", amount);
export const darken = (hex: string, amount: number) => mix(hex, "#000000", amount);

function linearize(channel: number): number {
  const s = channel / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Devuelve el color de texto legible sobre `hex` (blanco o casi negro). */
export function readableOn(hex: string, light = "#ffffff", dark = "#0b1220"): string {
  return contrastRatio(hex, light) >= contrastRatio(hex, dark) ? light : dark;
}

const LIGHT_BACKGROUND = "#f5f6f8";
const DARK_BACKGROUND = "#0f172a";

function backgroundOf(mode: "light" | "dark"): string {
  return mode === "dark" ? DARK_BACKGROUND : LIGHT_BACKGROUND;
}

/**
 * Ajusta el color de marca hasta que se lea como TEXTO sobre el fondo de la
 * página. Se usa para enlaces y rótulos que no van sobre un relleno de color.
 */
export function readableOnSurface(colorInput: string, mode: "light" | "dark", minRatio = 4.5): string {
  const background = backgroundOf(mode);
  const towards = mode === "dark" ? "#ffffff" : "#000000";
  let current = normalizeHex(colorInput, DEFAULT_BRAND.primary);
  for (let i = 0; i < 14 && contrastRatio(current, background) < minRatio; i += 1) {
    current = mix(current, towards, 0.12);
  }
  return current;
}

/** Variables CSS que se sobrescriben con los colores corporativos. */
export function brandVars(
  primaryInput: string,
  accentInput: string,
  mode: "light" | "dark"
): Record<string, string> {
  const primary = normalizeHex(primaryInput, DEFAULT_BRAND.primary);
  const accent = normalizeHex(accentInput, primary);
  const dark = mode === "dark";
  const background = backgroundOf(mode);

  // El color de marca se respeta tal cual; el texto se ajusta para que siempre
  // se lea (var(--on-primary) es blanco o casi negro según el contraste).
  const surface = primary;

  return {
    "--primary": surface,
    "--primary-dark": dark ? lighten(primary, 0.12) : darken(primary, 0.14),
    "--accent": accent,
    "--sidebar-active": surface,
    "--on-primary": readableOn(surface),
    "--on-surface": readableOnSurface(primary, mode),
    "--primary-soft": mix(background, surface, dark ? 0.2 : 0.12),
  };
}

/**
 * CSS de la paleta corporativa. Se inyecta en un <style id="crm-brand-vars">
 * del <head> (server) y se actualiza desde el cliente (ThemeProvider).
 * Misma especificidad que las paletas de globals.css, gana por orden.
 */
export function brandCss(brand: Brand): string {
  const light = brandVars(brand.primary, brand.accent, "light");
  const dark = brandVars(brand.primary, brand.accent, "dark");
  const decls = (vars: Record<string, string>) =>
    Object.entries(vars)
      .map(([k, v]) => `${k}:${v}`)
      .join(";");

  return [
    `:root[data-palette="custom"]{${decls(light)}}`,
    `:root[data-palette="custom"][data-theme="dark"]{${decls(dark)}}`,
  ].join("");
}

export const BRAND_STYLE_ID = "crm-brand-vars";

/** Iniciales para usar cuando no hay logo. */
export function brandInitials(name: string): string {
  const words = (name || "")
    .trim()
    .split(/\s+/)
    .filter((w) => /[a-z0-9]/i.test(w));
  if (words.length === 0) return "C";
  return words
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export function isValidLogo(value: string): boolean {
  return (
    /^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,/i.test(value) ||
    /^https?:\/\//i.test(value)
  );
}
