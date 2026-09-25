"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ChannelLogo from "@/components/channel-logo";

export default function ReplyBox({
  conversationId,
  channel,
}: {
  conversationId: string;
  channel: string;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setInfo("");

    const body = text.trim();
    if (!body) return;

    startTransition(async () => {
      const res = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });

      const data = await res.json().catch(() => null);
      if (res.status === 401) {
        router.push("/login");
        return;
      }

      if (!res.ok) {
        setError(data?.error || "No se pudo enviar la respuesta");
        return;
      }

      setText("");
      setInfo(
        data?.slaSeconds != null
          ? `Enviado · primera respuesta en ${formatDuration(data.slaSeconds)}`
          : "Enviado"
      );
      router.refresh();
    });
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      style={{
        marginTop: 24,
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 20,
      }}
    >
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 13,
          color: "var(--muted)",
          marginBottom: 8,
          fontWeight: 600,
        }}
      >
        <ChannelLogo channel={channel} size={15} />
        Responder por {channel === "WHATSAPP" ? "WhatsApp" : channel === "TELEGRAM" ? "Telegram" : "email"}
      </label>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Escribe tu respuesta..."
        rows={4}
        style={{
          width: "100%",
          padding: "12px",
          border: "1px solid var(--field-border)",
          borderRadius: 8,
          fontSize: 14,
          resize: "vertical",
          fontFamily: "inherit",
          background: "var(--field-bg)",
          color: "var(--field-fg)",
        }}
      />
      {error && <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 8 }}>{error}</p>}
      {info && <p style={{ color: "var(--success)", fontSize: 13, marginTop: 8 }}>{info}</p>}
      <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
        <button
          type="submit"
          disabled={isPending || !text.trim()}
          style={{
            padding: "10px 22px",
            borderRadius: 8,
            border: "none",
            background: "var(--primary)",
            color: "var(--on-primary)",
            fontSize: 14,
            fontWeight: 600,
            cursor: isPending || !text.trim() ? "not-allowed" : "pointer",
            opacity: isPending || !text.trim() ? 0.6 : 1,
          }}
        >
          {isPending ? "Enviando..." : "Enviar respuesta"}
        </button>
      </div>
    </form>
  );
}

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const min = Math.floor(seconds / 60);
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  return `${h}h ${min % 60}m`;
}