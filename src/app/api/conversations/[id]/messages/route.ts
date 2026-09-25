import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sendAgentReply } from "@/services/outbox/send";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const text = typeof body?.body === "string" ? body.body.trim() : "";

    if (!text) {
      return NextResponse.json({ error: "El mensaje no puede estar vacío" }, { status: 400 });
    }
    if (text.length > 40000) {
      return NextResponse.json({ error: "Mensaje demasiado largo" }, { status: 413 });
    }

    const result = await sendAgentReply({ conversationId: params.id, body: text });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }

    return NextResponse.json({ ok: true, slaSeconds: result.slaSeconds });
  } catch (error) {
    console.error("Error al responder:", error);
    return NextResponse.json(
      { error: "Error interno al procesar la respuesta" },
      { status: 500 }
    );
  }
}