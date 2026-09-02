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
    <div className="flex gap-4 overflow-x-auto pb-4">
      {timeOrder.map((b) => (
        <div
          key={b}
          className={`rounded-lg border flex-1 min-w-[320px] flex flex-col max-h-[75vh] transition-colors ${b === 'Atrasadas' ? 'bg-[#b43a3d]/10 dark:bg-[#b43a3d]/20 border-[#b43a3d]/20 dark:border-[#b43a3d]/30' : 'bg-slate-100/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800'}`}
        >
          <div className={`p-4 border-b flex justify-between items-center rounded-t-2xl transition-colors ${b === 'Atrasadas' ? 'border-[#b43a3d]/30 dark:border-[#b43a3d]/40 text-[#b43a3d] dark:text-[#f87171]' : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'}`}>
            <span className="font-medium">{b}</span>
            <span className="bg-white dark:bg-slate-700 text-xs font-medium px-2 py-0.5 rounded-full shadow-sm">{timeboard[b]?.length || 0}</span>
          </div>
          <div className="p-3 space-y-3 overflow-y-auto flex-1 custom-scrollbar">
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
