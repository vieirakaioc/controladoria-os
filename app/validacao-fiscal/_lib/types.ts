/**
 * Modelo da Validação Fiscal.
 *
 * Cada linha das planilhas de correção vira uma tarefa. A linha original é
 * guardada inteira em `dados` para a matriz exibir a planilha fielmente; os
 * campos promovidos a coluna existem para filtrar, ordenar e somar.
 */

export type Origem = 'cte_divergencias' | 'situacoes_logistica' | 'notas_entrada'

/**
 * `concluida` e `sem_correcao` são os dois desfechos possíveis: a linha foi
 * corrigida, ou foi conferida e já estava certa. Os dois encerram a tarefa —
 * separá-los é o que deixa a controladoria enxergar quanto do relatório era
 * divergência real.
 */
export type StatusTarefa = 'pendente' | 'em_andamento' | 'concluida' | 'sem_correcao'

/**
 * Entrada = nota recebida (escrita fiscal); saída = documento emitido.
 *
 * Decide quem responde e para qual lista o resumo vai, então sai da planilha
 * quando ela informa, nunca de palpite sobre o nome do arquivo.
 */
export type Fluxo = 'entrada' | 'saida'

/** Encerrada, com ou sem correção. */
export function estaFinalizada(status: StatusTarefa): boolean {
  return status === 'concluida' || status === 'sem_correcao'
}

/** Como a tarefa está em relação ao prazo de resposta. */
export type SituacaoPrazo =
  | 'concluida_no_prazo'
  | 'concluida_com_atraso'
  | 'atrasada'
  | 'vence_hoje'
  | 'no_prazo'

export type LinhaPlanilha = Record<string, string | number | null>

export type TarefaFiscal = {
  id: string
  /** Número da atividade: identidade estável, para citar fora do sistema. */
  numero: number
  loteId: string | null
  origem: Origem
  /** Aba de origem. Vazio para planilhas de aba única. */
  aba: string
  chave: string
  documento: string
  tipoDivergencia: string
  emitente: string
  filial: string
  fluxo: Fluxo
  valor: number | null
  /** YYYY-MM-DD */
  emissao: string | null
  dados: LinhaPlanilha
  status: StatusTarefa
  responsavelId: string | null
  responsavelNome: string | null
  observacaoCorrecao: string | null
  /** Por que a tarefa está parada — com quem está, o que falta. */
  motivoAndamento: string | null
  /** YYYY-MM-DD */
  prazo: string
  concluidoEm: string | null
  concluidoPor: string | null
  criadoEm: string
}

export type LoteImportacao = {
  id: string
  origem: Origem
  arquivo: string
  importadoPor: string | null
  importadoEm: string
  totalLinhas: number
  novas: number
  duplicadas: number
  prazo: string
}

/** Resultado da leitura de um arquivo, antes de ir para o banco. */
export type TarefaLida = {
  origem: Origem
  aba: string
  chave: string
  documento: string
  tipoDivergencia: string
  emitente: string
  filial: string
  fluxo: Fluxo
  valor: number | null
  emissao: string | null
  dados: LinhaPlanilha
}

export type Responsavel = { id: string; nome: string; email?: string | null }

export const ROTULO_ORIGEM: Record<Origem, string> = {
  cte_divergencias: 'Divergências fiscais',
  situacoes_logistica: 'Situações Logística',
  notas_entrada: 'Notas de entrada',
}

export const ROTULO_FLUXO: Record<Fluxo, string> = {
  entrada: 'Notas de entrada',
  saida: 'Notas de saída',
}

export const ROTULO_STATUS: Record<StatusTarefa, string> = {
  pendente: 'Pendente',
  em_andamento: 'Em andamento',
  concluida: 'Corrigida',
  sem_correcao: 'Sem correção',
}
