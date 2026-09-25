export const PALETTES = [
  { key: "azul", name: "Azul", color: "#2563eb", bg: "#eef4ff" },
  { key: "esmeralda", name: "Esmeralda", color: "#059669", bg: "#ecfdf5" },
  { key: "violeta", name: "Violeta", color: "#7c3aed", bg: "#f5f3ff" },
  { key: "rosa", name: "Rosa", color: "#db2777", bg: "#fdf2f8" },
  { key: "ambar", name: "Ámbar", color: "#d97706", bg: "#fffbeb" },
] as const;

/** Paleta que usa los colores corporativos definidos en /design. */
export const CUSTOM_PALETTE = "custom";

export const PALETTE_KEYS: string[] = [...PALETTES.map((p) => p.key), CUSTOM_PALETTE];

export type ThemeMode = "light" | "dark";

export const DEFAULT_PALETTE = "azul";
export const DEFAULT_MODE: ThemeMode = "light";

export function isValidPalette(value: string): boolean {
  return PALETTE_KEYS.includes(value);
}
