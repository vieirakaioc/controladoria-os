'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ScanLine } from 'lucide-react'

const ABAS = [
  { href: '/validacao-fiscal', rotulo: 'Dashboard' },
  { href: '/validacao-fiscal/matriz', rotulo: 'Matriz' },
  { href: '/validacao-fiscal/importar', rotulo: 'Importar' },
]

export default function LayoutValidacaoFiscal({ children }: { children: React.ReactNode }) {
  const caminho = usePathname()

  return (
    <div className="p-6 space-y-6">
      <header className="bg-white rounded-lg border border-slate-200 shadow-sm p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-[#063955] p-2.5 text-white shrink-0">
              <ScanLine size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#063955] leading-tight">Validação Fiscal</h1>
              <p className="text-sm text-slate-500">
                Correções geradas das planilhas de divergências, com prazo de resposta por tarefa.
              </p>
            </div>
          </div>

          <nav className="flex flex-wrap items-center gap-1 rounded-md bg-slate-100 p-1">
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
                  className={`rounded-md px-4 py-2 text-sm font-semibold transition-all ${
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
