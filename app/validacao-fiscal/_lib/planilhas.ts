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
  /**
   * Nomes alternativos aceitos para uma coluna (chave = nome canônico).
   *
   * Existe porque a mesma exportação sai com títulos diferentes conforme a
   * versão do relatório. Em vez de recusar o arquivo, a leitura renomeia o
   * apelido para o nome canônico — assim uma planilha antiga e uma nova geram
   * exatamente a mesma tarefa, e a deduplicação continua valendo.
   */
  sinonimos: Record<string, string[]>
}

export const LAYOUTS: LayoutPlanilha[] = [
  {
    origem: 'cte_divergencias',
    rotulo: 'Divergências fiscais',
    assinatura: ['Nº DOCUMENTO', 'VALOR XML', 'VALOR SÊNIOR'],
    colunasMatriz: [
      'Nº DOCUMENTO',
      'MODELO',
      'EMITENTE',
      'VALOR XML',
      'VALOR SÊNIOR',
      'DIFERENÇA',
      'STATUS',
      'OBSERVAÇÃO',
      'ARQUIVO',
    ],
    colunasNumericas: ['Nº DOCUMENTO', 'VALOR XML', 'VALOR SÊNIOR', 'DIFERENÇA'],
    colunasMoeda: ['VALOR XML', 'VALOR SÊNIOR', 'DIFERENÇA'],
    colunasLargas: ['EMITENTE', 'OBSERVAÇÃO'],
    colunasCodigo: ['ARQUIVO'],
    // O relatório antigo saía com VALOR_CTE_*; o "padrão" novo largou o CTE do
    // nome, já que a mesma auditoria traz NFS-e além de CT-e.
    sinonimos: {
      'VALOR XML': ['VALOR_CTE_XML', 'VALOR DO XML', 'VALOR CTE XML'],
      'VALOR SÊNIOR': ['VALOR_CTE_SÊNIOR', 'VALOR DO SÊNIOR', 'VALOR CTE SENIOR'],
      'Nº DOCUMENTO': ['NUMERO DOCUMENTO', 'N DOCUMENTO', 'DOCUMENTO'],
      ARQUIVO: ['NOME DO ARQUIVO', 'CHAVE'],
    },
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
    sinonimos: {
      'Nº Nota Fiscal': ['Numero Nota Fiscal', 'Nota Fiscal', 'Nº NF'],
      'Desc. Situação NF-e': ['Descrição Situação NF-e', 'Situação NF-e'],
      'Chv.Aces.Nf-e': ['Chave de Acesso', 'Chave Acesso NF-e'],
    },
  },
  {
    // NFE_DIVERGENTES e NFSE_DIVERGENTES saem com as mesmas 14 colunas; o que
    // muda entre os dois é o valor de "Modelo" e o nome da última coluna. Um
    // layout só atende os dois, e a matriz separa por modelo na hora de agrupar.
    origem: 'notas_entrada',
    rotulo: 'Notas de entrada',
    // "Fluxo" é o que distingue esta planilha das outras: nenhuma das demais
    // exportações traz essa coluna.
    assinatura: ['Nota Fiscal', 'Fluxo', 'Valor XML'],
    colunasMatriz: [
      'Nota Fiscal',
      'Modelo',
      'Fluxo',
      'Filial',
      'Emitente / Destinatário',
      'Valor XML',
      'Valor Sênior',
      'Diferença',
      'Status',
      'Observação',
      'Empresa',
      'CNPJ da Filial',
      'Arquivo',
    ],
    colunasNumericas: ['Nota Fiscal', 'Filial', 'Valor XML', 'Valor Sênior', 'Diferença'],
    colunasMoeda: ['Valor XML', 'Valor Sênior', 'Diferença'],
    colunasLargas: ['Emitente / Destinatário', 'Observação', 'Empresa'],
    colunasCodigo: ['Arquivo'],
    sinonimos: {
      // O relatório de NF-e chama a mesma coluna de "Obs".
      'Observação': ['Obs', 'Observacao'],
      'Emitente / Destinatário': ['Emitente', 'Destinatário', 'Emitente Destinatario'],
      'Valor Sênior': ['Valor Senior'],
    },
  },
]

/** Todos os nomes aceitos para uma coluna (canônico + apelidos), normalizados. */
export function nomesAceitos(layout: LayoutPlanilha, coluna: string): string[] {
  return [coluna, ...(layout.sinonimos[coluna] ?? [])].map(normalizarCabecalho)
}

/** Traduz um cabeçalho da planilha para o nome canônico da coluna. */
export function canonizarCabecalho(layout: LayoutPlanilha, cabecalho: string): string {
  const alvo = normalizarCabecalho(cabecalho)

  for (const canonico of Object.keys(layout.sinonimos)) {
    if (nomesAceitos(layout, canonico).includes(alvo)) return canonico
  }

  return cabecalho
}

/**
 * Lê uma coluna da linha guardada aceitando os apelidos.
 *
 * É o que mantém legíveis as tarefas importadas antes desta mudança: elas
 * gravaram "VALOR_CTE_XML" no banco, e a matriz agora pede "VALOR XML".
 */
export function valorDaColuna(
  layout: LayoutPlanilha,
  dados: Record<string, string | number | null>,
  coluna: string,
): string | number | null {
  if (coluna in dados) return dados[coluna]

  const aceitos = nomesAceitos(layout, coluna)
  for (const [chave, valor] of Object.entries(dados)) {
    if (aceitos.includes(normalizarCabecalho(chave))) return valor
  }

  return null
}

export function layoutDe(origem: Origem): LayoutPlanilha {
  const layout = LAYOUTS.find((l) => l.origem === origem)
  if (!layout) throw new Error(`Layout desconhecido: ${origem}`)
  return layout
}

// Marcas de acentuação separadas pelo normalize('NFD'). Escrito como escape
// para o arquivo não depender de caracteres combinantes invisíveis.
const ACENTOS = new RegExp('[\\u0300-\\u036f]', 'g')

/**
 * Compara cabeçalhos ignorando o que varia entre exportações: acento, caixa,
 * espaço extra e pontuação. Assim "VALOR_CTE_XML", "Valor CTE XML" e
 * "VALOR-CTE-XML" são a mesma coluna, e "Nº Nota Fiscal" casa com
 * "N. Nota Fiscal" — diferenças que não mudam o significado não podem
 * derrubar uma importação.
 */
export function normalizarCabecalho(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(ACENTOS, '')
    .replace(/[^0-9a-zA-Z]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}
