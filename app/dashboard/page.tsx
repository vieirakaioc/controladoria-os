'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toPng } from 'html-to-image'
import jsPDF from 'jspdf'
import { Toaster, toast } from 'react-hot-toast'
import { FileText, Info } from 'lucide-react'
import { useTheme } from 'next-themes'

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
  atividades?: {
    planner_name?: string | null
    frequencia?: string | null
    responsaveis_lista?: any
    projeto_id?: string | null
    prioridade_descricao?: string | null
    projetos?: { nome?: string | null } | null 
    setores?: { nome?: string | null } | null
    responsaveis?: { nome?: string | null; email?: string | null } | null
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

const getResponsaveis = (atv: any) => {
  if (atv?.responsaveis_lista && Array.isArray(atv.responsaveis_lista) && atv.responsaveis_lista.length > 0) {
    return atv.responsaveis_lista;
  }
  if (atv?.responsaveis) {
    return [atv.responsaveis];
  }
  return [];
}

const getColors = (isDark: boolean) => ({
  darkBlue: isDark ? '#f8fafc' : '#031D2D', 
  primaryAccent: isDark ? '#E5D6A7' : '#C7A77B', 
  chartLines: isDark ? '#475569' : '#94A3B8', 
  grayTrack: isDark ? '#1e293b' : '#F1F5F9', 
  muted: isDark ? '#94a3b8' : '#818284',    
  okGreen: isDark ? '#82A384' : '#5A755C',  
  warnAmber: isDark ? '#E2B276' : '#C79A63', 
  statusWait: isDark ? '#a78bfa' : '#7c3aed', 
  chartPlan: isDark ? '#60a5fa' : '#2563eb',  
  chartAdhoc: isDark ? '#fb923c' : '#ea580c',
  dangerRed: isDark ? '#f87171' : '#b43a3d', // 💡 NOVO: Vermelho para o Alerta de Atraso
})

function InfoTooltip({ text }: { text: string }) {
  return (
    <div className="group relative flex items-center justify-center cursor-help">
      <Info size={14} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors" />
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-64 p-3 bg-slate-800 dark:bg-slate-700 text-white text-[11px] leading-relaxed rounded-xl shadow-2xl z-[99999] text-center pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200 font-medium">
        {text}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800 dark:border-t-slate-700"></div>
      </div>
    </div>
  )
}

function Section({ title, subtitle, right, info, children }: { title: string; subtitle?: string; right?: React.ReactNode; info?: string; children: React.ReactNode }) {
  return (
    <div className="relative hover:z-20 bg-white dark:bg-slate-900 border border-slate-100/50 dark:border-slate-800/50 rounded-2xl shadow-sm hover:shadow-xl dark:hover:shadow-slate-900/50 transition-all duration-500 flex flex-col h-full">
      <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-950/20 flex items-start justify-between gap-4 shrink-0 rounded-t-2xl">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-slate-800 dark:text-white tracking-tight">{title}</h2>
            {info && <InfoTooltip text={info} />}
          </div>
          {subtitle ? <div className="text-[13px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</div> : null}
        </div>
        {right}
      </div>
      <div className="p-5 flex-1 relative">
        {children}
      </div>
    </div>
  )
}

function KPI({ title, value, accent, isDark, info }: { title: string; value: any; accent?: string; isDark: boolean; info?: string }) {
  return (
    <div className="relative hover:z-20 bg-white dark:bg-slate-900 border border-slate-100/50 dark:border-slate-800/50 rounded-2xl p-5 shadow-sm hover:shadow-xl dark:hover:shadow-slate-900/50 hover:-translate-y-0.5 transition-all duration-300">
      <div className="flex justify-between items-start">
        <div className="text-xs font-semibold tracking-wider text-slate-400 dark:text-slate-500 uppercase">{title}</div>
        {info && <InfoTooltip text={info} />}
      </div>
      <div className={`text-3xl font-bold ${accent || (isDark ? 'text-white' : 'text-slate-900')} mt-2 tracking-tighter`}>{value}</div>
    </div>
  )
}

function Doughnut({ items, size = 140, colors }: { items: { label: string; value: number; color: string }[]; size?: number; colors: any }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  
  const realTotal = items.reduce((a, b) => a + b.value, 0)
  const mathTotal = realTotal || 1 
  
  const r = size / 2 - 10
  const cx = size / 2; const cy = size / 2; const stroke = 14
  let acc = 0

  const arcs = items.map((it) => {
    const start = (acc / mathTotal) * Math.PI * 2
    acc += it.value
    const end = (acc / mathTotal) * Math.PI * 2
    const x1 = cx + r * Math.cos(start - Math.PI / 2); const y1 = cy + r * Math.sin(start - Math.PI / 2)
    const x2 = cx + r * Math.cos(end - Math.PI / 2); const y2 = cy + r * Math.sin(end - Math.PI / 2)
    const large = end - start > Math.PI ? 1 : 0
    return { d: `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`, color: it.color }
  })

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6 h-full w-full">
      <div className="flex justify-center shrink-0 relative">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={colors.grayTrack} strokeWidth={stroke} />
          
          {realTotal > 0 && arcs.map((a, i) => (
            <path 
              key={i} 
              d={a.d} 
              fill="none" 
              stroke={a.color} 
              strokeWidth={hoverIdx === i ? stroke + 2 : stroke} 
              strokeLinecap="round" 
              className="transition-all duration-300 cursor-pointer"
              opacity={hoverIdx === null || hoverIdx === i ? 1 : 0.3}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
            />
          ))}
          
          <text x={cx} y={cy - 2} textAnchor="middle" fill={colors.darkBlue} fontSize="20" fontWeight="bold" className="tracking-tight">{realTotal}</text>
          <text x={cx} y={cy + 16} textAnchor="middle" fill={colors.muted} fontSize="10" fontWeight="500">tarefas</text>
        </svg>
      </div>
      
      <div className="space-y-1.5 flex-1 w-full max-h-[140px] overflow-y-auto pr-2 custom-scrollbar">
        {items.map((it, i) => {
          const pct = realTotal > 0 ? Math.round((it.value / realTotal) * 100) : 0
          return (
            <div 
              key={it.label} 
              className={`flex items-center justify-between gap-3 text-sm p-1.5 rounded-lg transition-colors cursor-default ${hoverIdx === i ? 'bg-slate-100 dark:bg-slate-800' : ''}`}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
            >
              <div className="flex items-center gap-2.5">
                <span className="inline-block w-3 h-3 rounded-md shrink-0 transition-transform" style={{ background: it.color, transform: hoverIdx === i ? 'scale(1.2)' : 'scale(1)' }} />
                <span className={`font-medium truncate transition-colors ${hoverIdx === i ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}>{it.label}</span>
              </div>
              <span className={`font-semibold shrink-0 transition-colors ${hoverIdx === i ? 'text-slate-900 dark:text-white' : 'text-slate-800 dark:text-white'}`}>
                {it.value} <span className="text-[11px] font-medium opacity-60 ml-1">({pct}%)</span>
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function LineChart({ points, height = 180, colors }: { points: { x: string; y: number }[]; height?: number; colors: any }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  
  const w = 720; const h = height; const pad = 18
  
  const actualMaxY = Math.max(1, ...points.map(p => p.y))
  const maxY = actualMaxY * 1.3 
  
  const xStep = points.length > 1 ? (w - pad * 2) / (points.length - 1) : 0
  const toX = (i: number) => pad + i * xStep
  const toY = (y: number) => h - pad - (y / (maxY || 1)) * (h - pad * 2)
  
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(p.y)}`).join(' ')
  const dArea = `${d} L ${toX(points.length - 1)} ${h - pad} L ${pad} ${h - pad} Z`

  return (
    <div className="relative w-full overflow-x-auto custom-scrollbar pb-2 group">
      <svg viewBox={`0 0 ${w} ${h}`} className="min-w-[500px] w-full h-full block" onMouseLeave={() => setHoverIdx(null)}>
        <defs>
          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colors.chartLines} stopOpacity="0.2" />
            <stop offset="100%" stopColor={colors.chartLines} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
          const y = h - pad - t * (h - pad * 2)
          return <line key={i} x1={pad} y1={y} x2={w - pad} y2={y} stroke={colors.grayTrack} strokeWidth="1.5" strokeDasharray={i === 0 ? "0" : "4 4"} />
        })}

        {points.length > 1 && <path d={dArea} fill="url(#areaGradient)" className="transition-all duration-300" />}
        
        <path d={d} fill="none" stroke={colors.chartLines} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

        {points.map((p, i) => {
          if (points.length > 20 && i % 4 !== 0 && hoverIdx !== i) return null
          return (
            <text key={`lbl-${i}`} x={toX(i)} y={h - 2} textAnchor="middle" fontSize="10" fontWeight="600" fill={hoverIdx === i ? colors.primaryAccent : colors.muted} className="transition-colors">
              {niceLabel(p.x)}
            </text>
          )
        })}

        {points.map((p, i) => {
          if (p.y === 0) return null;
          return (
            <text key={`val-${i}`} x={toX(i)} y={toY(p.y) - 10} textAnchor="middle" fontSize="12" fontWeight="bold" fill={colors.primaryAccent} className="pointer-events-none drop-shadow-sm transition-all duration-200" opacity={hoverIdx === i ? 0 : 1}>
              {p.y}
            </text>
          )
        })}

        {points.map((p, i) => (
          <circle key={`hit-${i}`} cx={toX(i)} cy={toY(p.y)} r="16" fill="transparent" onMouseEnter={() => setHoverIdx(i)} className="cursor-pointer outline-none" />
        ))}

        {points.map((p, i) => (
          <circle 
            key={`pt-${i}`} 
            cx={toX(i)} 
            cy={toY(p.y)} 
            r={hoverIdx === i ? "6" : "3"} 
            fill={hoverIdx === i ? "#fff" : colors.chartLines} 
            stroke={hoverIdx === i ? colors.primaryAccent : colors.chartLines}
            strokeWidth={hoverIdx === i ? "3" : "0"}
            className="transition-all duration-200 pointer-events-none" 
          />
        ))}

        {hoverIdx !== null && (
          <g transform={`translate(${toX(hoverIdx)}, ${toY(points[hoverIdx].y) - 34})`} className="pointer-events-none transition-transform duration-200 z-[999]">
            <rect x="-40" y="-40" width="80" height="34" rx="6" fill={colors.darkBlue} className="shadow-2xl" style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.3))' }} />
            <polygon points="-6,-6 6,-6 0,2" fill={colors.darkBlue} />
            <text x="0" y="-24" textAnchor="middle" fill="#fff" fontSize="13" fontWeight="bold">{points[hoverIdx].y} concl.</text>
            <text x="0" y="-12" textAnchor="middle" fill="#94a3b8" fontSize="9" fontWeight="500">Dia {niceLabel(points[hoverIdx].x)}</text>
          </g>
        )}
      </svg>
    </div>
  )
}

function BarList({ items, color, isPerson = false, profilesMap = {}, colors }: { items: { label: string; value: number }[], color: string, isPerson?: boolean, profilesMap?: Record<string, string>, colors: any }) {
  const maxV = Math.max(1, ...items.map(i => i.value))

  return (
    <div className="space-y-2.5 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
      {items.map((it) => {
        const w = maxV > 0 ? Math.round((it.value / maxV) * 100) : 0
        return (
          <div key={it.label} className="flex flex-col gap-1.5 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
            <div className="flex items-center justify-between text-sm font-medium text-slate-700 dark:text-slate-200 gap-3">
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                {isPerson && (
                  profilesMap[it.label] ? (
                    <img src={profilesMap[it.label]} alt="" className="w-7 h-7 rounded-full object-cover shadow-sm border border-slate-200 dark:border-slate-700 shrink-0" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                      {it.label.charAt(0).toUpperCase()}
                    </div>
                  )
                )}
                <span className="truncate leading-tight font-medium block">{it.label}</span>
              </div>
              <span className="text-slate-900 dark:text-white font-bold shrink-0">{it.value}</span>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="h-1.5 flex-1 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${w}%`, background: color }} />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function DoubleBarList({ items, profilesMap, colors }: { items: { name: string, onTime: number, late: number, total: number }[], profilesMap: Record<string, string>, colors: any }) {
  const maxV = Math.max(1, ...items.map(i => i.total))

  return (
    <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
      {items.map(it => {
        const wOnTime = maxV > 0 ? Math.round((it.onTime / maxV) * 100) : 0
        const wLate = maxV > 0 ? Math.round((it.late / maxV) * 100) : 0
        const pctOnTime = it.total > 0 ? Math.round((it.onTime / it.total) * 100) : 0
        const pctLate = it.total > 0 ? 100 - pctOnTime : 0
        
        return (
          <div key={it.name} className="flex flex-col gap-2 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
            <div className="flex items-center justify-between text-sm font-medium text-slate-700 dark:text-slate-200 gap-3">
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                {profilesMap[it.name] ? (
                  <img src={profilesMap[it.name]} alt="" className="w-8 h-8 rounded-full object-cover shadow-sm border border-slate-200 dark:border-slate-700 shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                    {it.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="truncate leading-tight font-semibold text-slate-900 dark:text-white block">{it.name}</span>
              </div>
              <span className="text-slate-900 dark:text-white font-black shrink-0 tracking-tight">{it.total}</span>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="h-2.5 flex-1 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 flex">
                <div className="h-full transition-all duration-700 ease-out" style={{ width: `${wOnTime}%`, background: colors.okGreen }} title={`No Prazo: ${it.onTime} (${pctOnTime}%)`} />
                <div className="h-full transition-all duration-700 ease-out" style={{ width: `${wLate}%`, background: colors.chartLines }} title={`Atrasadas: ${it.late} (${pctLate}%)`} />
              </div>
            </div>
            
            <div className="flex justify-between text-[10px] font-bold tracking-wide uppercase px-1">
              {it.onTime > 0 ? (
                <span className="text-slate-600 dark:text-slate-300">{it.onTime} no prazo <span className="opacity-60 ml-0.5">({pctOnTime}%)</span></span>
              ) : <span />}
              
              {it.late > 0 ? (
                <span className="text-slate-500 dark:text-slate-400">{it.late} com atraso <span className="opacity-60 ml-0.5">({pctLate}%)</span></span>
              ) : <span />}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function TwoBars({ onTime, late, colors }: { onTime: number; late: number; colors: any }) {
  const total = onTime + late
  const a = total > 0 ? Math.round((onTime / total) * 100) : 0
  const b = total > 0 ? 100 - a : 0

  return (
    <div className="space-y-6 pt-2">
      <div>
        <div className="flex items-center justify-between text-sm font-medium text-slate-600 dark:text-slate-300 mb-2.5">
          <span>Entregue no Prazo</span><span className="text-slate-900 dark:text-white font-bold tracking-tight">{onTime}</span>
        </div>
        <div className="h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <div className="h-full transition-all duration-700 ease-out" style={{ width: `${a}%`, background: colors.okGreen }} />
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between text-sm font-medium text-slate-600 dark:text-slate-300 mb-2.5">
          <span>Entregue com Atraso</span><span className="text-slate-900 dark:text-white font-bold tracking-tight">{late}</span>
        </div>
        <div className="h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <div className="h-full transition-all duration-700 ease-out" style={{ width: `${b}%`, background: colors.chartLines }} />
        </div>
      </div>
      <div className="pt-5 border-t border-slate-100 dark:border-slate-800 text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center justify-between">
        Taxa de pontualidade da equipa: <span className="text-slate-950 dark:text-white font-black text-sm ml-1 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg">{a}%</span>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  
  const [userRole, setUserRole] = useState<string>('membro')
  const [userEmail, setUserEmail] = useState<string>('')
  const [authLoaded, setAuthLoaded] = useState(false)

  const [planners, setPlanners] = useState<string[]>([])
  const [plannerSel, setPlannerSel] = useState<string>('Todos')

  const hoje = new Date()
  const [mesInicio, setMesInicio] = useState<number>(hoje.getMonth())
  const [mesFim, setMesFim] = useState<number>(hoje.getMonth())
  const [anoAlvo, setAnoAlvo] = useState<number>(hoje.getFullYear())

  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [gerandoPdf, setGerandoPdf] = useState(false)
  
  const [profilesMap, setProfilesMap] = useState<Record<string, string>>({})

  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const colors = getColors(isDark)

  const start = useMemo(() => new Date(anoAlvo, Math.min(mesInicio, mesFim), 1).toISOString().slice(0, 10), [anoAlvo, mesInicio, mesFim])
  const end = useMemo(() => new Date(anoAlvo, Math.max(mesInicio, mesFim) + 1, 0).toISOString().slice(0, 10), [anoAlvo, mesInicio, mesFim])

  useEffect(() => {
    const initAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserEmail(user.email || '')
        const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single()
        setUserRole(prof?.role || 'membro')
      } else {
        router.push('/login')
      }
      setAuthLoaded(true)
    }
    initAuth()
  }, [router])

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
    if (!authLoaded) return
    setLoading(true)
    
    try {
      const { data, error } = await supabase
        .from('tarefas_diarias')
        .select(`
          id, data_vencimento, status, data_conclusao,
          atividades!tarefas_diarias_atividade_id_fkey (
            planner_name, frequencia, responsaveis_lista, projeto_id, prioridade_descricao,
            setores!atividades_setor_id_fkey (nome),
            responsaveis!atividades_responsavel_id_fkey (nome, email),
            projetos (nome)
          )
        `)
        .gte('data_vencimento', start)
        .lte('data_vencimento', end)
        .order('data_vencimento', { ascending: true })

      if (error) throw error

      let baseData = data || []

      if (userRole !== 'admin') {
        const emailSeguroLogado = userEmail.trim().toLowerCase()
        baseData = baseData.filter((r: any) => {
          const respsTask = getResponsaveis(r?.atividades)
          return respsTask.some((res: any) => (res.email || '').trim().toLowerCase() === emailSeguroLogado)
        })
      }

      const filtered = plannerSel === 'Todos' ? baseData : baseData.filter((r: any) => r?.atividades?.planner_name === plannerSel)
      setRows(filtered as any)
      
    } catch (e: any) {
      toast.error('Erro ao carregar dashboard.')
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
  }, [plannerSel, start, end, authLoaded, userRole, userEmail])

  const exportarPDF = async () => {
    setGerandoPdf(true)
    const toastId = toast.loading('A preparar o dossiê executivo...')

    try {
      const input = document.getElementById('dashboard-content')
      if (!input) throw new Error('Elemento do dashboard não encontrado.')

      const imgData = await toPng(input, {
        quality: 1,
        pixelRatio: 2, 
        backgroundColor: isDark ? '#0a0a0a' : '#f8fafc',
      })
      
      const pdfWidth = input.offsetWidth
      const pdfHeight = input.offsetHeight

      const pdf = new jsPDF({
        orientation: pdfWidth > pdfHeight ? 'l' : 'p',
        unit: 'px',
        format: [pdfWidth, pdfHeight]
      })

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)
      
      const mesStrInicio = MESES.find(m => m.v === mesInicio)?.n
      const mesStrFim = MESES.find(m => m.v === mesFim)?.n
      pdf.save(`Dossie_Controladoria_${mesStrInicio}_a_${mesStrFim}_${anoAlvo}.pdf`)

      toast.success('Dossiê gerado com sucesso!', { id: toastId })
    } catch (err: any) {
      console.error(err)
      toast.error('Erro ao gerar o PDF.', { id: toastId })
    } finally {
      setGerandoPdf(false)
    }
  }

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
      if (!isDone && due.getTime() === today.getTime()) dueToday++
      if (!isDone && due > today && due <= next7) next7Count++
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
        { label: 'Planejado', value: planned, color: colors.okGreen },
        { label: 'Ad Hoc', value: adhoc, color: colors.warnAmber }
      ]
    }
  }, [rows, colors])

  const effortMix = useMemo(() => {
    let projetos = 0, rotina = 0
    rows.forEach(r => {
      if (r.atividades?.projetos?.nome || r.atividades?.projeto_id) projetos++
      else rotina++
    })
    return [
      { label: 'Projetos Estratégicos', value: projetos, color: colors.primaryAccent },
      { label: 'Rotina / Operacional', value: rotina, color: colors.chartLines }
    ]
  }, [rows, colors])

  const priorityMix = useMemo(() => {
    let alta = 0, media = 0, baixa = 0, sem = 0
    rows.forEach(r => {
      if ((r.status || '').toLowerCase().includes('concl')) return;

      const p = r.atividades?.prioridade_descricao || 'Sem Prioridade'
      if (p === 'Alta') alta++
      else if (p === 'Média') media++
      else if (p === 'Baixa') baixa++
      else sem++
    })
    const res = []
    if (alta > 0) res.push({ label: 'Alta Prioridade', value: alta, color: colors.primaryAccent }) 
    if (media > 0) res.push({ label: 'Prioridade Média', value: media, color: colors.chartLines })
    if (baixa > 0) res.push({ label: 'Prioridade Baixa', value: baixa, color: colors.okGreen })
    if (sem > 0) res.push({ label: 'Não Classificada', value: sem, color: colors.muted })
    
    return res.sort((a, b) => b.value - a.value)
  }, [rows, colors])

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
      { label: 'Concluído', value: map['Concluído'], color: colors.okGreen },
      { label: 'Em andamento', value: map['Em andamento'], color: colors.chartPlan },
      { label: 'Aguardando', value: map['Aguardando'], color: colors.statusWait },
      { label: 'Pendente', value: map['Pendente'], color: colors.warnAmber },
      { label: 'Outros', value: map['Outros'], color: colors.muted },
    ]
  }, [rows, colors])

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

      const resps = getResponsaveis(r.atividades)
      if (resps.length === 0) {
        map['Sem Responsável'] = (map['Sem Responsável'] || 0) + 1
      } else {
        resps.forEach((res: any) => {
          const name = res.nome || 'Sem Responsável'
          map[name] = (map[name] || 0) + 1
        })
      }
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
    rows.forEach((r) => { 
      const resps = getResponsaveis(r.atividades)
      if (resps.length === 0) {
        map['Sem Responsável'] = (map['Sem Responsável'] || 0) + 1
      } else {
        resps.forEach((res: any) => {
          const name = res.nome || 'Sem Responsável'
          map[name] = (map[name] || 0) + 1
        })
      }
    })
    return Object.entries(map).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 10)
  }, [rows])

  const byProject = useMemo(() => {
    const map: Record<string, number> = {}
    rows.forEach((r) => { 
      const projName = r.atividades?.projetos?.nome
      if (projName) {
        map[projName] = (map[projName] || 0) + 1 
      }
    })
    return Object.entries(map).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 10)
  }, [rows])

  const deliveriesByPerson = useMemo(() => {
    const map: Record<string, { onTime: number, late: number }> = {}
    
    rows.forEach((r) => {
      const st = (r.status || '').toLowerCase()
      if (!st.includes('concl')) return 
      
      const dueStr = (r.data_vencimento || '').slice(0, 10)
      const doneStr = (r.data_conclusao || r.data_vencimento || '').slice(0, 10)
      if (!dueStr) return

      const due = startOfDay(parseISODateOnly(dueStr))
      const done = startOfDay(parseISODateOnly(doneStr))
      const isOnTime = done.getTime() <= due.getTime()

      const resps = getResponsaveis(r.atividades)
      if (resps.length === 0) {
        if (!map['Sem Responsável']) map['Sem Responsável'] = { onTime: 0, late: 0 }
        if (isOnTime) map['Sem Responsável'].onTime++
        else map['Sem Responsável'].late++
      } else {
        resps.forEach((res: any) => {
          const name = res.nome || 'Sem Responsável'
          if (!map[name]) map[name] = { onTime: 0, late: 0 }
          if (isOnTime) map[name].onTime++
          else map[name].late++
        })
      }
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

  if (!authLoaded) return <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center text-slate-800 dark:text-white font-medium animate-pulse">A preparar o seu painel...</div>

  const isMesmoMes = mesInicio === mesFim
  const tituloPeriodo = isMesmoMes 
    ? `${MESES.find(m => m.v === mesInicio)?.n}/${anoAlvo}` 
    : `de ${MESES.find(m => m.v === mesInicio)?.n} a ${MESES.find(m => m.v === mesFim)?.n}/${anoAlvo}`

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-8 font-sans transition-colors duration-300">
      <Toaster position="bottom-right" toastOptions={{ style: { background: isDark ? '#1e293b' : '#031D2D', color: '#fff', borderRadius: '12px' } }} />

      <header className="flex flex-col xl:flex-row xl:justify-between xl:items-center gap-4 mb-8 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100/50 dark:border-slate-800/50 transition-colors">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-950 dark:text-white tracking-tighter flex items-center gap-3">
            Dashboard de Resultados
            <span className="text-[10px] uppercase font-bold tracking-widest bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 px-3 py-1.5 rounded-lg mt-1">
              {userRole === 'admin' ? 'Visão Global' : 'Meu Desempenho'}
            </span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1.5 font-medium">Visão estatística {tituloPeriodo}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          
          <select
            className="bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800/60 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 dark:text-white outline-none focus:border-slate-400 dark:focus:border-slate-600 cursor-pointer shadow-sm transition-colors"
            value={plannerSel}
            onChange={(e) => setPlannerSel(e.target.value)}
          >
            <option value="Todos">Visualizar: Todos os Planners</option>
            {planners.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>

          <div className="flex items-center bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800/60 rounded-xl shadow-sm overflow-hidden focus-within:border-slate-400 transition-colors relative z-30">
            <select
              className="bg-transparent py-2.5 pl-4 pr-2 text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
              value={mesInicio}
              onChange={(e) => setMesInicio(Number(e.target.value))}
            >
              {MESES.map((m) => <option key={m.v} value={m.v}>{m.n}</option>)}
            </select>
            
            <span className="text-slate-400 text-xs font-medium px-1">até</span>
            
            <select
              className="bg-transparent py-2.5 px-2 text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
              value={mesFim}
              onChange={(e) => setMesFim(Number(e.target.value))}
            >
              {MESES.map((m) => <option key={m.v} value={m.v}>{m.n}</option>)}
            </select>
            
            <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1.5"></div>
            
            <input
              className="bg-transparent py-2.5 px-3 text-sm font-semibold text-slate-800 dark:text-slate-200 w-20 outline-none text-center"
              type="number"
              value={anoAlvo}
              onChange={(e) => setAnoAlvo(Number(e.target.value))}
            />
          </div>

          <button 
            onClick={exportarPDF} 
            disabled={gerandoPdf}
            className="flex items-center gap-2.5 bg-[#C7A77B] hover:bg-[#A68A63] text-[#031D2D] px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow disabled:opacity-50 tracking-tight"
          >
            <FileText size={17} />
            {gerandoPdf ? 'A processar...' : 'Gerar Dossiê PDF'}
          </button>
        </div>
      </header>

      <div id="dashboard-content" className="bg-slate-50 dark:bg-slate-950 p-2 transition-colors relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-8">
          <KPI title="Total Volume" value={metrics.total} isDark={isDark} info="Número total de tarefas atribuídas no período selecionado." />
          <KPI title="Concluídas" value={metrics.done} accent="text-slate-800 dark:text-white" isDark={isDark} />
          <KPI title="Em Atraso" value={metrics.overdue} accent="text-[#A68A63] dark:text-[#E2B276]" isDark={isDark} info="Tarefas pendentes cuja data limite já foi ultrapassada." />
          <KPI title="Para Hoje" value={metrics.dueToday} accent="text-slate-800 dark:text-white" isDark={isDark} />
          <KPI title="Próx. 7 Dias" value={metrics.next7Count} isDark={isDark} />
          <KPI title="Eficiência" value={`${metrics.pct}%`} accent="text-slate-800 dark:text-white" isDark={isDark} info="Rácio entre as tarefas já concluídas e o volume total atribuído." />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <Section 
            title="Produtividade Diária" 
            subtitle="Tarefas concluídas no período" 
            info="Demonstra o volume de tarefas terminadas dia a dia. Picos altos indicam dias de maior esforço da equipa."
            right={loading ? <span className="text-xs font-medium text-slate-400 animate-pulse">A carregar…</span> : null}
          >
            <LineChart points={donePerDay} colors={colors} />
          </Section>

          <Section 
            title="Distribuição de Status" 
            subtitle="Visão geral do andamento"
            info="Mapeamento do estado atual de todas as tarefas. Ajuda a encontrar os gargalos da operação."
          >
            <Doughnut items={statusDist} size={140} colors={colors} />
          </Section>

          <Section 
            title="Qualidade de Entrega" 
            subtitle="Entregas no prazo vs atrasadas" 
            info="Mede a eficácia. Compara a data de conclusão da tarefa com a sua data limite teórica."
            right={<span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Entregue: {onTimeLate.onTime + onTimeLate.late}</span>}
          >
            <TwoBars onTime={onTimeLate.onTime} late={onTimeLate.late} colors={colors} />
          </Section>

          <Section 
            title="Saúde da Operação" 
            subtitle="Volume Planejado vs Ad Hoc"
            info="Uma operação saudável deve ter a maioria do seu volume como 'Planeado'. Muitos 'Ad Hocs' indicam incêndios diários."
          >
            <Doughnut items={additionalMetrics.mix} size={140} colors={colors} />
          </Section>

          <Section 
            title="Aging de Pendências" 
            subtitle="Tempo de atraso das tarefas em aberto"
            info="Classifica o perigo das tarefas atrasadas pela sua 'idade'. Dívidas com mais de 5 dias exigem atenção imediata."
          >
            {additionalMetrics.aging.some(a => a.value > 0) ? (
              <BarList items={additionalMetrics.aging} color={colors.warnAmber} colors={colors} />
            ) : (
              <div className="text-sm font-medium text-slate-500 h-full flex items-center justify-center text-center bg-slate-50 dark:bg-slate-800 rounded-xl transition-colors p-10">Nenhum atraso no momento 🎉</div>
            )}
          </Section>

          <Section 
            title="Entregas por Pessoa" 
            subtitle="Análise de pontualidade individual"
            info="Avalia a performance de cada membro. O verde indica tarefas fechadas dentro do prazo, e o ardósia, tarefas concluídas fora de tempo."
          >
            {deliveriesByPerson.length > 0 ? (
               <DoubleBarList items={deliveriesByPerson} profilesMap={profilesMap} colors={colors} />
            ) : (
               <div className="text-sm font-medium text-slate-500 h-full flex items-center justify-center text-center bg-slate-100/50 dark:bg-slate-800/50 rounded-xl p-6 transition-colors">Ainda não há tarefas concluídas neste período.</div>
            )}
          </Section>

          {userRole === 'admin' && (
            <>
              <Section 
                title="Foco da Operação" 
                subtitle="Projetos vs Rotina Diária"
                info="Mede quanto do volume da equipa está a ser investido em evolução e iniciativas (Projetos) contra a manutenção da base (Rotina)."
              >
                <Doughnut items={effortMix} size={140} colors={colors} />
              </Section>

              <Section 
                title="Top Projetos Ativos" 
                subtitle="Volume de demandas por projeto estratégico"
                info="Identifica quais as iniciativas da empresa que estão a consumir a maior quantidade de tarefas ativas neste momento."
              >
                {byProject.length ? <BarList items={byProject} color={colors.primaryAccent} colors={colors} /> : <div className="text-sm font-medium text-slate-500 h-full flex items-center justify-center text-center bg-slate-100/50 dark:bg-slate-800/50 rounded-xl p-6 transition-colors">Nenhum projeto em curso neste período.</div>}
              </Section>

              {/* 💡 COR DA BARRA ALTERADA PARA VERMELHO (dangerRed) */}
              <Section 
                title="Atrasadas por Responsável" 
                subtitle="Contas com pendências vencidas"
                info="Identifica rapidamente quem tem o maior volume de tarefas pendentes e já fora do prazo."
              >
                {overdueByPerson.length ? (
                  <BarList items={overdueByPerson} color={colors.dangerRed} isPerson={true} profilesMap={profilesMap} colors={colors} />
                ) : (
                  <div className="text-sm font-medium text-slate-500 h-full flex items-center justify-center text-center bg-slate-100/50 dark:bg-slate-800/50 rounded-xl p-6 transition-colors">Nenhuma tarefa atrasada 🎉</div>
                )}
              </Section>

              <Section title="Volume por Setor" subtitle="Demandas ativas no período" info="Mostra quais os departamentos com maior carga de processos neste mês.">
                {bySector.length ? <BarList items={bySector} color={colors.darkBlue} colors={colors} /> : <div className="text-sm font-medium text-slate-500 h-full flex items-center justify-center text-center bg-slate-100/50 dark:bg-slate-800/50 rounded-xl p-6 transition-colors">Sem dados para exibir.</div>}
              </Section>

              <Section title="Volume por Colaborador" subtitle="Demandas ativas no período" info="Ranqueia os membros da equipa pela quantidade bruta de responsabilidades que lhes foram atribuídas.">
                {byPerson.length ? <BarList items={byPerson} color={colors.darkBlue} isPerson={true} profilesMap={profilesMap} colors={colors} /> : <div className="text-sm font-medium text-slate-500 h-full flex items-center justify-center text-center bg-slate-100/50 dark:bg-slate-800/50 rounded-xl p-6 transition-colors">Sem dados para exibir.</div>}
              </Section>

              <Section 
                title="Matriz de Urgência" 
                subtitle="Carga de trabalho por prioridade"
                info="Avalia o nível de criticidade das tarefas pendentes. Um volume muito alto de 'Alta Prioridade' indica sobrecarga e exige atenção."
              >
                {priorityMix.length > 0 ? (
                  <Doughnut items={priorityMix} size={140} colors={colors} />
                ) : (
                  <div className="text-sm font-medium text-slate-500 h-full flex items-center justify-center text-center bg-slate-100/50 dark:bg-slate-800/50 rounded-xl p-6 transition-colors">Sem dados de prioridade.</div>
                )}
              </Section>
            </>
          )}
        </div>
      </div>
    </div>
  )
}