'use client'

import { Calendar } from 'lucide-react'
import { MESES, type ViewMode } from '../_lib/types'

type Props = {
  userRole: string
  mesAlvo: number
  anoAlvo: number
  view: ViewMode
  plannerSel: string
  planners: string[]
  setMesAlvo: (n: number) => void
  setAnoAlvo: (n: number) => void
  setView: (v: ViewMode) => void
  setPlannerSel: (p: string) => void
  onNovaAdHoc: () => void
  onRefresh: () => void
  onExportIcs: () => void
}

const views: { id: ViewMode; label: string }[] = [
  { id: 'list', label: 'Lista' },
  { id: 'board', label: 'Status' },
  { id: 'timeboard', label: 'Dias' },
  { id: 'calendar', label: 'Mês' },
]

export function Header({
  userRole, mesAlvo, anoAlvo, view, plannerSel, planners,
  setMesAlvo, setAnoAlvo, setView, setPlannerSel, onNovaAdHoc, onRefresh, onExportIcs,
}: Props) {
  return (
    <header className="flex flex-col xl:flex-row xl:justify-between xl:items-center gap-4 mb-6 bg-white dark:bg-slate-900 p-5 rounded-lg shadow-card border border-line dark:border-slate-800 transition-colors">
      <div>
        <h1 className="text-2xl font-semibold text-ink-900 dark:text-white tracking-tight flex items-center gap-2">
          Painel de Execução
          <span className="text-[10px] uppercase font-bold tracking-widest bg-teal-600/10 text-teal-600 dark:bg-[#38bdf8]/10 dark:text-[#38bdf8] px-2 py-1 rounded-md mt-1">
            {userRole === 'admin' ? 'Visão Admin' : 'Minhas Tarefas'}
          </span>
        </h1>
        <p className="text-ink-500 dark:text-slate-400 text-sm mt-1">
          Mês: {MESES.find(m => m.v === mesAlvo)?.n}/{anoAlvo}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={onNovaAdHoc}
          className="bg-teal-600 hover:bg-[#0c708b] text-white text-sm font-medium py-2 px-4 rounded-md transition-all shadow-sm"
        >
          + Nova Ad Hoc
        </button>

        <div className="flex bg-navy-100 dark:bg-slate-800 rounded-md p-1 border border-line dark:border-slate-700">
          {views.map(v => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${view === v.id ? 'bg-white dark:bg-slate-700 shadow-sm text-navy-700 dark:text-white' : 'text-ink-500 dark:text-slate-400'}`}
            >
              {v.label}
            </button>
          ))}
        </div>

        <select
          className="bg-navy-50 dark:bg-slate-950 border border-line dark:border-slate-800 rounded-md px-3 py-2 text-sm font-medium text-ink-700 dark:text-slate-200 outline-none focus:border-teal-500 transition-colors"
          value={plannerSel}
          onChange={(e) => setPlannerSel(e.target.value)}
        >
          <option value="Todos">Todos os Planners</option>
          {planners.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>

        <select
          className="bg-navy-50 dark:bg-slate-950 border border-line dark:border-slate-800 rounded-md px-3 py-2 text-sm font-medium text-ink-700 dark:text-slate-200 outline-none focus:border-teal-500 transition-colors"
          value={mesAlvo}
          onChange={(e) => setMesAlvo(Number(e.target.value))}
        >
          {MESES.map((m) => <option key={m.v} value={m.v}>{m.n}</option>)}
        </select>

        <input
          className="bg-navy-50 dark:bg-slate-950 border border-line dark:border-slate-800 rounded-md px-3 py-2 text-sm font-medium text-ink-700 dark:text-slate-200 w-24 outline-none focus:border-teal-500 transition-colors"
          type="number"
          value={anoAlvo}
          onChange={(e) => setAnoAlvo(Number(e.target.value))}
        />

        <button
          onClick={onExportIcs}
          title="Baixar .ics pra importar no Google Calendar / Outlook"
          className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-line dark:border-slate-700 hover:bg-navy-50 dark:hover:bg-slate-700 text-ink-700 dark:text-slate-300 text-sm font-medium py-2 px-3 rounded-md transition-all shadow-card"
        >
          <Calendar size={14} /> Calendário
        </button>

        <button
          onClick={onRefresh}
          className="bg-white dark:bg-slate-800 border border-line dark:border-slate-700 hover:bg-navy-50 dark:hover:bg-slate-700 text-ink-700 dark:text-slate-300 text-sm font-medium py-2 px-4 rounded-md transition-all shadow-card"
        >
          ↻ Atualizar
        </button>
      </div>
    </header>
  )
}
