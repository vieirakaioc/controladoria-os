'use client'

import { TaskCard } from '../TaskCard'
import type { Row, TimeBucket } from '../../_lib/types'

type Props = {
  timeOrder: TimeBucket[]
  timeboard: Record<string, Row[]>
  statuses: string[]
  statusOrderMap: Record<string, number>
  setStatus: (id: string, status: string) => void
  excluirTarefa: (id: string) => void
  abrirDrawer: (r: Row) => void
}

export function TimeboardView({ timeOrder, timeboard, statuses, statusOrderMap, setStatus, excluirTarefa, abrirDrawer }: Props) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-3">
      {timeOrder.map((b) => (
        <div
          key={b}
          className={`flex max-h-[75vh] min-w-[288px] flex-1 flex-col rounded-lg border transition-colors ${
            b === 'Atrasadas'
              ? 'border-[#b43a3d]/25 bg-[#b43a3d]/10 dark:border-[#b43a3d]/30 dark:bg-[#b43a3d]/20'
              : 'border-line bg-navy-100/70 dark:border-slate-800 dark:bg-slate-900/60'
          }`}
        >
          {/* Faixa de cor no topo da coluna atrasada: identifica de longe sem
              tingir os cartões que estão dentro dela. */}
          {b === 'Atrasadas' && <div className="h-[3px] rounded-t-lg bg-[#b43a3d]" />}

          <div className="flex items-center gap-2 px-3 pb-2 pt-2.5">
            <span className={`text-[13px] font-bold ${b === 'Atrasadas' ? 'text-[#b43a3d] dark:text-[#f87171]' : 'text-navy-700 dark:text-slate-200'}`}>
              {b}
            </span>
            <span className="num ml-auto rounded-full border border-line bg-white px-2 py-0.5 text-[11px] font-semibold text-ink-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {timeboard[b]?.length || 0}
            </span>
          </div>
          <div className="custom-scrollbar flex-1 space-y-2 overflow-y-auto px-2 pb-2">
            {(timeboard[b] || []).map((r) => (
              <TaskCard
                key={r.id}
                r={r}
                mode="timeboard"
                statuses={statuses}
                statusOrderMap={statusOrderMap}
                setStatus={setStatus}
                excluirTarefa={excluirTarefa}
                abrirDrawer={abrirDrawer}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
