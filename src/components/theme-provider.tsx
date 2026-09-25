"use client";

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { CUSTOM_PALETTE, isValidPalette, type ThemeMode } from "@/lib/themes";
import { BRAND_STYLE_ID, brandCss, isValidHex, normalizeHex, type Brand } from "@/lib/brand";

export const BRAND_STORAGE_KEY = "crm.brand";

type ThemeContextValue = {
  palette: string;
  mode: ThemeMode;
  brand: Brand;
  setPalette: (p: string) => void;
  setMode: (m: ThemeMode) => void;
  toggleMode: () => void;
  setBrand: (patch: Partial<Brand>) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(palette: string, mode: string) {
  const root = document.documentElement;
  root.dataset.palette = palette;
  root.dataset.theme = mode;
}

function readStoredBrand(fallback: Brand): Brand {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(BRAND_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<Brand>;
    return {
      name: typeof parsed.name === "string" ? parsed.name : fallback.name,
      logo: typeof parsed.logo === "string" ? parsed.logo : fallback.logo,
      primary: isValidHex(parsed.primary || "") ? normalizeHex(parsed.primary as string) : fallback.primary,
      accent: isValidHex(parsed.accent || "") ? normalizeHex(parsed.accent as string) : fallback.accent,
    };
  } catch {
    return fallback;
  }
}

function syncBrandStyle(brand: Brand) {
  let tag = document.getElementById(BRAND_STYLE_ID) as HTMLStyleElement | null;
  if (!tag) {
    tag = document.createElement("style");
    tag.id = BRAND_STYLE_ID;
    document.head.appendChild(tag);
  }
  const css = brandCss(brand);
  if (tag.textContent !== css) tag.textContent = css;
}

export function ThemeProvider({
  initialPalette,
  initialMode,
  initialBrand,
  children,
}: {
  initialPalette: string;
  initialMode: ThemeMode;
  initialBrand: Brand;
  children: ReactNode;
}) {
  // El primer render del cliente debe coincidir con el HTML del servidor, así que
  // el estado arranca siempre desde las props. Las preferencias guardadas se
  // reponen recién después de montar, que es cuando ya se puede tocar el DOM.
  const [palette, setPaletteState] = useState(initialPalette);
  const [mode, setModeState] = useState<ThemeMode>(initialMode);
  const [brand, setBrandState] = useState<Brand>(initialBrand);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const storedPalette = localStorage.getItem("crm.theme.palette");
      if (storedPalette && isValidPalette(storedPalette)) setPaletteState(storedPalette);
      const storedMode = localStorage.getItem("crm.theme.mode");
      if (storedMode === "light" || storedMode === "dark") setModeState(storedMode);
    } catch {
      // localStorage bloqueado: se conservan los valores del servidor
    }
    setBrandState(readStoredBrand(initialBrand));
    setHydrated(true);
    // Solo al montar: el servidor manda en el primer render y las ediciones en
    // vivo viven en el estado, no en una relectura de localStorage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    applyTheme(palette, mode);
    localStorage.setItem("crm.theme.palette", palette);
    localStorage.setItem("crm.theme.mode", mode);
  }, [palette, mode, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    syncBrandStyle(brand);
    localStorage.setItem(BRAND_STORAGE_KEY, JSON.stringify(brand));
  }, [brand, hydrated]);

  const persist = useCallback(async (body: Record<string, string>) => {
    try {
      await fetch("/api/theme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      // silencioso: lo local ya quedó aplicado
    }
  }, []);

  function setPalette(p: string) {
    if (!isValidPalette(p)) return;
    setPaletteState(p);
    void persist({ palette: p });
  }

  function setMode(m: ThemeMode) {
    setModeState(m);
    void persist({ mode: m });
  }

  function toggleMode() {
    setMode(mode === "dark" ? "light" : "dark");
  }

  /** Cambia la marca en vivo; tocar un color activa la paleta corporativa. */
  const setBrand = useCallback(
    (patch: Partial<Brand>) => {
      const next: Brand = {
        name: patch.name !== undefined ? patch.name.trim().slice(0, 60) : brand.name,
        logo: patch.logo !== undefined ? patch.logo : brand.logo,
        primary: isValidHex(patch.primary || "") ? normalizeHex(patch.primary as string) : brand.primary,
        accent: isValidHex(patch.accent || "") ? normalizeHex(patch.accent as string) : brand.accent,
      };
      setBrandState(next);
      if (patch.primary !== undefined || patch.accent !== undefined) {
        setPaletteState(CUSTOM_PALETTE);
        void persist({ palette: CUSTOM_PALETTE });
      }
    },
    [brand, persist]
  );

  return (
    <ThemeContext.Provider
      value={{ palette, mode, brand, setPalette, setMode, toggleMode, setBrand }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme debe usarse dentro de <ThemeProvider>");
  return ctx;
}
