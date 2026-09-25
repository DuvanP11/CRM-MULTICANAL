import { initPragmas, prisma } from "@/lib/prisma";
import { DEFAULT_BRAND, isValidHex, normalizeHex } from "@/lib/brand";
import DesignForm from "./design-form";

export const dynamic = "force-dynamic";

export default async function DesignPage() {
  await initPragmas();

  const [name, logo, primary, accent] = await Promise.all([
    prisma.setting.findUnique({ where: { key: "brand.name" } }),
    prisma.setting.findUnique({ where: { key: "brand.logo" } }),
    prisma.setting.findUnique({ where: { key: "brand.primary" } }),
    prisma.setting.findUnique({ where: { key: "brand.accent" } }),
  ]);

  return (
    <div style={{ maxWidth: 860 }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Diseño</h1>
      <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 24 }}>
        Logo y colores corporativos del CRM. Los cambios se ven al instante y se guardan para
        todos los equipos.
      </p>
      <DesignForm
        initial={{
          name: name?.value || DEFAULT_BRAND.name,
          logo: logo?.value || "",
          primary: isValidHex(primary?.value || "") ? normalizeHex(primary!.value) : DEFAULT_BRAND.primary,
          accent: isValidHex(accent?.value || "") ? normalizeHex(accent!.value) : DEFAULT_BRAND.accent,
        }}
      />
    </div>
  );
}
