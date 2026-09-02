'use client'

import { useEffect, useState } from 'react'
import { SECTIONS } from '../_lib/sections'

/**
 * Sidebar de navegação sticky.
 * - Mostra todas as seções
 * - Destaca a que está visível no viewport (IntersectionObserver)
 * - Click rola suavemente até a âncora
 */
export function TocSidebar() {
  const [activeId, setActiveId] = useState<string>(SECTIONS[0].id)

  useEffect(() => {
    const sections = SECTIONS.map(s => document.getElementById(s.id)).filter(Boolean) as HTMLElement[]
    if (sections.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        // Pega a que está mais perto do topo entre as visíveis
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActiveId(visible[0].target.id)
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0 },
    )

    sections.forEach(s => observer.observe(s))
    return () => observer.disconnect()
  }, [])

  return (
    <aside className="hidden lg:block sticky top-6 self-start w-64 shrink-0">
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-lg p-4 shadow-sm">
        <div className="text-[11px] uppercase font-bold tracking-widest text-slate-400 dark:text-slate-500 mb-3 px-2">
          Neste manual
        </div>
        <nav className="space-y-0.5">
          {SECTIONS.map((s, i) => {
            const isActive = s.id === activeId
            return (
              <a
                key={s.id}
                href={`#${s.id}`}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? 'bg-[#0f88a8]/10 dark:bg-[#38bdf8]/10 text-[#0f88a8] dark:text-[#38bdf8] font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span className={`text-[10px] font-mono tabular-nums ${isActive ? 'text-[#0f88a8] dark:text-[#38bdf8]' : 'text-slate-300 dark:text-slate-600'}`}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="truncate">{s.title}</span>
              </a>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}
