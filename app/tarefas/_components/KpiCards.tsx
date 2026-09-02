'use client'

type Stats = {
  total: number
  done: number
  overdue: number
  dueToday: number
  dueTomorrow: number
  next7: number
  pct: number
}

type Props = { stats: Stats; loading: boolean }

const SkeletonNumber = ({ w = 'w-16' }: { w?: string }) => (
  <div className={`h-8 ${w} bg-slate-200 dark:bg-slate-700 rounded-md animate-pulse mt-1`} />
)

const Card = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-lg p-4 shadow-sm transition-colors">
    <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</div>
    {children}
  </div>
)

export function KpiCards({ stats, loading }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-6 gap-3 mb-6">
      <Card label="Total">
        {loading ? <SkeletonNumber /> : <div className="text-2xl font-light text-slate-900 dark:text-white mt-1">{stats.total}</div>}
      </Card>
      <Card label="Atrasadas">
        {loading ? <SkeletonNumber /> : <div className="text-2xl font-light text-[#b43a3d] dark:text-[#f87171] mt-1">{stats.overdue}</div>}
      </Card>
      <Card label="Hoje">
        {loading ? <SkeletonNumber /> : <div className="text-2xl font-light text-[#0f88a8] dark:text-[#38bdf8] mt-1">{stats.dueToday}</div>}
      </Card>
      <Card label="Amanhã">
        {loading ? <SkeletonNumber /> : <div className="text-2xl font-light text-slate-900 dark:text-white mt-1">{stats.dueTomorrow}</div>}
      </Card>
      <Card label="Próx 7 dias">
        {loading ? <SkeletonNumber /> : <div className="text-2xl font-light text-slate-900 dark:text-white mt-1">{stats.next7}</div>}
      </Card>
      <Card label="Concluídas">
        {loading
          ? <SkeletonNumber w="w-24" />
          : <div className="text-2xl font-light text-[#2d6943] dark:text-[#4ade80] mt-1">{stats.done} <span className="text-sm font-medium text-slate-400">({stats.pct}%)</span></div>
        }
      </Card>
    </div>
  )
}
