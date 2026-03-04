import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Sidebar from "@/components/Sidebar";
import RouteGuard from "@/components/RouteGuard"; // <-- Importamos o Guarda
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Controladoria OS",
  description: "Sistema de gestão de tarefas e processos",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-br">
      <body
        className={`${inter.variable} font-sans antialiased text-slate-900 flex h-screen bg-slate-50 overflow-hidden`}
      >
        {/* O RouteGuard envolve tudo! Se não tiver login, ele nem deixa renderizar o resto */}
        <RouteGuard>
          <Sidebar />
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </RouteGuard>
      </body>
    </html>
  );
}