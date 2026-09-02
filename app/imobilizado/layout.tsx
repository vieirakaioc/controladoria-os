'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Boxes } from 'lucide-react'

const ABAS = [
  { href: '/imobilizado', rotulo: 'Fila' },
  { href: '/imobilizado/quadro', rotulo: 'Quadro' },
  { href: '/imobilizado/novo', rotulo: 'Novo item' },
  { href: '/imobilizado/processo', rotulo: 'Processo' },
]

export default function LayoutImobilizado({ children }: { children: React.ReactNode }) {
  const caminho = usePathname()

  return (
    <div className="space-y-6 p-6">
      <header className="rounded-lg border border-line bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="shrink-0 rounded-md bg-navy-700 p-2.5 text-white">
              <Boxes size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold leading-tight text-navy-700">Imobilizado</h1>
              <p className="text-sm text-ink-500">
                Cada nota de patrimônio percorre as etapas do processo, com a pasta de documentos
                junto.
              </p>
            </div>
          </div>

          <nav className="flex flex-wrap items-center gap-1 rounded-md bg-navy-100 p-1">
            {ABAS.map((aba) => {
              // "/imobilizado" é prefixo das demais; só fica ativa exata.
              const ativa =
                aba.href === '/imobilizado' ? caminho === aba.href : caminho.startsWith(aba.href)

              return (
                <Link
                  key={aba.href}
                  href={aba.href}
                  aria-current={ativa ? 'page' : undefined}
                  className={`rounded-md px-4 py-2 text-sm font-semibold transition-all ${
                    ativa ? 'bg-white text-navy-700 shadow-sm' : 'text-ink-500 hover:text-navy-700'
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
