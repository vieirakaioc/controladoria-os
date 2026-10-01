'use client'

import React, { useState } from 'react'
import { Inbox } from 'lucide-react'

import { TaskCard } from '../TaskCard'
import { QUADRANTES, type Quadrante, type Row } from '../../_lib/types'

type Props = {
  rows: Row[]
  /** task_id da atividade → quadrante escolhido por esta pessoa. */
  mapa: Record<string, Quadrante>
  definir: (taskId: string, quadrante: Quadrante | null) => void
  statuses: string[]
  statusOrderMap: Record<string, number>
  setStatus: (id: string, status: string) => void
  excluirTarefa: (id: string) => void
  abrirDrawer: (r: Row) => void
}

/** O id da atividade — é por ele que a prioridade é gravada. */
const taskIdDe = (r: Row): string => String(r.atividades?.task_id ?? '')

export function EisenhowerView({
  rows,
  mapa,
  definir,
  statuses,
  statusOrderMap,
  setStatus,
  excluirTarefa,
  abrirDrawer,
}: Props) {
  const [sobre, setSobre] = useState<string | null>(null)

  // Uma tarefa concluída não precisa mais ser priorizada; mantê-la na matriz
  // encheria os quadrantes de decisões que já não existem.
  const abertas = rows.filter((r) => !(r.status || '').toLowerCase().includes('concl'))

  // A mesma atividade aparece uma vez por ocorrência no mês. Na matriz ela
  // aparece uma vez só: o que se prioriza é a atividade, não cada data.
  const vistos = new Set<string>()
  const unicas: Row[] = []
  for (const r of abertas) {
    const id = taskIdDe(r)
    if (!id || vistos.has(id)) continue
    vistos.add(id)
    unicas.push(r)
  }

  const porQuadrante = (q: Quadrante) => unicas.filter((r) => mapa[taskIdDe(r)] === q)
  const semClassificar = unicas.filter((r) => !mapa[taskIdDe(r)])

  const soltar = (e: React.DragEvent, destino: Quadrante | null) => {
    e.preventDefault()
    setSobre(null)
    const idTarefa = e.dataTransfer.getData('text/plain')
    const tarefa = rows.find((r) => r.id === idTarefa)
    const taskId = tarefa ? taskIdDe(tarefa) : ''
    if (taskId) definir(taskId, destino)
  }

  const aoPassar = (e: React.DragEvent, chave: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (sobre !== chave) setSobre(chave)
  }

  const cartao = (r: Row) => (
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
  )

  return (
    <div className="space-y-4">
      {/* A fila de quem ainda não foi classificado fica em cima, atravessada:
          é dela que se arrasta, e escondê-la num canto faria a matriz parecer
          vazia no primeiro uso. */}
      <section
        onDragOver={(e) => aoPassar(e, 'sem')}
        onDragLeave={() => setSobre(null)}
        onDrop={(e) => soltar(e, null)}
        className={`rounded-lg border p-3 transition-colors ${
          sobre === 'sem'
            ? 'border-dashed border-teal-500 bg-teal-600/10'
            : 'border-line bg-white dark:border-slate-800 dark:bg-slate-900'
        }`}
      >
        <div className="mb-2 flex items-center gap-2">
          <Inbox size={15} className="text-ink-400" />
          <span className="text-sm font-bold text-navy-700 dark:text-white">Sem prioridade</span>
          <span className="rounded-full border border-line bg-navy-50 px-2 py-0.5 text-xs font-semibold text-ink-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {semClassificar.length}
          </span>
          <span className="ml-auto text-xs text-ink-400">
            Arraste para um quadrante — ou de volta para cá, para tirar a prioridade.
          </span>
        </div>

        {semClassificar.length === 0 ? (
          <p className="px-1 py-3 text-sm text-ink-400">
            Tudo classificado. O que entrar de novo aparece aqui.
          </p>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {semClassificar.map((r) => (
              <div key={r.id} className="w-[290px] shrink-0">
                {cartao(r)}
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {QUADRANTES.map((q) => {
          const tarefas = porQuadrante(q.id)
          const ativo = sobre === q.id

          return (
            <section
              key={q.id}
              onDragOver={(e) => aoPassar(e, q.id)}
              onDragLeave={() => setSobre(null)}
              onDrop={(e) => soltar(e, q.id)}
              className={`flex min-h-[260px] flex-col rounded-lg border transition-colors ${
                ativo ? 'border-dashed border-teal-500 bg-teal-600/10' : `border-line dark:border-slate-800 ${q.fundo}`
              }`}
            >
              {/* Faixa de cor no topo: identifica o quadrante de longe sem
                  tingir os cartões que estão dentro dele. */}
              <div className="h-1 rounded-t-lg" style={{ background: q.cor }} />

              <header className="flex items-baseline gap-2 px-4 py-3">
                <h3 className="text-sm font-bold" style={{ color: q.cor }}>
                  {q.titulo}
                </h3>
                <span className="text-xs text-ink-500 dark:text-slate-400">{q.resumo}</span>
                <span className="ml-auto rounded-full border border-line bg-white px-2 py-0.5 text-xs font-semibold text-ink-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {tarefas.length}
                </span>
              </header>

              <div className="custom-scrollbar max-h-[46vh] flex-1 space-y-3 overflow-y-auto px-3 pb-3">
                {tarefas.length === 0 ? (
                  <p className="px-1 py-6 text-center text-xs text-ink-400">
                    Arraste uma tarefa para cá.
                  </p>
                ) : (
                  tarefas.map(cartao)
                )}
              </div>
            </section>
          )
        })}
      </div>

      <p className="text-xs leading-relaxed text-ink-400">
        A prioridade é sua: ninguém mais vê como você classificou. Ela vale para a atividade, e
        não para a data — classificada uma vez, continua valendo nas próximas ocorrências.
      </p>
    </div>
  )
}
