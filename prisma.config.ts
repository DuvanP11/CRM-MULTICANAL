import "dotenv/config";
import { defineConfig } from "prisma/config";

// Se usa process.env con fallback en lugar de env("DATABASE_URL") porque
// `prisma generate` corre en postinstall/build, donde la variable puede no
// estar definida; env() lanzaría y rompería el despliegue en Vercel. El valor
// solo importa para conectar, y generar el client no necesita conexión real.
const databaseUrl =
  process.env.DATABASE_URL?.trim() || "postgresql://localhost:5432/postgres";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  engine: "classic",
  datasource: {
    url: databaseUrl,
  },
});
