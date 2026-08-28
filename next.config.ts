import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { APP_HOST, BOOKING_HOST } from "./src/lib/constants/hosts";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Assets de imagen corporativa subidos a Vercel Blob. El subdominio lo
      // asigna Vercel por cuenta, de ahí el comodín.
      { protocol: "https", hostname: "**.public.blob.vercel-storage.com" },
    ],
  },
  experimental: {
    // Dominios desde los que se aceptan Server Actions. Necesario cuando la app
    // se sirve tras un proxy/dominio propio distinto del host interno.
    // El motor de reservas se sirve desde BOOKING_HOST (ver src/middleware.ts).
    serverActions: {
      allowedOrigins: [APP_HOST, BOOKING_HOST, "localhost:3000"],
    },
  },
};

export default withNextIntl(nextConfig);
