'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Workflow = {
  id: string
  planner_name: string
}

type StatusRow = {
  id: string
  workflow_id: string
  status_name: string
  status_order: number
}

export default function WorkflowsPage() {
  const [mensagem, setMensagem] = useState('')
  const [loading, setLoading] = useState(true)

  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [plannerSel, setPlannerSel] = useState<string>('')

  const [workflowId, setWorkflowId] = useState<string>('')
  const [statuses, setStatuses] = useState<StatusRow[]>([])

  const [novoStatus, setNovoStatus] = useState('')

  const plannerOptions = useMemo(() => workflows.map(w => w.planner_name).sort(), [workflows])

  const loadWorkflows = async () => {
    setLoading(true)
    setMensagem('')
    try {
      const { data, error } = await supabase
        .from('planner_workflows')
        .select('id, planner_name')
        .order('planner_name', { ascending: true })

      if (error) throw error

      const ws = (data || []) as Workflow[]
      setWorkflows(ws)

      if (!plannerSel && ws.length) setPlannerSel(ws[0].planner_name)
    } catch (e: any) {
      console.error(e)
      setMensagem('❌ Erro ao carregar workflows.')
    } finally {
      setLoading(false)
    }
  }

  const loadStatuses = async (plannerName: string) => {
    setLoading(true)
    setMensagem('')
    try {
      const { data: wf, error: e1 } = await supabase
        .from('planner_workflows')
        .select('id, planner_name')
        .eq('planner_name', plannerName)
        .single()

      if (e1) throw e1
      setWorkflowId(wf.id)

      const { data: st, error: e2 } = await supabase
        .from('planner_workflow_statuses')
        .select('id, workflow_id, status_name, status_order')
        .eq('workflow_id', wf.id)
        .order('status_order', { ascending: true })

      if (e2) throw e2
      setStatuses((st || []) as StatusRow[])
    } catch (e: any) {
      console.error(e)
      setMensagem('❌ Erro ao carregar status do planner.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadWorkflows()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!plannerSel) return
    loadStatuses(plannerSel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plannerSel])

  const normalizeOrders = async (list: StatusRow[]) => {
    const normalized = list
      .slice()
      .sort((a, b) => a.status_order - b.status_order)
      .map((s, idx) => ({ ...s, status_order: (idx + 1) * 10 }))

    setStatuses(normalized)

    const payload = normalized.map(s => ({
      id: s.id,
      workflow_id: s.workflow_id,
      status_name: s.status_name,
      status_order: s.status_order,
    }))

    const { error } = await supabase
      .from('planner_workflow_statuses')
      .upsert(payload, { onConflict: 'id' })

    if (error) {
      console.error(error)
      setMensagem('❌ Erro ao normalizar ordem.')
      return
    }

    setMensagem('✅ Ordem organizada!')
    setTimeout(() => setMensagem(''), 1200)
  }

  const addStatus = async () => {
    const name = novoStatus.trim()
    if (!name || !workflowId) return

    setMensagem('Salvando...')
    const maxOrder = statuses.length ? Math.max(...statuses.map(s => s.status_order)) : 0
    const nextOrder = maxOrder + 10

    const { data, error } = await supabase
      .from('planner_workflow_statuses')
      .insert([{ workflow_id: workflowId, status_name: name, status_order: nextOrder }])
      .select('id, workflow_id, status_name, status_order')
      .single()

    if (error) {
      console.error(error)
      setMensagem('❌ Erro ao adicionar (talvez já exista).')
      return
    }

    setStatuses(prev => [...prev, data as any].sort((a, b) => a.status_order - b.status_order))
    setNovoStatus('')
    setMensagem('✅ Status adicionado!')
    setTimeout(() => setMensagem(''), 1200)
  }

  const renameStatus = async (id: string, newName: string) => {
    const name = newName.trim()
    if (!name) return

    setMensagem('Salvando...')
    const { error } = await supabase
      .from('planner_workflow_statuses')
      .update({ status_name: name })
      .eq('id', id)

    if (error) {
      console.error(error)
      setMensagem('❌ Erro ao renomear (nome duplicado?).')
      return
    }

    setStatuses(prev => prev.map(s => (s.id === id ? { ...s, status_name: name } : s)))
    setMensagem('✅ Renomeado!')
    setTimeout(() => setMensagem(''), 900)
  }

  const deleteStatus = async (id: string) => {
    if (!confirm('Deletar esse status?')) return

    setMensagem('Deletando...')
    const { error } = await supabase
      .from('planner_workflow_statuses')
      .delete()
      .eq('id', id)

    if (error) {
      console.error(error)
      setMensagem('❌ Erro ao deletar.')
      return
    }

    const remaining = statuses.filter(s => s.id !== id)
    setStatuses(remaining)
    setMensagem('✅ Deletado!')
    setTimeout(() => setMensagem(''), 1000)

    await normalizeOrders(remaining)
  }

  const swapTwo = async (a: StatusRow, b: StatusRow) => {
    const { error } = await supabase
      .from('planner_workflow_statuses')
      .upsert(
        [
          { id: a.id, workflow_id: a.workflow_id, status_name: a.status_name, status_order: a.status_order },
          { id: b.id, workflow_id: b.workflow_id, status_name: b.status_name, status_order: b.status_order },
        ],
        { onConflict: 'id' }
      )

    if (error) {
      console.error(error)
      setMensagem('❌ Erro ao mover.')
      return false
    }
    return true
  }

  const moveUp = async (idx: number) => {
    if (idx <= 0) return
    setMensagem('Salvando...')

    const list = statuses.slice().sort((a, b) => a.status_order - b.status_order)
    const a = { ...list[idx] }
    const b = { ...list[idx - 1] }

    const tmp = a.status_order
    a.status_order = b.status_order
    b.status_order = tmp

    const ok = await swapTwo(a, b)
    if (!ok) return

    const updated = list.map((s) => {
      if (s.id === a.id) return a
      if (s.id === b.id) return b
      return s
    }).sort((x, y) => x.status_order - y.status_order)

    setStatuses(updated)
    setMensagem('✅ Ordem atualizada!')
    setTimeout(() => setMensagem(''), 900)
  }

  const moveDown = async (idx: number) => {
    if (idx >= statuses.length - 1) return
    setMensagem('Salvando...')

    const list = statuses.slice().sort((a, b) => a.status_order - b.status_order)
    const a = { ...list[idx] }
    const b = { ...list[idx + 1] }

    const tmp = a.status_order
    a.status_order = b.status_order
    b.status_order = tmp

    const ok = await swapTwo(a, b)
    if (!ok) return

    const updated = list.map((s) => {
      if (s.id === a.id) return a
      if (s.id === b.id) return b
      return s
    }).sort((x, y) => x.status_order - y.status_order)

    setStatuses(updated)
    setMensagem('✅ Ordem atualizada!')
    setTimeout(() => setMensagem(''), 900)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <header className="flex justify-between items-center mb-6 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-3xl font-black text-indigo-950 uppercase tracking-tighter">Workflows</h1>
          <p className="text-gray-500 font-medium">Status por Planner</p>
        </div>

        <div className="flex items-center gap-3">
          {mensagem && <span className="text-sm font-bold text-indigo-600 animate-pulse">{mensagem}</span>}
          <button
            onClick={loadWorkflows}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-5 rounded-xl transition-all shadow-md active:scale-95"
          >
            ↻ Atualizar
          </button>
        </div>
      </header>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 mb-6 flex flex-wrap gap-3 items-center">
        <div className="font-black text-gray-900">Planner</div>
        <select
          className="bg-white border border-gray-200 rounded-xl px-3 py-2 font-bold text-gray-700"
          value={plannerSel}
          onChange={(e) => setPlannerSel(e.target.value)}
        >
          {plannerOptions.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        <div className="ml-auto text-sm font-bold text-gray-500">
          {loading ? 'Carregando...' : `${statuses.length} status`}
        </div>
      </div>

      <main className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex flex-wrap gap-3 items-center">
          <input
            value={novoStatus}
            onChange={(e) => setNovoStatus(e.target.value)}
            placeholder="Novo status (ex: Revisão, Bloqueado...)"
            className="border border-gray-200 rounded-xl px-4 py-2 w-full md:w-96 font-semibold"
          />
          <button
            onClick={addStatus}
            disabled={!novoStatus.trim()}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2 px-5 rounded-xl transition-all shadow-md disabled:opacity-50"
          >
            + Adicionar
          </button>

          <button
            onClick={() => normalizeOrders(statuses)}
            className="bg-white border border-gray-200 hover:bg-gray-50 font-black py-2 px-5 rounded-xl transition-all"
          >
            Organizar Ordem
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-indigo-50/50 border-b border-indigo-100 text-indigo-900 text-xs uppercase font-black">
                <th className="p-5">Ordem</th>
                <th className="p-5">Status</th>
                <th className="p-5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {statuses
                .slice()
                .sort((a, b) => a.status_order - b.status_order)
                .map((s, idx) => (
                  <tr key={s.id} className="hover:bg-indigo-50/30 transition-colors">
                    <td className="p-5 font-black text-gray-800">{s.status_order}</td>
                    <td className="p-5">
                      <input
                        defaultValue={s.status_name}
                        onBlur={(e) => {
                          const v = e.target.value
                          if (v.trim() !== s.status_name) renameStatus(s.id, v)
                        }}
                        className="border border-gray-200 rounded-xl px-4 py-2 w-full md:w-96 font-black text-gray-900"
                      />
                      <div className="text-xs text-gray-500 font-semibold mt-1">
                        (edita e sai do campo pra salvar)
                      </div>
                    </td>
                    <td className="p-5">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => moveUp(idx)}
                          disabled={idx === 0}
                          className="bg-white border border-gray-200 hover:bg-gray-50 font-black py-2 px-3 rounded-xl transition-all disabled:opacity-40"
                        >
                          ▲
                        </button>
                        <button
                          onClick={() => moveDown(idx)}
                          disabled={idx === statuses.length - 1}
                          className="bg-white border border-gray-200 hover:bg-gray-50 font-black py-2 px-3 rounded-xl transition-all disabled:opacity-40"
                        >
                          ▼
                        </button>
                        <button
                          onClick={() => deleteStatus(s.id)}
                          className="bg-red-600 hover:bg-red-700 text-white font-black py-2 px-4 rounded-xl transition-all shadow-md"
                        >
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

              {!loading && statuses.length === 0 && (
                <tr>
                  <td className="p-8 text-center text-gray-500 font-semibold" colSpan={3}>
                    Nenhum status nesse planner. Adiciona acima.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {loading && (
            <div className="p-6 text-center text-gray-500 font-semibold">
              Carregando...
            </div>
          )}
        </div>
      </main>

      <div className="mt-6 text-sm text-gray-500 font-semibold">
        Depois de mexer nos status, volta em <span className="font-black">/tarefas</span>, seleciona o planner e troca pra Board pra ver as colunas mudando.
      </div>
    </div>
  )
}