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
      <header className="surge overflow-hidden rounded-lg bg-navy-700 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="shrink-0 rounded-md bg-white/10 p-2.5 text-white">
              <ScanLine size={22} />
            </div>
            <div>
              <h1 className="text-[22px] font-semibold leading-tight text-white">Validação Fiscal</h1>
              <p className="text-[13px] text-white/70">
                Correções geradas das planilhas de divergências, com prazo de resposta por tarefa.
              </p>
            </div>
          </div>

          <nav className="flex flex-wrap items-center gap-1 rounded-md bg-navy-900/40 p-1">
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
                      ? 'bg-white text-navy-700 shadow-sm'
                      : 'text-ink-500 hover:text-navy-700'
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
