/**
 * Formatação de entrada do módulo.
 *
 * Duas regras que valem para tudo o que é digitado aqui: texto em caixa alta,
 * porque é assim que os dados chegam do Sênior e das planilhas — e misturar
 * "Comber" com "COMBER" quebraria busca e ordenação; e valor com máscara de
 * moeda, para ninguém precisar decidir se digita ponto ou vírgula.
 */

/** Limite da máscara: R$ 99.999.999,99. */
const MAXIMO_DIGITOS = 10

export function caixaAlta(texto: string): string {
  return texto.toLocaleUpperCase('pt-BR')
}

/**
 * Lê o que a pessoa digitou como centavos.
 *
 * Só os dígitos importam: quem digita "750000" quer R$ 7.500,00, e quem cola
 * "R$ 7.500,00" quer a mesma coisa. Assim o campo aceita os dois sem regra
 * extra na cabeça de quem preenche.
 */
export function moedaDoTexto(bruto: string): number | null {
  const digitos = bruto.replace(/\D/g, '').slice(0, MAXIMO_DIGITOS)
  if (!digitos) return null
  return Number(digitos) / 100
}

export function textoDaMoeda(valor: number | null): string {
  if (valor === null) return ''
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}
