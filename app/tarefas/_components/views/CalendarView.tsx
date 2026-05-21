'use client'

import { badge } from '../../_lib/helpers'
import type { Row } from '../../_lib/types'

type CalendarData = {
  diasVaziosInicio: string[]
  diasDoMes: { dia: number; dataString: string; tarefas: Row[]; isHoje: boolean }[]
  diasVaziosFim: string[]
}

type Props = {
  data: CalendarData
  abrirDrawer: (r: Row) => void
}

const HEADERS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export function CalendarView({ data, abrirDrawer }: Props) {
  return (
    <main className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden transition-colors">
      <div className="grid grid-cols-7 border-b border-slate-100 dark:border-slate-800 bg-[#063955] dark:bg-slate-950">
        {HEADERS.map(d => (
          <div key={d} className="p-3 text-center text-xs font-bold text-white uppercase tracking-wider">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 auto-rows-fr bg-slate-100 dark:bg-slate-800 gap-[1px]">
        {data.diasVaziosInicio.map(id => (
          <div key={id} className="min-h-[140px] bg-slate-50/50 dark:bg-slate-900/50" />
        ))}

        {data.diasDoMes.map(diaInfo => (
          <div
            key={diaInfo.dia}
            className={`min-h-[140px] p-2 bg-white dark:bg-slate-900 flex flex-col transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/80 ${diaInfo.isHoje ? 'ring-2 ring-inset ring-[#0f88a8] dark:ring-[#38bdf8] bg-[#0f88a8]/5 dark:bg-[#0f88a8]/10' : ''}`}
          >
            <div className="flex justify-between items-start mb-2">
              <span className={`text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full ${diaInfo.isHoje ? 'bg-[#0f88a8] dark:bg-[#38bdf8] text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'}`}>
                {diaInfo.dia}
              </span>
              {diaInfo.tarefas.length > 0 && (
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 rounded">{diaInfo.tarefas.length}</span>
              )}
            </div>

            <div className="flex-1 space-y-1.5 overflow-y-auto max-h-[100px] custom-scrollbar pr-1">
              {diaInfo.tarefas.map(t => (
                <div
                  key={t.id}
                  onClick={() => abrirDrawer(t)}
                  className={`text-[10px] leading-tight p-1.5 rounded cursor-pointer font-medium border border-black/5 dark:border-white/5 hover:shadow-md transition-all truncate flex items-center justify-between gap-1 ${badge(t.status)}`}
                  title={`${t.atividades?.nome_atividade} (${t.status})`}
                >
                  <span className="truncate">{t.anexo_url && '📎 '} {t.atividades?.nome_atividade || 'Tarefa'}</span>
                  {t.atividades?.classificacao && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" title={t.atividades.classificacao} />}
                </div>
              ))}
            </div>
          </div>
        ))}

        {data.diasVaziosFim.map(id => (
          <div key={id} className="min-h-[140px] bg-slate-50/50 dark:bg-slate-900/50" />
        ))}
      </div>
    </main>
  )
}
