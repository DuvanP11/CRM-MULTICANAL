import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma, initPragmas } from "@/lib/prisma";
import Sidebar from "./sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session] = await Promise.all([getServerSession(authOptions), initPragmas()]);

  const settingName = await prisma.setting.findUnique({ where: { key: "profile.name" } });
  const settingAvatar = await prisma.setting.findUnique({ where: { key: "profile.avatar" } });

  return (
    <div style={{ minHeight: "100vh", display: "flex" }}>
      <Sidebar
        email={session?.user?.email}
        name={settingName?.value}
        avatar={settingAvatar?.value}
      />
      <main style={{ flex: 1, padding: 28, minWidth: 0 }}>{children}</main>
    </div>
  );
}