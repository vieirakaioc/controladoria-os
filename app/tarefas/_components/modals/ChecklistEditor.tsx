'use client'

import { useState } from 'react'
import type { ChecklistItem } from '../../_lib/types'

type Props = {
  items: ChecklistItem[]
  onChange: (items: ChecklistItem[]) => void
}

export function ChecklistEditor({ items, onChange }: Props) {
  const [novo, setNovo] = useState('')

  const add = () => {
    if (!novo.trim()) return
    const newItem: ChecklistItem = { id: crypto.randomUUID(), texto: novo, concluido: false }
    onChange([...items, newItem])
    setNovo('')
  }

  const toggle = (id: string) => {
    onChange(items.map(c => c.id === id ? { ...c, concluido: !c.concluido } : c))
  }

  const remove = (id: string) => {
    onChange(items.filter(c => c.id !== id))
  }

  const doneCount = items.filter(c => c.concluido).length

  return (
    <div className="bg-navy-50 dark:bg-slate-800/50 p-4 rounded-md border border-line dark:border-slate-700/50">
      <div className="flex justify-between items-center mb-3">
        <label className="text-xs text-navy-700 dark:text-slate-300 font-bold tracking-wide uppercase">
          Subtarefas / Checklist
        </label>
        {items.length > 0 && (
          <span className="text-[10px] font-bold text-teal-600 dark:text-[#38bdf8] bg-teal-600/10 dark:bg-[#38bdf8]/10 px-2 py-0.5 rounded-full">
            {doneCount} de {items.length} concluídas
          </span>
        )}
      </div>

      <div className="space-y-2 mb-3">
        {items.map(c => (
          <div key={c.id} className="flex items-center gap-2 bg-white dark:bg-slate-800 p-2 rounded-md border border-line dark:border-slate-700 shadow-card group">
            <input
              type="checkbox"
              checked={c.concluido}
              onChange={() => toggle(c.id)}
              className="w-4 h-4 text-teal-600 rounded border-line-strong focus:ring-[#0f88a8] cursor-pointer"
            />
            <span className={`flex-1 text-sm transition-all ${c.concluido ? 'line-through text-ink-400 dark:text-slate-500' : 'text-ink-700 dark:text-slate-200'}`}>
              {c.texto}
            </span>
            <button
              onClick={() => remove(c.id)}
              className="text-ink-400 dark:text-slate-500 hover:text-[#b43a3d] dark:hover:text-[#f87171] opacity-0 group-hover:opacity-100 transition-opacity px-1"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          value={novo}
          onChange={e => setNovo(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          placeholder="Adicionar novo passo..."
          className="flex-1 bg-transparent border border-line dark:border-slate-700 dark:text-white rounded-md px-3 py-2 text-sm outline-none focus:border-teal-500"
        />
        <button
          onClick={add}
          className="bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-ink-700 dark:text-slate-200 px-3 rounded-md text-sm font-medium transition-colors"
        >
          Adicionar
        </button>
      </div>
    </div>
  )
}
