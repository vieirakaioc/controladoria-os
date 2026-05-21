'use client'

import { scoreFaixa, type ScoreBreakdown } from '../_lib/score'

export function ScoreBadge({ score }: { score: ScoreBreakdown }) {
  const faixa = scoreFaixa(score.total)
  const textColor = faixa.color.split(' ').find(c => c.startsWith('text-'))
  return (
    <div className="inline-flex flex-col items-center">
      <div className={`relative w-16 h-16 rounded-full border-2 flex items-center justify-center font-bold text-xl tabular-nums ${faixa.color}`}>
        {score.total}
      </div>
      <span className={`text-[11px] uppercase font-bold tracking-wider mt-1.5 ${textColor}`}>
        {faixa.label}
      </span>
    </div>
  )
}
