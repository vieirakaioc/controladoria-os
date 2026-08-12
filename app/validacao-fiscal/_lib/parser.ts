import * as XLSX from 'xlsx'

import {
  LAYOUTS,
  canonizarCabecalho,
  nomesAceitos,
  normalizarCabecalho,
  type LayoutPlanilha,
} from './planilhas'
import type { LinhaPlanilha, Origem, TarefaLida } from './types'

/**
 * Leitura das planilhas de correção fiscal (roda no navegador).
 *
 * O arquivo é identificado pelos próprios cabeçalhos, não pelo nome: o time
 * renomeia os arquivos ao exportar do Sênior, e um upload trocado geraria
 * tarefas silenciosamente erradas.
 *
 * As células são lidas uma a uma em vez de `sheet_to_json` porque é preciso
 * distinguir "zero" de "fórmula sem valor calculado" — o relatório de CT-e é
 * gerado por script e sai sem os resultados em cache.
 */

export class PlanilhaInvalida extends Error {
  constructor(mensagem: string) {
    super(mensagem)
    this.name = 'PlanilhaInvalida'
  }
}

export type LeituraAba = {
  origem: Origem
  aba: string
  tarefas: TarefaLida[]
  /** Linhas ignoradas por não terem documento (totais, rodapé). */
  ignoradas: number
}

/** Valores que a exportação do Sênior usa como "vazio". */
const PLACEHOLDERS = new Set(['00/00/0000', '0:00:00', '00:00:00', '0', '-', '.'])

function ehVazio(valor: string | number | null): boolean {
  if (valor === null) return true
  if (typeof valor === 'number') return valor === 0
  const texto = valor.trim()
  if (texto === '') return true
  if (PLACEHOLDERS.has(texto)) return true
  // Máscaras vazias tipo ".   .   /    -" (CNPJ sem preenchimento).
  return /^[\s.\-/:]+$/.test(texto)
}

function dataISO(data: Date): string {
  return [
    data.getUTCFullYear(),
    String(data.getUTCMonth() + 1).padStart(2, '0'),
    String(data.getUTCDate()).padStart(2, '0'),
  ].join('-')
}

function horaISO(data: Date): string {
  return [
    String(data.getUTCHours()).padStart(2, '0'),
    String(data.getUTCMinutes()).padStart(2, '0'),
    String(data.getUTCSeconds()).padStart(2, '0'),
  ].join(':')
}

/** Reduz uma célula do SheetJS a texto, número ou nulo. */
function valorCelula(celula: XLSX.CellObject | undefined): string | number | null {
  // Sem `v` a célula não tem valor: ou está vazia, ou é fórmula sem cache.
  if (!celula || celula.v === undefined || celula.v === null) return null

  if (celula.t === 'e') return null

  const bruto = celula.v

  if (bruto instanceof Date) {
    // O Excel guarda hora como fração do dia 1899-12-30; sem esse corte toda
    // coluna de hora viraria uma data de 1899 na matriz.
    return bruto.getUTCFullYear() < 1901 ? horaISO(bruto) : dataISO(bruto)
  }

  if (typeof bruto === 'number') return bruto
  if (typeof bruto === 'boolean') return bruto ? 'Sim' : 'Não'

  const texto = String(bruto).trim()
  return texto === '' ? null : texto
}

function lerCabecalhos(aba: XLSX.WorkSheet, faixa: XLSX.Range, linha: number): string[] {
  const cabecalhos: string[] = []
  const vistos = new Map<string, number>()

  for (let coluna = faixa.s.c; coluna <= faixa.e.c; coluna++) {
    const endereco = XLSX.utils.encode_cell({ r: linha, c: coluna })
    const bruto = valorCelula(aba[endereco] as XLSX.CellObject | undefined)
    let nome = bruto === null ? `Coluna ${coluna + 1}` : String(bruto)

    // Cabeçalho repetido viraria sobrescrita silenciosa de dado.
    const repeticoes = vistos.get(nome) ?? 0
    vistos.set(nome, repeticoes + 1)
    if (repeticoes > 0) nome = `${nome} (${repeticoes + 1})`

    cabecalhos[coluna - faixa.s.c] = nome
  }

  return cabecalhos
}

function detectarLayout(cabecalhos: string[]): LayoutPlanilha | null {
  const presentes = new Set(cabecalhos.filter(Boolean).map(normalizarCabecalho))
  return (
    LAYOUTS.find((layout) =>
      layout.assinatura.every((coluna) =>
        nomesAceitos(layout, coluna).some((nome) => presentes.has(nome)),
      ),
    ) ?? null
  )
}

/**
 * Até onde procurar o cabeçalho. Exportações costumam trazer título, filtros
 * ou linhas em branco antes da grade, e exigir cabeçalho na linha 1 recusaria
 * arquivos que têm exatamente a estrutura certa.
 */
const LINHAS_ATE_CABECALHO = 25

type Cabecalho = { linha: number; cabecalhos: string[]; layout: LayoutPlanilha }

function localizarCabecalho(aba: XLSX.WorkSheet, faixa: XLSX.Range): Cabecalho | null {
  const limite = Math.min(faixa.e.r, faixa.s.r + LINHAS_ATE_CABECALHO)

  for (let linha = faixa.s.r; linha <= limite; linha++) {
    const cabecalhos = lerCabecalhos(aba, faixa, linha)
    const layout = detectarLayout(cabecalhos)
    if (layout) return { linha, cabecalhos, layout }
  }

  return null
}

/** O que faltou para a aba ser reconhecida, para a mensagem de erro dizer algo útil. */
function diagnosticar(aba: XLSX.WorkSheet, faixa: XLSX.Range): string {
  const limite = Math.min(faixa.e.r, faixa.s.r + LINHAS_ATE_CABECALHO)
  let melhor: { layout: LayoutPlanilha; faltando: string[] } | null = null

  for (let linha = faixa.s.r; linha <= limite; linha++) {
    const presentes = new Set(
      lerCabecalhos(aba, faixa, linha).filter(Boolean).map(normalizarCabecalho),
    )

    for (const layout of LAYOUTS) {
      const faltando = layout.assinatura.filter(
        (coluna) => !nomesAceitos(layout, coluna).some((nome) => presentes.has(nome)),
      )
      if (!melhor || faltando.length < melhor.faltando.length) melhor = { layout, faltando }
    }
  }

  if (!melhor || melhor.faltando.length === melhor.layout.assinatura.length) {
    return 'nenhuma coluna conhecida foi encontrada'
  }

  return `parece "${melhor.layout.rotulo}", mas falta a coluna ${melhor.faltando
    .map((c) => `"${c}"`)
    .join(', ')}`
}

/** Localiza o valor de uma coluna tolerando variação de acento e caixa. */
function campo(linha: LinhaPlanilha, coluna: string): string | number | null {
  if (coluna in linha) return linha[coluna]
  const alvo = normalizarCabecalho(coluna)
  for (const [chave, valor] of Object.entries(linha)) {
    if (normalizarCabecalho(chave) === alvo) return valor
  }
  return null
}

function texto(linha: LinhaPlanilha, coluna: string): string {
  const valor = campo(linha, coluna)
  return valor === null ? '' : String(valor).trim()
}

function numero(linha: LinhaPlanilha, coluna: string): number | null {
  const valor = campo(linha, coluna)
  if (valor === null) return null
  if (typeof valor === 'number') return valor
  // Exportações em texto vêm como "1.234,56".
  const limpo = valor.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '')
  const convertido = Number(limpo)
  return Number.isFinite(convertido) ? convertido : null
}

function data(linha: LinhaPlanilha, coluna: string): string | null {
  const valor = texto(linha, coluna)
  if (!valor || PLACEHOLDERS.has(valor)) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return valor
  const br = valor.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (br) return `${br[3]}-${br[2]}-${br[1]}`
  return null
}

/** Monta a tarefa a partir da linha, conforme a planilha de origem. */
function montarTarefa(origem: Origem, aba: string, linha: LinhaPlanilha): TarefaLida | null {
  if (origem === 'cte_divergencias') {
    const documento = texto(linha, 'Nº DOCUMENTO')
    const arquivo = texto(linha, 'ARQUIVO')
    if (!documento && !arquivo) return null

    // A coluna DIFERENÇA é a fórmula "VALOR_CTE_XML - VALOR_CTE_SÊNIOR" e o
    // relatório é salvo sem os valores calculados. Reproduzimos a conta da
    // própria planilha para a matriz não exibir a coluna toda vazia.
    if (campo(linha, 'DIFERENÇA') === null) {
      const xml = numero(linha, 'VALOR XML')
      const senior = numero(linha, 'VALOR SÊNIOR')
      if (xml !== null && senior !== null) {
        linha['DIFERENÇA'] = Number((xml - senior).toFixed(2))
      }
    }

    return {
      origem,
      aba: '',
      // A chave de acesso no nome do arquivo é única; o nº do documento se
      // repete entre emitentes e não serve sozinho para deduplicar.
      chave: `cte::${arquivo || documento}`,
      documento,
      tipoDivergencia:
        texto(linha, 'OBSERVAÇÃO') || texto(linha, 'STATUS') || 'Sem classificação',
      emitente: texto(linha, 'EMITENTE'),
      filial: '',
      valor: numero(linha, 'VALOR XML'),
      emissao: null,
      dados: linha,
    }
  }

  const filial = texto(linha, 'Filial')
  const serie = texto(linha, 'Série NF')
  const documento = texto(linha, 'Nº Nota Fiscal')
  if (!documento) return null

  return {
    origem,
    aba,
    chave: `log::${aba}::${filial}::${serie}::${documento}`,
    documento,
    tipoDivergencia: texto(linha, 'Observação') || 'Sem classificação',
    emitente: texto(linha, 'Fantasia') || texto(linha, 'Nome do Cliente'),
    filial,
    valor: numero(linha, 'Valor Bruto'),
    emissao: data(linha, 'Emissão'),
    dados: linha,
  }
}

/**
 * Lê o arquivo e devolve as tarefas por aba reconhecida.
 * Abas sem assinatura conhecida são ignoradas sem erro — a exportação do Sênior
 * costuma trazer abas auxiliares.
 */
export function lerPlanilha(buffer: ArrayBuffer): LeituraAba[] {
  let workbook: XLSX.WorkBook

  try {
    workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  } catch {
    throw new PlanilhaInvalida(
      'Não foi possível abrir o arquivo. Envie a planilha em .xlsx (não use .xls nem .csv).',
    )
  }

  const leituras: LeituraAba[] = []
  const recusadas: string[] = []

  for (const nomeAba of workbook.SheetNames) {
    const aba = workbook.Sheets[nomeAba]
    if (!aba || !aba['!ref']) continue

    const faixa = XLSX.utils.decode_range(aba['!ref'])
    const achado = localizarCabecalho(aba, faixa)

    if (!achado) {
      recusadas.push(`"${nomeAba}": ${diagnosticar(aba, faixa)}`)
      continue
    }

    const { cabecalhos, layout } = achado

    const obrigatorias = new Set(layout.colunasMatriz.map(normalizarCabecalho))
    const tarefas: TarefaLida[] = []
    let ignoradas = 0

    for (let r = achado.linha + 1; r <= faixa.e.r; r++) {
      const linha: LinhaPlanilha = {}
      let temConteudo = false

      for (let c = faixa.s.c; c <= faixa.e.c; c++) {
        const bruto = cabecalhos[c - faixa.s.c]
        if (!bruto) continue

        // Grava sempre com o nome canônico: duas versões do mesmo relatório
        // precisam produzir a mesma linha, senão a matriz fica com colunas
        // vazias e a deduplicação deixa de reconhecer o que já veio antes.
        const cabecalho = canonizarCabecalho(layout, bruto)

        const endereco = XLSX.utils.encode_cell({ r, c })
        const valor = valorCelula(aba[endereco] as XLSX.CellObject | undefined)
        const vazio = ehVazio(valor)

        // Colunas da matriz entram sempre, para a grade ter forma estável.
        // As outras ~190 só entram quando a linha realmente traz valor.
        if (obrigatorias.has(normalizarCabecalho(cabecalho)) || !vazio) {
          linha[cabecalho] = valor
          if (!vazio) temConteudo = true
        }
      }

      if (!temConteudo) continue

      const tarefa = montarTarefa(layout.origem, nomeAba, linha)
      if (tarefa) tarefas.push(tarefa)
      else ignoradas++
    }

    leituras.push({ origem: layout.origem, aba: nomeAba, tarefas, ignoradas })
  }

  if (leituras.length === 0) {
    throw new PlanilhaInvalida(
      'Nenhuma aba reconhecida. O arquivo é identificado pelos cabeçalhos, não pelo nome — ' +
        'pode renomear à vontade, mas os títulos das colunas precisam bater. ' +
        (recusadas.length > 0
          ? `O que encontrei: ${recusadas.join('; ')}.`
          : 'A planilha veio sem nenhuma aba com conteúdo.') +
        ' Se preferir, baixe o modelo na tela de importação e cole os dados nele.',
    )
  }

  return leituras
}
