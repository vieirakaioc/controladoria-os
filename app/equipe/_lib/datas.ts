// Helpers de datas pro Monitor

export const iso = (d: Date) => d.toISOString().slice(0, 10)
export const startOfMonth = (year: number, month: number) => new Date(year, month, 1)
export const startOfNextMonth = (year: number, month: number) => new Date(year, month + 1, 1)

/** Conta dias úteis (seg-sex) entre `inicio` (inclusive) e `fim` (exclusive). */
export function diasUteisNoIntervalo(inicio: Date, fim: Date): number {
  let count = 0
  const cur = new Date(inicio)
  while (cur < fim) {
    const dow = cur.getDay()
    if (dow !== 0 && dow !== 6) count++
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

/** Conta dias distintos (yyyy-mm-dd) em uma lista de timestamps ISO. */
export function diasDistintos(timestamps: string[]): number {
  const set = new Set<string>()
  timestamps.forEach(t => set.add(t.slice(0, 10)))
  return set.size
}

/** Conta dias úteis distintos em uma lista de timestamps ISO. */
export function diasUteisDistintos(timestamps: string[]): number {
  const set = new Set<string>()
  timestamps.forEach(t => {
    const dia = t.slice(0, 10)
    const d = new Date(dia + 'T00:00:00')
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) set.add(dia)
  })
  return set.size
}

/** Retorna label tipo "Ativo agora", "Há 2h", "Ontem", "Há 5 dias", "—" */
export function ultimoAcessoLabel(lastActivity: string | null | undefined): string {
  if (!lastActivity) return '—'
  const last = new Date(lastActivity).getTime()
  const now = Date.now()
  const diffMs = now - last
  const diffMin = Math.floor(diffMs / 60000)
  const diffH = Math.floor(diffMin / 60)
  const diffD = Math.floor(diffH / 24)

  if (diffMin < 5) return 'Ativo agora'
  if (diffMin < 60) return `Há ${diffMin} min`
  if (diffH < 24) return `Há ${diffH}h`
  if (diffD === 1) return 'Ontem'
  if (diffD < 7) return `Há ${diffD} dias`
  if (diffD < 30) return `Há ${Math.floor(diffD / 7)} sem`
  return `Há ${Math.floor(diffD / 30)} mês`
}

/** Cor do indicador de presença. */
export function presencaCor(lastActivity: string | null | undefined): string {
  if (!lastActivity) return 'bg-slate-400'
  const diffH = (Date.now() - new Date(lastActivity).getTime()) / 3600000
  if (diffH < 1) return 'bg-emerald-500 animate-pulse'   // online
  if (diffH < 24) return 'bg-emerald-500'                // ativo hoje
  if (diffH < 24 * 7) return 'bg-amber-500'              // semana
  return 'bg-[#b43a3d]'                                  // inativo
}
