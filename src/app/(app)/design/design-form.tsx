"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/components/theme-provider";
import { CUSTOM_PALETTE, PALETTES, type ThemeMode } from "@/lib/themes";
import {
  BRAND_LOGO_MAX_LENGTH,
  brandInitials,
  isValidHex,
  normalizeHex,
  type Brand,
} from "@/lib/brand";

export default function DesignForm({ initial }: { initial: Brand }) {
  const router = useRouter();
  const { palette, mode, brand, setBrand, setPalette, setMode } = useTheme();

  const [logoFile, setLogoFile] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const logoSrc = logoFile || brand.logo;

  function onLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > BRAND_LOGO_MAX_LENGTH) {
      setMsg({ ok: false, text: "El logo supera 1.5 MB. Usa una imagen más pequeña." });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const data = String(reader.result);
      setLogoFile(data);
      setBrand({ logo: data });
      setMsg(null);
    };
    reader.readAsDataURL(file);
  }

  function clearLogo() {
    setLogoFile(null);
    setBrand({ logo: "" });
  }

  function discard() {
    setLogoFile(null);
    setBrand(initial);
    setPalette(palette);
    setMsg({ ok: true, text: "Cambios descartados." });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/brand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: brand.name,
          logo: brand.logo,
          primary: brand.primary,
          accent: brand.accent,
        }),
      });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setMsg({ ok: false, text: data?.error || "No se pudo guardar el diseño" });
        return;
      }
      setMsg({ ok: true, text: "Diseño guardado." });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* ---- Identidad: logo + nombre ---- */}
      <Card
        title="Logo y nombre"
        hint="Sin logo se usan las iniciales del nombre. El logo aparece en la cabecera del menú y en la pestaña del navegador."
      >
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: 16,
              border: "1px dashed var(--field-border)",
              background: "var(--field-bg)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              overflow: "hidden",
            }}
          >
            {logoSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoSrc}
                alt="Logo"
                style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
              />
            ) : (
              <span
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: 14,
                  background: "var(--primary)",
                  color: "var(--on-primary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 24,
                  fontWeight: 800,
                }}
              >
                {brandInitials(brand.name)}
              </span>
            )}
          </div>

          <div style={{ flex: 1, minWidth: 260, display: "flex", flexDirection: "column", gap: 14 }}>
            <label style={labelStyle}>
              Nombre de la empresa
              <input
                value={brand.name}
                maxLength={60}
                onChange={(e) => setBrand({ name: e.target.value })}
                placeholder="Mi Empresa"
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              URL del logo (opcional)
              <input
                value={logoSrc.startsWith("http") ? logoSrc : ""}
                onChange={(e) => {
                  setLogoFile(null);
                  setBrand({ logo: e.target.value });
                }}
                placeholder="https://miempresa.com/logo.png"
                style={inputStyle}
              />
            </label>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <label>
                <input type="file" accept="image/*" onChange={onLogoFile} style={{ display: "none" }} />
                <span style={secondaryBtnStyle}>Subir logo</span>
              </label>
              {logoSrc && (
                <button type="button" onClick={clearLogo} style={secondaryBtnStyle}>
                  Quitar logo
                </button>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* ---- Colores corporativos ---- */}
      <Card
        title="Colores corporativos"
        hint="El color principal pinta botones, enlaces y el ítem activo del menú. El acento se usa en detalles y avisos."
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
          <ColorField
            label="Color principal"
            value={brand.primary}
            onChange={(v) => setBrand({ primary: v })}
          />
          <ColorField label="Color de acento" value={brand.accent} onChange={(v) => setBrand({ accent: v })} />
        </div>
      </Card>

      {/* ---- Paletas rápidas + modo ---- */}
      <Card title="Paletas listas" hint="Atajos. Elige una paleta o vuelve a “Corporativo” para usar tus colores.">
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
          {PALETTES.map((p) => {
            const active = palette === p.key;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => setPalette(p.key)}
                title={p.name}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 6,
                  padding: "10px 12px",
                  width: 96,
                  cursor: "pointer",
                  borderRadius: 10,
                  border: active ? "2px solid var(--primary)" : "1px solid var(--border)",
                  background: "var(--card)",
                  color: "var(--foreground)",
                }}
              >
                <span
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    background: `linear-gradient(135deg, ${p.color} 55%, ${p.bg})`,
                    border: "1px solid var(--border)",
                  }}
                />
                <span style={{ fontSize: 12, fontWeight: active ? 700 : 500 }}>{p.name}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setPalette(CUSTOM_PALETTE)}
            title="Tus colores corporativos"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
              padding: "10px 12px",
              width: 96,
              cursor: "pointer",
              borderRadius: 10,
              border: palette === CUSTOM_PALETTE ? "2px solid var(--primary)" : "1px solid var(--border)",
              background: "var(--card)",
              color: "var(--foreground)",
            }}
          >
            <span
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: "linear-gradient(135deg, var(--accent) 50%, var(--primary) 50%)",
                border: "1px solid var(--border)",
              }}
            />
            <span style={{ fontSize: 12, fontWeight: palette === CUSTOM_PALETTE ? 700 : 500 }}>
              Corporativo
            </span>
          </button>
        </div>

        <div style={modeRowStyle}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Tema claro u oscuro</div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>
              {mode === "dark" ? "Estás en modo oscuro." : "Estás en modo claro."}
            </div>
          </div>
          <button type="button" onClick={() => setMode(nextMode(mode))} style={primaryBtnStyle}>
            {mode === "dark" ? "☀️ Modo claro" : "🌙 Modo oscuro"}
          </button>
        </div>
      </Card>

      {/* ---- Vista previa ---- */}
      <Card title="Vista previa">
        <Preview brand={brand} logoSrc={logoSrc} mode={mode} />
      </Card>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
        {msg && (
          <span style={{ fontSize: 13, color: msg.ok ? "var(--success)" : "var(--danger)" }}>
            {msg.ok ? "✔ " : "✖ "}
            {msg.text}
          </span>
        )}
        <button type="button" onClick={discard} style={secondaryBtnStyle}>
          Descartar cambios
        </button>
        <button type="submit" disabled={saving} style={{ ...primaryBtnStyle, padding: "11px 24px" }}>
          {saving ? "Guardando…" : "Guardar diseño"}
        </button>
      </div>
    </form>
  );
}

function nextMode(mode: ThemeMode): ThemeMode {
  return mode === "dark" ? "light" : "dark";
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const valid = isValidHex(draft);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>{label}</span>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          type="color"
          value={value}
          onChange={(e) => {
            setDraft(e.target.value);
            onChange(e.target.value);
          }}
          style={{
            width: 46,
            height: 40,
            padding: 2,
            borderRadius: 8,
            border: "1px solid var(--field-border)",
            background: "var(--field-bg)",
            cursor: "pointer",
          }}
        />
        <input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (isValidHex(e.target.value)) onChange(normalizeHex(e.target.value));
          }}
          placeholder="#1d4ed8"
          style={{ ...inputStyle, flex: 1 }}
        />
      </div>
      <span style={{ fontSize: 11, color: valid ? "var(--muted)" : "var(--danger)" }}>
        {valid ? "Formato hexadecimal (#2563eb)" : "Escribe un color como #2563eb"}
      </span>
    </div>
  );
}

function Preview({ brand, logoSrc, mode }: { brand: Brand; logoSrc: string; mode: ThemeMode }) {
  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
      <div
        style={{
          width: 220,
          flexShrink: 0,
          border: "1px solid var(--border)",
          borderRadius: 12,
          overflow: "hidden",
          background: "var(--sidebar-bg)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: 12,
            borderBottom: "1px solid var(--sidebar-border)",
          }}
        >
          {logoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoSrc} alt="" style={{ width: 28, height: 28, objectFit: "contain" }} />
          ) : (
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: "var(--primary)",
                color: "var(--on-primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 800,
                flexShrink: 0,
              }}
            >
              {brandInitials(brand.name)}
            </span>
          )}
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "var(--sidebar-fg)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {brand.name || "Mi Empresa"}
          </span>
        </div>
        {["Dashboard", "Conversaciones", "Alertas"].map((label, i) => (
          <div
            key={label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "9px 12px",
              fontSize: 13,
              color: i === 1 ? "var(--on-primary)" : "var(--sidebar-muted)",
              background: i === 1 ? "var(--sidebar-active)" : "transparent",
              fontWeight: i === 1 ? 600 : 400,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 3,
                background: i === 1 ? "var(--on-primary)" : "var(--sidebar-muted)",
              }}
            />
            {label}
          </div>
        ))}
      </div>

      <div style={{ flex: 1, minWidth: 240, display: "flex", flexDirection: "column", gap: 12 }}>
        <div
          style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 16,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 14 }}>Vista previa</div>
          <div style={{ fontSize: 13, color: "var(--muted)" }}>
            Botón principal, enlace de acento y badge de estado.
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span style={primaryBtnStyle}>Guardar</span>
            <span style={{ color: "var(--on-surface)", fontSize: 13, fontWeight: 600 }}>Ver detalle →</span>
            <span
              style={{
                background: "var(--primary)",
                color: "var(--on-primary)",
                borderRadius: 999,
                padding: "3px 10px",
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              {mode === "dark" ? "Oscuro" : "Claro"}
            </span>
          </div>
        </div>
        <div
          style={{
            background: "var(--primary-soft)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 14,
            fontSize: 13,
          }}
        >
          Esta caja usa <code>--primary-soft</code>: una versión suave de tu color principal.
        </div>
      </div>
    </div>
  );
}

function Card({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 24,
        boxShadow: "var(--shadow)",
      }}
    >
      <h2 style={{ fontSize: 16, marginBottom: hint ? 2 : 16 }}>{title}</h2>
      {hint && <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>{hint}</p>}
      {children}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  fontSize: 12,
  color: "var(--muted)",
  fontWeight: 600,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid var(--field-border)",
  background: "var(--field-bg)",
  color: "var(--field-fg)",
  fontSize: 14,
};

const primaryBtnStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "10px 16px",
  borderRadius: 8,
  border: "none",
  background: "var(--primary)",
  color: "var(--on-primary)",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
};

const secondaryBtnStyle: React.CSSProperties = {
  display: "inline-block",
  cursor: "pointer",
  border: "1px solid var(--field-border)",
  background: "var(--field-bg)",
  color: "var(--field-fg)",
  padding: "8px 12px",
  borderRadius: 8,
  fontSize: 13,
};

const modeRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: 14,
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "var(--field-bg)",
};
