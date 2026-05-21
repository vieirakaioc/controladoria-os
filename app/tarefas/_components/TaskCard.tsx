'use client'

import React from 'react'
import { badge, getBucket } from '../_lib/helpers'
import type { ChecklistItem, Row } from '../_lib/types'
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

export const TaskCard = React.memo(function TaskCard({
  r, mode, statuses, statusOrderMap, setStatus, excluirTarefa, abrirDrawer,
}: Props) {
  const atv = r.atividades || {}
  const st = r.status || statuses[0] || 'Pendente'
  const bucket = getBucket(r.data_vencimento)
  const isDone = st.toLowerCase().includes('concl')

  const chk = r.checklists || []
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

  return (
    <div
      draggable={mode === 'default'}
      onDragStart={mode === 'default' ? handleDragStart : undefined}
      onDragEnd={mode === 'default' ? handleDragEnd : undefined}
      className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm hover:shadow-md dark:hover:shadow-slate-900/50 hover:-translate-y-0.5 transition-all duration-200 select-none ${mode === 'default' ? 'cursor-grab active:cursor-grabbing' : ''}`}
    >
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
          {r.data_vencimento ? String(r.data_vencimento).slice(0, 10) : '—'} • {bucket}
        </div>
        <div className="flex gap-2 items-center">
          {chkTotal > 0 && <span title="Progresso do Checklist" className="text-[10px] font-bold text-slate-400 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded flex items-center gap-1">☑ {chkDone}/{chkTotal}</span>}
          {r.anexo_url && <span title="Tem anexo" className="text-[#0f88a8]">📎</span>}
          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase ${badge(st)}`}>{st}</span>
        </div>
      </div>

      <div className="text-sm font-medium text-slate-800 dark:text-white leading-snug pointer-events-none">{atv.nome_atividade || '-'}</div>

      <div className="mt-3 flex flex-wrap gap-1.5 pointer-events-none">
        {atv.projeto_id && (
          <span className="bg-[#031D2D]/10 text-[#031D2D] border border-[#031D2D]/20 dark:bg-[#C7A77B]/10 dark:text-[#C7A77B] dark:border-[#C7A77B]/20 px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase">
            Projeto
          </span>
        )}
        {atv.classificacao && (
          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase">
            {atv.classificacao}
          </span>
        )}
        <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded text-[10px] font-medium">{atv.setores?.nome || '—'}</span>
        <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded text-[10px] font-medium truncate max-w-[120px]" title={nomesResponsaveis}>
          {nomesResponsaveis}
        </span>
        <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded text-[10px] font-medium">{atv.planner_name || '—'}</span>
      </div>

      <div className="mt-4 flex gap-2 items-center">
        {mode === 'timeboard' ? (
          <>{!isDone && <button onClick={() => setStatus(r.id, statuses[statuses.length - 1] || 'Concluído')} className="bg-[#2d6943]/10 hover:bg-[#2d6943]/20 dark:bg-[#2d6943]/20 dark:hover:bg-[#2d6943]/40 text-[#2d6943] dark:text-[#4ade80] border border-[#2d6943]/20 dark:border-[#4ade80]/20 font-medium py-1 px-3 rounded-lg transition-colors text-xs cursor-pointer">Concluir</button>}</>
        ) : (
          <>
            <button onClick={() => setStatus(r.id, prevSt)} disabled={st === statuses[0]} className="bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 py-1 px-2 rounded-lg transition-colors disabled:opacity-40 text-xs cursor-pointer">◀</button>
            <button onClick={() => setStatus(r.id, nextSt)} disabled={st === statuses[statuses.length - 1]} className="bg-[#0f88a8]/10 hover:bg-[#0f88a8]/20 dark:bg-[#0f88a8]/20 dark:hover:bg-[#0f88a8]/40 border border-[#0f88a8]/20 dark:border-[#0f88a8]/30 text-[#0f88a8] dark:text-[#7dd3fc] py-1 px-2 rounded-lg transition-colors disabled:opacity-40 text-xs cursor-pointer">▶</button>
          </>
        )}

        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => excluirTarefa(r.id)} className="text-slate-300 dark:text-slate-600 hover:text-[#b43a3d] dark:hover:text-[#f87171] hover:bg-[#b43a3d]/10 dark:hover:bg-[#b43a3d]/20 py-1 px-2 rounded-lg transition-colors text-xs cursor-pointer" title="Excluir Tarefa">🗑️</button>
          <button onClick={() => abrirDrawer(r)} className="bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium py-1 px-3 rounded-lg transition-colors text-xs cursor-pointer">Detalhes</button>
        </div>
      </div>
    </div>
  )
})
