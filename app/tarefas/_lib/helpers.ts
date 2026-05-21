import type { TimeBucket } from './types'

// ─── Datas ───────────────────────────────────────────────────────────────
export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

export const addDays = (d: Date, n: number) => {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

export const parseISODateOnly = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

export const iso = (d: Date) => d.toISOString().split('T')[0]

// ─── Buckets de tempo ────────────────────────────────────────────────────
export const getBucket = (data_vencimento: string | null): TimeBucket => {
  if (!data_vencimento) return 'Sem data'
  const today0 = startOfDay(new Date())
  const tomorrow0 = startOfDay(addDays(new Date(), 1))
  const in7 = startOfDay(addDays(new Date(), 7))
  const due = startOfDay(parseISODateOnly(String(data_vencimento).slice(0, 10)))

  if (due < today0) return 'Atrasadas'
  if (due.getTime() === today0.getTime()) return 'Hoje'
  if (due.getTime() === tomorrow0.getTime()) return 'Amanhã'
  if (due > tomorrow0 && due <= in7) return 'Próx 7 dias'
  return 'Oculto'
}

// ─── Badge / cor por status ──────────────────────────────────────────────
export const badge = (s?: string | null) => {
  const st = (s || 'Pendente').toLowerCase()
  if (st.includes('concl')) return 'bg-[#2d6943]/10 text-[#2d6943] dark:bg-[#2d6943]/20 dark:text-[#4ade80]'
  if (st.includes('and')) return 'bg-[#0f88a8]/10 text-[#0f88a8] dark:bg-[#0f88a8]/20 dark:text-[#7dd3fc]'
  if (st.includes('aguard')) return 'bg-[#efc486]/20 text-[#063955] dark:bg-[#efc486]/20 dark:text-[#fde047]'
  if (st.includes('pend')) return 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300'
  return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
}
