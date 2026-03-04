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
  grayTrack: '#F1F5F9',
  muted: '#64748B',
  okGreen: '#10B981',
  warnAmber: '#F59E0B',
  dangerRed: '#EF4444',
}

function Section({ title, subtitle, right, children }: { title: string; subtitle?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden flex flex-col h-full">
      <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-start justify-between gap-4 shrink-0">
        <div>
          <div className="text-base font-semibold text-slate-800">{title}</div>
          {subtitle ? <div className="text-[13px] font-medium text-slate-500 mt-0.5">{subtitle}</div> : null}
        </div>
        {right}
      </div>
      <div className="p-5 flex-1 overflow-hidden">
        {children}
      </div>
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

function Doughnut({ items, size = 140 }: { items: { label: string; value: number; color: string }[]; size?: number }) {
  const total = items.reduce((a, b) => a + b.value, 0) || 1
  const r = size / 2 - 10
  const cx = size / 2; const cy = size / 2; const stroke = 14
  let acc = 0

  const arcs = items.map((it) => {
    const start = (acc / total) * Math.PI * 2
    acc += it.value
    const end = (acc / total) * Math.PI * 2
    const x1 = cx + r * Math.cos(start - Math.PI / 2); const y1 = cy + r * Math.sin(start - Math.PI / 2)
    const x2 = cx + r * Math.cos(end - Math.PI / 2); const y2 = cy + r * Math.sin(end - Math.PI / 2)
    const large = end - start > Math.PI ? 1 : 0
    return { d: `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`, color: it.color }
  })

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6 h-full w-full">
      <div className="flex justify-center shrink-0">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={COLORS.grayTrack} strokeWidth={stroke} />
          {arcs.map((a, i) => <path key={i} d={a.d} fill="none" stroke={a.color} strokeWidth={stroke} strokeLinecap="round" />)}
          <circle cx={cx} cy={cy} r={r - stroke} fill="white" />
          <text x={cx} y={cy - 2} textAnchor="middle" fill={COLORS.navy} fontSize="18" fontWeight="600">{total}</text>
          <text x={cx} y={cy + 16} textAnchor="middle" fill={COLORS.muted} fontSize="10" fontWeight="500">tarefas</text>
        </svg>
      </div>
      
      <div className="space-y-2.5 flex-1 w-full max-h-[140px] overflow-y-auto pr-2 custom-scrollbar">
        {items.map((it) => {
          const pct = Math.round((it.value / total) * 100)
          return (
            <div key={it.label} className="flex items-center justify-between gap-3 text-sm">
              <div className="flex items-center gap-2.5">
                <span className="inline-block w-3 h-3 rounded-md shrink-0" style={{ background: it.color }} />
                <span className="text-slate-600 font-medium truncate">{it.label}</span>
              </div>
              <span className="text-slate-800 font-semibold shrink-0">
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
  const w = 720; const h = height; const pad = 18
  const maxY = Math.max(1, ...points.map(p => p.y))
  const xStep = points.length > 1 ? (w - pad * 2) / (points.length - 1) : 0
  const toX = (i: number) => pad + i * xStep
  const toY = (y: number) => h - pad - (y / (maxY || 1)) * (h - pad * 2)
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(p.y)}`).join(' ')

  return (
    <div className="w-full overflow-x-auto custom-scrollbar pb-2">
      <svg viewBox={`0 0 ${w} ${h}`} className="min-w-[500px] w-full h-full block">
        {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
          const y = h - pad - t * (h - pad * 2)
          return <line key={i} x1={pad} y1={y} x2={w - pad} y2={y} stroke={COLORS.grayTrack} strokeWidth="1.5" />
        })}
        <path d={d} fill="none" stroke={COLORS.blue} strokeWidth="3" strokeLinecap="round" />
        {points.map((p, i) => <circle key={i} cx={toX(i)} cy={toY(p.y)} r="4" fill={COLORS.blue} />)}
        {points.map((p, i) => {
          if (points.length > 20 && i % 4 !== 0) return null
          return <text key={i} x={toX(i)} y={h - 2} textAnchor="middle" fontSize="11" fontWeight="500" fill={COLORS.muted}>{niceLabel(p.x)}</text>
        })}
      </svg>
    </div>
  )
}

// ✅ ATUALIZADO: Layout em Linhas - Valor preto no topo direito, % na frente da barra
function BarList({ items, color, isPerson = false, profilesMap = {} }: { items: { label: string; value: number }[], color: string, isPerson?: boolean, profilesMap?: Record<string, string> }) {
  const maxV = Math.max(1, ...items.map(i => i.value))

  return (
    <div className="space-y-4 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
      {items.map((it) => {
        const w = Math.round((it.value / maxV) * 100)
        return (
          <div key={it.label} className="flex flex-col gap-1.5">
            {/* Linha do Nome e Valor Preto */}
            <div className="flex items-center justify-between text-sm font-medium text-slate-700">
              <div className="flex items-center gap-2.5">
                {isPerson && (
                  profilesMap[it.label] ? (
                    <img src={profilesMap[it.label]} alt="" className="w-8 h-8 rounded-full object-cover shadow-sm border border-slate-200 shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 border border-slate-200 flex items-center justify-center text-xs font-bold shrink-0">
                      {it.label.charAt(0).toUpperCase()}
                    </div>
                  )
                )}
                <span className="truncate leading-tight">{it.label}</span>
              </div>
              <span className="text-slate-800 font-semibold shrink-0">{it.value}</span>
            </div>
            
            {/* Linha da Barra e Porcentagem */}
            <div className="flex items-center gap-3">
              <div className="h-2 flex-1 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${w}%`, background: color }} />
              </div>
              <span className="text-[11px] font-medium text-slate-400 w-8 text-right shrink-0">{w}%</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ✅ ATUALIZADO: Layout em Linhas para o Gráfico Duplo
function DoubleBarList({ items, profilesMap }: { items: { name: string, onTime: number, late: number, total: number }[], profilesMap: Record<string, string> }) {
  const maxV = Math.max(1, ...items.map(i => i.total))

  return (
    <div className="space-y-6 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
      {items.map(it => {
        const wOnTime = Math.round((it.onTime / maxV) * 100)
        const wLate = Math.round((it.late / maxV) * 100)
        
        const pctOnTime = Math.round((it.onTime / it.total) * 100)
        const pctLate = 100 - pctOnTime
        
        return (
          <div key={it.name} className="flex flex-col gap-1.5">
            {/* Linha do Nome e Valor Total Preto de Volta ao Topo */}
            <div className="flex items-center justify-between text-sm font-medium text-slate-700">
              <div className="flex items-center gap-2.5">
                {profilesMap[it.name] ? (
                  <img src={profilesMap[it.name]} alt="" className="w-8 h-8 rounded-full object-cover shadow-sm border border-slate-200 shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 border border-slate-200 flex items-center justify-center text-xs font-bold shrink-0">
                    {it.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="truncate leading-tight font-semibold text-slate-800">{it.name}</span>
              </div>
              <span className="text-slate-800 font-bold shrink-0">{it.total}</span>
            </div>
            
            {/* Linha da Barra Dupla */}
            <div className="flex items-center gap-3">
              <div className="h-2.5 flex-1 rounded-full overflow-hidden bg-slate-100 flex">
                <div className="h-full transition-all duration-500" style={{ width: `${wOnTime}%`, background: COLORS.okGreen }} title={`No Prazo: ${it.onTime} (${pctOnTime}%)`} />
                <div className="h-full transition-all duration-500" style={{ width: `${wLate}%`, background: COLORS.dangerRed }} title={`Atrasadas: ${it.late} (${pctLate}%)`} />
              </div>
            </div>
            
            {/* Sub-legenda discriminando as percentagens */}
            <div className="flex justify-between text-[11px] px-1">
              {it.onTime > 0 ? (
                <span className="text-emerald-600 font-semibold">{it.onTime} no prazo <span className="text-emerald-500/70 ml-0.5">({pctOnTime}%)</span></span>
              ) : <span />}
              
              {it.late > 0 ? (
                <span className="text-red-500 font-semibold">{it.late} com atraso <span className="text-red-400/70 ml-0.5">({pctLate}%)</span></span>
              ) : <span />}
            </div>
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
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between text-sm font-medium text-slate-600 mb-2">
          <span>Entregue no Prazo</span><span className="text-slate-800 font-semibold">{onTime}</span>
        </div>
        <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full transition-all duration-500" style={{ width: `${a}%`, background: COLORS.okGreen }} />
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between text-sm font-medium text-slate-600 mb-2">
          <span>Entregue com Atraso</span><span className="text-slate-800 font-semibold">{late}</span>
        </div>
        <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full transition-all duration-500" style={{ width: `${b}%`, background: COLORS.dangerRed }} />
        </div>
      </div>
      <div className="pt-4 border-t border-slate-100 text-xs font-medium text-slate-500">
        Taxa de pontualidade real: <span className="text-slate-800 font-bold text-sm ml-1">{a}%</span>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [msg, setMsg] = useState('')
  const [planners, setPlanners] = useState<string[]>([])
  const [plannerSel, setPlannerSel] = useState<string>('Todos')

  const [start, setStart] = useState<string>(iso(addDays(new Date(), -30)))
  const [end, setEnd] = useState<string>(iso(new Date()))
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  
  const [profilesMap, setProfilesMap] = useState<Record<string, string>>({})

  const carregarProfilesEPlanners = async () => {
    const { data: atvData } = await supabase.from('atividades').select('planner_name')
    if (atvData) {
      const uniq = Array.from(new Set((atvData || []).map((x: any) => x.planner_name).filter(Boolean))).sort()
      setPlanners(uniq)
    }

    const { data: profData } = await supabase.from('profiles').select('full_name, avatar_url')
    if (profData) {
      const map: Record<string, string> = {}
      profData.forEach(p => {
        if (p.full_name && p.avatar_url) {
          map[p.full_name.trim()] = p.avatar_url
        }
      })
      setProfilesMap(map)
    }
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

      const filtered = plannerSel === 'Todos' ? (data || []) : (data || []).filter((r: any) => r?.atividades?.planner_name === plannerSel)
      setRows(filtered as any)
    } catch (e: any) {
      setMsg('Erro ao carregar dashboard.')
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarProfilesEPlanners()
  }, [])

  useEffect(() => {
    carregar()
  }, [plannerSel, start, end])

  const metrics = useMemo(() => {
    const today = startOfDay(new Date())
    const next7 = startOfDay(addDays(new Date(), 7))
    let total = 0, done = 0, overdue = 0, dueToday = 0, next7Count = 0

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
    let planned = 0, adhoc = 0
    const today = startOfDay(new Date())

    rows.forEach(r => {
      const st = r.status || 'Pendente'
      const isDone = st.toLowerCase().includes('concl')

      if (r.atividades?.planner_name === 'Ad Hoc' || r.atividades?.frequencia === 'Ad Hoc') adhoc++
      else planned++

      if (!isDone && r.data_vencimento) {
        const due = startOfDay(parseISODateOnly(r.data_vencimento.slice(0, 10)))
        if (due < today) {
          const diff = Math.floor((today.getTime() - due.getTime()) / (1000 * 3600 * 24))
          if (diff <= 2) agingMap['0 a 2 dias']++
          else if (diff <= 5) agingMap['3 a 5 dias']++
          else agingMap['+ de 5 dias']++
        }
      }
    })

    return {
      aging: Object.entries(agingMap).map(([label, value]) => ({ label, value })),
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
    for (let d = startOfDay(s); d <= startOfDay(e); d = startOfDay(addDays(d, 1))) days.push(iso(d))

    const count: Record<string, number> = {}; days.forEach((d) => (count[d] = 0))

    rows.forEach((r) => {
      if (!(r.status || '').toLowerCase().includes('concl')) return
      const base = (r.data_conclusao || r.data_vencimento || '').slice(0, 10)
      if (base && count[base] !== undefined) count[base]++
    })
    return days.map((d) => ({ x: d, y: count[d] || 0 }))
  }, [rows, start, end])

  const overdueByPerson = useMemo(() => {
    const today = startOfDay(new Date())
    const map: Record<string, number> = {}

    rows.forEach((r) => {
      if ((r.status || '').toLowerCase().includes('concl')) return
      if (!r.data_vencimento) return
      const due = startOfDay(parseISODateOnly(String(r.data_vencimento).slice(0, 10)))
      if (due >= today) return

      const name = r.atividades?.responsaveis?.nome || '—'
      map[name] = (map[name] || 0) + 1
    })

    return Object.entries(map).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 8)
  }, [rows])

  const bySector = useMemo(() => {
    const map: Record<string, number> = {}
    rows.forEach((r) => { const k = r.atividades?.setores?.nome || '—'; map[k] = (map[k] || 0) + 1 })
    return Object.entries(map).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 10)
  }, [rows])

  const byPerson = useMemo(() => {
    const map: Record<string, number> = {}
    rows.forEach((r) => { const k = r.atividades?.responsaveis?.nome || '—'; map[k] = (map[k] || 0) + 1 })
    return Object.entries(map).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 10)
  }, [rows])

  const deliveriesByPerson = useMemo(() => {
    const map: Record<string, { onTime: number, late: number }> = {}
    
    rows.forEach((r) => {
      const st = (r.status || '').toLowerCase()
      if (!st.includes('concl')) return 
      
      const name = r.atividades?.responsaveis?.nome || '—'
      if (!map[name]) map[name] = { onTime: 0, late: 0 }

      const dueStr = (r.data_vencimento || '').slice(0, 10)
      const doneStr = (r.data_conclusao || r.data_vencimento || '').slice(0, 10)
      if (!dueStr) return

      const due = startOfDay(parseISODateOnly(dueStr))
      const done = startOfDay(parseISODateOnly(doneStr))

      if (done.getTime() <= due.getTime()) map[name].onTime++
      else map[name].late++
    })

    return Object.entries(map)
      .map(([name, counts]) => ({ name, ...counts, total: counts.onTime + counts.late }))
      .filter(x => x.total > 0)
      .sort((a, b) => b.total - a.total)
  }, [rows])

  const onTimeLate = useMemo(() => {
    let onTime = 0; let late = 0
    rows.forEach((r) => {
      if (!(r.status || '').toLowerCase().includes('concl')) return
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
          <p className="text-slate-500 text-sm mt-1">Visão gerencial do período selecionado</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {msg && <span className="text-sm font-medium text-red-600 bg-red-50 px-3 py-1 rounded-lg animate-pulse">{msg}</span>}

          <select
            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-medium text-slate-700 outline-none focus:border-indigo-400 cursor-pointer"
            value={plannerSel}
            onChange={(e) => setPlannerSel(e.target.value)}
          >
            <option value="Todos">Visualizar: Todos os Planners</option>
            {planners.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>

          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 hover:border-indigo-300 transition-colors">
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="bg-transparent py-2 text-sm font-medium text-slate-700 outline-none cursor-pointer" />
            <span className="text-slate-400 text-sm font-medium">até</span>
            <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="bg-transparent py-2 text-sm font-medium text-slate-700 outline-none cursor-pointer" />
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
        <Section title="Produtividade Diária" subtitle="Tarefas concluídas no período" right={loading ? <span className="text-xs font-medium text-slate-400 animate-pulse">A carregar…</span> : null}>
          <LineChart points={donePerDay} />
        </Section>

        <Section title="Distribuição de Status" subtitle="Visão geral do andamento global">
          <Doughnut items={statusDist} size={140} />
        </Section>

        <Section title="Qualidade de Entrega" subtitle="Entregas globais: no prazo vs atrasadas" right={<span className="text-xs font-medium text-slate-500">Total Entregue: {onTimeLate.onTime + onTimeLate.late}</span>}>
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

        <Section title="Entregas por Pessoa" subtitle="Análise de pontualidade individual">
          {deliveriesByPerson.length > 0 ? (
             <DoubleBarList items={deliveriesByPerson} profilesMap={profilesMap} />
          ) : (
             <div className="text-sm font-medium text-slate-500 h-full flex items-center justify-center text-center bg-slate-50 rounded-xl p-6">Ainda não há tarefas concluídas neste período.</div>
          )}
        </Section>

        {/* === LINHA 3 === */}
        <Section title="Atrasadas por Responsável" subtitle="Top 8 contas com pendências vencidas">
          {overdueByPerson.length ? (
            <BarList items={overdueByPerson} color={COLORS.dangerRed} isPerson={true} profilesMap={profilesMap} />
          ) : (
            <div className="text-sm font-medium text-slate-500 h-full flex items-center justify-center text-center bg-slate-50 rounded-xl p-6">Nenhuma tarefa atrasada 🎉</div>
          )}
        </Section>

        <Section title="Volume por Setor" subtitle="Demandas ativas no período">
          {bySector.length ? <BarList items={bySector} color={COLORS.blue} /> : <div className="text-sm font-medium text-slate-500 h-full flex items-center justify-center text-center bg-slate-50 rounded-xl p-6">Sem dados para exibir.</div>}
        </Section>

        <Section title="Volume por Colaborador" subtitle="Demandas ativas no período">
          {byPerson.length ? <BarList items={byPerson} color={COLORS.navy} isPerson={true} profilesMap={profilesMap} /> : <div className="text-sm font-medium text-slate-500 h-full flex items-center justify-center text-center bg-slate-50 rounded-xl p-6">Sem dados para exibir.</div>}
        </Section>

      </div>
    </div>
  )
}