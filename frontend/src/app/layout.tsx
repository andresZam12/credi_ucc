import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "CrediUCC — Simulador de microcrédito",
  description: "Simula y solicita tu microcrédito estudiantil CrediUCC.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es-CO" className="h-full antialiased">
      <body className="min-h-full font-sans text-base text-ink">{children}</body>
    </html>
  );
}
