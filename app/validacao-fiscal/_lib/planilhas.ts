import type { Origem } from './types'

/**
 * Layout de cada planilha aceita pela importação.
 *
 * `colunasMatriz` é a ordem em que os campos aparecem na matriz — escolhida
 * para bater com a leitura da planilha original. A linha inteira continua
 * guardada na tarefa; a matriz mostra o restante no painel de detalhe.
 */

export type LayoutPlanilha = {
  origem: Origem
  rotulo: string
  /** Cabeçalhos que identificam a planilha (comparados sem acento/caixa). */
  assinatura: string[]
  colunasMatriz: string[]
  /** Colunas alinhadas à direita por conterem número. */
  colunasNumericas: string[]
  /** Colunas formatadas como moeda. */
  colunasMoeda: string[]
  /** Texto corrido: ganha largura e quebra em duas linhas em vez de cortar. */
  colunasLargas: string[]
  /** Chaves longas (44 dígitos): fonte mono e só o fim, que é o que distingue. */
  colunasCodigo: string[]
}

export const LAYOUTS: LayoutPlanilha[] = [
  {
    origem: 'cte_divergencias',
    rotulo: 'Divergências CT-e',
    assinatura: ['Nº DOCUMENTO', 'VALOR_CTE_XML', 'VALOR_CTE_SÊNIOR'],
    colunasMatriz: [
      'Nº DOCUMENTO',
      'MODELO',
      'EMITENTE',
      'VALOR_CTE_XML',
      'VALOR_CTE_SÊNIOR',
      'DIFERENÇA',
      'STATUS',
      'OBSERVAÇÃO',
      'ARQUIVO',
    ],
    colunasNumericas: ['Nº DOCUMENTO', 'VALOR_CTE_XML', 'VALOR_CTE_SÊNIOR', 'DIFERENÇA'],
    colunasMoeda: ['VALOR_CTE_XML', 'VALOR_CTE_SÊNIOR', 'DIFERENÇA'],
    colunasLargas: ['EMITENTE', 'OBSERVAÇÃO'],
    colunasCodigo: ['ARQUIVO'],
  },
  {
    origem: 'situacoes_logistica',
    rotulo: 'Situações Logística',
    assinatura: ['Filial', 'Desc. Situação NF-e', 'Nº Nota Fiscal'],
    // A planilha traz 208 colunas, quase todas zeradas. Estas são as que
    // descrevem a correção; as demais ficam no painel de detalhe da linha.
    colunasMatriz: [
      'Filial',
      'Série NF',
      'Nº Nota Fiscal',
      'Fantasia',
      'Desc. Situação NF-e',
      'Descrição (Sit.)',
      'Observação',
      'Nome do Cliente',
      'UF Cliente',
      'Cidade Cliente',
      'Valor Bruto',
      'Emissão',
      'Placa',
      'Tns. Serviço',
      'Esp. Doc.',
      'Nome do Representante',
      'Chv.Aces.Nf-e',
    ],
    colunasNumericas: ['Filial', 'Nº Nota Fiscal', 'Valor Bruto'],
    colunasMoeda: ['Valor Bruto'],
    colunasLargas: [
      'Fantasia',
      'Desc. Situação NF-e',
      'Descrição (Sit.)',
      'Observação',
      'Nome do Cliente',
      'Nome do Representante',
    ],
    colunasCodigo: ['Chv.Aces.Nf-e'],
  },
]

export function layoutDe(origem: Origem): LayoutPlanilha {
  const layout = LAYOUTS.find((l) => l.origem === origem)
  if (!layout) throw new Error(`Layout desconhecido: ${origem}`)
  return layout
}

// Marcas de acentuação separadas pelo normalize('NFD'). Escrito como escape
// para o arquivo não depender de caracteres combinantes invisíveis.
const ACENTOS = new RegExp('[\\u0300-\\u036f]', 'g')

/** Compara cabeçalhos ignorando acento, caixa, espaço extra e ponto final. */
export function normalizarCabecalho(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(ACENTOS, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\.$/, '')
    .toUpperCase()
}
