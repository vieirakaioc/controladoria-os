'use client'

import React from 'react'
import { badge, getBucket } from '../_lib/helpers'
import { apenasSubtarefas, type ChecklistItem, type Row } from '../_lib/types'
import { getResponsaveis } from '@/lib/responsaveis'

type Props = {
  r: Row
  mode: 'default' | 'timeboard'
  statuses: string[]
  statusOrderMap: Record<string, number>
  setStatus: (id: string, status: string) => void
  excluirTarefa: (id: string) => void
  abrirDrawer: (r: Row) => void
}

/**
 * Iniciais de quem responde, para o círculo do cartão.
 *
 * Primeira e última palavra do nome: "Vithoria Gabrielly" vira VG, e não VI —
 * o sobrenome distingue mais do que a segunda letra do primeiro nome.
 */
function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '?'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

/** Cor do círculo, estável por pessoa: o mesmo nome nunca troca de cor. */
const CORES_PESSOA = ['bg-navy-700', 'bg-teal-600', 'bg-cyan-600', 'bg-navy-500', 'bg-teal-700']
function corDaPessoa(nome: string): string {
  let soma = 0
  for (let i = 0; i < nome.length; i++) soma += nome.charCodeAt(i)
  return CORES_PESSOA[soma % CORES_PESSOA.length]
}

export const TaskCard = React.memo(function TaskCard({
  r, mode, statuses, statusOrderMap, setStatus, excluirTarefa, abrirDrawer,
}: Props) {
  const atv = r.atividades || {}
  const st = r.status || statuses[0] || 'Pendente'
  const bucket = getBucket(r.data_vencimento)
  const isDone = st.toLowerCase().includes('concl')

  // Bloco é título, não se conclui: contá-lo faria "3 de 5" nunca chegar a 5.
  const chk = apenasSubtarefas(r.checklists)
  const chkTotal = chk.length
  const chkDone = chk.filter((c: ChecklistItem) => c.concluido).length

  const responsaveisAtuais = getResponsaveis(atv)
  const nomesResponsaveis = responsaveisAtuais.length > 0 ? responsaveisAtuais.map((res) => res.nome).join(', ') : '—'

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', r.id)
    e.dataTransfer.setData('sourceStatus', st)
    setTimeout(() => { if (e.target instanceof HTMLElement) e.target.classList.add('opacity-40') }, 0)
  }

  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    if (e.target instanceof HTMLElement) e.target.classList.remove('opacity-40')
  }

  const prevSt = statuses[Math.max((statusOrderMap[st] ?? 0) - 1, 0)]
  const nextSt = statuses[Math.min((statusOrderMap[st] ?? 0) + 1, statuses.length - 1)]

  /*
   * Etiquetas de cor no lugar de palavras.
   *
   * Projeto, classificação e atraso ocupavam caixas de texto no rodapé e
   * dobravam a altura do cartão. Viram barras: a cor identifica de relance e o
   * nome inteiro fica no title e no detalhe da tarefa. É o que faz caber o
   * dobro de tarefas na coluna sem rolar.
   */
  const etiquetas: { cor: string; titulo: string }[] = []
  if (bucket === 'Atrasadas' && !isDone) etiquetas.push({ cor: 'bg-negativo', titulo: 'Atrasada' })
  if (atv.projeto_id) etiquetas.push({ cor: 'bg-navy-500', titulo: 'Projeto' })
  if (atv.classificacao) etiquetas.push({ cor: 'bg-teal-500', titulo: String(atv.classificacao) })

  const prazoTexto = r.data_vencimento
    ? String(r.data_vencimento).slice(0, 10).split('-').reverse().slice(0, 2).join('/')
    : null

  const prazoEstilo = isDone
    ? 'bg-navy-50 text-ink-500 dark:bg-slate-800 dark:text-slate-400'
    : bucket === 'Atrasadas'
      ? 'bg-negativo-bg text-negativo dark:bg-[#b43a3d]/20 dark:text-[#f87171]'
      : bucket === 'Hoje'
        ? 'bg-alerta-bg text-alerta dark:bg-[#c98a00]/20 dark:text-amber-300'
        : 'bg-teal-50 text-teal-700 dark:bg-teal-600/15 dark:text-teal-300'

  return (
    <div
      draggable={mode === 'default'}
      onDragStart={mode === 'default' ? handleDragStart : undefined}
      onDragEnd={mode === 'default' ? handleDragEnd : undefined}
      className={`group flex select-none flex-col gap-[7px] rounded-lg border border-line bg-white p-[9px] shadow-card transition-all hover:-translate-y-px hover:shadow-card-hover dark:border-slate-800 dark:bg-slate-900 ${
        mode === 'default' ? 'cursor-grab active:cursor-grabbing' : ''
      } ${isDone ? 'opacity-70' : ''}`}
    >
      {etiquetas.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {etiquetas.map((e) => (
            <span key={e.titulo} title={e.titulo} className={`h-2 w-8 rounded ${e.cor}`} />
          ))}
        </div>
      )}

      <div className="pointer-events-none text-[13.5px] font-medium leading-snug text-ink-900 dark:text-white">
        {atv.nome_atividade || '-'}
      </div>

      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-ink-500 dark:text-slate-400">
        {prazoTexto && (
          <span className={`num rounded px-1.5 py-0.5 font-semibold ${prazoEstilo}`} title={`Vencimento ${prazoTexto}`}>
            {isDone ? '✓ ' : bucket === 'Atrasadas' ? 'venceu ' : bucket === 'Hoje' ? 'hoje · ' : ''}
            {prazoTexto}
          </span>
        )}

        {chkTotal > 0 && (
          <span title="Subtarefas concluídas" className="num font-semibold">
            ☑ {chkDone}/{chkTotal}
          </span>
        )}

        {r.anexo_url && <span title="Tem anexo" className="text-teal-600">📎</span>}

        {atv.setores?.nome && (
          <span className="max-w-[90px] truncate" title={String(atv.setores.nome)}>
            {atv.setores.nome}
          </span>
        )}

        {/* O status aparece só na visão por dias: no quadro por status ele é a
            própria coluna onde o cartão está, e repetir seria ruído. */}
        {mode === 'timeboard' && (
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badge(st)}`}>
            {st}
          </span>
        )}

        {/* O círculo guarda o nome inteiro, e o balão aparece na hora. O title
            do navegador leva quase um segundo e some sozinho — pouco para
            conferir de quem é a tarefa, que é a consulta mais frequente aqui.
            Ancorado à direita para não ser cortado pela rolagem da coluna. */}
        <span className="group/quem relative ml-auto shrink-0">
          <span
            tabIndex={0}
            className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white ${corDaPessoa(nomesResponsaveis)}`}
          >
            {iniciais(nomesResponsaveis)}
          </span>
          <span
            role="tooltip"
            className="pointer-events-none absolute bottom-full right-0 z-20 mb-1 hidden whitespace-nowrap rounded-md bg-navy-900 px-2 py-1 text-[11px] font-semibold text-white shadow-pop group-hover/quem:block group-focus-within/quem:block dark:bg-slate-700"
          >
            {nomesResponsaveis}
          </span>
        </span>
      </div>

      {/* Em repouso o cartão mostra só conteúdo; os botões chegam com o mouse.
          É o que tira o rodapé de controles de todos os cartões ao mesmo tempo. */}
      <div className="flex items-center gap-1.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        {mode === 'timeboard' ? (
          !isDone && (
            <button
              onClick={() => setStatus(r.id, statuses[statuses.length - 1] || 'Concluído')}
              className="cursor-pointer rounded border border-[#2d6943]/20 bg-[#2d6943]/10 px-2 py-0.5 text-[11px] font-medium text-[#2d6943] transition-colors hover:bg-[#2d6943]/20 dark:border-[#4ade80]/20 dark:bg-[#2d6943]/20 dark:text-[#4ade80]"
            >
              Concluir
            </button>
          )
        ) : (
          <>
            <button
              onClick={() => setStatus(r.id, prevSt)}
              disabled={st === statuses[0]}
              title="Voltar status"
              className="cursor-pointer rounded border border-line bg-navy-50 px-1.5 py-0.5 text-[11px] text-ink-700 transition-colors hover:bg-navy-100 disabled:opacity-30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              ◀
            </button>
            <button
              onClick={() => setStatus(r.id, nextSt)}
              disabled={st === statuses[statuses.length - 1]}
              title="Avançar status"
              className="cursor-pointer rounded border border-teal-500/20 bg-teal-600/10 px-1.5 py-0.5 text-[11px] text-teal-600 transition-colors hover:bg-teal-600/20 disabled:opacity-30 dark:border-[#0f88a8]/30 dark:bg-[#0f88a8]/20 dark:text-[#7dd3fc]"
            >
              ▶
            </button>
          </>
        )}

        <button
          onClick={() => excluirTarefa(r.id)}
          title="Excluir tarefa"
          className="ml-auto cursor-pointer rounded px-1.5 py-0.5 text-[11px] text-ink-400 transition-colors hover:bg-[#b43a3d]/10 hover:text-[#b43a3d] dark:text-slate-600 dark:hover:text-[#f87171]"
        >
          🗑️
        </button>
        <button
          onClick={() => abrirDrawer(r)}
          className="cursor-pointer rounded border border-line bg-navy-50 px-2 py-0.5 text-[11px] font-medium text-ink-700 transition-colors hover:bg-navy-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
        >
          Detalhes
        </button>
      </div>
    </div>
  )
})
