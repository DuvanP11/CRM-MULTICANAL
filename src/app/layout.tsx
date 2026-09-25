import type { Metadata } from "next";
import "./globals.css";
import { initPragmas, prisma } from "@/lib/prisma";
import { DEFAULT_PALETTE, DEFAULT_MODE, type ThemeMode } from "@/lib/themes";
import { BRAND_STYLE_ID, DEFAULT_BRAND, brandCss, isValidHex, normalizeHex, type Brand } from "@/lib/brand";
import { ThemeProvider } from "@/components/theme-provider";
import ServiceWorkerRegistration from "@/components/service-worker-registration";

const FALLBACK = { palette: DEFAULT_PALETTE, mode: DEFAULT_MODE, brand: DEFAULT_BRAND };

export async function generateMetadata(): Promise<Metadata> {
  const { brand } = await getTheme();
  const title = brand.name || DEFAULT_BRAND.name;
  return {
    title,
    description: "CRM unificado de correo y WhatsApp con control de SLA",
    manifest: "/manifest.webmanifest",
    applicationName: title,
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title,
    },
    icons: {
      icon: "/icons/icon-192.png",
      // iOS espera 180x180; se genera aparte porque no admite transparencia.
      apple: "/icons/apple-touch-icon.png",
    },
  };
}

async function getTheme(): Promise<{ palette: string; mode: ThemeMode; brand: Brand }> {
  try {
    await initPragmas();
    const [palette, mode, name, logo, primary, accent] = await Promise.all([
      prisma.setting.findUnique({ where: { key: "theme.palette" } }),
      prisma.setting.findUnique({ where: { key: "theme.mode" } }),
      prisma.setting.findUnique({ where: { key: "brand.name" } }),
      prisma.setting.findUnique({ where: { key: "brand.logo" } }),
      prisma.setting.findUnique({ where: { key: "brand.primary" } }),
      prisma.setting.findUnique({ where: { key: "brand.accent" } }),
    ]);
    return {
      palette: palette?.value || DEFAULT_PALETTE,
      mode: mode?.value === "dark" ? "dark" : mode?.value === "light" ? "light" : DEFAULT_MODE,
      brand: {
        name: name?.value || DEFAULT_BRAND.name,
        logo: logo?.value || "",
        primary: isValidHex(primary?.value || "") ? normalizeHex(primary!.value) : DEFAULT_BRAND.primary,
        accent: isValidHex(accent?.value || "") ? normalizeHex(accent!.value) : DEFAULT_BRAND.accent,
      },
    };
  } catch {
    return FALLBACK;
  }
}

const noFlashScript = `(function(){try{var p=localStorage.getItem("crm.theme.palette");var m=localStorage.getItem("crm.theme.mode");var d=document.documentElement;if(p)d.dataset.palette=p;if(m)d.dataset.theme=m;}catch(e){}})();`;

// Todo el CRM depende de la BD y de la sesión, así que nada debe prerenderizarse
// en build: en Vercel el build no tiene por qué alcanzar la base de datos, y
// prerenderizar /api/cron/* ejecutaba consultas en tiempo de compilación.
export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const theme = await getTheme();

  return (
    <html
      lang="es"
      data-palette={theme.palette}
      data-theme={theme.mode}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: noFlashScript }} />
        <style id={BRAND_STYLE_ID} dangerouslySetInnerHTML={{ __html: brandCss(theme.brand) }} />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body>
        <ThemeProvider
          initialPalette={theme.palette}
          initialMode={theme.mode}
          initialBrand={theme.brand}
        >
          {children}
        </ThemeProvider>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
