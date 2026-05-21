'use client'

import { BoardColumn } from '../BoardColumn'
import type { Row } from '../../_lib/types'

type Props = {
  statuses: string[]
  boardStatus: Record<string, Row[]>
  statusOrderMap: Record<string, number>
  setStatus: (id: string, status: string) => void
  excluirTarefa: (id: string) => void
  abrirDrawer: (r: Row) => void
}

export function BoardView({ statuses, boardStatus, statusOrderMap, setStatus, excluirTarefa, abrirDrawer }: Props) {
  return (
    <div
      className="flex gap-4 overflow-x-auto pb-4"
      style={{ gridTemplateColumns: `repeat(${statuses.length}, minmax(300px, 1fr))` }}
    >
      {statuses.map((s) => (
        <BoardColumn
          key={s}
          status={s}
          tasks={boardStatus[s] || []}
          statuses={statuses}
          statusOrderMap={statusOrderMap}
          setStatus={setStatus}
          excluirTarefa={excluirTarefa}
          abrirDrawer={abrirDrawer}
        />
      ))}
    </div>
  )
}
