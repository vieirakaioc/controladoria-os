'use client'

import React, { useEffect, useMemo, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Toaster, toast } from 'react-hot-toast'

const MESES = [
  { v: 0, n: 'Jan' }, { v: 1, n: 'Fev' }, { v: 2, n: 'Mar' }, { v: 3, n: 'Abr' },
  { v: 4, n: 'Mai' }, { v: 5, n: 'Jun' }, { v: 6, n: 'Jul' }, { v: 7, n: 'Ago' },
  { v: 8, n: 'Set' }, { v: 9, n: 'Out' }, { v: 10, n: 'Nov' }, { v: 11, n: 'Dez' },
]

type ChecklistItem = { id: string; texto: string; concluido: boolean }

type Row = {
  id: string
  data_vencimento: string | null
  status: string | null
  data_conclusao: string | null
  observacoes: string | null
  anexo_url?: string | null
  checklists?: ChecklistItem[] | null 
  atividades?: any
}

type PlannerRow = { planner_name: string }
type StatusRow = { status_name: string; status_order: number }
type TimeBucket = 'Atrasadas' | 'Hoje' | 'Amanhã' | 'Próx 7 dias' | 'Sem data' | 'Oculto'
type Lookup = { id: string; nome: string; email?: string }

// ==========================================
// FUNÇÕES PURAS & HELPERS
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
  if (st.includes('concl')) return 'bg-[#2d6943]/10 text-[#2d6943] dark:bg-[#2d6943]/20 dark:text-[#4ade80]' 
  if (st.includes('and')) return 'bg-[#0f88a8]/10 text-[#0f88a8] dark:bg-[#0f88a8]/20 dark:text-[#7dd3fc]'   
  if (st.includes('aguard')) return 'bg-[#efc486]/20 text-[#063955] dark:bg-[#efc486]/20 dark:text-[#fde047]' 
  if (st.includes('pend')) return 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300'
  return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
}

const getResponsaveis = (atv: any) => {
  if (atv?.responsaveis_lista && Array.isArray(atv.responsaveis_lista) && atv.responsaveis_lista.length > 0) {
    return atv.responsaveis_lista;
  }
  if (atv?.responsaveis) {
    return [atv.responsaveis];
  }
  return [];
}

// ==========================================
// COMPONENTES DE SKELETON
// ==========================================
const SkeletonCard = () => (
  <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-4 shadow-sm animate-pulse">
    <div className="flex justify-between items-center mb-3"><div className="h-2.5 bg-slate-200 dark:bg-slate-700 rounded w-1/3"></div><div className="h-4 bg-slate-200 dark:bg-slate-700 rounded-md w-16"></div></div>
    <div className="h-3.5 bg-slate-300 dark:bg-slate-600 rounded w-3/4 mb-3"></div>
    <div className="flex gap-1.5 mb-4"><div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-12"></div><div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-16"></div><div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-14"></div></div>
    <div className="flex justify-between items-center mt-4"><div className="flex gap-2"><div className="h-6 bg-slate-100 dark:bg-slate-800 rounded-lg w-6"></div><div className="h-6 bg-slate-100 dark:bg-slate-800 rounded-lg w-6"></div></div><div className="flex gap-1"><div className="h-6 bg-slate-100 dark:bg-slate-800 rounded-lg w-6"></div><div className="h-6 bg-slate-200 dark:bg-slate-700 rounded-lg w-16"></div></div></div>
  </div>
)

const SkeletonBoard = ({ columns }: { columns: number }) => (
  <div className="flex gap-4 overflow-x-auto pb-4" style={{ gridTemplateColumns: `repeat(${columns}, minmax(300px, 1fr))` }}>
    {Array.from({ length: columns }).map((_, i) => (
      <div key={i} className="rounded-2xl border flex-1 min-w-[320px] flex flex-col max-h-[75vh] bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center rounded-t-2xl bg-white/50 dark:bg-slate-900/50"><div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-24 animate-pulse"></div><div className="h-5 bg-slate-200 dark:bg-slate-700 rounded-full w-8 animate-pulse"></div></div>
        <div className="p-3 space-y-3 overflow-y-auto flex-1"><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>
      </div>
    ))}
  </div>
)

const SkeletonList = () => (
  <main className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead><tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800">{Array.from({ length: 6 }).map((_, i) => (<th key={i} className="p-4"><div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-20 animate-pulse"></div></th>))}</tr></thead>
        <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">{Array.from({ length: 6 }).map((_, i) => (<tr key={i}><td className="p-4"><div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-20 animate-pulse"></div></td><td className="p-4"><div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-48 animate-pulse"></div></td><td className="p-4"><div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-24 animate-pulse"></div></td><td className="p-4"><div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-32 animate-pulse"></div></td><td className="p-4"><div className="h-5 bg-slate-200 dark:bg-slate-700 rounded-full w-16 animate-pulse"></div></td><td className="p-4 flex justify-end gap-2"><div className="h-6 bg-slate-100 dark:bg-slate-800 rounded w-6 animate-pulse"></div><div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-16 animate-pulse"></div></td></tr>))}</tbody>
      </table>
    </div>
  </main>
)

const SkeletonCalendar = () => (
  <main className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden animate-pulse">
    <div className="grid grid-cols-7 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">{Array.from({ length: 7 }).map((_, i) => (<div key={i} className="p-3 flex justify-center"><div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-8"></div></div>))}</div>
    <div className="grid grid-cols-7 auto-rows-fr">{Array.from({ length: 35 }).map((_, i) => (<div key={i} className="min-h-[120px] p-2 border-b border-r border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900"><div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-6 mb-2"></div>{i % 3 === 0 && <div className="h-6 bg-slate-50 dark:bg-slate-800/50 rounded w-full mb-1"></div>}{i % 5 === 0 && <div className="h-6 bg-slate-100 dark:bg-slate-800 rounded w-full"></div>}</div>))}</div>
  </main>
)

// ==========================================
// COMPONENTES ISOLADOS DO KANBAN
// ==========================================

const TaskCard = React.memo(({ r, mode, statuses, statusOrderMap, setStatus, excluirTarefa, abrirDrawer }: any) => {
  const atv = r.atividades || {}
  const st = r.status || statuses[0] || 'Pendente'
  const bucket = getBucket(r.data_vencimento)
  const isDone = st.toLowerCase().includes('concl')
  
  const chk = r.checklists || []
  const chkTotal = chk.length
  const chkDone = chk.filter((c: ChecklistItem) => c.concluido).length

  const responsaveisAtuais = getResponsaveis(atv)
  const nomesResponsaveis = responsaveisAtuais.length > 0 ? responsaveisAtuais.map((res: any) => res.nome).join(', ') : '—'

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', r.id)
    e.dataTransfer.setData('sourceStatus', st)
    setTimeout(() => { if (e.target instanceof HTMLElement) e.target.classList.add('opacity-40') }, 0)
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
      className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm hover:shadow-md dark:hover:shadow-slate-900/50 hover:-translate-y-0.5 transition-all duration-200 select-none ${mode === 'default' ? 'cursor-grab active:cursor-grabbing' : ''}`}
    >
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
          {r.data_vencimento ? String(r.data_vencimento).slice(0, 10) : '—'} • {bucket}
        </div>
        <div className="flex gap-2 items-center">
          {chkTotal > 0 && <span title="Progresso do Checklist" className="text-[10px] font-bold text-slate-400 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded flex items-center gap-1">☑ {chkDone}/{chkTotal}</span>}
          {r.anexo_url && <span title="Tem anexo" className="text-[#0f88a8]">📎</span>}
          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase ${badge(st)}`}>{st}</span>
        </div>
      </div>

      <div className="text-sm font-medium text-slate-800 dark:text-white leading-snug pointer-events-none">{atv.nome_atividade || '-'}</div>

      <div className="mt-3 flex flex-wrap gap-1.5 pointer-events-none">
        {atv.classificacao && (
          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase">
            {atv.classificacao}
          </span>
        )}
        <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded text-[10px] font-medium">{atv.setores?.nome || '—'}</span>
        <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded text-[10px] font-medium truncate max-w-[120px]" title={nomesResponsaveis}>
          {nomesResponsaveis}
        </span>
        <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded text-[10px] font-medium">{atv.planner_name || '—'}</span>
      </div>

      <div className="mt-4 flex gap-2 items-center">
        {mode === 'timeboard' ? (
          <>{!isDone && <button onClick={() => setStatus(r.id, statuses[statuses.length - 1] || 'Concluído')} className="bg-[#2d6943]/10 hover:bg-[#2d6943]/20 dark:bg-[#2d6943]/20 dark:hover:bg-[#2d6943]/40 text-[#2d6943] dark:text-[#4ade80] border border-[#2d6943]/20 dark:border-[#4ade80]/20 font-medium py-1 px-3 rounded-lg transition-colors text-xs cursor-pointer">Concluir</button>}</>
        ) : (
          <>
            <button onClick={() => setStatus(r.id, prevSt)} disabled={st === statuses[0]} className="bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 py-1 px-2 rounded-lg transition-colors disabled:opacity-40 text-xs cursor-pointer">◀</button>
            <button onClick={() => setStatus(r.id, nextSt)} disabled={st === statuses[statuses.length - 1]} className="bg-[#0f88a8]/10 hover:bg-[#0f88a8]/20 dark:bg-[#0f88a8]/20 dark:hover:bg-[#0f88a8]/40 border border-[#0f88a8]/20 dark:border-[#0f88a8]/30 text-[#0f88a8] dark:text-[#7dd3fc] py-1 px-2 rounded-lg transition-colors disabled:opacity-40 text-xs cursor-pointer">▶</button>
          </>
        )}
        
        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => excluirTarefa(r.id)} className="text-slate-300 dark:text-slate-600 hover:text-[#b43a3d] dark:hover:text-[#f87171] hover:bg-[#b43a3d]/10 dark:hover:bg-[#b43a3d]/20 py-1 px-2 rounded-lg transition-colors text-xs cursor-pointer" title="Excluir Tarefa">🗑️</button>
          <button onClick={() => abrirDrawer(r)} className="bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium py-1 px-3 rounded-lg transition-colors text-xs cursor-pointer">Detalhes</button>
        </div>
      </div>
    </div>
  )
})

const BoardColumn = ({ status, tasks, statuses, statusOrderMap, setStatus, excluirTarefa, abrirDrawer }: any) => {
  const [isOver, setIsOver] = useState(false)

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (!isOver) setIsOver(true) }
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsOver(false) }
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setIsOver(false)
    const taskId = e.dataTransfer.getData('text/plain')
    const sourceStatus = e.dataTransfer.getData('sourceStatus')
    if (taskId && sourceStatus !== status) setStatus(taskId, status)
  }

  return (
    <div onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} className={`rounded-2xl border flex-1 min-w-[320px] flex flex-col max-h-[75vh] transition-colors ${isOver ? 'bg-[#0f88a8]/10 dark:bg-[#0f88a8]/20 border-[#0f88a8]/50 border-dashed' : 'bg-slate-100/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800'}`}>
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-100/80 dark:bg-slate-800/80 rounded-t-2xl">
        <span className={`font-medium ${isOver ? 'text-[#0f88a8] dark:text-[#7dd3fc]' : 'text-slate-700 dark:text-slate-200'}`}>{status}</span>
        <span className="bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-300 text-xs font-medium px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-600 shadow-sm">{tasks.length}</span>
      </div>
      <div className="p-3 space-y-3 overflow-y-auto flex-1 custom-scrollbar">
        {tasks.map((r: any) => <TaskCard key={r.id} r={r} mode="default" statuses={statuses} statusOrderMap={statusOrderMap} setStatus={setStatus} excluirTarefa={excluirTarefa} abrirDrawer={abrirDrawer} />)}
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

  const [filtroTexto, setFiltroTexto] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<string>('Todos')
  const [filtroSetor, setFiltroSetor] = useState<string>('Todos')
  const [filtroResp, setFiltroResp] = useState<string>('Todos')
  const [filtroClassificacao, setFiltroClassificacao] = useState<string>('Todos')

  const [view, setView] = useState<'list' | 'board' | 'timeboard' | 'calendar'>('timeboard')

  const [planners, setPlanners] = useState<string[]>([])
  const [plannerSel, setPlannerSel] = useState<string>('Todos')

  const [statuses, setStatuses] = useState<string[]>([])
  const [statusOrderMap, setStatusOrderMap] = useState<Record<string, number>>({})

  // Drawer & Upload State
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selected, setSelected] = useState<Row | null>(null)
  
  const [drawerNome, setDrawerNome] = useState<string>('')
  const [drawerStatus, setDrawerStatus] = useState<string>('')
  const [drawerObs, setDrawerObs] = useState<string>('')
  const [drawerVenc, setDrawerVenc] = useState<string>('')
  const [drawerAnexo, setDrawerAnexo] = useState<string>('')
  const [drawerChecklists, setDrawerChecklists] = useState<ChecklistItem[]>([])
  const [drawerClassificacao, setDrawerClassificacao] = useState<string>('')
  const [drawerResps, setDrawerResps] = useState<any[]>([])

  const [novoItemChecklist, setNovoItemChecklist] = useState('')
  const [savingDrawer, setSavingDrawer] = useState(false)
  const [uploadingAnexo, setUploadingAnexo] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Comments & Mentions & Roles
  const [comentarios, setComentarios] = useState<any[]>([])
  const [comentNovo, setComentNovo] = useState('')
  const [userId, setUserId] = useState<string>('')
  const [userName, setUserName] = useState<string>('')
  const [userEmail, setUserEmail] = useState<string>('') 
  const [userRole, setUserRole] = useState<string>('membro')
  const [authLoaded, setAuthLoaded] = useState(false)

  const [loadingComents, setLoadingComents] = useState(false)
  
  const [mentionOpen, setMentionOpen] = useState(false)
  const [mentionFilter, setMentionFilter] = useState('')
  const comentInputRef = useRef<HTMLInputElement>(null)

  // Lookups
  const [setoresDb, setSetoresDb] = useState<Lookup[]>([])
  const [respsDb, setRespsDb] = useState<Lookup[]>([])
  const [classificacoesDb, setClassificacoesDb] = useState<Lookup[]>([])

  // Modal Ad Hoc
  const [adhocOpen, setAdhocOpen] = useState(false)
  const [adhocNome, setAdhocNome] = useState('')
  const [adhocSetorId, setAdhocSetorId] = useState<string>('')
  const [adhocResps, setAdhocResps] = useState<any[]>([])
  
  const [adhocVenc, setAdhocVenc] = useState<string>(new Date().toISOString().slice(0, 10))
  const [adhocPrioridade, setAdhocPrioridade] = useState<string>('Média')
  const [adhocClassificacao, setAdhocClassificacao] = useState<string>('')
  const [adhocObs, setAdhocObs] = useState<string>('')
  const [savingAdhoc, setSavingAdhoc] = useState(false)

  const inicio = useMemo(() => new Date(anoAlvo, mesAlvo, 1), [anoAlvo, mesAlvo])
  const fim = useMemo(() => new Date(anoAlvo, mesAlvo + 1, 1), [anoAlvo, mesAlvo])
  const iso = (d: Date) => d.toISOString().split('T')[0]

  const carregarUsuario = async () => {
    const { data, error } = await supabase.auth.getUser()
    if (error || !data?.user) {
      router.push('/login')
      return
    }
    const u = data.user
    setUserId(u.id)
    setUserEmail(u.email || '')
    
    const { data: prof } = await supabase.from('profiles').select('full_name, role').eq('id', u.id).maybeSingle()
    
    setUserName(prof?.full_name?.trim() || u.email || 'Usuário')
    setUserRole(prof?.role?.toLowerCase().trim() || 'membro')
    setAuthLoaded(true) 
  }

  const carregarLookups = async () => {
    const [{ data: s }, { data: r }, { data: c }] = await Promise.all([
      supabase.from('setores').select('id,nome').order('nome', { ascending: true }),
      supabase.from('responsaveis').select('id,nome,email').order('nome', { ascending: true }),
      supabase.from('classificacoes').select('id,nome').order('nome', { ascending: true }),
    ])
    setSetoresDb((s || []) as any)
    setRespsDb((r || []) as any)
    setClassificacoesDb((c || []) as any)
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
    if (!plannerSel || !authLoaded || !userEmail) return
    setCarregando(true)
    
    try {
      const { data, error } = await supabase.from('tarefas_diarias').select(`
          id, data_vencimento, status, data_conclusao, observacoes, anexo_url, checklists,
          atividades!tarefas_diarias_atividade_id_fkey (
            task_id, nome_atividade, planner_name, frequencia, prioridade_descricao, responsavel_id, classificacao, responsaveis_lista,
            setores!atividades_setor_id_fkey (nome), responsaveis!atividades_responsavel_id_fkey (nome, email)
          )
        `).gte('data_vencimento', iso(inicio)).lt('data_vencimento', iso(fim)).order('data_vencimento', { ascending: true })

      if (error) throw error

      let baseData = data || []

      if (userRole !== 'admin') {
        const emailSeguroLogado = userEmail.trim().toLowerCase()
        
        baseData = baseData.filter((r: any) => {
          const respsTask = getResponsaveis(r?.atividades)
          return respsTask.some((res: any) => (res.email || '').trim().toLowerCase() === emailSeguroLogado)
        })
      }

      const filtradoPlanner = plannerSel === 'Todos' ? baseData : baseData.filter((r: any) => r?.atividades?.planner_name === plannerSel)
      setRows(filtradoPlanner as any)
    } catch (e: any) {
      toast.error('Erro ao carregar tarefas da base de dados.')
    } finally {
      setCarregando(false)
    }
  }

  // 💡 A MÁQUINA DE ENVIO DE E-MAIL DO LEMBRETE DIÁRIO (DISCRETO E SILENCIOSO)
  useEffect(() => {
    if (carregando || !userEmail || rows.length === 0) return;

    const dt = new Date();
    const hojeLocal = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    const cacheKey = `email_lembrete_${userEmail}_${hojeLocal}`;

    // Se já tivermos guardado no navegador que enviamos hoje, ele pára aqui e não faz spam.
    if (localStorage.getItem(cacheKey)) return; 

    const emailSeguroLogado = userEmail.trim().toLowerCase();
    
    // Filtra as tarefas do usuário logado que vencem exatamente hoje e estão pendentes
    const minhasTarefasHoje = rows.filter(r => {
      const isPendente = !(r.status || '').toLowerCase().includes('concl');
      const isParaHoje = r.data_vencimento && r.data_vencimento.slice(0, 10) === hojeLocal;
      
      const respsTask = getResponsaveis(r?.atividades);
      const souResponsavel = respsTask.some((res: any) => (res.email || '').trim().toLowerCase() === emailSeguroLogado);
      
      return isPendente && isParaHoje && souResponsavel;
    });

    if (minhasTarefasHoje.length > 0) {
      // 1. Regista no navegador que já avisou hoje
      localStorage.setItem(cacheKey, 'true');

      // 2. Monta o corpo do e-mail
      const taskListHtml = minhasTarefasHoje.map(t => `<li><strong>${t.atividades?.nome_atividade}</strong></li>`).join('');

      // 3. Dispara o envio silenciosamente
      fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: userEmail,
          subject: `[Lembrete de Vencimento] ${minhasTarefasHoje.length} tarefa(s) expiram HOJE!`,
          taskName: `Resumo Diário`,
          action: `exigem a sua atenção hoje`,
          userName: userName,
          observacoes: `Olá! As seguintes tarefas sob sua responsabilidade têm prazo de entrega para hoje (${dt.toLocaleDateString('pt-BR')}):<br/><br/><ul>${taskListHtml}</ul><br/>Acesse o Portal da Controladoria para atualizar os status.`
        })
      });
    }
  }, [carregando, rows, userEmail, userName]);

  const sendEmailNotification = async (taskId: string, actionText: string, extraObs?: string) => {
    try {
      const task = rows.find(r => r.id === taskId)
      if (!task) return
      
      const resps = getResponsaveis(task.atividades)
      
      for (const resp of resps) {
        if (!resp.email) continue;
        const payload = {
          to: resp.email,
          subject: `[Portal da Controladoria] Atualização de Tarefa: ${task.atividades?.nome_atividade}`,
          taskName: task.atividades?.nome_atividade,
          action: actionText,
          userName: userName,
          observacoes: extraObs || task.observacoes || ''
        }
        await fetch('/api/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      }
    } catch (error) {}
  }

  const handleUploadAnexo = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = event.target.files?.[0]
      if (!file) return

      setUploadingAnexo(true)
      const toastId = toast.loading('A carregar ficheiro...')

      const fileExt = file.name.split('.').pop()
      const fileName = `anexo-${Date.now()}-${Math.floor(Math.random() * 1000)}.${fileExt}`

      const { error: uploadError } = await supabase.storage.from('evidencias').upload(fileName, file)
      if (uploadError) throw uploadError

      const { data: publicUrlData } = supabase.storage.from('evidencias').getPublicUrl(fileName)
      
      setDrawerAnexo(publicUrlData.publicUrl)
      toast.success('Ficheiro anexado com sucesso! Lembre-se de Guardar a tarefa.', { id: toastId })

    } catch (error: any) {
      toast.error('Erro ao carregar o ficheiro. O bucket "evidencias" foi criado?')
    } finally {
      setUploadingAnexo(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const carregarComentarios = async (tarefaId: string) => {
    setLoadingComents(true)
    try {
      const { data } = await supabase.from('tarefa_comentarios').select(`id, tarefa_id, autor_id, autor, mensagem, created_at`).eq('tarefa_id', tarefaId).order('created_at', { ascending: false })
      setComentarios(data || [])
    } finally { setLoadingComents(false) }
  }

  const handleComentInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setComentNovo(val)
    
    const match = val.match(/(?:^|\s)@([a-zA-ZÀ-ÿ\s]*)$/)
    if (match) {
      setMentionOpen(true)
      setMentionFilter(match[1].trim())
    } else {
      setMentionOpen(false)
    }
  }

  const handleSelectMention = (nome: string) => {
    const replaced = comentNovo.replace(/(?:^|\s)@([a-zA-ZÀ-ÿ\s]*)$/, ` @${nome} `)
    setComentNovo(replaced)
    setMentionOpen(false)
    comentInputRef.current?.focus()
  }

  const enviarComentario = async () => {
    if (!selected) return
    const msg = comentNovo.trim()
    if (!msg) return
    if (!userId) { router.push('/login'); return }

    const payload = { tarefa_id: selected.id, autor_id: userId, autor: userName || null, mensagem: msg }
    const { data, error } = await supabase.from('tarefa_comentarios').insert([payload]).select().single()
    if (error) { 
      toast.error('Erro ao guardar o comentário.')
      return 
    }

    setComentarios(prev => [data, ...prev])
    setComentNovo('')
    toast.success('Comentário enviado!')

    const task = rows.find(r => r.id === selected.id)
    const respsTask = getResponsaveis(task?.atividades)

    respsTask.forEach(async (resp: any) => {
      if (resp.email && resp.email !== userEmail) {
        await supabase.from('notificacoes').insert({
          user_email: resp.email,
          titulo: 'Novo Comentário',
          mensagem: `${userName} comentou na tarefa: "${task?.atividades?.nome_atividade}"`
        })
      }
    })

    const usersMentioned = respsDb.filter(r => msg.includes(`@${r.nome}`))
    for (const u of usersMentioned) {
      if (u.email !== userEmail && !respsTask.some((rt: any) => rt.email === u.email)) {
        await supabase.from('notificacoes').insert({
          user_email: u.email,
          titulo: 'Mencionaram-no!',
          mensagem: `${userName} mencionou-o em "${task?.atividades?.nome_atividade}": "${msg}"`
        })
      }
    }

    sendEmailNotification(selected.id, 'comentada', `Novo comentário de ${userName}: "${msg}"`)
  }

  const excluirTarefa = async (tarefaId: string) => {
    if (!window.confirm('⚠️ Tem certeza que deseja excluir esta tarefa?\n\nEssa ação apagará a tarefa e seus comentários. Não pode ser desfeita.')) return
    
    const toastId = toast.loading('A excluir tarefa...')
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
      toast.success('Tarefa excluída permanentemente!', { id: toastId })
    } catch (err: any) {
      toast.error('Erro ao excluir a tarefa.', { id: toastId })
    }
  }

  useEffect(() => { carregarUsuario(); carregarPlanners(); carregarLookups() }, [])
  
  useEffect(() => { 
    if (!plannerSel || !authLoaded || !userEmail) return; 
    ;(async () => { await carregarWorkflow(plannerSel); await carregar() })() 
  }, [plannerSel, mesAlvo, anoAlvo, authLoaded, userRole, userEmail])

  const setStatus = async (id: string, status: string) => {
    const toastId = toast.loading('A atualizar status...')
    setRows(prev => prev.map(r => (r.id === id ? { ...r, status } : r)))
    
    const patch: any = { status, data_conclusao: status.toLowerCase().includes('concl') ? new Date().toISOString() : null }
    const { error } = await supabase.from('tarefas_diarias').update(patch).eq('id', id)
    
    if (error) { 
      toast.error('Erro ao atualizar o status.', { id: toastId })
      carregar() 
      return 
    }
    
    if (selected?.id === id) { setSelected({ ...selected, ...patch }); setDrawerStatus(patch.status) }
    
    toast.success('Status atualizado!', { id: toastId })
    sendEmailNotification(id, `movida para o status "${status}"`, '')
  }

  const abrirDrawer = (r: Row) => {
    setSelected(r)
    setDrawerNome(r.atividades?.nome_atividade || '')
    setDrawerStatus(r.status || statuses[0] || 'Pendente')
    setDrawerObs(r.observacoes || '')
    setDrawerVenc(r.data_vencimento ? String(r.data_vencimento).slice(0, 10) : '')
    setDrawerAnexo(r.anexo_url || '') 
    setDrawerChecklists(r.checklists || []) 
    setDrawerClassificacao(r.atividades?.classificacao || '')
    setDrawerResps(getResponsaveis(r.atividades))
    
    setDrawerOpen(true)
    setComentarios([])
    setComentNovo('')
    setMentionOpen(false)
    setNovoItemChecklist('')
    carregarComentarios(r.id)
  }

  const fecharDrawer = () => { 
    setDrawerOpen(false)
    setSelected(null)
    setDrawerNome('')
    setDrawerStatus('')
    setDrawerObs('')
    setDrawerVenc('')
    setDrawerAnexo('')
    setDrawerChecklists([])
    setDrawerClassificacao('')
    setDrawerResps([])
    setNovoItemChecklist('')
    setSavingDrawer(false)
    setComentarios([])
    setComentNovo('')
    setMentionOpen(false)
  }

  const handleAddChecklist = () => {
    if (!novoItemChecklist.trim()) return
    const newItem: ChecklistItem = { id: crypto.randomUUID(), texto: novoItemChecklist, concluido: false }
    setDrawerChecklists([...drawerChecklists, newItem])
    setNovoItemChecklist('')
  }

  const handleToggleChecklist = (id: string) => {
    setDrawerChecklists(drawerChecklists.map(c => c.id === id ? { ...c, concluido: !c.concluido } : c))
  }

  const handleRemoveChecklist = (id: string) => {
    setDrawerChecklists(drawerChecklists.filter(c => c.id !== id))
  }

  const salvarDrawer = async () => {
    if (!selected) return
    if (!drawerNome.trim()) { toast.error('O título não pode estar vazio.'); return }

    setSavingDrawer(true)
    const toastId = toast.loading('A guardar alterações...')

    const patch: any = { 
      status: drawerStatus, 
      observacoes: drawerObs || null, 
      data_vencimento: drawerVenc || null, 
      anexo_url: drawerAnexo || null, 
      checklists: drawerChecklists, 
      data_conclusao: drawerStatus.toLowerCase().includes('concl') ? (selected.data_conclusao || new Date().toISOString()) : null 
    }

    try {
      const { error } = await supabase.from('tarefas_diarias').update(patch).eq('id', selected.id)
      if (error) throw error

      let mudouMatriz = false
      const nomeAntigo = selected.atividades?.nome_atividade || ''
      const classifAntiga = selected.atividades?.classificacao || ''
      
      if (selected.atividades?.task_id) {
        const { error: errAtv } = await supabase.from('atividades')
          .update({ 
            nome_atividade: drawerNome,
            classificacao: drawerClassificacao || null,
            responsaveis_lista: drawerResps.length > 0 ? drawerResps : null 
          })
          .eq('task_id', selected.atividades.task_id)
        
        if (errAtv) throw errAtv
        mudouMatriz = true
      }

      setRows(prev => prev.map(r => {
        let atualizado = { ...r }
        if (r.id === selected.id) {
          atualizado = { ...atualizado, ...patch }
        }
        if (mudouMatriz && r.atividades?.task_id === selected.atividades?.task_id) {
          atualizado.atividades = { 
            ...atualizado.atividades, 
            nome_atividade: drawerNome,
            classificacao: drawerClassificacao || null,
            responsaveis_lista: drawerResps
          }
        }
        return atualizado
      }))

      setSelected(prev => prev ? { 
        ...prev, 
        ...patch, 
        atividades: { 
          ...prev.atividades, 
          nome_atividade: drawerNome,
          classificacao: drawerClassificacao || null,
          responsaveis_lista: drawerResps
        } 
      } : prev)

      toast.success('Detalhes guardados!', { id: toastId })
      
      let emailObs = drawerObs || ''
      if (drawerAnexo) emailObs += `<br/><br/>📎 <strong>Anexo adicionado:</strong> <a href="${drawerAnexo}">Ver Ficheiro</a>`
      sendEmailNotification(selected.id, `atualizada com novas observações/anexos`, emailObs)

    } catch (err: any) {
      toast.error('Erro ao guardar os detalhes.', { id: toastId })
    } finally {
      setSavingDrawer(false)
      fecharDrawer()
    }
  }

  const concluirNoDrawer = async () => {
    if (!selected) return
    if (drawerChecklists.length > 0 && drawerChecklists.some(c => !c.concluido)) {
      if(!window.confirm('Existem itens não concluídos no checklist! Tem a certeza que deseja concluir a tarefa matriz assim mesmo?')) return
    }
    await setStatus(selected.id, statuses[statuses.length - 1] || 'Concluído')
    fecharDrawer()
  }

  const criarAdHoc = async () => {
    const nome = adhocNome.trim(); if (!nome || !adhocVenc) return
    setSavingAdhoc(true)
    const toastId = toast.loading('A criar tarefa e a notificar...')

    try {
      const taskId = crypto.randomUUID()
      const payloadAtv: any = { 
        task_id: taskId, 
        planner_name: 'Ad Hoc', 
        nome_atividade: nome, 
        setor_id: adhocSetorId || null, 
        frequencia: 'Ad Hoc', 
        status: 'Ativo',
        prioridade_descricao: adhocPrioridade,
        classificacao: adhocClassificacao || null,
        responsaveis_lista: adhocResps.length > 0 ? adhocResps : null 
      }
      const { data: atv, error: errAtv } = await supabase.from('atividades').insert([payloadAtv]).select('task_id').single()
      if (errAtv) throw errAtv

      const payloadExec: any = { 
        atividade_id: atv.task_id, 
        data_vencimento: adhocVenc, 
        status: statuses[0] || 'Pendente',
        observacoes: adhocObs || null 
      }
      const { error: errExec } = await supabase.from('tarefas_diarias').insert([payloadExec])
      if (errExec) throw errExec

      setAdhocOpen(false); setAdhocNome(''); setAdhocSetorId(''); setAdhocResps([]); setAdhocVenc(new Date().toISOString().slice(0, 10)); setAdhocPrioridade('Média'); setAdhocObs(''); setAdhocClassificacao('');
      
      adhocResps.forEach(async (resp) => {
        if (resp.email) {
          await supabase.from('notificacoes').insert({
            user_email: resp.email,
            titulo: 'Nova Tarefa Ad Hoc',
            mensagem: `${userName} delegou a você: "${nome}" para o dia ${adhocVenc.slice(8,10)}/${adhocVenc.slice(5,7)}`
          })

          await fetch('/api/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: resp.email,
              subject: `[Portal da Controladoria] Nova Tarefa Ad Hoc: ${nome}`,
              taskName: nome,
              action: `criada e atribuída a você`,
              userName: userName,
              observacoes: `Prazo: ${adhocVenc.slice(8,10)}/${adhocVenc.slice(5,7)}/${adhocVenc.slice(0,4)}<br/>Prioridade: <strong>${adhocPrioridade}</strong><br/>Classificação: <strong>${adhocClassificacao || 'Nenhuma'}</strong><br/><br/>Detalhes Adicionais:<br/>${adhocObs || 'Nenhum detalhe fornecido.'}`
            })
          })
        }
      })

      await carregarPlanners(); await carregar()
      toast.success('Tarefa Ad Hoc criada!', { id: toastId })
    } catch (error) {
      toast.error('Erro ao criar tarefa.', { id: toastId })
    } finally { 
      setSavingAdhoc(false) 
    }
  }

  const setorOptions = useMemo(() => Array.from(new Set(rows.map(r => r.atividades?.setores?.nome).filter(Boolean))).sort(), [rows])
  
  const respOptions = useMemo(() => {
    const allNames = new Set<string>();
    rows.forEach(r => {
      const resps = getResponsaveis(r.atividades);
      resps.forEach((res: any) => { if (res.nome) allNames.add(res.nome); });
    });
    return Array.from(allNames).sort();
  }, [rows])
  
  const classifOptions = useMemo(() => Array.from(new Set(rows.map(r => r.atividades?.classificacao).filter(Boolean))).sort(), [rows])

  const filtradas = useMemo(() => {
    const q = filtroTexto.trim().toLowerCase()
    return rows.filter((r) => {
      const atv = r.atividades || {}
      const nome = (atv.nome_atividade || '').toLowerCase()
      const st = r.status || statuses[0] || 'Pendente'
      
      const respsTask = getResponsaveis(atv)
      const matchesRespFiltro = respsTask.some((res: any) => res.nome?.toLowerCase().includes(q))
      
      const okTexto = !q || nome.includes(q) || (atv.setores?.nome || '').toLowerCase().includes(q) || matchesRespFiltro
      const okStatus = filtroStatus === 'Todos' ? true : st === filtroStatus
      const okSetor = filtroSetor === 'Todos' ? true : (atv.setores?.nome === filtroSetor)
      
      const okResp = filtroResp === 'Todos' ? true : respsTask.some((res: any) => res.nome === filtroResp)
      const okClassificacao = filtroClassificacao === 'Todos' ? true : (atv.classificacao === filtroClassificacao)
      
      return okTexto && okStatus && okSetor && okResp && okClassificacao
    })
  }, [rows, filtroTexto, filtroStatus, filtroSetor, filtroResp, filtroClassificacao, statuses])

  const dashboard = useMemo(() => {
    const done = filtradas.filter(r => (r.status || '').toLowerCase().includes('concl')).length
    const pendentes = filtradas.filter(r => !(r.status || '').toLowerCase().includes('concl'))
    
    return {
      total: filtradas.length, 
      done, 
      overdue: pendentes.filter(r => getBucket(r.data_vencimento) === 'Atrasadas').length,
      dueToday: pendentes.filter(r => getBucket(r.data_vencimento) === 'Hoje').length, 
      dueTomorrow: pendentes.filter(r => getBucket(r.data_vencimento) === 'Amanhã').length,
      next7: pendentes.filter(r => getBucket(r.data_vencimento) === 'Próx 7 dias').length, 
      pct: filtradas.length ? Math.round((done / filtradas.length) * 100) : 0
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
    filtradas.forEach(r => { 
      if ((r.status || '').toLowerCase().includes('concl')) return;
      const b = getBucket(r.data_vencimento); 
      if (buckets[b]) buckets[b].push(r) 
    })
    return buckets
  }, [filtradas])

  const calendarData = useMemo(() => {
    const dataAlvo = new Date(anoAlvo, mesAlvo, 1)
    const diasNoMes = new Date(anoAlvo, mesAlvo + 1, 0).getDate()
    const primeiroDiaSemana = dataAlvo.getDay() 
    const diasVaziosInicio = Array.from({ length: primeiroDiaSemana }).map((_, i) => `empty-start-${i}`)
    
    const diasDoMes = Array.from({ length: diasNoMes }).map((_, i) => {
      const dia = i + 1
      const dataString = `${anoAlvo}-${String(mesAlvo + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
      const tarefasDoDia = filtradas.filter(t => t.data_vencimento?.startsWith(dataString))
      return { dia, dataString, tarefas: tarefasDoDia, isHoje: dataString === new Date().toISOString().slice(0, 10) }
    })

    const ultimoDiaSemana = new Date(anoAlvo, mesAlvo + 1, 0).getDay()
    const paddingFim = 6 - ultimoDiaSemana
    const diasVaziosFim = Array.from({ length: paddingFim }).map((_, i) => `empty-end-${i}`)

    return { diasVaziosInicio, diasDoMes, diasVaziosFim }
  }, [anoAlvo, mesAlvo, filtradas])

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-8 font-sans relative transition-colors duration-300">
      
      <Toaster 
        position="bottom-right" 
        toastOptions={{
          style: { background: '#063955', color: '#fff', fontSize: '14px', borderRadius: '12px', padding: '12px 20px' },
          success: { iconTheme: { primary: '#2d6943', secondary: '#fff' } },
          error: { iconTheme: { primary: '#b43a3d', secondary: '#fff' } },
        }}
      />

      <header className="flex flex-col xl:flex-row xl:justify-between xl:items-center gap-4 mb-6 bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 transition-colors">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            Painel de Execução 
            <span className="text-[10px] uppercase font-bold tracking-widest bg-[#0f88a8]/10 text-[#0f88a8] dark:bg-[#38bdf8]/10 dark:text-[#38bdf8] px-2 py-1 rounded-md mt-1">
              {userRole === 'admin' ? 'Visão Admin' : 'Minhas Tarefas'}
            </span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Mês: {MESES.find(m => m.v === mesAlvo)?.n}/{anoAlvo}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => setAdhocOpen(true)} className="bg-[#0f88a8] hover:bg-[#0c708b] text-white text-sm font-medium py-2 px-4 rounded-xl transition-all shadow-sm">
            + Nova Ad Hoc
          </button>

          <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1 border border-slate-200 dark:border-slate-700">
            <button onClick={() => setView('list')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${view === 'list' ? 'bg-white dark:bg-slate-700 shadow-sm text-[#063955] dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>Lista</button>
            <button onClick={() => setView('board')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${view === 'board' ? 'bg-white dark:bg-slate-700 shadow-sm text-[#063955] dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>Status</button>
            <button onClick={() => setView('timeboard')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${view === 'timeboard' ? 'bg-white dark:bg-slate-700 shadow-sm text-[#063955] dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>Dias</button>
            <button onClick={() => setView('calendar')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${view === 'calendar' ? 'bg-white dark:bg-slate-700 shadow-sm text-[#063955] dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>Mês</button>
          </div>

          <select className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 outline-none focus:border-[#0f88a8] transition-colors" value={plannerSel} onChange={(e) => setPlannerSel(e.target.value)}>
            <option value="Todos">Todos os Planners</option>
            {planners.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>

          <select className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 outline-none focus:border-[#0f88a8] transition-colors" value={mesAlvo} onChange={(e) => setMesAlvo(Number(e.target.value))}>
            {MESES.map((m) => <option key={m.v} value={m.v}>{m.n}</option>)}
          </select>

          <input className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 w-24 outline-none focus:border-[#0f88a8] transition-colors" type="number" value={anoAlvo} onChange={(e) => setAnoAlvo(Number(e.target.value))} />

          <button onClick={carregar} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium py-2 px-4 rounded-xl transition-all shadow-sm">↻ Atualizar</button>
        </div>
      </header>

      {/* KPIS */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-3 mb-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 shadow-sm transition-colors">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Total</div>
          {carregando ? <div className="h-8 w-16 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse mt-1"></div> : <div className="text-2xl font-light text-slate-900 dark:text-white mt-1">{dashboard.total}</div>}
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 shadow-sm transition-colors">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Atrasadas</div>
          {carregando ? <div className="h-8 w-16 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse mt-1"></div> : <div className="text-2xl font-light text-[#b43a3d] dark:text-[#f87171] mt-1">{dashboard.overdue}</div>}
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 shadow-sm transition-colors">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Hoje</div>
          {carregando ? <div className="h-8 w-16 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse mt-1"></div> : <div className="text-2xl font-light text-[#0f88a8] dark:text-[#38bdf8] mt-1">{dashboard.dueToday}</div>}
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 shadow-sm transition-colors">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Amanhã</div>
          {carregando ? <div className="h-8 w-16 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse mt-1"></div> : <div className="text-2xl font-light text-slate-900 dark:text-white mt-1">{dashboard.dueTomorrow}</div>}
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 shadow-sm transition-colors">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Próx 7 dias</div>
          {carregando ? <div className="h-8 w-16 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse mt-1"></div> : <div className="text-2xl font-light text-slate-900 dark:text-white mt-1">{dashboard.next7}</div>}
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 shadow-sm transition-colors">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Concluídas</div>
          {carregando ? <div className="h-8 w-24 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse mt-1"></div> : <div className="text-2xl font-light text-[#2d6943] dark:text-[#4ade80] mt-1">{dashboard.done} <span className="text-sm font-medium text-slate-400">({dashboard.pct}%)</span></div>}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 mb-6 flex flex-wrap gap-3 items-center transition-colors">
        <input value={filtroTexto} onChange={(e) => setFiltroTexto(e.target.value)} placeholder="Buscar atividade..." className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-sm w-full md:w-64 outline-none focus:border-[#0f88a8] dark:text-white transition-colors" />
        
        <select value={filtroClassificacao} onChange={(e) => setFiltroClassificacao(e.target.value)} className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-700 dark:text-slate-200 outline-none transition-colors">
          <option value="Todos">Classificação: Todas</option>
          {classifOptions.map(c => <option key={c as string} value={c as string}>{c as string}</option>)}
        </select>
        
        <select value={filtroSetor} onChange={(e) => setFiltroSetor(e.target.value)} className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-700 dark:text-slate-200 outline-none transition-colors"><option value="Todos">Setor: Todos</option>{setorOptions.map(s => <option key={s as string} value={s as string}>{s as string}</option>)}</select>
        
        <select value={filtroResp} onChange={(e) => setFiltroResp(e.target.value)} className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-700 dark:text-slate-200 outline-none transition-colors"><option value="Todos">Resp: Todos</option>{respOptions.map(r => <option key={r as string} value={r as string}>{r as string}</option>)}</select>
        
        <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-700 dark:text-slate-200 outline-none transition-colors"><option value="Todos">Status: Todos</option>{statuses.map(s => <option key={s} value={s}>{s}</option>)}</select>
        
        <button onClick={() => { setFiltroTexto(''); setFiltroSetor('Todos'); setFiltroResp('Todos'); setFiltroStatus('Todos'); setFiltroClassificacao('Todos') }} className="text-sm font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 px-2 transition-colors">Limpar Filtros</button>
        <span className="ml-auto text-sm font-medium text-slate-400">{filtradas.length} tarefas</span>
      </div>

      {/* RENDERIZAÇÃO DAS VISTAS */}
      {carregando ? (
        view === 'list' ? <SkeletonList /> : (view === 'calendar' ? <SkeletonCalendar /> : <SkeletonBoard columns={view === 'board' ? (statuses.length || 4) : 5} />)
      ) : (
        <>
          {view === 'list' && (
            <main className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden transition-colors">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase text-xs">
                      <th className="p-4 font-medium">Vencimento</th><th className="p-4 font-medium">Atividade</th><th className="p-4 font-medium">Setor</th><th className="p-4 font-medium">Responsável</th><th className="p-4 font-medium">Status</th><th className="p-4 font-medium text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                    {filtradas.map((r) => {
                      const respsList = getResponsaveis(r.atividades);
                      const nomesTd = respsList.length > 0 ? respsList.map((res:any) => res.nome).join(', ') : '—';
                      return (
                      <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-sm">
                        <td className="p-4 text-slate-600 dark:text-slate-400">{r.data_vencimento ? String(r.data_vencimento).slice(0, 10) : '—'}</td>
                        <td className="p-4 font-medium text-slate-800 dark:text-white flex items-center gap-2">
                          {r.anexo_url && <span title="Tem anexo" className="text-[#0f88a8]">📎</span>}
                          <div className="flex flex-col">
                            <span>{r.atividades?.nome_atividade || '-'}</span>
                            {r.atividades?.classificacao && <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase mt-0.5">{r.atividades.classificacao}</span>}
                          </div>
                        </td>
                        <td className="p-4 text-slate-500 dark:text-slate-400">{r.atividades?.setores?.nome || '-'}</td>
                        <td className="p-4 text-slate-500 dark:text-slate-400 max-w-[150px] truncate" title={nomesTd}>{nomesTd}</td>
                        <td className="p-4"><span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${badge(r.status)}`}>{r.status}</span></td>
                        <td className="p-4 text-right flex justify-end items-center gap-3">
                          <button onClick={() => excluirTarefa(r.id)} className="text-slate-300 hover:text-[#b43a3d] dark:hover:text-[#f87171] transition-colors" title="Excluir">🗑️</button>
                          <button onClick={() => abrirDrawer(r)} className="text-[#0f88a8] dark:text-[#38bdf8] hover:text-[#063955] dark:hover:text-white font-medium transition-colors">Detalhes</button>
                        </td>
                      </tr>
                    )})}
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
                <div key={b} className={`rounded-2xl border flex-1 min-w-[320px] flex flex-col max-h-[75vh] transition-colors ${b === 'Atrasadas' ? 'bg-[#b43a3d]/10 dark:bg-[#b43a3d]/20 border-[#b43a3d]/20 dark:border-[#b43a3d]/30' : 'bg-slate-100/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800'}`}>
                  <div className={`p-4 border-b flex justify-between items-center rounded-t-2xl transition-colors ${b === 'Atrasadas' ? 'border-[#b43a3d]/30 dark:border-[#b43a3d]/40 text-[#b43a3d] dark:text-[#f87171]' : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'}`}>
                    <span className="font-medium">{b}</span><span className="bg-white dark:bg-slate-700 text-xs font-medium px-2 py-0.5 rounded-full shadow-sm">{timeboard[b]?.length || 0}</span>
                  </div>
                  <div className="p-3 space-y-3 overflow-y-auto flex-1 custom-scrollbar">
                    {(timeboard[b] || []).map((r) => <TaskCard key={r.id} r={r} mode="timeboard" statuses={statuses} statusOrderMap={statusOrderMap} setStatus={setStatus} excluirTarefa={excluirTarefa} abrirDrawer={abrirDrawer} />)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {view === 'calendar' && (
            <main className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden transition-colors">
              <div className="grid grid-cols-7 border-b border-slate-100 dark:border-slate-800 bg-[#063955] dark:bg-slate-950">
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
                  <div key={d} className="p-3 text-center text-xs font-bold text-white uppercase tracking-wider">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 auto-rows-fr bg-slate-100 dark:bg-slate-800 gap-[1px]">
                {calendarData.diasVaziosInicio.map(id => (
                  <div key={id} className="min-h-[140px] bg-slate-50/50 dark:bg-slate-900/50"></div>
                ))}
                
                {calendarData.diasDoMes.map(diaInfo => (
                  <div key={diaInfo.dia} className={`min-h-[140px] p-2 bg-white dark:bg-slate-900 flex flex-col transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/80 ${diaInfo.isHoje ? 'ring-2 ring-inset ring-[#0f88a8] dark:ring-[#38bdf8] bg-[#0f88a8]/5 dark:bg-[#0f88a8]/10' : ''}`}>
                    <div className="flex justify-between items-start mb-2">
                      <span className={`text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full ${diaInfo.isHoje ? 'bg-[#0f88a8] dark:bg-[#38bdf8] text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'}`}>
                        {diaInfo.dia}
                      </span>
                      {diaInfo.tarefas.length > 0 && (
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 rounded">{diaInfo.tarefas.length}</span>
                      )}
                    </div>
                    
                    <div className="flex-1 space-y-1.5 overflow-y-auto max-h-[100px] custom-scrollbar pr-1">
                      {diaInfo.tarefas.map(t => (
                        <div 
                          key={t.id} 
                          onClick={() => abrirDrawer(t)}
                          className={`text-[10px] leading-tight p-1.5 rounded cursor-pointer font-medium border border-black/5 dark:border-white/5 hover:shadow-md transition-all truncate flex items-center justify-between gap-1 ${badge(t.status)}`}
                          title={`${t.atividades?.nome_atividade} (${t.status})`}
                        >
                          <span className="truncate">{t.anexo_url && '📎 '} {t.atividades?.nome_atividade || 'Tarefa'}</span>
                          {t.atividades?.classificacao && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" title={t.atividades.classificacao} />}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {calendarData.diasVaziosFim.map(id => (
                  <div key={id} className="min-h-[140px] bg-slate-50/50 dark:bg-slate-900/50"></div>
                ))}
              </div>
            </main>
          )}
        </>
      )}

      {/* MODAL AD HOC */}
      {adhocOpen && (
        <>
          <div className="fixed inset-0 bg-[#063955]/20 dark:bg-black/60 backdrop-blur-sm z-40 transition-all" onClick={() => setAdhocOpen(false)} />
          <aside className="fixed top-0 right-0 h-full w-full sm:w-[480px] bg-white dark:bg-slate-900 z-50 shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col transition-colors">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start">
              <div><span className="text-xs text-[#0f88a8] dark:text-[#38bdf8] font-semibold tracking-wide uppercase">Nova Tarefa Pontual</span><h2 className="text-xl text-slate-900 dark:text-white font-semibold mt-1">Planner: Ad Hoc</h2></div>
              <button onClick={() => setAdhocOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2">✕</button>
            </div>
            
            <div className="p-6 space-y-5 flex-1 overflow-y-auto custom-scrollbar">
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400 font-medium block mb-1">Nome da atividade</label>
                <input value={adhocNome} onChange={(e) => setAdhocNome(e.target.value)} className="w-full bg-transparent border border-slate-200 dark:border-slate-800 dark:text-white rounded-xl px-4 py-3 text-sm outline-none focus:border-[#0f88a8]" placeholder="Ex: Ajustar lançamento X..." />
              </div>
              
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400 font-medium block mb-1">Setor</label>
                <select value={adhocSetorId} onChange={(e) => setAdhocSetorId(e.target.value)} className="w-full bg-transparent border border-slate-200 dark:border-slate-800 dark:text-white rounded-xl px-3 py-3 text-sm outline-none focus:border-[#0f88a8]">
                  <option value="" className="dark:bg-slate-900">(sem setor)</option>
                  {setoresDb.map(s => <option key={s.id} value={s.id} className="dark:bg-slate-900">{s.nome}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400 font-medium block mb-1 flex justify-between">
                  Envolvidos na Tarefa
                  <span className="text-[#0f88a8] font-bold">{adhocResps.length} selecionado(s)</span>
                </label>
                <div className="border rounded-xl p-2 max-h-36 overflow-y-auto bg-transparent border-slate-200 dark:border-slate-800 custom-scrollbar">
                  {respsDb.map(r => {
                    const isChecked = adhocResps.some(dr => dr.id === r.id);
                    return (
                      <label key={r.id} className="flex items-center gap-3 p-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded cursor-pointer transition-colors">
                        <input 
                          type="checkbox" 
                          checked={isChecked} 
                          onChange={(e) => {
                            if (e.target.checked) setAdhocResps([...adhocResps, {id: r.id, nome: r.nome, email: r.email}])
                            else setAdhocResps(adhocResps.filter(dr => dr.id !== r.id))
                          }}
                          className="w-4 h-4 rounded border-slate-300 text-[#0f88a8] focus:ring-[#0f88a8] cursor-pointer"
                        />
                        <span className={`text-sm ${isChecked ? 'font-semibold text-[#0f88a8] dark:text-[#38bdf8]' : 'text-slate-700 dark:text-slate-300'}`}>{r.nome}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-500 dark:text-slate-400 font-medium block mb-1">Vencimento</label>
                  <input type="date" value={adhocVenc} onChange={(e) => setAdhocVenc(e.target.value)} className="w-full bg-transparent border border-slate-200 dark:border-slate-800 dark:text-white rounded-xl px-4 py-3 text-sm outline-none focus:border-[#0f88a8]" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 dark:text-slate-400 font-medium block mb-1">Prioridade</label>
                  <select value={adhocPrioridade} onChange={(e) => setAdhocPrioridade(e.target.value)} className="w-full bg-transparent border border-slate-200 dark:border-slate-800 dark:text-white rounded-xl px-3 py-3 text-sm outline-none focus:border-[#0f88a8]">
                    <option value="Baixa" className="dark:bg-slate-900">Baixa</option>
                    <option value="Média" className="dark:bg-slate-900">Média</option>
                    <option value="Alta" className="dark:bg-slate-900">Alta</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400 font-medium block mb-1">Classificação</label>
                <select value={adhocClassificacao} onChange={(e) => setAdhocClassificacao(e.target.value)} className="w-full bg-transparent border border-slate-200 dark:border-slate-800 dark:text-white rounded-xl px-3 py-3 text-sm outline-none focus:border-[#0f88a8]">
                  <option value="" className="dark:bg-slate-900">(Nenhuma)</option>
                  {classificacoesDb.map(c => <option key={c.id} value={c.nome} className="dark:bg-slate-900">{c.nome}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400 font-medium block mb-1">Observações / Detalhes</label>
                <textarea value={adhocObs} onChange={(e) => setAdhocObs(e.target.value)} rows={4} className="w-full bg-transparent border border-slate-200 dark:border-slate-800 dark:text-white rounded-xl px-4 py-3 text-sm outline-none focus:border-[#0f88a8] resize-none" placeholder="Forneça instruções, links ou contexto adicional para quem vai executar a tarefa..." />
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex gap-2 bg-slate-50 dark:bg-slate-950">
              <button onClick={criarAdHoc} disabled={savingAdhoc} className="bg-[#0f88a8] text-white px-5 py-3 w-full rounded-xl text-sm font-semibold hover:bg-[#0c708b] transition-colors shadow-sm disabled:opacity-50">
                {savingAdhoc ? 'A processar...' : 'Criar Tarefa'}
              </button>
            </div>
          </aside>
        </>
      )}

      {/* DRAWER COM DETALHES E MENÇÕES */}
      {drawerOpen && selected && (
        <>
          <div className="fixed inset-0 bg-[#063955]/20 dark:bg-black/60 backdrop-blur-sm z-40 transition-all" onClick={fecharDrawer} />
          <aside className="fixed top-0 right-0 h-full w-full sm:w-[520px] bg-white dark:bg-slate-900 z-50 shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col transition-colors">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start">
              <div className="w-full mr-4">
                <span className="text-xs text-[#0f88a8] dark:text-[#38bdf8] font-semibold tracking-wide uppercase">Detalhes da Tarefa</span>
                
                <input 
                  value={drawerNome} 
                  onChange={(e) => setDrawerNome(e.target.value)} 
                  className="w-full text-xl text-[#063955] dark:text-white font-semibold mt-1 bg-transparent border-b-2 border-transparent focus:border-[#0f88a8] outline-none transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 px-1 -ml-1 rounded"
                  title="Clique para editar o nome da atividade"
                />

                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
                  <span>{selected.atividades?.setores?.nome || '—'}</span>
                  <span>•</span>
                  <span>{selected.atividades?.planner_name || '—'}</span>
                </div>
              </div>
              <button onClick={fecharDrawer} className="text-slate-400 hover:text-[#063955] dark:hover:text-white p-2">✕</button>
            </div>
            
            <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-slate-500 dark:text-slate-400 font-medium block mb-1">Status</label>
                    <select value={drawerStatus} onChange={e => setDrawerStatus(e.target.value)} className="w-full bg-transparent border border-slate-200 dark:border-slate-800 dark:text-white rounded-xl p-2.5 text-sm outline-none focus:border-[#0f88a8]">
                      {statuses.map(s => <option key={s} value={s} className="dark:bg-slate-900">{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 dark:text-slate-400 font-medium block mb-1">Vencimento</label>
                    <input type="date" value={drawerVenc} onChange={e => setDrawerVenc(e.target.value)} className="w-full bg-transparent border border-slate-200 dark:border-slate-800 dark:text-white rounded-xl p-2.5 text-sm outline-none focus:border-[#0f88a8]"/>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-500 dark:text-slate-400 font-medium block mb-1">Classificação da Tarefa</label>
                  <select value={drawerClassificacao} onChange={e => setDrawerClassificacao(e.target.value)} className="w-full bg-transparent border border-slate-200 dark:border-slate-800 dark:text-white rounded-xl p-2.5 text-sm outline-none focus:border-[#0f88a8]">
                    <option value="" className="dark:bg-slate-900">(Nenhuma)</option>
                    {classificacoesDb.map(c => <option key={c.id} value={c.nome} className="dark:bg-slate-900">{c.nome}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-500 dark:text-slate-400 font-medium block mb-1 flex justify-between">
                    Envolvidos na Tarefa
                    <span className="text-[#0f88a8] font-bold">{drawerResps.length} selecionado(s)</span>
                  </label>
                  <div className="border rounded-xl p-2 max-h-36 overflow-y-auto bg-transparent border-slate-200 dark:border-slate-800 custom-scrollbar">
                    {respsDb.map(r => {
                      const isChecked = drawerResps.some(dr => dr.id === r.id);
                      return (
                        <label key={r.id} className="flex items-center gap-3 p-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded cursor-pointer transition-colors">
                          <input 
                            type="checkbox" 
                            checked={isChecked} 
                            onChange={(e) => {
                              if (e.target.checked) setDrawerResps([...drawerResps, {id: r.id, nome: r.nome, email: r.email}])
                              else setDrawerResps(drawerResps.filter(dr => dr.id !== r.id))
                            }}
                            className="w-4 h-4 rounded border-slate-300 text-[#0f88a8] focus:ring-[#0f88a8] cursor-pointer"
                          />
                          <span className={`text-sm ${isChecked ? 'font-semibold text-[#0f88a8] dark:text-[#38bdf8]' : 'text-slate-700 dark:text-slate-300'}`}>{r.nome}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700/50">
                  <div className="flex justify-between items-center mb-3">
                    <label className="text-xs text-[#063955] dark:text-slate-300 font-bold tracking-wide uppercase">Subtarefas / Checklist</label>
                    {drawerChecklists.length > 0 && (
                      <span className="text-[10px] font-bold text-[#0f88a8] dark:text-[#38bdf8] bg-[#0f88a8]/10 dark:bg-[#38bdf8]/10 px-2 py-0.5 rounded-full">
                        {drawerChecklists.filter(c => c.concluido).length} de {drawerChecklists.length} concluídas
                      </span>
                    )}
                  </div>
                  
                  <div className="space-y-2 mb-3">
                    {drawerChecklists.map(c => (
                      <div key={c.id} className="flex items-center gap-2 bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm group">
                        <input type="checkbox" checked={c.concluido} onChange={() => handleToggleChecklist(c.id)} className="w-4 h-4 text-[#0f88a8] rounded border-slate-300 focus:ring-[#0f88a8] cursor-pointer" />
                        <span className={`flex-1 text-sm transition-all ${c.concluido ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-200'}`}>{c.texto}</span>
                        <button onClick={() => handleRemoveChecklist(c.id)} className="text-slate-300 dark:text-slate-500 hover:text-[#b43a3d] dark:hover:text-[#f87171] opacity-0 group-hover:opacity-100 transition-opacity px-1">✕</button>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <input value={novoItemChecklist} onChange={e => setNovoItemChecklist(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddChecklist()} placeholder="Adicionar novo passo..." className="flex-1 bg-transparent border border-slate-200 dark:border-slate-700 dark:text-white rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0f88a8]" />
                    <button onClick={handleAddChecklist} className="bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 px-3 rounded-lg text-sm font-medium transition-colors">Adicionar</button>
                  </div>
                </div>
                
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700/50">
                  <label className="text-xs text-[#063955] dark:text-slate-300 font-bold tracking-wide uppercase block mb-3">Evidência / Anexo</label>
                  <div className="flex items-center gap-3">
                    {drawerAnexo ? (
                      <div className="flex items-center gap-2 bg-white dark:bg-slate-800 px-3 py-2 rounded-lg text-sm font-medium w-full justify-between border border-slate-200 dark:border-slate-700 shadow-sm">
                        <a href={drawerAnexo} target="_blank" rel="noreferrer" className="text-[#0f88a8] dark:text-[#38bdf8] hover:underline truncate w-full">📎 Ver Documento Anexado</a>
                        <button onClick={() => setDrawerAnexo('')} className="text-slate-400 hover:text-[#b43a3d] p-1 ml-2 transition-colors">✕</button>
                      </div>
                    ) : (
                      <button onClick={() => fileInputRef.current?.click()} disabled={uploadingAnexo} className="flex items-center justify-center gap-2 w-full bg-white dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-600 rounded-lg px-4 py-3 text-sm text-slate-500 dark:text-slate-400 hover:border-[#0f88a8] hover:text-[#0f88a8] transition-colors disabled:opacity-50">
                        {uploadingAnexo ? 'A carregar ficheiro...' : '📎 Clique para anexar uma evidência'}
                      </button>
                    )}
                    <input type="file" ref={fileInputRef} className="hidden" onChange={handleUploadAnexo} />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-500 dark:text-slate-400 font-medium block mb-1">Observações Gerais</label>
                  <textarea value={drawerObs} onChange={e => setDrawerObs(e.target.value)} rows={4} className="w-full bg-transparent border border-slate-200 dark:border-slate-800 dark:text-white rounded-xl p-3 text-sm outline-none focus:border-[#0f88a8]" placeholder="Informações adicionais..." />
                </div>
                
                <div className="border-t border-slate-100 dark:border-slate-800 pt-5 relative">
                  <label className="text-xs text-slate-500 dark:text-slate-400 font-medium block mb-2">Comentários e Histórico (Use @ para mencionar)</label>
                  
                  {mentionOpen && (
                    <div className="absolute bottom-full mb-2 left-0 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50">
                       <div className="bg-[#063955] dark:bg-slate-900 text-white text-xs font-bold px-4 py-2">Mencionar Colaborador</div>
                       <div className="max-h-40 overflow-y-auto custom-scrollbar">
                         {respsDb.filter(r => r.nome.toLowerCase().includes(mentionFilter.toLowerCase())).map(r => (
                           <div 
                             key={r.id} 
                             onClick={() => handleSelectMention(r.nome)}
                             className="px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer text-slate-700 dark:text-slate-200 border-b border-slate-100 dark:border-slate-700 last:border-0 transition-colors"
                           >
                             <span className="font-semibold text-sm text-[#0f88a8] dark:text-[#38bdf8] block">{r.nome}</span>
                             <span className="text-[10px] text-slate-400 block">{r.email}</span>
                           </div>
                         ))}
                         {respsDb.filter(r => r.nome.toLowerCase().includes(mentionFilter.toLowerCase())).length === 0 && (
                           <div className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 text-center bg-slate-50 dark:bg-slate-800">Ninguém encontrado...</div>
                         )}
                       </div>
                    </div>
                  )}

                  <div className="flex gap-2 relative">
                    <input 
                      ref={comentInputRef}
                      value={comentNovo} 
                      onChange={handleComentInput} 
                      onKeyDown={e => e.key === 'Enter' && !mentionOpen && enviarComentario()} 
                      placeholder="Escreva algo... (ex: @Patricia valida isto?)" 
                      className="flex-1 bg-transparent border border-slate-200 dark:border-slate-800 dark:text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-[#0f88a8] transition-colors"
                    />
                    <button onClick={enviarComentario} className="bg-[#0f88a8] text-white px-4 rounded-xl text-sm font-medium hover:bg-[#0c708b] transition-colors">Enviar</button>
                  </div>
                  
                  <div className="mt-4 space-y-2">
                    {comentarios.map(c => (
                      <div key={c.id} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-100 dark:border-slate-700/50">
                        <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                          <span className="font-bold text-[#063955] dark:text-slate-200">{c.autor || 'Usuário'}</span>
                          <span>{String(c.created_at).slice(0,16).replace('T',' ')}</span>
                        </div>
                        <p className="text-sm text-slate-800 dark:text-slate-300 leading-relaxed" dangerouslySetInnerHTML={{ __html: c.mensagem.replace(/@([a-zA-ZÀ-ÿ\s]+)/g, '<strong class="text-[#0f88a8] dark:text-[#38bdf8]">@$1</strong>') }}></p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-between bg-slate-50 dark:bg-slate-950 transition-colors">
              <button onClick={() => excluirTarefa(selected.id)} className="text-[#b43a3d] dark:text-[#f87171] hover:bg-[#b43a3d]/10 dark:hover:bg-[#b43a3d]/20 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors">Excluir Tarefa</button>
              <div className="flex gap-2">
                <button onClick={salvarDrawer} className="bg-[#0f88a8] text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-[#0c708b] transition-colors shadow-sm">{savingDrawer ? 'A guardar...' : 'Salvar'}</button>
                <button onClick={concluirNoDrawer} className="bg-[#2d6943] text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-[#204e31] transition-colors shadow-sm">✓ Concluir</button>
              </div>
            </div>
          </aside>
        </>
      )}
    </div>
  )
}