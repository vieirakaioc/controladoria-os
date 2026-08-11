import type { SituacaoPrazo } from './types'

/**
 * Cores da Validação Fiscal.
 *
 * As três de status foram validadas contra a superfície branca dos cards:
 * banda de luminosidade, piso de croma, separação para daltonismo (pior par
 * ΔE 10,5) e contraste ≥ 3:1 — todas aprovadas. "Concluída" usa cinza de
 * de-ênfase de propósito: um quarto tom cromático ao lado dos outros três
 * reprovava o piso de visão normal, então esse estado sai do canal de cor e
 * se apoia no rótulo, que sempre acompanha.
 */
export const CORES = {
  /** Azul-petróleo da marca — títulos e superfícies escuras. */
  marca: '#063955',
  /** Teal de ação: botões, item ativo, foco. */
  acao: '#0f88a8',
  /** Barra de gráfico (série única, magnitude). */
  serie: '#0f88a8',
  bom: '#0e7a3c',
  atencao: '#c98500',
  critico: '#b1272d',
  concluido: '#94a3b8',
} as const

export const COR_PRAZO: Record<SituacaoPrazo, string> = {
  concluida_no_prazo: CORES.concluido,
  concluida_com_atraso: CORES.concluido,
  atrasada: CORES.critico,
  vence_hoje: CORES.atencao,
  no_prazo: CORES.bom,
}
