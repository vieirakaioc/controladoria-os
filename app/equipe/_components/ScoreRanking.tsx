'use client'

import { BarChart3 } from 'lucide-react'
import type { ColaboradorRow } from '../_hooks/useEquipeData'

/**
 * Gráfico de barras horizontais com o score de cada colaborador.
 * Visualização rápida pro gerente ver quem está bem e quem precisa atenção.
 */
export function ScoreRanking({ colaboradores }: { colaboradores: ColaboradorRow[] }) {
  if (colaboradores.length === 0) return null

  const barColor = (total: number) => {
    if (total >= 85) return 'bg-gradient-to-r from-emerald-500 to-emerald-400'
    if (total >= 70) return 'bg-gradient-to-r from-[#0f88a8] to-[#38bdf8]'
    if (total >= 50) return 'bg-gradient-to-r from-amber-500 to-amber-400'
    return 'bg-gradient-to-r from-[#b43a3d] to-rose-400'
  }

  return (
    <div className="mb-6 bg-white dark:bg-slate-900 rounded-lg shadow-card border border-line dark:border-slate-800 p-6">
      <h3 className="text-sm font-bold text-navy-700 dark:text-white uppercase tracking-wider mb-5 flex items-center gap-2">
        <BarChart3 size={16} className="text-teal-600" /> Score por colaborador
      </h3>

      <div className="space-y-3">
        {colaboradores.map(c => (
          <div key={c.responsavel_id} className="group">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-ink-700 dark:text-slate-200 truncate flex-1">
                {c.nome}
              </span>
              <span className="text-xs text-ink-400 ml-2 mr-2 hidden sm:inline">
                {c.metrics.concluidas}/{c.metrics.totalAtribuidas} · {c.metrics.diasUteisAtivos}d
              </span>
              <span className="text-sm font-bold text-navy-700 dark:text-white tabular-nums w-10 text-right">
                {c.score.total}
              </span>
            </div>
            <div className="h-2.5 bg-navy-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full ${barColor(c.score.total)} transition-all duration-500 ease-out`}
                style={{ width: `${Math.max(2, c.score.total)}%` }}
                title={`Conclusão ${c.score.conclusao}% · Volume ${c.score.volume}% · Pontualidade ${c.score.pontualidade}% · Aderência ${c.score.aderencia}% · Uso ${c.score.uso}%`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
