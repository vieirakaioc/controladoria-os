// =============================================================================
// Score de Desempenho 0-100 (5 dimensões, pesos configuráveis pelo admin)
//
//   conclusão     = concluidas / totalAtribuidas             × 100
//   volume        = concluidas / maxConcluidasDoMes          × 100   ← NOVO
//   pontualidade  = concluidasNoPrazo / concluidas           × 100
//   aderência     = (totalAtribuidas - atrasadas) / total    × 100
//   uso           = diasUteisAtivos / diasUteisPeriodo       × 100
//
//   score = somatório (cada_dim × peso) / 100
//
// O Volume corrige o viés de quem tem poucas tarefas — quem produz em
// absoluto mais ganha pontos, sem zerar a importância da taxa.
// =============================================================================

export type ScoreWeights = {
  conclusao: number      // 0..100
  volume: number         // 0..100
  pontualidade: number   // 0..100
  aderencia: number      // 0..100
  uso: number            // 0..100
}

export const DEFAULT_WEIGHTS: ScoreWeights = {
  conclusao: 45,
  volume: 25,
  pontualidade: 15,
  aderencia: 10,
  uso: 5,
}

/** Metadado de cada dimensão pra UI (label + descrição + cor de destaque). */
export const SCORE_DIMENSIONS: {
  key: keyof ScoreWeights
  label: string
  short: string
  desc: string
  accent: string
}[] = [
  {
    key: 'conclusao',
    label: 'Conclusão',
    short: 'Concl.',
    desc: 'Quanto a pessoa fez. % concluídas sobre o total atribuído no período.',
    accent: '#0f88a8',
  },
  {
    key: 'volume',
    label: 'Volume',
    short: 'Vol.',
    desc: 'Produção absoluta. Compara a quantidade concluída com a maior do mês. Corrige o viés de quem tem poucas tarefas.',
    accent: '#063955',
  },
  {
    key: 'pontualidade',
    label: 'Pontualidade',
    short: 'Pont.',
    desc: 'Qualidade do que entregou. % das concluídas que saíram dentro do prazo.',
    accent: '#2d6943',
  },
  {
    key: 'aderencia',
    label: 'Aderência',
    short: 'Ader.',
    desc: 'Disciplina. % de tarefas atribuídas que não viraram atraso.',
    accent: '#7c3aed',
  },
  {
    key: 'uso',
    label: 'Uso do App',
    short: 'Uso',
    desc: 'Engajamento com a ferramenta. % de dias úteis em que entrou no app.',
    accent: '#C7A77B',
  },
]

export type Metrics = {
  totalAtribuidas: number
  concluidas: number
  concluidasNoPrazo: number
  atrasadas: number
  pendentes: number
  diasUteisAtivos: number
  diasUteisPeriodo: number
  /** Maior número de concluídas no período (referência pro cálculo de Volume). */
  maxConcluidasNoPeriodo: number
}

export type ScoreBreakdown = {
  total: number              // 0..100 (já ponderado)
  conclusao: number          // 0..100 bruto
  volume: number             // 0..100 bruto
  pontualidade: number       // 0..100 bruto
  aderencia: number          // 0..100 bruto
  uso: number                // 0..100 bruto
  weights: ScoreWeights
}

const safePct = (num: number, den: number) =>
  den <= 0 ? 0 : Math.round((num / den) * 100)

export function computeScore(m: Metrics, weights: ScoreWeights = DEFAULT_WEIGHTS): ScoreBreakdown {
  const conclusao    = safePct(m.concluidas, m.totalAtribuidas)
  const volume       = safePct(m.concluidas, m.maxConcluidasNoPeriodo)
  const pontualidade = safePct(m.concluidasNoPrazo, m.concluidas)
  const aderencia    = safePct(m.totalAtribuidas - m.atrasadas, m.totalAtribuidas)
  const uso          = safePct(m.diasUteisAtivos, m.diasUteisPeriodo)

  const total = Math.round(
    (conclusao    * weights.conclusao
    + volume       * weights.volume
    + pontualidade * weights.pontualidade
    + aderencia    * weights.aderencia
    + uso          * weights.uso) / 100,
  )

  return { total, conclusao, volume, pontualidade, aderencia, uso, weights }
}

/** Helper visual: classifica o score em faixa de cor/label. */
export function scoreFaixa(total: number): { label: string; color: string } {
  if (total >= 85) return { label: 'Excelente', color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30' }
  if (total >= 70) return { label: 'Bom',       color: 'text-[#0f88a8] dark:text-[#38bdf8] bg-[#0f88a8]/10 border-[#0f88a8]/30' }
  if (total >= 50) return { label: 'Regular',   color: 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30' }
  return                  { label: 'Atenção',   color: 'text-[#b43a3d] dark:text-[#f87171] bg-[#b43a3d]/10 border-[#b43a3d]/30' }
}

/** Soma dos pesos. Útil pra UI validar se está em 100. */
export const sumWeights = (w: ScoreWeights) =>
  w.conclusao + w.volume + w.pontualidade + w.aderencia + w.uso
