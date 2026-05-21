'use client'

export const SkeletonCard = () => (
  <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-4 shadow-sm animate-pulse">
    <div className="flex justify-between items-center mb-3"><div className="h-2.5 bg-slate-200 dark:bg-slate-700 rounded w-1/3"></div><div className="h-4 bg-slate-200 dark:bg-slate-700 rounded-md w-16"></div></div>
    <div className="h-3.5 bg-slate-300 dark:bg-slate-600 rounded w-3/4 mb-3"></div>
    <div className="flex gap-1.5 mb-4"><div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-12"></div><div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-16"></div><div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-14"></div></div>
    <div className="flex justify-between items-center mt-4"><div className="flex gap-2"><div className="h-6 bg-slate-100 dark:bg-slate-800 rounded-lg w-6"></div><div className="h-6 bg-slate-100 dark:bg-slate-800 rounded-lg w-6"></div></div><div className="flex gap-1"><div className="h-6 bg-slate-100 dark:bg-slate-800 rounded-lg w-6"></div><div className="h-6 bg-slate-200 dark:bg-slate-700 rounded-lg w-16"></div></div></div>
  </div>
)

export const SkeletonBoard = ({ columns }: { columns: number }) => (
  <div className="flex gap-4 overflow-x-auto pb-4" style={{ gridTemplateColumns: `repeat(${columns}, minmax(300px, 1fr))` }}>
    {Array.from({ length: columns }).map((_, i) => (
      <div key={i} className="rounded-2xl border flex-1 min-w-[320px] flex flex-col max-h-[75vh] bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center rounded-t-2xl bg-white/50 dark:bg-slate-900/50"><div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-24 animate-pulse"></div><div className="h-5 bg-slate-200 dark:bg-slate-700 rounded-full w-8 animate-pulse"></div></div>
        <div className="p-3 space-y-3 overflow-y-auto flex-1"><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>
      </div>
    ))}
  </div>
)

export const SkeletonList = () => (
  <main className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead><tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800">{Array.from({ length: 6 }).map((_, i) => (<th key={i} className="p-4"><div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-20 animate-pulse"></div></th>))}</tr></thead>
        <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">{Array.from({ length: 6 }).map((_, i) => (<tr key={i}><td className="p-4"><div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-20 animate-pulse"></div></td><td className="p-4"><div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-48 animate-pulse"></div></td><td className="p-4"><div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-24 animate-pulse"></div></td><td className="p-4"><div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-32 animate-pulse"></div></td><td className="p-4"><div className="h-5 bg-slate-200 dark:bg-slate-700 rounded-full w-16 animate-pulse"></div></td><td className="p-4 flex justify-end gap-2"><div className="h-6 bg-slate-100 dark:bg-slate-800 rounded w-6 animate-pulse"></div><div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-16 animate-pulse"></div></td></tr>))}</tbody>
      </table>
    </div>
  </main>
)

export const SkeletonCalendar = () => (
  <main className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden animate-pulse">
    <div className="grid grid-cols-7 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">{Array.from({ length: 7 }).map((_, i) => (<div key={i} className="p-3 flex justify-center"><div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-8"></div></div>))}</div>
    <div className="grid grid-cols-7 auto-rows-fr">{Array.from({ length: 35 }).map((_, i) => (<div key={i} className="min-h-[120px] p-2 border-b border-r border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900"><div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-6 mb-2"></div>{i % 3 === 0 && <div className="h-6 bg-slate-50 dark:bg-slate-800/50 rounded w-full mb-1"></div>}{i % 5 === 0 && <div className="h-6 bg-slate-100 dark:bg-slate-800 rounded w-full"></div>}</div>))}</div>
  </main>
)
