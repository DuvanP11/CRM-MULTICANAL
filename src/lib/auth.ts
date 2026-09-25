import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { getEnv } from "./env";
import { prisma } from "./prisma";

async function verifyCredentials(email: string, password: string) {
  const env = getEnv();

  const settingEmail = await prisma.setting.findUnique({
    where: { key: "auth.admin.email" },
  });
  const settingHash = await prisma.setting.findUnique({
    where: { key: "auth.admin.passwordHash" },
  });

  const adminEmail = settingEmail?.value || env.adminEmail;
  const hashB64 = settingHash?.value || env.adminPasswordHashB64;

  if (!adminEmail || !hashB64) return null;

  const normalizedEmail = adminEmail.toLowerCase();
  if (email.toLowerCase() !== normalizedEmail) return null;

  const hash = Buffer.from(hashB64, "base64").toString("utf8");
  const ok = await bcrypt.compare(password, hash);
  if (!ok) return null;

  return { id: "admin", email: normalizedEmail, name: "Administrador" };
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        return verifyCredentials(credentials.email, credentials.password);
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = "admin";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as string | undefined;
      }
      return session;
    },
  },
};