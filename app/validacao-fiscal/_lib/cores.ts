import type { SituacaoPrazo } from './types'

/**
 * Cores do portal — paleta institucional Comber, amostrada do logo e já em uso
 * no ai-controller-dashboard.
 *
 * O trio de status foi validado contra a superfície branca dos cards: banda de
 * luminosidade, piso de croma, separação para daltonismo (pior par ΔE 11,0) e
 * piso de visão normal (ΔE 20,4) — todos aprovados. O âmbar fica em 2,87:1 de
 * contraste, abaixo de 3:1, o que é aceito porque status aqui nunca aparece só
 * como cor: vem sempre com ícone e rótulo. "Concluída" usa cinza de de-ênfase
 * de propósito — um quarto tom cromático ao lado dos outros três reprovaria o
 * piso de visão normal.
 */
export const CORES = {
  /** Navy dominante do logo — títulos e superfícies escuras. */
  marca: '#004068',
  /** Teal do símbolo: botões, item ativo, foco. */
  acao: '#10b098',
  /** Barra de gráfico (série única, magnitude). */
  serie: '#10b098',
  bom: '#0e9c82',
  atencao: '#c98a00',
  critico: '#c43a5c',
  concluido: '#8496a5',
} as const

export const COR_PRAZO: Record<SituacaoPrazo, string> = {
  concluida_no_prazo: CORES.concluido,
  concluida_com_atraso: CORES.concluido,
  atrasada: CORES.critico,
  vence_hoje: CORES.atencao,
  no_prazo: CORES.bom,
}
