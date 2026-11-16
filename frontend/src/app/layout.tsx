import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "CrediUCC — Tu próximo paso",
  description: "Solicita y consulta tu microcrédito estudiantil CrediUCC.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full bg-[#f5f7f3] font-sans text-[#1c302c]">{children}</body>
    </html>
  );
}
