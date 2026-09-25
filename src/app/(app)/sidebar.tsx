"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useTheme } from "@/components/theme-provider";
import { brandInitials } from "@/lib/brand";
import LogoutButton from "./logout-button";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/conversations", label: "Conversaciones", icon: "💬" },
  { href: "/alerts", label: "Alertas", icon: "🔔" },
  { href: "/design", label: "Diseño", icon: "🎨" },
  { href: "/profile", label: "Perfil", icon: "👤" },
  { href: "/settings", label: "Ajustes", icon: "⚙️" },
];

const STORE_KEY = "crm.sidebar.collapsed";

export default function Sidebar({
  email,
  name,
  avatar,
}: {
  email?: string | null;
  name?: string | null;
  avatar?: string | null;
}) {
  const pathname = usePathname();
  const { mode, toggleMode, brand } = useTheme();
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(STORE_KEY) === "1";
  });

  const displayName = name || email || "Administrador";
  const initials = (displayName || "A")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem(STORE_KEY, next ? "1" : "0");
      return next;
    });
  }

  const width = collapsed ? 72 : 232;

  return (
    <aside
      style={{
        width,
        background: "var(--sidebar-bg)",
        color: "var(--sidebar-fg)",
        borderRight: "1px solid var(--sidebar-border)",
        display: "flex",
        flexDirection: "column",
        transition: "width 200ms ease",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: collapsed ? "14px 8px" : "14px 16px",
          gap: 8,
        }}
      >
        <Link
          href="/design"
          title="Ajustar diseño"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            minWidth: 0,
            textDecoration: "none",
          }}
        >
          {brand.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={brand.logo}
              alt={brand.name}
              style={{
                width: 28,
                height: 28,
                objectFit: "contain",
                flexShrink: 0,
                borderRadius: 6,
              }}
            />
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
          {!collapsed && (
            <span
              style={{
                fontSize: 15,
                fontWeight: 700,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                color: "var(--sidebar-fg)",
              }}
            >
              {brand.name}
            </span>
          )}
        </Link>
        <button
          onClick={toggleCollapsed}
          title={collapsed ? "Expandir menú" : "Contraer menú"}
          style={{
            background: "transparent",
            border: "1px solid var(--sidebar-border)",
            color: "var(--sidebar-muted)",
            borderRadius: 8,
            width: 32,
            height: 32,
            fontSize: 14,
            cursor: "pointer",
            flexShrink: 0,
            lineHeight: 1,
          }}
        >
          {collapsed ? "»" : "«"}
        </button>
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 2, padding: "0 8px" }}>
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: collapsed ? "10px 0" : "10px 12px",
                justifyContent: collapsed ? "center" : "flex-start",
                fontSize: 14,
                color: active ? "var(--on-primary)" : "var(--sidebar-muted)",
                background: active ? "var(--sidebar-active)" : "transparent",
                borderRadius: 8,
                textDecoration: "none",
                whiteSpace: "nowrap",
                fontWeight: active ? 600 : 400,
              }}
            >
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              {!collapsed && item.label}
            </Link>
          );
        })}
      </nav>

      <div style={{ marginTop: "auto", padding: collapsed ? "12px 8px" : "16px", borderTop: "1px solid var(--sidebar-border)" }}>
        <Link
          href="/profile"
          title="Editar perfil"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            justifyContent: collapsed ? "center" : "flex-start",
            textDecoration: "none",
            padding: 4,
          }}
        >
          <Avatar value={avatar} name={initials} size={collapsed ? 36 : 40} />
          {!collapsed && (
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "var(--sidebar-fg)" }}>
                {displayName}
              </div>
              <div style={{ fontSize: 12, color: "var(--sidebar-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {email}
              </div>
            </div>
          )}
          {!collapsed && (
            <span style={{ color: "var(--sidebar-muted)", fontSize: 14 }} title="Editar perfil">
              ✏️
            </span>
          )}
        </Link>

        <div style={{ marginTop: 12, display: "flex", gap: 8, flexDirection: collapsed ? "column" : "row" }}>
          <button
            onClick={toggleMode}
            title={mode === "dark" ? "Modo claro" : "Modo oscuro"}
            style={{
              flex: 1,
              padding: "8px",
              borderRadius: 8,
              border: "1px solid var(--sidebar-border)",
              background: "transparent",
              color: "var(--sidebar-muted)",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            {mode === "dark" ? "☀️" : "🌙"}
          </button>
          {!collapsed && (
            <div style={{ flex: 2 }}>
              <LogoutButton />
            </div>
          )}
        </div>
        {collapsed && (
          <div style={{ marginTop: 8 }}>
            <LogoutButton />
          </div>
        )}
      </div>
    </aside>
  );
}

function Avatar({ value, name, size }: { value?: string | null; name: string; size: number }) {
  if (value) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img
        src={value}
        alt={name}
        width={size}
        height={size}
        style={{ borderRadius: "50%", objectFit: "cover", background: "var(--sidebar-bg)", border: "1px solid var(--sidebar-border)", flexShrink: 0 }}
      />;
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "var(--sidebar-active)",
        color: "var(--on-primary)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.4,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {name}
    </div>
  );
}