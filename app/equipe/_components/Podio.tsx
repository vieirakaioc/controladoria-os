'use client'

import { Trophy, Medal, Award } from 'lucide-react'
import type { ColaboradorRow } from '../_hooks/useEquipeData'
import { scoreFaixa } from '../_lib/score'

const ICONES = [Trophy, Medal, Award]
const CORES_BG = [
  'from-amber-100 to-amber-50 dark:from-amber-500/20 dark:to-amber-500/5 border-amber-200 dark:border-amber-500/30',
  'from-slate-100 to-slate-50 dark:from-slate-700/30 dark:to-slate-700/10 border-line dark:border-slate-600',
  'from-orange-100 to-orange-50 dark:from-orange-500/20 dark:to-orange-500/5 border-orange-200 dark:border-orange-500/30',
]
const CORES_ICONE = [
  'text-amber-500 dark:text-amber-400',
  'text-ink-500 dark:text-slate-300',
  'text-orange-500 dark:text-orange-400',
]
const TITULOS = ['🥇 1º Lugar', '🥈 2º Lugar', '🥉 3º Lugar']

export function Podio({ colaboradores }: { colaboradores: ColaboradorRow[] }) {
  const top3 = colaboradores.slice(0, 3)
  if (top3.length === 0) return null

  return (
    <div className="mb-6">
      <h3 className="text-sm font-bold text-navy-700 dark:text-white uppercase tracking-wider mb-3 flex items-center gap-2">
        <Trophy size={16} className="text-amber-500" /> Destaque do mês
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {top3.map((c, idx) => {
          const Icon = ICONES[idx]
          const faixa = scoreFaixa(c.score.total)
          return (
            <div
              key={c.responsavel_id}
              className={`rounded-lg p-5 border bg-gradient-to-br ${CORES_BG[idx]} relative overflow-hidden`}
            >
              <div className="flex items-start justify-between mb-3">
                <Icon size={32} className={CORES_ICONE[idx]} />
                <span className="text-[10px] uppercase font-bold tracking-widest text-ink-700 dark:text-slate-300">
                  {TITULOS[idx]}
                </span>
              </div>
              <div className="font-bold text-navy-700 dark:text-white text-lg leading-tight">{c.nome}</div>
              {c.email && (
                <div className="text-xs text-ink-500 dark:text-slate-400 truncate">{c.email}</div>
              )}
              <div className="mt-4 flex items-end justify-between">
                <div>
                  <div className={`text-3xl font-light ${faixa.color.split(' ').find(c => c.startsWith('text-'))}`}>
                    {c.score.total}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-ink-500 dark:text-slate-400 font-bold">
                    Score
                  </div>
                </div>
                <div className="text-right text-xs text-ink-700 dark:text-slate-300">
                  <div>{c.metrics.concluidas}/{c.metrics.totalAtribuidas} concluídas</div>
                  <div className="text-ink-400 mt-0.5">{c.metrics.diasUteisAtivos}/{c.metrics.diasUteisPeriodo} dias ativos</div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
