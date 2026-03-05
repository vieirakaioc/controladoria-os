'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const MESES = [
  { v: 0, n: 'Jan' }, { v: 1, n: 'Fev' }, { v: 2, n: 'Mar' }, { v: 3, n: 'Abr' },
  { v: 4, n: 'Mai' }, { v: 5, n: 'Jun' }, { v: 6, n: 'Jul' }, { v: 7, n: 'Ago' },
  { v: 8, n: 'Set' }, { v: 9, n: 'Out' }, { v: 10, n: 'Nov' }, { v: 11, n: 'Dez' },
]

type Row = {
  id: string
  data_vencimento: string | null
  status: string | null
  data_conclusao: string | null
  observacoes: string | null
  atividades?: any
}

type PlannerRow = { planner_name: string }
type StatusRow = { status_name: string; status_order: number }
type TimeBucket = 'Atrasadas' | 'Hoje' | 'Amanhã' | 'Próx 7 dias' | 'Sem data' | 'Oculto'
type Lookup = { id: string; nome: string; email?: string }

// ==========================================
// FUNÇÕES PURAS
// ==========================================
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const addDays = (d: Date, n: number) => {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}
const parseISODateOnly = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

const getBucket = (data_vencimento: string | null): TimeBucket => {
  if (!data_vencimento) return 'Sem data'
  const today0 = startOfDay(new Date())
  const tomorrow0 = startOfDay(addDays(new Date(), 1))
  const in7 = startOfDay(addDays(new Date(), 7))
  const due = startOfDay(parseISODateOnly(String(data_vencimento).slice(0, 10)))

  if (due < today0) return 'Atrasadas'
  if (due.getTime() === today0.getTime()) return 'Hoje'
  if (due.getTime() === tomorrow0.getTime()) return 'Amanhã'
  if (due > tomorrow0 && due <= in7) return 'Próx 7 dias'
  return 'Oculto'
}

const badge = (s?: string | null) => {
  const st = (s || 'Pendente').toLowerCase()
  if (st.includes('concl')) return 'bg-[#2d6943]/10 text-[#2d6943]' 
  if (st.includes('and')) return 'bg-[#0f88a8]/10 text-[#0f88a8]'   
  if (st.includes('aguard')) return 'bg-[#efc486]/20 text-[#063955]' 
  if (st.includes('pend')) return 'bg-amber-100 text-amber-800'
  return 'bg-slate-100 text-slate-700'
}

// ==========================================
// COMPONENTES ISOLADOS
// ==========================================

const TaskCard = React.memo(({ r, mode, statuses, statusOrderMap, setStatus, excluirTarefa, abrirDrawer }: any) => {
  const atv = r.atividades || {}
  const st = r.status || statuses[0] || 'Pendente'
  const bucket = getBucket(r.data_vencimento)
  const isDone = st.toLowerCase().includes('concl')

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', r.id)
    e.dataTransfer.setData('sourceStatus', st)
    setTimeout(() => {
      if (e.target instanceof HTMLElement) e.target.classList.add('opacity-40')
    }, 0)
  }

  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    if (e.target instanceof HTMLElement) e.target.classList.remove('opacity-40')
  }

  const prevSt = statuses[Math.max((statusOrderMap[st] ?? 0) - 1, 0)]
  const nextSt = statuses[Math.min((statusOrderMap[st] ?? 0) + 1, statuses.length - 1)]

  return (
    <div 
      draggable={mode === 'default'}
      onDragStart={mode === 'default' ? handleDragStart : undefined}
      onDragEnd={mode === 'default' ? handleDragEnd : undefined}
      className={`bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 select-none ${mode === 'default' ? 'cursor-grab active:cursor-grabbing' : ''}`}
    >
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="text-[11px] font-medium text-slate-500">
          {r.data_vencimento ? String(r.data_vencimento).slice(0, 10) : '—'} • {bucket}
        </div>
        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase ${badge(st)}`}>
          {st}
        </span>
      </div>

      <div className="text-sm font-medium text-slate-800 leading-snug pointer-events-none">{atv.nome_atividade || '-'}</div>

      <div className="mt-3 flex flex-wrap gap-1.5 pointer-events-none">
        <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-medium">{atv.setores?.nome || '—'}</span>
        <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-medium">{atv.responsaveis?.nome || '—'}</span>
        <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-medium">{atv.planner_name || '—'}</span>
      </div>

      <div className="mt-4 flex gap-2 items-center">
        {mode === 'timeboard' ? (
          <>
            {!isDone && (
              <button onClick={() => setStatus(r.id, statuses[statuses.length - 1] || 'Concluído')} className="bg-[#2d6943]/10 hover:bg-[#2d6943]/20 text-[#2d6943] border border-[#2d6943]/20 font-medium py-1 px-3 rounded-lg transition-colors text-xs cursor-pointer">
                Concluir
              </button>
            )}
          </>
        ) : (
          <>
            <button onClick={() => setStatus(r.id, prevSt)} disabled={st === statuses[0]} className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 py-1 px-2 rounded-lg transition-colors disabled:opacity-40 text-xs cursor-pointer">
              ◀
            </button>
            <button onClick={() => setStatus(r.id, nextSt)} disabled={st === statuses[statuses.length - 1]} className="bg-[#0f88a8]/10 hover:bg-[#0f88a8]/20 border border-[#0f88a8]/20 text-[#0f88a8] py-1 px-2 rounded-lg transition-colors disabled:opacity-40 text-xs cursor-pointer">
              ▶
            </button>
          </>
        )}
        
        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => excluirTarefa(r.id)} className="text-slate-300 hover:text-[#b43a3d] hover:bg-[#b43a3d]/10 py-1 px-2 rounded-lg transition-colors text-xs cursor-pointer" title="Excluir Tarefa">
            🗑️
          </button>
          <button onClick={() => abrirDrawer(r)} className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 font-medium py-1 px-3 rounded-lg transition-colors text-xs cursor-pointer">
            Detalhes
          </button>
        </div>
      </div>
    </div>
  )
})

const BoardColumn = ({ status, tasks, statuses, statusOrderMap, setStatus, excluirTarefa, abrirDrawer }: any) => {
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

    if (taskId && sourceStatus !== status) {
      setStatus(taskId, status)
    }
  }

  return (
    <div 
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`rounded-2xl border flex-1 min-w-[320px] flex flex-col max-h-[75vh] transition-colors ${
        isOver ? 'bg-[#0f88a8]/10 border-[#0f88a8]/50 border-dashed' : 'bg-slate-100/50 border-slate-200'
      }`}
    >
      <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-100/80 rounded-t-2xl">
        <span className={`font-medium ${isOver ? 'text-[#0f88a8]' : 'text-slate-700'}`}>{status}</span>
        <span className="bg-white text-slate-500 text-xs font-medium px-2 py-0.5 rounded-full border border-slate-200 shadow-sm">{tasks.length}</span>
      </div>
      <div className="p-3 space-y-3 overflow-y-auto flex-1 custom-scrollbar">
        {tasks.map((r: any) => (
          <TaskCard 
            key={r.id} r={r} mode="default" statuses={statuses} 
            statusOrderMap={statusOrderMap} setStatus={setStatus} 
            excluirTarefa={excluirTarefa} abrirDrawer={abrirDrawer} 
          />
        ))}
      </div>
    </div>
  )
}

// ==========================================
// PÁGINA PRINCIPAL
// ==========================================
export default function TarefasPage() {
  const router = useRouter()

  const hoje = new Date()
  const [mesAlvo, setMesAlvo] = useState<number>(hoje.getMonth())
  const [anoAlvo, setAnoAlvo] = useState<number>(hoje.getFullYear())

  const [rows, setRows] = useState<Row[]>([])
  const [carregando, setCarregando] = useState(true)
  const [mensagem, setMensagem] = useState('')

  const [filtroTexto, setFiltroTexto] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<string>('Todos')
  const [filtroSetor, setFiltroSetor] = useState<string>('Todos')
  const [filtroResp, setFiltroResp] = useState<string>('Todos')

  const [view, setView] = useState<'list' | 'board' | 'timeboard'>('timeboard')

  const [planners, setPlanners] = useState<string[]>([])
  const [plannerSel, setPlannerSel] = useState<string>('Todos')

  const [statuses, setStatuses] = useState<string[]>([])
  const [statusOrderMap, setStatusOrderMap] = useState<Record<string, number>>({})

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selected, setSelected] = useState<Row | null>(null)
  const [drawerStatus, setDrawerStatus] = useState<string>('')
  const [drawerObs, setDrawerObs] = useState<string>('')
  const [drawerVenc, setDrawerVenc] = useState<string>('')
  const [savingDrawer, setSavingDrawer] = useState(false)

  // Comments
  const [comentarios, setComentarios] = useState<any[]>([])
  const [comentNovo, setComentNovo] = useState('')
  const [userId, setUserId] = useState<string>('')
  const [userName, setUserName] = useState<string>('')
  const [loadingComents, setLoadingComents] = useState(false)

  // Lookups para Ad Hoc
  const [setoresDb, setSetoresDb] = useState<Lookup[]>([])
  const [respsDb, setRespsDb] = useState<Lookup[]>([])

  // Modal Ad Hoc
  const [adhocOpen, setAdhocOpen] = useState(false)
  const [adhocNome, setAdhocNome] = useState('')
  const [adhocSetorId, setAdhocSetorId] = useState<string>('')
  const [adhocRespId, setAdhocRespId] = useState<string>('')
  const [adhocVenc, setAdhocVenc] = useState<string>(new Date().toISOString().slice(0, 10))
  const [adhocPrioridade, setAdhocPrioridade] = useState<string>('Média')
  const [adhocObs, setAdhocObs] = useState<string>('')
  const [savingAdhoc, setSavingAdhoc] = useState(false)

  const inicio = useMemo(() => new Date(anoAlvo, mesAlvo, 1), [anoAlvo, mesAlvo])
  const fim = useMemo(() => new Date(anoAlvo, mesAlvo + 1, 1), [anoAlvo, mesAlvo])
  const iso = (d: Date) => d.toISOString().split('T')[0]

  const carregarUsuario = async () => {
    const { data, error } = await supabase.auth.getUser()
    if (error) console.warn('auth.getUser error:', error)
    const u = data?.user
    if (!u) {
      router.push('/login')
      return
    }
    setUserId(u.id)
    const { data: prof } = await supabase.from('profiles').select('full_name').eq('id', u.id).maybeSingle()
    setUserName(prof?.full_name?.trim() || u.email || 'Usuário')
  }

  const carregarLookups = async () => {
    const [{ data: s }, { data: r }] = await Promise.all([
      supabase.from('setores').select('id,nome').order('nome', { ascending: true }),
      supabase.from('responsaveis').select('id,nome,email').order('nome', { ascending: true }),
    ])
    setSetoresDb((s || []) as any)
    setRespsDb((r || []) as any)
  }

  const carregarPlanners = async () => {
    const { data, error } = await supabase.from('atividades').select('planner_name')
    if (error) return
    const uniq = Array.from(new Set((data as PlannerRow[]).map(x => x.planner_name))).filter(Boolean).sort()
    setPlanners(uniq)
  }

  const carregarWorkflow = async (plannerName: string) => {
    if (!plannerName) return
    let final = ['Pendente', 'Em andamento', 'Aguardando', 'Concluído'] 
    let map: Record<string, number> = {}

    if (plannerName !== 'Todos') {
      const { data } = await supabase.from('planner_workflows').select(`id, planner_name, planner_workflow_statuses (status_name, status_order)`).eq('planner_name', plannerName).maybeSingle()
      const st: StatusRow[] = ((data as any)?.planner_workflow_statuses || []) as any
      const ordered = st.slice().sort((a, b) => a.status_order - b.status_order).map(s => s.status_name)
      if (ordered.length > 0) final = ordered
    }

    final.forEach((name, idx) => (map[name] = idx))
    setStatuses(final)
    setStatusOrderMap(map)
    if (filtroStatus !== 'Todos' && !final.includes(filtroStatus)) setFiltroStatus('Todos')
  }

  const carregar = async () => {
    if (!plannerSel) return
    setCarregando(true)
    setMensagem('')
    try {
      const { data, error } = await supabase.from('tarefas_diarias').select(`
          id, data_vencimento, status, data_conclusao, observacoes,
          atividades!tarefas_diarias_atividade_id_fkey (
            task_id, nome_atividade, planner_name, frequencia, prioridade_descricao, responsavel_id,
            setores!atividades_setor_id_fkey (nome), responsaveis!atividades_responsavel_id_fkey (nome, email)
          )
        `).gte('data_vencimento', iso(inicio)).lt('data_vencimento', iso(fim)).order('data_vencimento', { ascending: true })

      if (error) throw error
      const filtradoPlanner = plannerSel === 'Todos' ? data : (data || []).filter((r: any) => r?.atividades?.planner_name === plannerSel)
      setRows(filtradoPlanner as any)
    } catch (e: any) {
      setMensagem('❌ Erro ao carregar tarefas.')
    } finally {
      setCarregando(false)
    }
  }

  const sendEmailNotification = async (taskId: string, actionText: string, extraObs?: string) => {
    try {
      const task = rows.find(r => r.id === taskId)
      if (!task) return
      const destinatarioEmail = task.atividades?.responsaveis?.email
      if (!destinatarioEmail) return 

      const payload = {
        to: destinatarioEmail,
        subject: `[Portal da Controladoria] Atualização de Tarefa: ${task.atividades?.nome_atividade}`,
        taskName: task.atividades?.nome_atividade,
        action: actionText,
        userName: userName,
        observacoes: extraObs || task.observacoes || ''
      }

      await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
    } catch (error) {}
  }

  const carregarComentarios = async (tarefaId: string) => {
    setLoadingComents(true)
    try {
      const { data } = await supabase.from('tarefa_comentarios').select(`id, tarefa_id, autor_id, autor, mensagem, created_at`).eq('tarefa_id', tarefaId).order('created_at', { ascending: false })
      setComentarios(data || [])
    } finally { setLoadingComents(false) }
  }

  const enviarComentario = async () => {
    if (!selected) return
    const msg = comentNovo.trim()
    if (!msg) return
    if (!userId) { router.push('/login'); return }

    const payload = { tarefa_id: selected.id, autor_id: userId, autor: userName || null, mensagem: msg }
    const { data, error } = await supabase.from('tarefa_comentarios').insert([payload]).select().single()
    if (error) { setMensagem('❌ Erro ao salvar comentário.'); return }

    setComentarios(prev => [data, ...prev])
    setComentNovo('')
    sendEmailNotification(selected.id, 'comentada', `Novo comentário de ${userName}: "${msg}"`)
  }

  const excluirTarefa = async (tarefaId: string) => {
    if (!window.confirm('⚠️ Tem certeza que deseja excluir esta tarefa?\n\nEssa ação apagará a tarefa e seus comentários. Não pode ser desfeita.')) return
    setMensagem('Excluindo tarefa...')
    try {
      const tarefa = rows.find(r => r.id === tarefaId)
      await supabase.from('tarefa_comentarios').delete().eq('tarefa_id', tarefaId)
      const { error } = await supabase.from('tarefas_diarias').delete().eq('id', tarefaId)
      if (error) throw error

      if (tarefa?.atividades?.frequencia === 'Ad Hoc' && tarefa.atividades.task_id) {
        await supabase.from('atividades').delete().eq('task_id', tarefa.atividades.task_id)
      }

      setRows(prev => prev.filter(r => r.id !== tarefaId))
      if (selected?.id === tarefaId) fecharDrawer()
      setMensagem('✅ Tarefa excluída!')
    } catch (err: any) {
      setMensagem('❌ Erro ao excluir a tarefa.')
    } finally { setTimeout(() => setMensagem(''), 3000) }
  }

  useEffect(() => { carregarUsuario(); carregarPlanners(); carregarLookups() }, [])
  useEffect(() => { if (!plannerSel) return; ;(async () => { await carregarWorkflow(plannerSel); await carregar() })() }, [plannerSel])
  useEffect(() => { if (!plannerSel) return; carregar() }, [mesAlvo, anoAlvo])

  const setStatus = async (id: string, status: string) => {
    setRows(prev => prev.map(r => (r.id === id ? { ...r, status } : r)))
    setMensagem('A atualizar...')
    const patch: any = { status, data_conclusao: status.toLowerCase().includes('concl') ? new Date().toISOString() : null }
    const { error } = await supabase.from('tarefas_diarias').update(patch).eq('id', id)
    if (error) { setMensagem('❌ Erro ao atualizar.'); carregar(); return }
    if (selected?.id === id) { setSelected({ ...selected, ...patch }); setDrawerStatus(patch.status) }
    setMensagem('✅ Sucesso!')
    setTimeout(() => setMensagem(''), 1000)
    sendEmailNotification(id, `movida para o status "${status}"`, '')
  }

  const abrirDrawer = (r: Row) => {
    setSelected(r); setDrawerStatus(r.status || statuses[0] || 'Pendente'); setDrawerObs(r.observacoes || ''); setDrawerVenc(r.data_vencimento ? String(r.data_vencimento).slice(0, 10) : '')
    setDrawerOpen(true); setComentarios([]); setComentNovo(''); carregarComentarios(r.id)
  }

  const fecharDrawer = () => { setDrawerOpen(false); setSelected(null); setDrawerStatus(''); setDrawerObs(''); setDrawerVenc(''); setSavingDrawer(false); setComentarios([]); setComentNovo('') }

  const salvarDrawer = async () => {
    if (!selected) return
    setSavingDrawer(true)
    const patch: any = { status: drawerStatus, observacoes: drawerObs || null, data_vencimento: drawerVenc || null, data_conclusao: drawerStatus.toLowerCase().includes('concl') ? (selected.data_conclusao || new Date().toISOString()) : null }
    const { error } = await supabase.from('tarefas_diarias').update(patch).eq('id', selected.id)
    if (!error) {
      setRows(prev => prev.map(r => (r.id === selected.id ? { ...r, ...patch } : r)))
      setSelected(prev => (prev ? { ...prev, ...patch } : prev))
    }
    setSavingDrawer(false); fecharDrawer()
    sendEmailNotification(selected.id, `atualizada com novas observações e/ou status`, drawerObs || '')
  }

  const concluirNoDrawer = async () => {
    if (!selected) return
    await setStatus(selected.id, statuses[statuses.length - 1] || 'Concluído')
    fecharDrawer()
  }

  const criarAdHoc = async () => {
    const nome = adhocNome.trim(); if (!nome || !adhocVenc) return
    setSavingAdhoc(true)
    try {
      const taskId = crypto.randomUUID()
      const payloadAtv: any = { 
        task_id: taskId, 
        planner_name: 'Ad Hoc', 
        nome_atividade: nome, 
        setor_id: adhocSetorId || null, 
        responsavel_id: adhocRespId || null, 
        frequencia: 'Ad Hoc', 
        status: 'Ativo',
        prioridade_descricao: adhocPrioridade // NOVO CAMPO
      }
      const { data: atv, error: errAtv } = await supabase.from('atividades').insert([payloadAtv]).select('task_id').single()
      if (errAtv) throw errAtv

      const payloadExec: any = { 
        atividade_id: atv.task_id, 
        data_vencimento: adhocVenc, 
        status: statuses[0] || 'Pendente',
        observacoes: adhocObs || null // NOVO CAMPO
      }
      const { error: errExec } = await supabase.from('tarefas_diarias').insert([payloadExec])
      if (errExec) throw errExec

      setAdhocOpen(false); setAdhocNome(''); setAdhocSetorId(''); setAdhocRespId(''); setAdhocVenc(new Date().toISOString().slice(0, 10)); setAdhocPrioridade('Média'); setAdhocObs('');
      
      const { data: novaTask } = await supabase.from('tarefas_diarias').select('*, atividades!inner(responsaveis(email))').eq('atividade_id', atv.task_id).single()
      if (novaTask) {
        const userResp = respsDb.find(r => r.id === adhocRespId)
        if (userResp?.email) {
          await fetch('/api/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: userResp.email,
              subject: `[Portal da Controladoria] Nova Tarefa Ad Hoc: ${nome}`,
              taskName: nome,
              action: `criada e atribuída a você`,
              userName: userName,
              observacoes: `Prazo: ${adhocVenc.slice(8,10)}/${adhocVenc.slice(5,7)}/${adhocVenc.slice(0,4)}<br/>Prioridade: <strong>${adhocPrioridade}</strong><br/><br/>Detalhes Adicionais:<br/>${adhocObs || 'Nenhum detalhe fornecido.'}`
            })
          })
        }
      }

      await carregarPlanners(); await carregar()
    } finally { setSavingAdhoc(false) }
  }

  const setorOptions = useMemo(() => Array.from(new Set(rows.map(r => r.atividades?.setores?.nome).filter(Boolean))).sort(), [rows])
  const respOptions = useMemo(() => Array.from(new Set(rows.map(r => r.atividades?.responsaveis?.nome).filter(Boolean))).sort(), [rows])

  const filtradas = useMemo(() => {
    const q = filtroTexto.trim().toLowerCase()
    return rows.filter((r) => {
      const atv = r.atividades || {}
      const nome = (atv.nome_atividade || '').toLowerCase()
      const st = r.status || statuses[0] || 'Pendente'
      const okTexto = !q || nome.includes(q) || (atv.setores?.nome || '').toLowerCase().includes(q) || (atv.responsaveis?.nome || '').toLowerCase().includes(q)
      const okStatus = filtroStatus === 'Todos' ? true : st === filtroStatus
      const okSetor = filtroSetor === 'Todos' ? true : (atv.setores?.nome === filtroSetor)
      const okResp = filtroResp === 'Todos' ? true : (atv.responsaveis?.nome === filtroResp)
      return okTexto && okStatus && okSetor && okResp
    })
  }, [rows, filtroTexto, filtroStatus, filtroSetor, filtroResp, statuses])

  const dashboard = useMemo(() => {
    const done = filtradas.filter(r => (r.status || '').toLowerCase().includes('concl')).length
    return {
      total: filtradas.length, done, overdue: filtradas.filter(r => getBucket(r.data_vencimento) === 'Atrasadas').length,
      dueToday: filtradas.filter(r => getBucket(r.data_vencimento) === 'Hoje').length, dueTomorrow: filtradas.filter(r => getBucket(r.data_vencimento) === 'Amanhã').length,
      next7: filtradas.filter(r => getBucket(r.data_vencimento) === 'Próx 7 dias').length, pct: filtradas.length ? Math.round((done / filtradas.length) * 100) : 0
    }
  }, [filtradas])

  const boardStatus = useMemo(() => {
    const buckets: Record<string, Row[]> = {}; statuses.forEach(s => (buckets[s] = []))
    filtradas.forEach((r) => { const st = r.status || statuses[0] || 'Pendente'; if (buckets[st]) buckets[st].push(r) })
    return buckets
  }, [filtradas, statuses])

  const timeOrder: TimeBucket[] = useMemo(() => ['Atrasadas', 'Hoje', 'Amanhã', 'Próx 7 dias', 'Sem data'], [])
  const timeboard = useMemo(() => {
    const buckets: Record<string, Row[]> = { 'Atrasadas': [], 'Hoje': [], 'Amanhã': [], 'Próx 7 dias': [], 'Sem data': [] }
    filtradas.forEach(r => { const b = getBucket(r.data_vencimento); if (buckets[b]) buckets[b].push(r) })
    return buckets
  }, [filtradas])

  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans">
      
      <header className="flex flex-col xl:flex-row xl:justify-between xl:items-center gap-4 mb-6 bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Painel de Execução</h1>
          <p className="text-slate-500 text-sm mt-1">Mês: {MESES.find(m => m.v === mesAlvo)?.n}/{anoAlvo}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {mensagem && <span className="text-sm font-medium text-[#0f88a8] bg-[#0f88a8]/10 px-3 py-1 rounded-lg animate-pulse">{mensagem}</span>}

          <button onClick={() => setAdhocOpen(true)} className="bg-[#0f88a8] hover:bg-[#0c708b] text-white text-sm font-medium py-2 px-4 rounded-xl transition-all shadow-sm">
            + Nova Ad Hoc
          </button>

          <div className="flex bg-slate-100 rounded-xl p-1 border border-slate-200">
            <button onClick={() => setView('list')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${view === 'list' ? 'bg-white shadow-sm text-[#063955]' : 'text-slate-500'}`}>Lista</button>
            <button onClick={() => setView('board')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${view === 'board' ? 'bg-white shadow-sm text-[#063955]' : 'text-slate-500'}`}>Status</button>
            <button onClick={() => setView('timeboard')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${view === 'timeboard' ? 'bg-white shadow-sm text-[#063955]' : 'text-slate-500'}`}>Dias</button>
          </div>

          <select className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-[#0f88a8]" value={plannerSel} onChange={(e) => setPlannerSel(e.target.value)}>
            <option value="Todos">Todos os Planners</option>
            {planners.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>

          <select className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-[#0f88a8]" value={mesAlvo} onChange={(e) => setMesAlvo(Number(e.target.value))}>
            {MESES.map((m) => <option key={m.v} value={m.v}>{m.n}</option>)}
          </select>

          <input className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 w-24 outline-none focus:border-[#0f88a8]" type="number" value={anoAlvo} onChange={(e) => setAnoAlvo(Number(e.target.value))} />

          <button onClick={carregar} className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium py-2 px-4 rounded-xl transition-all shadow-sm">↻ Atualizar</button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-6 gap-3 mb-6">
        <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm"><div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total</div><div className="text-2xl font-light text-slate-900 mt-1">{dashboard.total}</div></div>
        <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm"><div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Atrasadas</div><div className="text-2xl font-light text-[#b43a3d] mt-1">{dashboard.overdue}</div></div>
        <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm"><div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Hoje</div><div className="text-2xl font-light text-[#0f88a8] mt-1">{dashboard.dueToday}</div></div>
        <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm"><div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Amanhã</div><div className="text-2xl font-light text-slate-900 mt-1">{dashboard.dueTomorrow}</div></div>
        <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm"><div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Próx 7 dias</div><div className="text-2xl font-light text-slate-900 mt-1">{dashboard.next7}</div></div>
        <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm"><div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Concluídas</div><div className="text-2xl font-light text-[#2d6943] mt-1">{dashboard.done} <span className="text-sm font-medium text-slate-400">({dashboard.pct}%)</span></div></div>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-6 flex flex-wrap gap-3 items-center">
        <input value={filtroTexto} onChange={(e) => setFiltroTexto(e.target.value)} placeholder="Buscar atividade..." className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm w-full md:w-64 outline-none focus:border-[#0f88a8]" />
        <select value={filtroSetor} onChange={(e) => setFiltroSetor(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-700 outline-none"><option value="Todos">Setor: Todos</option>{setorOptions.map(s => <option key={s} value={s}>{s}</option>)}</select>
        <select value={filtroResp} onChange={(e) => setFiltroResp(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-700 outline-none"><option value="Todos">Resp: Todos</option>{respOptions.map(r => <option key={r} value={r}>{r}</option>)}</select>
        <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-700 outline-none"><option value="Todos">Status: Todos</option>{statuses.map(s => <option key={s} value={s}>{s}</option>)}</select>
        <button onClick={() => { setFiltroTexto(''); setFiltroSetor('Todos'); setFiltroResp('Todos'); setFiltroStatus('Todos') }} className="text-sm font-medium text-slate-500 hover:text-slate-800 px-2 transition-colors">Limpar Filtros</button>
        <span className="ml-auto text-sm font-medium text-slate-400">{filtradas.length} tarefas</span>
      </div>

      {view === 'list' && (
        <main className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase text-xs">
                  <th className="p-4 font-medium">Vencimento</th><th className="p-4 font-medium">Atividade</th><th className="p-4 font-medium">Setor</th><th className="p-4 font-medium">Responsável</th><th className="p-4 font-medium">Status</th><th className="p-4 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtradas.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors text-sm">
                    <td className="p-4 text-slate-600">{r.data_vencimento ? String(r.data_vencimento).slice(0, 10) : '—'}</td>
                    <td className="p-4 font-medium text-slate-800">{r.atividades?.nome_atividade || '-'}</td>
                    <td className="p-4 text-slate-500">{r.atividades?.setores?.nome || '-'}</td>
                    <td className="p-4 text-slate-500">{r.atividades?.responsaveis?.nome || '-'}</td>
                    <td className="p-4"><span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${badge(r.status)}`}>{r.status}</span></td>
                    <td className="p-4 text-right flex justify-end items-center gap-3">
                      <button onClick={() => excluirTarefa(r.id)} className="text-slate-300 hover:text-[#b43a3d] transition-colors" title="Excluir">🗑️</button>
                      <button onClick={() => abrirDrawer(r)} className="text-[#0f88a8] hover:text-[#063955] font-medium">Detalhes</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      )}

      {view === 'board' && (
        <div className="flex gap-4 overflow-x-auto pb-4" style={{ gridTemplateColumns: `repeat(${statuses.length}, minmax(300px, 1fr))` }}>
          {statuses.map((s) => (
            <BoardColumn key={s} status={s} tasks={boardStatus[s] || []} statuses={statuses} statusOrderMap={statusOrderMap} setStatus={setStatus} excluirTarefa={excluirTarefa} abrirDrawer={abrirDrawer} />
          ))}
        </div>
      )}

      {view === 'timeboard' && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {timeOrder.map((b) => (
            <div key={b} className={`rounded-2xl border flex-1 min-w-[320px] flex flex-col max-h-[75vh] ${b === 'Atrasadas' ? 'bg-[#b43a3d]/10 border-[#b43a3d]/20' : 'bg-slate-100/50 border-slate-200'}`}>
              <div className={`p-4 border-b flex justify-between items-center rounded-t-2xl ${b === 'Atrasadas' ? 'bg-[#b43a3d]/20 border-[#b43a3d]/30 text-[#b43a3d]' : 'bg-slate-100 border-slate-200 text-slate-700'}`}>
                <span className="font-medium">{b}</span><span className="bg-white text-xs font-medium px-2 py-0.5 rounded-full shadow-sm">{(timeboard[b] || []).length}</span>
              </div>
              <div className="p-3 space-y-3 overflow-y-auto flex-1 custom-scrollbar">
                {(timeboard[b] || []).map((r) => <TaskCard key={r.id} r={r} mode="timeboard" statuses={statuses} statusOrderMap={statusOrderMap} setStatus={setStatus} excluirTarefa={excluirTarefa} abrirDrawer={abrirDrawer} />)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL AD HOC ATUALIZADO */}
      {adhocOpen && (
        <>
          <div className="fixed inset-0 bg-[#063955]/20 backdrop-blur-sm z-40 transition-all" onClick={() => setAdhocOpen(false)} />
          <aside className="fixed top-0 right-0 h-full w-full sm:w-[480px] bg-white z-50 shadow-2xl border-l border-slate-200 flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-start">
              <div><span className="text-xs text-[#0f88a8] font-semibold tracking-wide uppercase">Nova Tarefa Pontual</span><h2 className="text-xl text-slate-900 font-semibold mt-1">Planner: Ad Hoc</h2></div>
              <button onClick={() => setAdhocOpen(false)} className="text-slate-400 hover:text-slate-600 p-2">✕</button>
            </div>
            
            <div className="p-6 space-y-5 flex-1 overflow-y-auto custom-scrollbar">
              <div>
                <label className="text-xs text-slate-500 font-medium block mb-1">Nome da atividade</label>
                <input value={adhocNome} onChange={(e) => setAdhocNome(e.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#0f88a8]" placeholder="Ex: Ajustar lançamento X..." />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-500 font-medium block mb-1">Setor</label>
                  <select value={adhocSetorId} onChange={(e) => setAdhocSetorId(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-3 text-sm outline-none focus:border-[#0f88a8]">
                    <option value="">(sem setor)</option>
                    {setoresDb.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-medium block mb-1">Responsável</label>
                  <select value={adhocRespId} onChange={(e) => setAdhocRespId(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-3 text-sm outline-none focus:border-[#0f88a8]">
                    <option value="">(sem responsável)</option>
                    {respsDb.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-500 font-medium block mb-1">Vencimento</label>
                  <input type="date" value={adhocVenc} onChange={(e) => setAdhocVenc(e.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#0f88a8]" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-medium block mb-1">Prioridade</label>
                  <select value={adhocPrioridade} onChange={(e) => setAdhocPrioridade(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-3 text-sm outline-none focus:border-[#0f88a8]">
                    <option value="Baixa">Baixa</option>
                    <option value="Média">Média</option>
                    <option value="Alta">Alta</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-500 font-medium block mb-1">Observações / Detalhes</label>
                <textarea 
                  value={adhocObs} 
                  onChange={(e) => setAdhocObs(e.target.value)} 
                  rows={4} 
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#0f88a8] resize-none" 
                  placeholder="Forneça instruções, links ou contexto adicional para quem vai executar a tarefa..." 
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 flex gap-2 bg-slate-50">
              <button onClick={criarAdHoc} disabled={savingAdhoc} className="bg-[#0f88a8] text-white px-5 py-3 w-full rounded-xl text-sm font-semibold hover:bg-[#0c708b] transition-colors shadow-sm disabled:opacity-50">
                {savingAdhoc ? 'Criando e enviando notificação...' : 'Criar Tarefa'}
              </button>
            </div>
          </aside>
        </>
      )}

      {/* DRAWER PADRÃO */}
      {drawerOpen && selected && (
        <>
          <div className="fixed inset-0 bg-[#063955]/20 backdrop-blur-sm z-40 transition-all" onClick={fecharDrawer} />
          <aside className="fixed top-0 right-0 h-full w-full sm:w-[520px] bg-white z-50 shadow-2xl border-l border-slate-200 flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-start">
              <div><span className="text-xs text-[#0f88a8] font-semibold tracking-wide uppercase">Detalhes da Tarefa</span><h2 className="text-xl text-[#063955] font-semibold mt-1">{selected.atividades?.nome_atividade}</h2><div className="text-xs text-slate-500 mt-1">{selected.atividades?.setores?.nome || '—'} • {selected.atividades?.responsaveis?.nome || '—'}</div></div>
              <button onClick={fecharDrawer} className="text-slate-400 hover:text-[#063955] p-2">✕</button>
            </div>
            <div className="p-6 flex-1 overflow-y-auto space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs text-slate-500 font-medium block mb-1">Status</label><select value={drawerStatus} onChange={e => setDrawerStatus(e.target.value)} className="w-full border border-slate-200 rounded-xl p-2.5 text-sm outline-none focus:border-[#0f88a8]">{statuses.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                <div><label className="text-xs text-slate-500 font-medium block mb-1">Vencimento</label><input type="date" value={drawerVenc} onChange={e => setDrawerVenc(e.target.value)} className="w-full border border-slate-200 rounded-xl p-2.5 text-sm outline-none focus:border-[#0f88a8]"/></div>
              </div>
              <div><label className="text-xs text-slate-500 font-medium block mb-1">Observações (Links, Evidências)</label><textarea value={drawerObs} onChange={e => setDrawerObs(e.target.value)} rows={5} className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-[#0f88a8]" /></div>
              <div className="border-t border-slate-100 pt-5">
                <label className="text-xs text-slate-500 font-medium block mb-2">Comentários</label>
                <div className="flex gap-2"><input value={comentNovo} onChange={e => setComentNovo(e.target.value)} onKeyDown={e => e.key === 'Enter' && enviarComentario()} placeholder="Escreva um comentário..." className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#0f88a8]"/><button onClick={enviarComentario} className="bg-[#0f88a8] text-white px-4 rounded-xl text-sm font-medium hover:bg-[#0c708b] transition-colors">Enviar</button></div>
                <div className="mt-4 space-y-2">{comentarios.map(c => (<div key={c.id} className="bg-slate-50 rounded-xl p-3 border border-slate-100"><div className="flex justify-between text-xs text-slate-500 mb-1"><span className="font-medium text-[#063955]">{c.autor || 'Usuário'}</span><span>{String(c.created_at).slice(0,16).replace('T',' ')}</span></div><p className="text-sm text-slate-800">{c.mensagem}</p></div>))}</div>
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 flex justify-between bg-slate-50">
              <button onClick={() => excluirTarefa(selected.id)} className="text-[#b43a3d] hover:bg-[#b43a3d]/10 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors">Excluir Tarefa</button>
              <div className="flex gap-2"><button onClick={salvarDrawer} className="bg-[#0f88a8] text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-[#0c708b] transition-colors shadow-sm">{savingDrawer ? 'Salvando...' : 'Salvar'}</button><button onClick={concluirNoDrawer} className="bg-[#2d6943] text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-[#204e31] transition-colors shadow-sm">✓ Concluir</button></div>
            </div>
          </aside>
        </>
      )}
    </div>
  )
}