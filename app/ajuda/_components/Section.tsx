'use client'

import { SECTIONS } from '../_lib/sections'

type Props = {
  id: string
  title: string
  subtitle?: string
  children: React.ReactNode
}

/**
 * Card de seção do manual. Header com número + título + subtítulo,
 * âncora pra link direto via #id (usado pelo TOC e por anchor copy).
 */
export function Section({ id, title, subtitle, children }: Props) {
  const idx = SECTIONS.findIndex(s => s.id === id)
  const numero = idx >= 0 ? String(idx + 1).padStart(2, '0') : '00'

  return (
    <section
      id={id}
      className="scroll-mt-6 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-lg shadow-sm overflow-hidden mb-6"
    >
      <header className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
        <div className="flex items-baseline gap-3">
          <span className="text-xs font-mono tabular-nums text-slate-300 dark:text-slate-600">
            {numero}
          </span>
          <h2 className="text-xl font-bold text-[#063955] dark:text-white tracking-tight">
            {title}
          </h2>
        </div>
        {subtitle && (
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 ml-7">
            {subtitle}
          </p>
        )}
      </header>
      <div className="p-6 prose prose-sm dark:prose-invert max-w-none">
        {children}
      </div>
    </section>
  )
}
