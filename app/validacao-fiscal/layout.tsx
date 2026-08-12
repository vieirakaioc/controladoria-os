'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Lock, ScanLine } from 'lucide-react'

import { useAuthGate } from '@/app/tarefas/_hooks/useAuthGate'

import { podeVerValidacaoFiscal } from './_lib/acesso'

const ABAS = [
  { href: '/validacao-fiscal', rotulo: 'Dashboard' },
  { href: '/validacao-fiscal/matriz', rotulo: 'Matriz' },
  { href: '/validacao-fiscal/importar', rotulo: 'Importar' },
]

export default function LayoutValidacaoFiscal({ children }: { children: React.ReactNode }) {
  const caminho = usePathname()
  const { userRole, userEmail, authLoaded } = useAuthGate()

  const liberado = podeVerValidacaoFiscal(userRole, userEmail)

  // Tela em branco enquanto o papel não chegou, para não piscar o conteúdo
  // para quem não pode vê-lo. Quem barra de verdade é o RLS; isto é a camada
  // que evita mostrar um módulo vazio e confuso.
  if (!authLoaded) return <div className="p-6" />

  if (!liberado) {
    return (
      <div className="p-6">
        <div className="mx-auto flex max-w-xl flex-col items-center gap-4 rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <div className="rounded-xl bg-slate-100 p-3 text-slate-400">
            <Lock size={22} />
          </div>
          <h1 className="text-xl font-bold text-[#063955]">Acesso restrito</h1>
          <p className="text-sm leading-relaxed text-slate-500">
            A Validação Fiscal é usada apenas pela controladoria responsável pelas correções. Fale
            com um administrador se precisar acompanhar este módulo.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <header className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-[#063955] p-2.5 text-white shrink-0">
              <ScanLine size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#063955] leading-tight">Validação Fiscal</h1>
              <p className="text-sm text-slate-500">
                Correções geradas das planilhas de divergências, com prazo de resposta por tarefa.
              </p>
            </div>
          </div>

          <nav className="flex flex-wrap items-center gap-1 rounded-xl bg-slate-100 p-1">
            {ABAS.map((aba) => {
              // "/validacao-fiscal" é prefixo das demais; só fica ativa exata.
              const ativa =
                aba.href === '/validacao-fiscal'
                  ? caminho === aba.href
                  : caminho.startsWith(aba.href)

              return (
                <Link
                  key={aba.href}
                  href={aba.href}
                  aria-current={ativa ? 'page' : undefined}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                    ativa
                      ? 'bg-white text-[#063955] shadow-sm'
                      : 'text-slate-500 hover:text-[#063955]'
                  }`}
                >
                  {aba.rotulo}
                </Link>
              )
            })}
          </nav>
        </div>
      </header>

      {children}
    </div>
  )
}
