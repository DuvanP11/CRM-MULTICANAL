import { initPragmas } from "@/lib/prisma";
import { getConfigModel } from "@/lib/config";
import SettingsPanel from "./settings-panel";

export default async function SettingsPage() {
  await initPragmas();
  const model = await getConfigModel();

  return (
    <div style={{ maxWidth: 720 }}>
      <h1 style={{ fontSize: 22, marginBottom: 8 }}>Ajustes</h1>
      <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 24 }}>
        Configura el CRM desde aquí. Los valores guardados tienen{" "}
        <strong>prioridad sobre el archivo <code>.env</code></strong> y se almacenan en tu base de datos local.
      </p>

      <SettingsPanel model={model} />
    </div>
  );
}