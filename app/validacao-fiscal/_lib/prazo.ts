import { estaFinalizada, type SituacaoPrazo, type StatusTarefa } from './types'

/** Prazo de resposta em dias úteis, contados da data de importação. */
export const PRAZO_DIAS_UTEIS = 3

const FUSO = 'America/Sao_Paulo'

/**
 * Datas aqui são sempre strings YYYY-MM-DD. O app roda no navegador de quem
 * usa e é hospedado em servidor UTC; tratar prazo como data civil pura evita
 * a tarefa "vencer" à meia-noite errada.
 */

/** Data de hoje no fuso de Brasília, como YYYY-MM-DD. */
export function hoje(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function paraUTC(data: string): Date {
  const [ano, mes, dia] = data.split('-').map(Number)
  return new Date(Date.UTC(ano, mes - 1, dia))
}

/** Soma dias úteis (pula sábado e domingo; feriados não são considerados). */
export function somarDiasUteis(inicio: string, dias: number): string {
  const data = paraUTC(inicio)
  let restantes = dias

  while (restantes > 0) {
    data.setUTCDate(data.getUTCDate() + 1)
    const diaSemana = data.getUTCDay()
    if (diaSemana !== 0 && diaSemana !== 6) restantes--
  }

  return data.toISOString().slice(0, 10)
}

/** Prazo de resposta de um lote importado hoje. */
export function calcularPrazo(base: string = hoje()): string {
  return somarDiasUteis(base, PRAZO_DIAS_UTEIS)
}

/** Diferença em dias corridos (negativa se `fim` já passou). */
export function diasEntre(inicio: string, fim: string): number {
  return Math.round((paraUTC(fim).getTime() - paraUTC(inicio).getTime()) / 86_400_000)
}

export function situacaoPrazo(
  status: StatusTarefa,
  prazo: string,
  concluidoEm: string | null,
  referencia: string = hoje(),
): SituacaoPrazo {
  if (estaFinalizada(status)) {
    const dataConclusao = concluidoEm?.slice(0, 10) ?? referencia
    return dataConclusao > prazo ? 'concluida_com_atraso' : 'concluida_no_prazo'
  }
  if (referencia > prazo) return 'atrasada'
  if (referencia === prazo) return 'vence_hoje'
  return 'no_prazo'
}

export const ROTULO_PRAZO: Record<SituacaoPrazo, string> = {
  concluida_no_prazo: 'Concluída no prazo',
  concluida_com_atraso: 'Concluída com atraso',
  atrasada: 'Atrasada',
  vence_hoje: 'Vence hoje',
  no_prazo: 'No prazo',
}

/** Texto curto de prazo: "2 dias", "vence hoje", "3 dias em atraso". */
export function textoPrazo(prazo: string, referencia: string = hoje()): string {
  const dias = diasEntre(referencia, prazo)
  if (dias === 0) return 'vence hoje'
  if (dias < 0) return `${Math.abs(dias)} ${Math.abs(dias) === 1 ? 'dia' : 'dias'} em atraso`
  return `${dias} ${dias === 1 ? 'dia' : 'dias'}`
}

/** Formata YYYY-MM-DD como DD/MM/AAAA. */
export function formatarData(data: string | null): string {
  if (!data) return '—'
  const [ano, mes, dia] = data.slice(0, 10).split('-')
  return `${dia}/${mes}/${ano}`
}
