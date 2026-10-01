'use client'

import React, { useState } from 'react'
import { TaskCard } from './TaskCard'
import type { Row } from '../_lib/types'

type Props = {
  status: string
  tasks: Row[]
  statuses: string[]
  statusOrderMap: Record<string, number>
  setStatus: (id: string, status: string) => void
  excluirTarefa: (id: string) => void
  abrirDrawer: (r: Row) => void
}

export function BoardColumn({ status, tasks, statuses, statusOrderMap, setStatus, excluirTarefa, abrirDrawer }: Props) {
  const [isOver, setIsOver] = useState(false)

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (!isOver) setIsOver(true)
  }
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsOver(false)
  }
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsOver(false)
    const taskId = e.dataTransfer.getData('text/plain')
    const sourceStatus = e.dataTransfer.getData('sourceStatus')
    if (taskId && sourceStatus !== status) setStatus(taskId, status)
  }

  // A coluna tem fundo próprio e os cartões são brancos sobre ele. Antes era
  // branco sobre branco, e a pilha de cartões não se lia como uma coluna.
  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex max-h-[75vh] min-w-[288px] flex-1 flex-col rounded-lg border transition-colors ${
        isOver
          ? 'border-dashed border-teal-500/60 bg-teal-600/10 dark:bg-[#0f88a8]/20'
          : 'border-line bg-navy-100/70 dark:border-slate-800 dark:bg-slate-900/60'
      }`}
    >
      <div className="flex items-center gap-2 px-3 pb-2 pt-2.5">
        <span className={`text-[13px] font-bold ${isOver ? 'text-teal-600 dark:text-[#7dd3fc]' : 'text-navy-700 dark:text-slate-200'}`}>
          {status}
        </span>
        <span className="num ml-auto rounded-full border border-line bg-white px-2 py-0.5 text-[11px] font-semibold text-ink-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          {tasks.length}
        </span>
      </div>
      <div className="custom-scrollbar flex-1 space-y-2 overflow-y-auto px-2 pb-2">
        {tasks.map((r) => (
          <TaskCard
            key={r.id}
            r={r}
            mode="default"
            statuses={statuses}
            statusOrderMap={statusOrderMap}
            setStatus={setStatus}
            excluirTarefa={excluirTarefa}
            abrirDrawer={abrirDrawer}
          />
        ))}
      </div>
    </div>
  )
}
