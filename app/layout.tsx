import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Sidebar from "@/components/Sidebar"; // Importando o menu lateral
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
      {/* Ajustamos o body para usar flexbox com h-screen e overflow-hidden.
        Isso faz o menu ficar fixo à esquerda e apenas o conteúdo da direita rolar.
      */}
      <body
        className={`${inter.variable} font-sans antialiased text-slate-900 flex h-screen bg-gray-50 overflow-hidden`}
      >
        {/* Renderiza o Menu Lateral (ele mesmo decide se esconde na tela de Login) */}
        <Sidebar />
        
        {/* Onde suas páginas serão carregadas */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </body>
    </html>
  );
}