'use client'

import { Activity, Clock } from 'lucide-react'
import type { ColaboradorAtividade } from '../_hooks/useHeatmapAtividade'

type Props = {
  loading: boolean
  matrizEquipe: number[][]
  maxEquipe: number
  porColaborador: ColaboradorAtividade[]
  inicio: Date
  fim: Date
  totalEventos: number
}

const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

// Escala de cores: vazio → 5 tons de verde
function corCell(valor: number, max: number) {
  if (max === 0 || valor === 0) return 'bg-slate-100 dark:bg-slate-800/40'
  const ratio = valor / max
  if (ratio >= 0.75) return 'bg-emerald-600 dark:bg-emerald-500'
  if (ratio >= 0.50) return 'bg-emerald-500 dark:bg-emerald-500/80'
  if (ratio >= 0.25) return 'bg-emerald-400 dark:bg-emerald-500/60'
  if (ratio >= 0.10) return 'bg-emerald-300 dark:bg-emerald-500/40'
  return 'bg-emerald-200 dark:bg-emerald-500/25'
}

const fmtData = (d: Date) =>
  `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`

export function HeatmapAtividade({
  loading, matrizEquipe, maxEquipe, porColaborador, inicio, fim, totalEventos,
}: Props) {
  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-12 text-center text-[#0f88a8] dark:text-[#38bdf8] font-medium animate-pulse">
        A calcular padrão de atividade dos últimos 30 dias...
      </div>
    )
  }

  if (totalEventos === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-12 text-center text-slate-500 dark:text-slate-400">
        Sem dados de atividade ainda. Rode <code>docs/user-activity-schema.sql</code> no Supabase pra começar o tracking.
      </div>
    )
  }

  // Pico da equipe — dia/hora com mais atividade
  let pico = { dia: '', hora: 0, valor: 0 }
  matrizEquipe.forEach((row, d) => row.forEach((v, h) => {
    if (v > pico.valor) pico = { dia: DIAS[d], hora: h, valor: v }
  }))

  return (
    <div className="space-y-6">
      {/* Cabeçalho com info do período */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500/10 dark:bg-emerald-500/20 p-2.5 rounded-xl text-emerald-600 dark:text-emerald-400">
              <Activity size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#063955] dark:text-white">
                Padrão de Atividade da Equipe
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {fmtData(inicio)} → {fmtData(fim)} · {totalEventos.toLocaleString('pt-BR')} interações registradas
              </p>
            </div>
          </div>
          {pico.valor > 0 && (
            <div className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-lg px-3 py-2 border border-slate-200 dark:border-slate-700">
              <Clock size={11} className="inline mr-1 text-emerald-500" />
              <strong>Pico:</strong> {pico.dia}, {String(pico.hora).padStart(2, '0')}h ({pico.valor} interações)
            </div>
          )}
        </div>
      </div>

      {/* Heatmap principal: 7 linhas × 24 colunas */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-6">
        <h4 className="text-sm font-bold text-[#063955] dark:text-white uppercase tracking-wider mb-4">
          Quando a equipe trabalha
        </h4>

        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            {/* Cabeçalho de horas */}
            <div className="flex items-center pl-12 mb-1">
              {Array.from({ length: 24 }).map((_, h) => (
                <div key={h} className="w-6 text-center">
                  <span className={`text-[9px] font-mono ${h % 3 === 0 ? 'text-slate-500 dark:text-slate-400' : 'text-slate-300 dark:text-slate-600'}`}>
                    {h % 3 === 0 ? String(h).padStart(2, '0') : ''}
                  </span>
                </div>
              ))}
            </div>

            {/* Linhas: cada dia da semana */}
            {DIAS.map((dia, d) => (
              <div key={dia} className="flex items-center mb-0.5">
                <div className="w-12 pr-3 text-right">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{dia}</span>
                </div>
                {matrizEquipe[d].map((valor, h) => (
                  <div
                    key={h}
                    className={`w-6 h-6 mx-px rounded ${corCell(valor, maxEquipe)} transition-colors hover:ring-2 hover:ring-[#0f88a8] hover:scale-110`}
                    title={`${dia} ${String(h).padStart(2, '0')}h — ${valor} interações`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Legenda de cor */}
        <div className="mt-5 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>Menos</span>
          <div className="w-4 h-4 rounded bg-slate-100 dark:bg-slate-800/40" />
          <div className="w-4 h-4 rounded bg-emerald-200 dark:bg-emerald-500/25" />
          <div className="w-4 h-4 rounded bg-emerald-300 dark:bg-emerald-500/40" />
          <div className="w-4 h-4 rounded bg-emerald-400 dark:bg-emerald-500/60" />
          <div className="w-4 h-4 rounded bg-emerald-500 dark:bg-emerald-500/80" />
          <div className="w-4 h-4 rounded bg-emerald-600 dark:bg-emerald-500" />
          <span>Mais</span>
        </div>
      </div>

      {/* Por colaborador: strip de 24h */}
      {porColaborador.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-6">
          <h4 className="text-sm font-bold text-[#063955] dark:text-white uppercase tracking-wider mb-4">
            Horários preferidos de cada colaborador
          </h4>
          <div className="space-y-2">
            {porColaborador.map(c => {
              const maxIndiv = Math.max(...c.porHora, 1)
              return (
                <div key={c.email} className="flex items-center gap-3 py-1">
                  <div className="w-48 truncate">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{c.email}</span>
                  </div>
                  <div className="flex-1 flex items-center">
                    {c.porHora.map((v, h) => (
                      <div
                        key={h}
                        className={`flex-1 h-5 mx-px rounded ${corCell(v, maxIndiv)} transition-colors hover:ring-1 hover:ring-[#0f88a8]`}
                        title={`${String(h).padStart(2, '0')}h — ${v}`}
                      />
                    ))}
                  </div>
                  <div className="w-16 text-right">
                    <span className="text-xs font-bold tabular-nums text-slate-700 dark:text-slate-200">{c.total}</span>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-3 flex items-center justify-between text-[10px] text-slate-400">
            <span>00h</span>
            <span>06h</span>
            <span>12h</span>
            <span>18h</span>
            <span>23h</span>
          </div>
        </div>
      )}
    </div>
  )
}
