'use client'

import { AlertTriangle, Database, Lock } from 'lucide-react'

import { CORES } from '@/app/validacao-fiscal/_lib/cores'

/** Card padrão do módulo — mesmo desenho do resto do portal. */
export function Painel({
  titulo,
  descricao,
  acao,
  children,
  className = '',
}: {
  titulo?: string
  descricao?: string
  acao?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={`rounded-lg border border-line bg-white p-5 shadow-card ${className}`}>
      {(titulo || acao) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {titulo && <h2 className="text-base font-bold text-navy-700">{titulo}</h2>}
            {descricao && <p className="mt-1 text-sm leading-relaxed text-ink-500">{descricao}</p>}
          </div>
          {acao}
        </div>
      )}
      {children}
    </section>
  )
}

export function Kpi({
  rotulo,
  valor,
  detalhe,
  tom = 'neutro',
}: {
  rotulo: string
  valor: string
  detalhe?: string
  tom?: 'neutro' | 'bom' | 'atencao' | 'critico'
}) {
  const cor = { neutro: '#063955', bom: CORES.bom, atencao: CORES.atencao, critico: CORES.critico }[tom]

  return (
    <div className="rounded-lg border border-line bg-white p-4 shadow-card">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">{rotulo}</p>
      <p className="mt-2 text-3xl font-bold leading-none" style={{ color: cor }}>
        {valor}
      </p>
      {detalhe && <p className="mt-2 text-xs leading-relaxed text-ink-500">{detalhe}</p>}
    </div>
  )
}

export function Carregando({ linhas = 3 }: { linhas?: number }) {
  return (
    <div className="animate-pulse space-y-4">
      {Array.from({ length: linhas }).map((_, i) => (
        <div key={i} className="h-24 rounded-lg border border-line bg-white" />
      ))}
    </div>
  )
}

export function AvisoErro({ mensagem }: { mensagem: string }) {
  const faltaTabela = mensagem.includes('imobilizado-schema')

  return (
    <Painel>
      <div className="flex items-start gap-4">
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
          <Database size={22} style={{ color: CORES.atencao }} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-navy-700">Não foi possível carregar</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-700">{mensagem}</p>
          {faltaTabela && (
            <ol className="mt-4 flex list-decimal flex-col gap-2 pl-5 text-sm leading-relaxed text-ink-700">
              <li>Abra o Supabase do projeto e vá em SQL Editor.</li>
              <li>
                Cole o conteúdo de{' '}
                <code className="font-semibold text-teal-600">docs/imobilizado-schema.sql</code> e
                execute.
              </li>
              <li>Recarregue esta página.</li>
            </ol>
          )}
        </div>
      </div>
    </Painel>
  )
}

export function SemAcesso() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 rounded-lg border border-line bg-white p-10 text-center shadow-card">
      <div className="rounded-md bg-navy-100 p-3 text-ink-400">
        <Lock size={22} />
      </div>
      <h1 className="text-xl font-bold text-navy-700">Acesso restrito</h1>
      <p className="text-sm leading-relaxed text-ink-500">
        O fluxo de imobilizado é visto apenas por quem participa do processo. Peça a um
        administrador para incluir você no cadastro de participantes.
      </p>
    </div>
  )
}

/** Selo de prazo da etapa: ícone e texto, nunca só a cor. */
export function ChipPrazo({ prazo, hoje, concluida }: { prazo: string | null; hoje: string; concluida: boolean }) {
  if (concluida) {
    return <span className="text-xs font-semibold text-ink-400">Concluída</span>
  }
  if (!prazo) return <span className="text-xs text-ink-400">Sem prazo</span>

  const atrasada = prazo < hoje
  const hojeMesmo = prazo === hoje
  const cor = atrasada ? CORES.critico : hojeMesmo ? CORES.atencao : CORES.bom
  const texto = atrasada ? 'Atrasada' : hojeMesmo ? 'Vence hoje' : 'No prazo'

  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold"
      style={{ borderColor: cor, color: cor }}
    >
      {(atrasada || hojeMesmo) && <AlertTriangle size={12} className="shrink-0" aria-hidden />}
      {texto}
    </span>
  )
}
