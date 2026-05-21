// Helpers de "semana corrente" — segunda 00:00 até próxima segunda 00:00.

/** Retorna a segunda-feira da semana que contém `d` (00:00 hora local). */
export function inicioDaSemana(d: Date = new Date()): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  // getDay: 0=domingo, 1=segunda, ..., 6=sábado
  const diff = (x.getDay() + 6) % 7 // 0 se segunda, 6 se domingo
  x.setDate(x.getDate() - diff)
  return x
}

/** Retorna a segunda-feira da PRÓXIMA semana (00:00). */
export function fimDaSemana(d: Date = new Date()): Date {
  const inicio = inicioDaSemana(d)
  inicio.setDate(inicio.getDate() + 7)
  return inicio
}

/** Formata uma data como dd/mm. */
export function ddmm(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Label tipo "12/05 a 18/05" pra exibir no card. */
export function labelSemana(d: Date = new Date()): string {
  const ini = inicioDaSemana(d)
  const fim = fimDaSemana(d)
  // fim é o INÍCIO da próxima semana, então pra exibir o último dia uso fim-1
  const ultimo = new Date(fim)
  ultimo.setDate(ultimo.getDate() - 1)
  return `${ddmm(ini)} a ${ddmm(ultimo)}`
}
