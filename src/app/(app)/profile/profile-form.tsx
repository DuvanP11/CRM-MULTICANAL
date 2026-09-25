"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ProfileForm({
  initial,
}: {
  initial: {
    name: string;
    avatar: string;
  };
}) {
  const router = useRouter();

  const [name, setName] = useState(initial.name);
  const [avatarUrl, setAvatarUrl] = useState(initial.avatar || "");
  const [avatarFile, setAvatarFile] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const initials = ((name.trim() || "A").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase());

  function onAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setMsg({ ok: false, text: "La imagen supera 2 MB. Usa una más pequeña." });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAvatarFile(String(reader.result));
      setMsg(null);
    };
    reader.readAsDataURL(file);
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const avatarValue = avatarFile || avatarUrl;
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, avatar: avatarValue }),
      });
      const data = await res.json().catch(() => null);
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) {
        setMsg({ ok: false, text: data?.error || "No se pudo guardar el perfil" });
        return;
      }
      setMsg({ ok: true, text: "Perfil guardado." });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const avatarSrc = avatarFile || avatarUrl;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* ---- Foto y nombre ---- */}
      <Card title="Foto y nombre">
        <form onSubmit={saveProfile} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <Avatar src={avatarSrc} initials={initials} />
            <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, minWidth: 240 }}>
              <label style={fieldLabelStyle}>
                Nombre
                <input
                  value={name}
                  maxLength={80}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tu nombre"
                  style={fieldStyle}
                />
              </label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <label>
                  <input type="file" accept="image/*" onChange={onAvatarFile} style={{ display: "none" }} />
                  <span style={{ display: "inline-block", cursor: "pointer", border: "1px solid var(--field-border)", background: "var(--field-bg)", color: "var(--field-fg)", padding: "8px 12px", borderRadius: 8, fontSize: 13 }}>
                    Subir avatar
                  </span>
                </label>
                <input
                  value={avatarUrl}
                  onChange={(e) => {
                    setAvatarUrl(e.target.value);
                    setAvatarFile(null);
                  }}
                  placeholder="o pega una URL de imagen"
                  style={{ ...fieldStyle, flex: 1, minWidth: 180 }}
                />
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10 }}>
            {msg && (
              <span style={{ fontSize: 13, color: msg.ok ? "var(--success)" : "var(--danger)" }}>
                {msg.ok ? "✔ " : "✖ "}
                {msg.text}
              </span>
            )}
            <button type="submit" disabled={saving} style={{ ...buttonStyle, width: "auto" }}>
              {saving ? "Guardando…" : "Guardar perfil"}
            </button>
          </div>
        </form>
      </Card>

      {/* ---- Colores del sitio ---- */}
      <Card title="Colores del sitio">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: 14,
            borderRadius: 12,
            border: "1px solid var(--border)",
            background: "var(--field-bg)",
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Logo y colores corporativos</div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>
              Ahora viven en Diseño: logo, nombre de empresa, color principal y de acento.
            </div>
          </div>
          <Link
            href="/design"
            style={{
              display: "inline-block",
              padding: "10px 16px",
              borderRadius: 8,
              border: "1px solid var(--field-border)",
              background: "var(--primary)",
              color: "var(--on-primary)",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Ir a Diseño
          </Link>
        </div>
      </Card>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: 24, boxShadow: "var(--shadow)" }}>
      <h2 style={{ fontSize: 16, marginBottom: 16 }}>{title}</h2>
      {children}
    </div>
  );
}

function Avatar({ src, initials }: { src?: string | null; initials: string }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="Avatar" width={72} height={72} style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "1px solid var(--border)" }} />;
  }
  return (
    <div
      style={{
        width: 72,
        height: 72,
        borderRadius: "50%",
        background: "var(--primary)",
        color: "var(--on-primary)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 26,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}

const fieldLabelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  fontSize: 12,
  color: "var(--muted)",
  fontWeight: 600,
};

const fieldStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid var(--field-border)",
  background: "var(--field-bg)",
  color: "var(--field-fg)",
  fontSize: 14,
};

const buttonStyle: React.CSSProperties = {
  padding: "10px 22px",
  borderRadius: 8,
  border: "none",
  background: "var(--primary)",
  color: "var(--on-primary)",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  width: "100%",
};