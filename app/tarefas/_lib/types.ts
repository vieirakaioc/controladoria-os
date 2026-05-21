export type ChecklistItem = { id: string; texto: string; concluido: boolean }

export type Row = {
  id: string
  data_vencimento: string | null
  status: string | null
  data_conclusao: string | null
  observacoes: string | null
  anexo_url?: string | null
  checklists?: ChecklistItem[] | null
  atividades?: any
}

export type PlannerRow = { planner_name: string }
export type StatusRow = { status_name: string; status_order: number }
export type TimeBucket = 'Atrasadas' | 'Hoje' | 'Amanhã' | 'Próx 7 dias' | 'Sem data' | 'Oculto'
export type Lookup = { id: string; nome: string; email?: string }
export type ViewMode = 'list' | 'board' | 'timeboard' | 'calendar'

export const MESES = [
  { v: 0, n: 'Jan' }, { v: 1, n: 'Fev' }, { v: 2, n: 'Mar' }, { v: 3, n: 'Abr' },
  { v: 4, n: 'Mai' }, { v: 5, n: 'Jun' }, { v: 6, n: 'Jul' }, { v: 7, n: 'Ago' },
  { v: 8, n: 'Set' }, { v: 9, n: 'Out' }, { v: 10, n: 'Nov' }, { v: 11, n: 'Dez' },
] as const
