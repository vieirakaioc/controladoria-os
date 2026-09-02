'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Boxes } from 'lucide-react'

const ABAS = [
  { href: '/imobilizado', rotulo: 'Fila' },
  { href: '/imobilizado/quadro', rotulo: 'Quadro' },
  { href: '/imobilizado/matriz', rotulo: 'Matriz' },
  { href: '/imobilizado/novo', rotulo: 'Novo item' },
  { href: '/imobilizado/processo', rotulo: 'Processo' },
]

export default function LayoutImobilizado({ children }: { children: React.ReactNode }) {
  const caminho = usePathname()

  return (
    <div className="space-y-6 p-6">
      {/* Faixa navy: dá âncora à tela e separa o módulo do resto do portal
          sem precisar de mais uma borda. */}
      <header className="surge overflow-hidden rounded-lg bg-navy-700 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="shrink-0 rounded-md bg-white/10 p-2.5 text-white">
              <Boxes size={22} />
            </div>
            <div>
              <h1 className="text-[22px] font-semibold leading-tight text-white">Imobilizado</h1>
              <p className="text-[13px] text-white/70">
                Cada nota de patrimônio percorre as etapas do processo, com a pasta de documentos
                junto.
              </p>
            </div>
          </div>

          <nav className="flex flex-wrap items-center gap-1 rounded-md bg-navy-900/40 p-1">
            {ABAS.map((aba) => {
              // "/imobilizado" é prefixo das demais; só fica ativa exata.
              const ativa =
                aba.href === '/imobilizado' ? caminho === aba.href : caminho.startsWith(aba.href)

              return (
                <Link
                  key={aba.href}
                  href={aba.href}
                  aria-current={ativa ? 'page' : undefined}
                  // Sobre a faixa navy, cinza médio some. navy-100 é claro o
                  // bastante para ler sem esforço, e a hierarquia continua vindo
                  // da pastilha branca da ativa — não de apagar as outras.
                  className={`rounded px-4 py-1.5 text-[13px] font-semibold transition-all ${
                    ativa
                      ? 'bg-white text-navy-700 shadow-sm'
                      : 'text-navy-100 hover:bg-white/10 hover:text-white'
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
