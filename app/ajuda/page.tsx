'use client'

import { BookOpen } from 'lucide-react'
import { Conteudo } from './_components/Conteudo'
import { TocSidebar } from './_components/TocSidebar'

export default function AjudaPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-8 font-sans transition-colors duration-300">
      {/* Hero header — full width como nas outras páginas */}
      <header className="mb-8 bg-gradient-to-br from-[#063955] to-[#0f88a8] dark:from-slate-900 dark:to-slate-800 text-white rounded-lg p-8 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="bg-white/10 backdrop-blur-sm p-3 rounded-md">
            <BookOpen size={32} className="text-[#efc486]" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Manual do Portal</h1>
            <p className="text-white/80 mt-1.5 text-sm font-medium">
              Guia completo de como o Portal da Controladoria funciona, desde importação até score.
            </p>
          </div>
        </div>
      </header>

      {/* Layout fluido: TOC à esquerda + conteúdo ocupando o restante */}
      <div className="flex gap-8">
        <TocSidebar />
        <Conteudo />
      </div>
    </div>
  )
}
