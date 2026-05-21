'use client'

import { TrendingUp, TrendingDown, Minus, History } from 'lucide-react'
import type { HistoricoMes, LinhaHistorico } from '../_hooks/useHistoricoScore'

type Props = {
  linhas: LinhaHistorico[]
  meses: HistoricoMes[]
  loading: boolean
}

/** Pinta a célula com cor da faixa do score. */
function corDoScore(score: number | null | undefined) {
  if (score == null) return 'bg-slate-50 dark:bg-slate-800/30 text-slate-300 dark:text-slate-600'
  if (score >= 85) return 'bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/30'
  if (score >= 70) return 'bg-[#0f88a8]/15 dark:bg-[#38bdf8]/15 text-[#0f88a8] dark:text-[#38bdf8] ring-1 ring-[#0f88a8]/30'
  if (score >= 50) return 'bg-amber-500/15 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/30'
  return 'bg-rose-500/15 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 ring-1 ring-rose-500/30'
}

/** Compara último mês com penúltimo e retorna ícone de tendência. */
function trend(linha: LinhaHistorico) {
  const ult = linha.scores[linha.scores.length - 1]?.total
  const pen = linha.scores[linha.scores.length - 2]?.total
  if (ult == null || pen == null) return null
  const diff = ult - pen
  if (Math.abs(diff) < 3) return { icone: <Minus size={14} />, cor: 'text-slate-400', label: 'estável' }
  if (diff > 0) return { icone: <TrendingUp size={14} />, cor: 'text-emerald-600 dark:text-emerald-400', label: `+${diff}` }
  return { icone: <TrendingDown size={14} />, cor: 'text-rose-600 dark:text-rose-400', label: `${diff}` }
}

export function HistoricoView({ linhas, meses, loading }: Props) {
  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-12 text-center text-[#0f88a8] dark:text-[#38bdf8] font-medium animate-pulse">
        A carregar histórico de 6 meses...
      </div>
    )
  }

  if (linhas.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-12 text-center text-slate-500 dark:text-slate-400">
        Sem dados nos últimos meses pra mostrar histórico.
      </div>
    )
  }

  return (
    <>
      <div className="mb-3 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        <History size={14} className="text-[#C7A77B]" />
        <span>Heatmap de score por colaborador nos últimos {meses.length} meses. Cinza = não teve tarefa no mês.</span>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-950">
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase text-xs tracking-wider">
                <th className="px-4 py-3.5 font-semibold sticky left-0 bg-slate-50 dark:bg-slate-950 z-10">Colaborador</th>
                {meses.map(m => (
                  <th key={`${m.ano}-${m.mes}`} className="px-3 py-3.5 font-semibold text-center min-w-[80px]">
                    {m.label}
                  </th>
                ))}
                <th className="px-4 py-3.5 font-semibold text-center min-w-[100px]">Tendência</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {linhas.map(linha => {
                const t = trend(linha)
                return (
                  <tr key={linha.responsavel_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 sticky left-0 bg-white dark:bg-slate-900 z-10">
                      <div className="font-bold text-[14px] text-[#063955] dark:text-white leading-tight">{linha.nome}</div>
                      {linha.email && <div className="text-[10px] text-slate-400 mt-0.5">{linha.email}</div>}
                    </td>
                    {linha.scores.map((s, i) => (
                      <td key={i} className="px-2 py-3 text-center">
                        <div
                          className={`mx-auto w-12 h-9 flex items-center justify-center rounded-lg font-bold text-sm tabular-nums ${corDoScore(s?.total)}`}
                          title={s ? `Conclusão ${s.conclusao}% · Volume ${s.volume}% · Pontualidade ${s.pontualidade}% · Aderência ${s.aderencia}% · Uso ${s.uso}%` : 'Sem tarefas neste mês'}
                        >
                          {s ? s.total : '—'}
                        </div>
                      </td>
                    ))}
                    <td className="px-4 py-3 text-center">
                      {t ? (
                        <span className={`inline-flex items-center gap-1.5 text-sm font-bold ${t.cor}`}>
                          {t.icone}
                          {t.label}
                        </span>
                      ) : (
                        <span className="text-slate-300 text-sm">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legenda */}
      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
        <span className="font-semibold">Legenda:</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded ring-1 ring-emerald-500/30 bg-emerald-500/15" /> 85+</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded ring-1 ring-[#0f88a8]/30 bg-[#0f88a8]/15" /> 70-84</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded ring-1 ring-amber-500/30 bg-amber-500/15" /> 50-69</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded ring-1 ring-rose-500/30 bg-rose-500/15" /> 0-49</span>
      </div>
    </>
  )
}
