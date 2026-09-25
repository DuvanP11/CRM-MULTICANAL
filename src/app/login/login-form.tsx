"use client";

import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = e.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;

    startTransition(async () => {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (res?.error) {
        setError("Credenciales incorrectas");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ marginBottom: 16 }}>
        <label
          htmlFor="email"
          style={{ display: "block", fontSize: 13, marginBottom: 6, color: "var(--muted)" }}
        >
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="admin@crm.local"
          style={inputStyle}
        />
      </div>
      <div style={{ marginBottom: 20 }}>
        <label
          htmlFor="password"
          style={{ display: "block", fontSize: 13, marginBottom: 6, color: "var(--muted)" }}
        >
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          style={inputStyle}
        />
      </div>
      {error && (
        <p style={{ color: "var(--danger)", fontSize: 14, marginBottom: 12 }}>{error}</p>
      )}
      <button type="submit" disabled={isPending} style={buttonStyle}>
        {isPending ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 14,
  background: "var(--field-bg)",
  color: "var(--field-fg)",
};

const buttonStyle: React.CSSProperties = {
  width: "100%",
  padding: "11px",
  borderRadius: 8,
  border: "none",
  background: "var(--primary)",
  color: "var(--on-primary)",
  fontSize: 15,
  fontWeight: 600,
  cursor: "pointer",
};