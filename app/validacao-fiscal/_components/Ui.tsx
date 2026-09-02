'use client'

import { AlertTriangle, CalendarClock, CheckCircle2, CircleDot, Database } from 'lucide-react'

import { CORES, COR_PRAZO } from '../_lib/cores'
import { formatarInteiro } from '../_lib/formato'
import type { SituacaoPrazo } from '../_lib/types'

/** Card padrão do módulo. */
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
    <section className={`bg-white rounded-lg border border-slate-200 shadow-sm p-5 ${className}`}>
      {(titulo || acao) && (
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            {titulo && <h2 className="text-base font-bold text-[#063955]">{titulo}</h2>}
            {descricao && <p className="mt-1 text-sm text-slate-500 leading-relaxed">{descricao}</p>}
          </div>
          {acao}
        </div>
      )}
      {children}
    </section>
  )
}

/** Stat tile. Valor em figuras proporcionais — tabulares ficam frouxas grandes. */
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
  const cor = {
    neutro: CORES.marca,
    bom: CORES.bom,
    atencao: CORES.atencao,
    critico: CORES.critico,
  }[tom]

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
      <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">{rotulo}</p>
      <p className="mt-2 text-3xl font-bold leading-none" style={{ color: cor }}>
        {valor}
      </p>
      {detalhe && <p className="mt-2 text-xs text-slate-500 leading-relaxed">{detalhe}</p>}
    </div>
  )
}

const ROTULO: Record<SituacaoPrazo, { texto: string; Icone: typeof CheckCircle2 }> = {
  concluida_no_prazo: { texto: 'Concluída', Icone: CheckCircle2 },
  concluida_com_atraso: { texto: 'Concluída com atraso', Icone: CheckCircle2 },
  atrasada: { texto: 'Atrasada', Icone: AlertTriangle },
  vence_hoje: { texto: 'Vence hoje', Icone: CalendarClock },
  no_prazo: { texto: 'No prazo', Icone: CircleDot },
}

/** Estado do prazo sempre como ícone + texto — a cor nunca informa sozinha. */
export function ChipPrazo({
  situacao,
  complemento,
}: {
  situacao: SituacaoPrazo
  complemento?: string
}) {
  const { texto, Icone } = ROTULO[situacao]
  const cor = COR_PRAZO[situacao]

  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold"
      style={{ borderColor: cor, color: cor }}
    >
      <Icone size={13} className="shrink-0" aria-hidden />
      {texto}
      {complemento && <span className="font-normal text-slate-500">· {complemento}</span>}
    </span>
  )
}

export type ItemBarra = { rotulo: string; valor: number; nota?: string }

/**
 * Lista de barras para comparar magnitude. Série única, então uma cor só e sem
 * legenda — o título do card já diz o que está medido.
 */
export function ListaBarras({
  itens,
  vazio = 'Nada a exibir.',
  limite = 8,
}: {
  itens: ItemBarra[]
  vazio?: string
  limite?: number
}) {
  if (itens.length === 0) return <p className="text-sm text-slate-400">{vazio}</p>

  const exibidos = itens.slice(0, limite)
  const maior = Math.max(...exibidos.map((i) => i.valor), 1)

  return (
    <ul className="flex flex-col gap-3.5">
      {exibidos.map((item) => (
        <li key={item.rotulo}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate text-sm text-slate-700" title={item.rotulo}>
              {item.rotulo}
            </span>
            <span className="shrink-0 text-sm font-bold tabular-nums text-[#063955]">
              {formatarInteiro(item.valor)}
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-2 flex-1 overflow-hidden rounded-sm bg-slate-100">
              <div
                className="h-full rounded-r"
                style={{
                  width: `${Math.max((item.valor / maior) * 100, 1.5)}%`,
                  background: CORES.serie,
                }}
              />
            </div>
            {item.nota && <span className="shrink-0 text-xs text-slate-400">{item.nota}</span>}
          </div>
        </li>
      ))}
      {itens.length > limite && (
        <li className="text-xs text-slate-400">+ {itens.length - limite} fora da lista</li>
      )}
    </ul>
  )
}

export type Segmento = { rotulo: string; valor: number; cor: string }

/**
 * Barra de composição. Segmentos separados por 2px na cor da superfície e
 * legenda com rótulo e número, para a leitura não depender da cor.
 */
export function BarraDistribuicao({ segmentos }: { segmentos: Segmento[] }) {
  const total = segmentos.reduce((soma, s) => soma + s.valor, 0)
  if (total === 0) return <p className="text-sm text-slate-400">Nenhuma tarefa importada ainda.</p>

  return (
    <div>
      <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full">
        {segmentos
          .filter((s) => s.valor > 0)
          .map((s) => (
            <div
              key={s.rotulo}
              style={{ width: `${(s.valor / total) * 100}%`, background: s.cor }}
              title={`${s.rotulo}: ${formatarInteiro(s.valor)}`}
            />
          ))}
      </div>

      <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
        {segmentos.map((s) => (
          <li key={s.rotulo} className="flex items-center gap-2 text-sm">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: s.cor }}
              aria-hidden
            />
            <span className="text-slate-600">{s.rotulo}</span>
            <span className="font-bold tabular-nums text-[#063955]">
              {formatarInteiro(s.valor)}
            </span>
            <span className="text-xs text-slate-400">
              {Math.round((s.valor / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Erro de banco/RLS com o caminho da correção. */
export function AvisoErro({ mensagem }: { mensagem: string }) {
  const faltaTabela = mensagem.includes('validacao-fiscal-schema')

  return (
    <Painel>
      <div className="flex items-start gap-4">
        <div className="rounded-md bg-amber-50 border border-amber-200 p-3">
          <Database size={22} style={{ color: CORES.atencao }} />
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-[#063955]">Não foi possível carregar</h2>
          <p className="mt-2 text-sm text-slate-600 leading-relaxed">{mensagem}</p>

          {faltaTabela && (
            <ol className="mt-4 flex list-decimal flex-col gap-2 pl-5 text-sm text-slate-600 leading-relaxed">
              <li>Abra o Supabase do projeto e vá em SQL Editor.</li>
              <li>
                Cole o conteúdo de{' '}
                <code className="text-[#0f88a8] font-semibold">docs/validacao-fiscal-schema.sql</code>{' '}
                e execute.
              </li>
              <li>Recarregue esta página.</li>
            </ol>
          )}
        </div>
      </div>
    </Painel>
  )
}

/** Placeholder de carregamento no padrão de skeleton do app. */
export function Carregando({ linhas = 3 }: { linhas?: number }) {
  return (
    <div className="space-y-4 animate-pulse">
      {Array.from({ length: linhas }).map((_, i) => (
        <div key={i} className="h-24 rounded-lg bg-white border border-slate-200" />
      ))}
    </div>
  )
}
