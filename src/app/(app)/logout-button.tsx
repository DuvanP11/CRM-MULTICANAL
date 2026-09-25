"use client";

import { signOut } from "next-auth/react";

export default function LogoutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      style={{
        width: "100%",
        padding: "8px",
        borderRadius: 8,
        border: "1px solid var(--sidebar-border)",
        background: "transparent",
        color: "var(--sidebar-muted)",
        fontSize: 13,
        cursor: "pointer",
      }}
    >
      Cerrar sesión
    </button>
  );
}