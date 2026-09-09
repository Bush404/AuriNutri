import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "AuriNutri — Plataforma para Nutricionistas",
  description:
    "AuriNutri simplifica a rotina do nutricionista com gestão de pacientes, avaliações antropométricas e planos alimentares — sem a complexidade dos grandes softwares.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="font-sans">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
