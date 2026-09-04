'use client'

import { AlertTriangle, Database, Lock, PauseCircle } from 'lucide-react'

/**
 * Peças visuais do módulo, na linguagem institucional do portal.
 *
 * Quem separa o painel do fundo é a sombra em navy, não uma cor de fundo: numa
 * tela que se lê por meia hora, fundo colorido compete com o dado.
 */

type Estado = 'neutro' | 'positivo' | 'alerta' | 'negativo'

/** Faixa de 3px na borda esquerda — sinaliza estado sem tingir o cartão. */
const FAIXA: Record<Estado, string> = {
  neutro: '',
  positivo: 'before:bg-positivo',
  alerta: 'before:bg-alerta',
  negativo: 'before:bg-negativo',
}

const COM_FAIXA = "before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:content-['']"

export function Painel({
  titulo,
  descricao,
  acao,
  estado = 'neutro',
  children,
  className = '',
}: {
  titulo?: string
  descricao?: string
  acao?: React.ReactNode
  estado?: Estado
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={`panel surge relative overflow-hidden p-5 ${
        estado !== 'neutro' ? `${COM_FAIXA} ${FAIXA[estado]}` : ''
      } ${className}`}
    >
      {(titulo || acao) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {titulo && (
              <h2 className="text-[15px] font-semibold leading-tight text-navy-700">{titulo}</h2>
            )}
            {descricao && (
              <p className="mt-1 max-w-prose text-[13px] leading-relaxed text-ink-500">
                {descricao}
              </p>
            )}
          </div>
          {acao}
        </div>
      )}
      {children}
    </section>
  )
}

/**
 * Indicador.
 *
 * Rótulo miúdo, número grande, detalhe fraco — a hierarquia faz o número ser
 * lido primeiro, que é a razão de o cartão existir. O estado aparece na faixa
 * lateral e no tom do número, nunca só numa cor de fundo.
 */
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
  const estado: Estado = { neutro: 'neutro', bom: 'positivo', atencao: 'alerta', critico: 'negativo' }[
    tom
  ] as Estado

  const corDoNumero = {
    neutro: 'text-navy-900',
    bom: 'text-positivo',
    atencao: 'text-alerta',
    critico: 'text-negativo',
  }[tom]

  return (
    <div
      className={`panel panel-hover surge relative overflow-hidden p-4 ${
        estado !== 'neutro' ? `${COM_FAIXA} ${FAIXA[estado]}` : ''
      }`}
    >
      <p className="eyebrow truncate">{rotulo}</p>
      <p className={`num mt-1.5 truncate text-[26px] font-semibold leading-none ${corDoNumero}`}>
        {valor}
      </p>
      {detalhe && <p className="mt-2 text-[11px] leading-relaxed text-ink-400">{detalhe}</p>}
    </div>
  )
}

export function Carregando({ linhas = 3 }: { linhas?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: linhas }).map((_, i) => (
        <div key={i} className="panel h-24 animate-pulse" />
      ))}
    </div>
  )
}

export function AvisoErro({ mensagem }: { mensagem: string }) {
  const faltaTabela = mensagem.includes('imobilizado-schema')

  return (
    <Painel estado="alerta">
      <div className="flex items-start gap-4">
        <div className="rounded-md border border-alerta-border bg-alerta-bg p-3">
          <Database size={22} className="text-alerta" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] font-semibold text-navy-700">Não foi possível carregar</h2>
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
    <div className="panel surge mx-auto flex max-w-xl flex-col items-center gap-4 p-10 text-center">
      <div className="rounded-md bg-navy-100 p-3 text-navy-400">
        <Lock size={22} />
      </div>
      <h1 className="text-[19px] font-semibold text-navy-700">Acesso restrito</h1>
      <p className="text-sm leading-relaxed text-ink-500">
        O fluxo de imobilizado é visto apenas por quem participa do processo. Peça a um
        administrador para incluir você no cadastro de participantes.
      </p>
    </div>
  )
}

/**
 * Selo de prazo da etapa: ícone e texto, nunca só a cor.
 *
 * Etapa bloqueada não tem prazo porque ainda não é a vez dela — dizer "sem
 * prazo" faria parecer configuração faltando.
 */
export function ChipPrazo({
  prazo,
  hoje,
  concluida,
  bloqueada = false,
  emEspera = false,
}: {
  prazo: string | null
  hoje: string
  concluida: boolean
  bloqueada?: boolean
  /** Item parado esperando terceiro: o prazo não corre, e não pode acusar atraso. */
  emEspera?: boolean
}) {
  if (concluida) {
    return (
      <span className="rounded-full bg-navy-50 px-2.5 py-1 text-[11px] font-semibold text-ink-400">
        Concluída
      </span>
    )
  }
  if (bloqueada) {
    return <span className="text-[11px] text-ink-400">Aguardando a anterior</span>
  }
  // Antes do prazo, de propósito: com o item em espera o prazo existe mas não
  // corre, e mostrá-lo como "atrasada" cobraria de quem não está devendo.
  if (emEspera) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-navy-200 bg-navy-50 px-2.5 py-1 text-[11px] font-semibold text-navy-700">
        <PauseCircle size={11} className="shrink-0" aria-hidden />
        Em espera
      </span>
    )
  }
  if (!prazo) return <span className="text-[11px] text-ink-400">Sem prazo</span>

  const atrasada = prazo < hoje
  const hojeMesmo = prazo === hoje

  const estilo = atrasada
    ? 'bg-negativo-bg text-negativo border-negativo-border'
    : hojeMesmo
      ? 'bg-alerta-bg text-alerta border-alerta-border'
      : 'bg-positivo-bg text-positivo border-positivo-border'

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold ${estilo}`}
    >
      {(atrasada || hojeMesmo) && <AlertTriangle size={11} className="shrink-0" aria-hidden />}
      {atrasada ? 'Atrasada' : hojeMesmo ? 'Vence hoje' : 'No prazo'}
    </span>
  )
}
