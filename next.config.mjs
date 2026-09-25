/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      // Google exige Digital Asset Links en /.well-known/assetlinks.json para que
      // el APK (Trusted Web Activity) no muestre la barra de URL. Next ignora las
      // carpetas que empiezan con punto, así que se sirve desde /api y se reescribe.
      // El contenido se lee de variables de entorno en cada request, de modo que
      // rotar la huella del certificado no exige rebuild.
      { source: "/.well-known/assetlinks.json", destination: "/api/assetlinks" },
    ];
  },
};

export default nextConfig;
