import { NextResponse } from "next/server";

/**
 * Digital Asset Links para la app Android (Trusted Web Activity).
 *
 * Sin este archivo Chrome muestra la barra de URL dentro del APK y avisa que la
 * app no está verificada. El par (package_name, sha256_cert_fingerprint) debe
 * coincidir exactamente con el del APK firmado.
 *
 * Ambas variables llegan del entorno; si faltan se devuelve un array vacío,
 * que es la respuesta válida que Google interpreta como "sin asociaciones".
 * Ver docs/apk-android.md para obtener la huella.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const packageName = process.env.ANDROID_PACKAGE_NAME?.trim();
  const fingerprint = process.env.ANDROID_SHA256_CERT?.trim();

  const body =
    packageName && fingerprint
      ? [
          {
            relation: ["delegate_permission/common.handle_all_urls"],
            target: {
              namespace: "android_app",
              package_name: packageName,
              sha256_cert_fingerprints: [fingerprint],
            },
          },
        ]
      : [];

  return NextResponse.json(body, {
    headers: {
      "Content-Type": "application/assetlinks.json; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
