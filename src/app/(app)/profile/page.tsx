import { initPragmas, prisma } from "@/lib/prisma";
import ProfileForm from "./profile-form";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  await initPragmas();

  const [name, avatar] = await Promise.all([
    prisma.setting.findUnique({ where: { key: "profile.name" } }),
    prisma.setting.findUnique({ where: { key: "profile.avatar" } }),
  ]);

  return (
    <div style={{ maxWidth: 720 }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Perfil</h1>
      <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 24 }}>
        Tu nombre, tu avatar y cómo se ve el sitio para ti.
      </p>
      <ProfileForm
        initial={{
          name: name?.value || "",
          avatar: avatar?.value || "",
        }}
      />
    </div>
  );
}
