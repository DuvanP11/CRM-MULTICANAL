import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import ChannelLogo from "@/components/channel-logo";
import LoginForm from "./login-form";

export default async function LoginPage() {
  const session = await getServerSession(authOptions);
  if (session) {
    redirect("/dashboard");
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--background)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 380,
          padding: 40,
          background: "var(--card)",
          borderRadius: 12,
          border: "1px solid var(--border)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <h1 style={{ fontSize: 22, margin: 0, color: "var(--foreground)" }}>CRM · Email + WhatsApp</h1>
          <ChannelLogo channel="EMAIL" size={20} />
          <ChannelLogo channel="WHATSAPP" size={20} />
        </div>
        <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 24 }}>
          Inicia sesión para gestionar tus conversaciones
        </p>
        <LoginForm />
      </div>
    </div>
  );
}