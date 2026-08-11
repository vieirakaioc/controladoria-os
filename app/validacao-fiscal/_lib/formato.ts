/** Formatação de valores para a matriz e o dashboard. */

const MOEDA = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 2,
})

const DECIMAL = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const INTEIRO = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })

export function formatarMoeda(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return '—'
  return MOEDA.format(valor)
}

export function formatarInteiro(valor: number): string {
  return INTEIRO.format(valor)
}

const ISO = /^\d{4}-\d{2}-\d{2}$/

/**
 * Renderiza uma célula da planilha preservando o que ela é.
 *
 * Números inteiros saem sem separador de milhar de propósito: quase todos são
 * identificadores (nº da nota, filial, código de cliente) e "6.307" seria a
 * leitura errada de um número de documento.
 */
export function formatarCelula(
  valor: string | number | null | undefined,
  opcoes: { moeda?: boolean } = {},
): string {
  if (valor === null || valor === undefined || valor === '') return '—'

  if (typeof valor === 'number') {
    if (opcoes.moeda) return MOEDA.format(valor)
    return Number.isInteger(valor) ? String(valor) : DECIMAL.format(valor)
  }

  const texto = valor.trim()
  if (texto === '') return '—'
  if (ISO.test(texto)) {
    const [ano, mes, dia] = texto.split('-')
    return `${dia}/${mes}/${ano}`
  }
  return texto
}
