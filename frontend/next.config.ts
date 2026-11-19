import type { NextConfig } from "next";

function withoutTrailingSlashes(url: string): string {
  let end = url.length;
  while (end > 0 && url[end - 1] === "/") end--;
  return url.slice(0, end);
}

const nextConfig: NextConfig = {
  // Solo aplica a `npm run dev`. Next bloquea su JavaScript de desarrollo para cualquier origen que no sea
  // localhost: si la página se abría como http://127.0.0.1:3000 o con la IP de red ("Network" en la consola),
  // React nunca arrancaba, el estado quedaba en "Conectando…" y el formulario recargaba la página.
  allowedDevOrigins: ["127.0.0.1", "192.168.*.*", "10.*.*.*", "172.*.*.*"],
  turbopack: {
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  rewrites() {
    const apiUrl = withoutTrailingSlashes(process.env.API_URL ?? "http://127.0.0.1:8000");
    return Promise.resolve([
      { source: "/api/:path*", destination: `${apiUrl}/api/:path*` },
      { source: "/health", destination: `${apiUrl}/health` },
    ]);
  },
};

export default nextConfig;
