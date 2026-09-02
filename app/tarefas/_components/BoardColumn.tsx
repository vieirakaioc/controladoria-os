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

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`rounded-lg border flex-1 min-w-[320px] flex flex-col max-h-[75vh] transition-colors ${isOver ? 'bg-[#0f88a8]/10 dark:bg-[#0f88a8]/20 border-[#0f88a8]/50 border-dashed' : 'bg-slate-100/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800'}`}
    >
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-100/80 dark:bg-slate-800/80 rounded-t-2xl">
        <span className={`font-medium ${isOver ? 'text-[#0f88a8] dark:text-[#7dd3fc]' : 'text-slate-700 dark:text-slate-200'}`}>{status}</span>
        <span className="bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-300 text-xs font-medium px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-600 shadow-sm">{tasks.length}</span>
      </div>
      <div className="p-3 space-y-3 overflow-y-auto flex-1 custom-scrollbar">
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
