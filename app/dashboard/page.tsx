'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Row = {
  id: string
  data_vencimento: string | null
  status: string | null
  data_conclusao: string | null
  atividades?: {
    planner_name?: string | null
    frequencia?: string | null
    setores?: { nome?: string | null } | null
    responsaveis?: { nome?: string | null } | null
  } | null
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const addDays = (d: Date, n: number) => {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}
const iso = (d: Date) => d.toISOString().slice(0, 10)
const parseISODateOnly = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}
const niceLabel = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`

const COLORS = {
  navy: '#0B1F3A',
  blue: '#1D4ED8',
  lightBlue: '#93C5FD',
  grayTrack: '#F1F5F9', // Ajustado para tom slate bem claro
  muted: '#64748B',
  okGreen: '#10B981',
  warnAmber: '#F59E0B',
  dangerRed: '#EF4444',
}

function Section({
  title,
  subtitle,
  right,
  children,
}: {
  title: string
  subtitle?: string
  right?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden flex flex-col">
      <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-start justify-between gap-4">
        <div>
          <div className="text-base font-semibold text-slate-800">{title}</div>
          {subtitle ? <div className="text-[13px] font-medium text-slate-500 mt-0.5">{subtitle}</div> : null}
        </div>
        {right}
      </div>
      <div className="p-5 flex-1">{children}</div>
    </div>
  )
}

function KPI({ title, value, accent }: { title: string; value: any; accent?: string }) {
  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
      <div className="text-xs font-semibold tracking-wider text-slate-400 uppercase">{title}</div>
      <div className={`text-3xl font-semibold ${accent || 'text-slate-800'} mt-2`}>{value}</div>
    </div>
  )
}

function Doughnut({
  items,
  size = 140,
}: {
  items: { label: string; value: number; color: string }[]
  size?: number
}) {
  const total = items.reduce((a, b) => a + b.value, 0) || 1
  const r = size / 2 - 10
  const cx = size / 2
  const cy = size / 2
  const stroke = 14

  let acc = 0
  const arcs = items.map((it) => {
    const start = (acc / total) * Math.PI * 2
    acc += it.value
    const end = (acc / total) * Math.PI * 2

    const x1 = cx + r * Math.cos(start - Math.PI / 2)
    const y1 = cy + r * Math.sin(start - Math.PI / 2)
    const x2 = cx + r * Math.cos(end - Math.PI / 2)
    const y2 = cy + r * Math.sin(end - Math.PI / 2)
    const large = end - start > Math.PI ? 1 : 0

    const d = `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`
    return { d, color: it.color }
  })

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-center">
      <div className="flex justify-center">
        <svg width={size} height={size}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={COLORS.grayTrack} strokeWidth={stroke} />
          {arcs.map((a, i) => (
            <path key={i} d={a.d} fill="none" stroke={a.color} strokeWidth={stroke} strokeLinecap="round" />
          ))}
          <circle cx={cx} cy={cy} r={r - stroke} fill="white" />
          <text x={cx} y={cy - 2} textAnchor="middle" fill={COLORS.navy} fontSize="18" fontWeight="600">
            {total}
          </text>
          <text x={cx} y={cy + 16} textAnchor="middle" fill={COLORS.muted} fontSize="10" fontWeight="500">
            tarefas
          </text>
        </svg>
      </div>

      <div className="space-y-2.5">
        {items.map((it) => {
          const pct = Math.round((it.value / total) * 100)
          return (
            <div key={it.label} className="flex items-center justify-between gap-3 text-sm">
              <div className="flex items-center gap-2.5">
                <span className="inline-block w-3 h-3 rounded-md" style={{ background: it.color }} />
                <span className="text-slate-600 font-medium">{it.label}</span>
              </div>
              <span className="text-slate-800 font-semibold">
                {it.value} <span className="text-[11px] font-medium text-slate-400 ml-1">({pct}%)</span>
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function LineChart({ points, height = 180 }: { points: { x: string; y: number }[]; height?: number }) {
  const w = 720
  const h = height
  const pad = 18

  const maxY = Math.max(1, ...points.map(p => p.y))
  const xStep = points.length > 1 ? (w - pad * 2) / (points.length - 1) : 0

  const toX = (i: number) => pad + i * xStep
  const toY = (y: number) => h - pad - (y / (maxY || 1)) * (h - pad * 2)

  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(p.y)}`).join(' ')

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} className="block">
      {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
        const y = h - pad - t * (h - pad * 2)
        return <line key={i} x1={pad} y1={y} x2={w - pad} y2={y} stroke={COLORS.grayTrack} strokeWidth="1.5" />
      })}

      <path d={d} fill="none" stroke={COLORS.blue} strokeWidth="3" strokeLinecap="round" />

      {points.map((p, i) => (
        <circle key={i} cx={toX(i)} cy={toY(p.y)} r="4" fill={COLORS.blue} />
      ))}

      {points.map((p, i) => {
        if (points.length > 20 && i % 4 !== 0) return null
        return (
          <text key={i} x={toX(i)} y={h - 2} textAnchor="middle" fontSize="11" fontWeight="500" fill={COLORS.muted}>
            {niceLabel(p.x)}
          </text>
        )
      })}
    </svg>
  )
}

function BarList({
  items,
  color,
}: {
  items: { label: string; value: number }[]
  color: string
}) {
  const maxV = Math.max(1, ...items.map(i => i.value))

  return (
    <div className="space-y-3">
      {items.map((it) => {
        const w = Math.round((it.value / maxV) * 100)
        return (
          <div key={it.label} className="grid grid-cols-[1fr_52px] gap-3 items-center">
            <div>
              <div className="flex items-center justify-between text-[13px] font-medium text-slate-600 mb-1">
                <span className="truncate">{it.label}</span>
                <span className="text-slate-800 font-semibold">{it.value}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${w}%`, background: color }} />
              </div>
            </div>
            <div className="text-right text-[11px] font-medium text-slate-400 pt-3">{w}%</div>
          </div>
        )
      })}
    </div>
  )
}

function TwoBars({ onTime, late }: { onTime: number; late: number }) {
  const total = Math.max(1, onTime + late)
  const a = Math.round((onTime / total) * 100)
  const b = 100 - a

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center justify-between text-sm font-medium text-slate-600 mb-1.5">
          <span>Entregue no Prazo</span>
          <span className="text-slate-800 font-semibold">{onTime}</span>
        </div>
        <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full transition-all duration-500" style={{ width: `${a}%`, background: COLORS.okGreen }} />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between text-sm font-medium text-slate-600 mb-1.5">
          <span>Entregue com Atraso</span>
          <span className="text-slate-800 font-semibold">{late}</span>
        </div>
        <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full transition-all duration-500" style={{ width: `${b}%`, background: COLORS.dangerRed }} />
        </div>
      </div>

      <div className="pt-2 border-t border-slate-100 text-xs font-medium text-slate-500">
        Taxa de pontualidade: <span className="text-slate-800 font-bold">{a}%</span>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [userName, setUserName] = useState('')
  const [msg, setMsg] = useState('')
  const [planners, setPlanners] = useState<string[]>([])
  const [plannerSel, setPlannerSel] = useState<string>('Todos')

  const [start, setStart] = useState<string>(iso(addDays(new Date(), -30)))
  const [end, setEnd] = useState<string>(iso(new Date()))
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  const carregarUsuario = async () => {
    const { data } = await supabase.auth.getUser()
    const u = data?.user
    if (!u) return
    const { data: prof } = await supabase.from('profiles').select('full_name').eq('id', u.id).maybeSingle()
    setUserName(prof?.full_name?.trim() || u.email || 'Usuário')
  }

  const carregarPlanners = async () => {
    const { data, error } = await supabase.from('atividades').select('planner_name')
    if (error) return
    const uniq = Array.from(new Set((data || []).map((x: any) => x.planner_name).filter(Boolean))).sort()
    setPlanners(uniq)
  }

  const carregar = async () => {
    setLoading(true)
    setMsg('')
    try {
      const { data, error } = await supabase
        .from('tarefas_diarias')
        .select(`
          id, data_vencimento, status, data_conclusao,
          atividades!tarefas_diarias_atividade_id_fkey (
            planner_name, frequencia,
            setores!atividades_setor_id_fkey (nome),
            responsaveis!atividades_responsavel_id_fkey (nome)
          )
        `)
        .gte('data_vencimento', start)
        .lte('data_vencimento', end)
        .order('data_vencimento', { ascending: true })

      if (error) throw error

      const filtered =
        plannerSel === 'Todos'
          ? (data || [])
          : (data || []).filter((r: any) => r?.atividades?.planner_name === plannerSel)

      setRows(filtered as any)
    } catch (e: any) {
      console.error(e)
      setMsg('Erro ao carregar dashboard.')
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarUsuario()
    carregarPlanners()
  }, [])

  useEffect(() => {
    carregar()
  }, [plannerSel, start, end])

  const metrics = useMemo(() => {
    const today = startOfDay(new Date())
    const next7 = startOfDay(addDays(new Date(), 7))

    let total = 0
    let done = 0
    let overdue = 0
    let dueToday = 0
    let next7Count = 0

    rows.forEach((r) => {
      total++
      const st = (r.status || '').toLowerCase()
      const isDone = st.includes('concl')
      if (isDone) done++

      if (!r.data_vencimento) return
      const due = startOfDay(parseISODateOnly(String(r.data_vencimento).slice(0, 10)))

      if (!isDone && due < today) overdue++
      if (due.getTime() === today.getTime()) dueToday++
      if (due > today && due <= next7) next7Count++
    })

    const pct = total ? Math.round((done / total) * 100) : 0
    return { total, done, overdue, dueToday, next7Count, pct }
  }, [rows])

  const additionalMetrics = useMemo(() => {
    const agingMap = { '0 a 2 dias': 0, '3 a 5 dias': 0, '+ de 5 dias': 0 }
    const wipMap: Record<string, number> = {}
    let planned = 0
    let adhoc = 0

    const today = startOfDay(new Date())

    rows.forEach(r => {
      const st = r.status || 'Pendente'
      const isDone = st.toLowerCase().includes('concl')

      // 1. Planejado vs Ad Hoc
      if (r.atividades?.planner_name === 'Ad Hoc' || r.atividades?.frequencia === 'Ad Hoc') {
        adhoc++
      } else {
        planned++
      }

      // 2. WIP e Aging (apenas tarefas abertas)
      if (!isDone) {
        wipMap[st] = (wipMap[st] || 0) + 1

        if (r.data_vencimento) {
          const due = startOfDay(parseISODateOnly(r.data_vencimento.slice(0, 10)))
          if (due < today) {
            const diff = Math.floor((today.getTime() - due.getTime()) / (1000 * 3600 * 24))
            if (diff <= 2) agingMap['0 a 2 dias']++
            else if (diff <= 5) agingMap['3 a 5 dias']++
            else agingMap['+ de 5 dias']++
          }
        }
      }
    })

    return {
      aging: Object.entries(agingMap).map(([label, value]) => ({ label, value })),
      wip: Object.entries(wipMap).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value),
      mix: [
        { label: 'Planejado', value: planned, color: COLORS.blue },
        { label: 'Ad Hoc', value: adhoc, color: COLORS.warnAmber }
      ]
    }
  }, [rows])

  const statusDist = useMemo(() => {
    const map = { Pendente: 0, 'Em andamento': 0, Aguardando: 0, Concluído: 0, Outros: 0 }
    rows.forEach((r) => {
      const st = (r.status || 'Pendente').toLowerCase()
      if (st.includes('concl')) map['Concluído']++
      else if (st.includes('and')) map['Em andamento']++
      else if (st.includes('aguard')) map['Aguardando']++
      else if (st.includes('pend')) map['Pendente']++
      else map['Outros']++
    })

    return [
      { label: 'Concluído', value: map['Concluído'], color: COLORS.okGreen },
      { label: 'Em andamento', value: map['Em andamento'], color: COLORS.blue },
      { label: 'Aguardando', value: map['Aguardando'], color: COLORS.lightBlue },
      { label: 'Pendente', value: map['Pendente'], color: COLORS.warnAmber },
      { label: 'Outros', value: map['Outros'], color: '#94A3B8' },
    ]
  }, [rows])

  const donePerDay = useMemo(() => {
    const s = parseISODateOnly(start)
    const e = parseISODateOnly(end)

    const days: string[] = []
    for (let d = startOfDay(s); d <= startOfDay(e); d = startOfDay(addDays(d, 1))) {
      days.push(iso(d))
    }

    const count: Record<string, number> = {}
    days.forEach((d) => (count[d] = 0))

    rows.forEach((r) => {
      const st = (r.status || '').toLowerCase()
      if (!st.includes('concl')) return
      const base = (r.data_conclusao || r.data_vencimento || '').slice(0, 10)
      if (base && count[base] !== undefined) count[base]++
    })

    return days.map((d) => ({ x: d, y: count[d] || 0 }))
  }, [rows, start, end])

  const overdueByPerson = useMemo(() => {
    const today = startOfDay(new Date())
    const map: Record<string, number> = {}

    rows.forEach((r) => {
      const st = (r.status || '').toLowerCase()
      if (st.includes('concl')) return
      if (!r.data_vencimento) return
      const due = startOfDay(parseISODateOnly(String(r.data_vencimento).slice(0, 10)))
      if (due >= today) return

      const name = r.atividades?.responsaveis?.nome || '—'
      map[name] = (map[name] || 0) + 1
    })

    return Object.entries(map)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  }, [rows])

  const bySector = useMemo(() => {
    const map: Record<string, number> = {}
    rows.forEach((r) => {
      const k = r.atividades?.setores?.nome || '—'
      map[k] = (map[k] || 0) + 1
    })
    return Object.entries(map)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
  }, [rows])

  const byPerson = useMemo(() => {
    const map: Record<string, number> = {}
    rows.forEach((r) => {
      const k = r.atividades?.responsaveis?.nome || '—'
      map[k] = (map[k] || 0) + 1
    })
    return Object.entries(map)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
  }, [rows])

  const onTimeLate = useMemo(() => {
    let onTime = 0
    let late = 0

    rows.forEach((r) => {
      const st = (r.status || '').toLowerCase()
      if (!st.includes('concl')) return

      const dueStr = (r.data_vencimento || '').slice(0, 10)
      if (!dueStr) return

      const doneStr = (r.data_conclusao || r.data_vencimento || '').slice(0, 10)
      if (!doneStr) return

      const due = startOfDay(parseISODateOnly(dueStr))
      const done = startOfDay(parseISODateOnly(doneStr))

      if (done.getTime() <= due.getTime()) onTime++
      else late++
    })

    return { onTime, late }
  }, [rows])

  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans">
      <header className="flex flex-col xl:flex-row xl:justify-between xl:items-center gap-4 mb-6 bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Dashboard de Gestão</h1>
          <p className="text-slate-500 text-sm mt-1">
            Visão gerencial do período selecionado
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {msg && <span className="text-sm font-medium text-red-600 bg-red-50 px-3 py-1 rounded-lg animate-pulse">{msg}</span>}

          <select
            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-medium text-slate-700 outline-none focus:border-indigo-400"
            value={plannerSel}
            onChange={(e) => setPlannerSel(e.target.value)}
          >
            <option value="Todos">Visualizar: Todos os Planners</option>
            {planners.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>

          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-2">
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="bg-transparent py-2 text-sm font-medium text-slate-700 outline-none"
            />
            <span className="text-slate-400 text-sm font-medium">até</span>
            <input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="bg-transparent py-2 text-sm font-medium text-slate-700 outline-none"
            />
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6">
        <KPI title="Total Volume" value={metrics.total} />
        <KPI title="Concluídas" value={metrics.done} accent="text-emerald-600" />
        <KPI title="Em Atraso" value={metrics.overdue} accent="text-red-600" />
        <KPI title="Para Hoje" value={metrics.dueToday} accent="text-indigo-600" />
        <KPI title="Próx. 7 Dias" value={metrics.next7Count} />
        <KPI title="Eficiência" value={`${metrics.pct}%`} accent="text-blue-600" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* === LINHA 1 === */}
        <Section
          title="Produtividade Diária"
          subtitle="Tarefas concluídas no período"
          right={loading ? <span className="text-xs font-medium text-slate-400 animate-pulse">Carregando…</span> : null}
        >
          <LineChart points={donePerDay} />
        </Section>

        <Section title="Distribuição de Status" subtitle="Visão geral do andamento">
          <Doughnut items={statusDist} size={140} />
        </Section>

        <Section
          title="Qualidade de Entrega"
          subtitle="Entregas no prazo vs com atraso"
          right={<span className="text-xs font-medium text-slate-500">Concluídas: {onTimeLate.onTime + onTimeLate.late}</span>}
        >
          <TwoBars onTime={onTimeLate.onTime} late={onTimeLate.late} />
        </Section>

        {/* === LINHA 2 === */}
        <Section title="Saúde da Operação" subtitle="Volume de Processos Planejados vs Ad Hoc">
          <Doughnut items={additionalMetrics.mix} size={140} />
        </Section>

        <Section title="Aging de Pendências" subtitle="Tempo de atraso das tarefas em aberto">
          {additionalMetrics.aging.some(a => a.value > 0) ? (
            <BarList items={additionalMetrics.aging} color={COLORS.warnAmber} />
          ) : (
            <div className="text-sm font-medium text-slate-500 py-4 text-center bg-slate-50 rounded-xl">Nenhum atraso crítico no momento 🎉</div>
          )}
        </Section>

        <Section title="Gargalos por Status (WIP)" subtitle="Volume estacionado por etapa atual">
          {additionalMetrics.wip.length ? (
             <BarList items={additionalMetrics.wip} color={COLORS.lightBlue} />
          ) : (
             <div className="text-sm font-medium text-slate-500 py-4 text-center bg-slate-50 rounded-xl">Nenhuma tarefa pendente 🙌</div>
          )}
        </Section>

        {/* === LINHA 3 === */}
        <Section title="Atrasadas por Responsável" subtitle="Top 8 contas com pendências vencidas">
          {overdueByPerson.length ? (
            <BarList items={overdueByPerson} color={COLORS.dangerRed} />
          ) : (
            <div className="text-sm font-medium text-slate-500 py-4 text-center bg-slate-50 rounded-xl">Nenhuma tarefa atrasada 🎉</div>
          )}
        </Section>

        <Section title="Volume por Setor" subtitle="Demandas ativas no período">
          {bySector.length ? <BarList items={bySector} color={COLORS.blue} /> : <div className="text-sm font-medium text-slate-500 py-4 text-center bg-slate-50 rounded-xl">Sem dados para exibir.</div>}
        </Section>

        <Section title="Volume por Colaborador" subtitle="Demandas ativas no período">
          {byPerson.length ? <BarList items={byPerson} color={COLORS.navy} /> : <div className="text-sm font-medium text-slate-500 py-4 text-center bg-slate-50 rounded-xl">Sem dados para exibir.</div>}
        </Section>

      </div>
    </div>
  )
}