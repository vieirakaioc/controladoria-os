'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Users, ShieldAlert, BarChart3, CheckCircle2, AlertTriangle, Clock, FileText, Download } from 'lucide-react'
import { useTheme } from 'next-themes'
import { toast } from 'react-hot-toast'
import { exportEquipePDF, exportEquipeXLSX } from './_lib/export'

import { useEquipeData } from './_hooks/useEquipeData'
import { useDestaqueSemana } from './_hooks/useDestaqueSemana'
import { useHistoricoScore } from './_hooks/useHistoricoScore'
import { useHeatmapAtividade } from './_hooks/useHeatmapAtividade'
import { ScoreBadge } from './_components/ScoreBadge'
import { PresencaDot } from './_components/PresencaDot'
import { ScoreConfigPanel } from './_components/ScoreConfigPanel'
import { Podio } from './_components/Podio'
import { ScoreRanking } from './_components/ScoreRanking'
import { DestaqueSemana } from './_components/DestaqueSemana'
import { HistoricoView } from './_components/HistoricoView'
import { HeatmapAtividade } from './_components/HeatmapAtividade'

const MESES = [
  { v: 0, n: 'Jan' }, { v: 1, n: 'Fev' }, { v: 2, n: 'Mar' }, { v: 3, n: 'Abr' },
  { v: 4, n: 'Mai' }, { v: 5, n: 'Jun' }, { v: 6, n: 'Jul' }, { v: 7, n: 'Ago' },
  { v: 8, n: 'Set' }, { v: 9, n: 'Out' }, { v: 10, n: 'Nov' }, { v: 11, n: 'Dez' },
]

export default function EquipePage() {
  const router = useRouter()
  const hoje = new Date()
  const [mesAlvo, setMesAlvo] = useState(hoje.getMonth())
  const [anoAlvo, setAnoAlvo] = useState(hoje.getFullYear())
  const [filtroPlanner, setFiltroPlanner] = useState<string>('Todos')
  const [filtroSetor, setFiltroSetor] = useState<string>('Todos')
  const [tab, setTab] = useState<'mensal' | 'historico' | 'atividade'>('mensal')
  const [exporting, setExporting] = useState<'pdf' | 'xlsx' | null>(null)
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const [isAdmin, setIsAdmin] = useState(false)
  const [authLoaded, setAuthLoaded] = useState(false)

  // Checa se é admin
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (cancelled) return
      if (!user) { router.push('/login'); return }
      const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
      if (cancelled) return
      if (prof?.role !== 'admin') {
        setIsAdmin(false)
        setAuthLoaded(true)
        return
      }
      setIsAdmin(true)
      setAuthLoaded(true)
    })()
    return () => { cancelled = true }
  }, [router])

  const { colaboradores, weights, plannerOptions, setorOptions, loading, erro, reload } = useEquipeData({
    mesAlvo, anoAlvo, enabled: authLoaded && isAdmin,
    filtroPlanner, filtroSetor,
  })

  const destaque = useDestaqueSemana(authLoaded && isAdmin)

  // Histórico só carrega quando a tab está ativa (lazy)
  const historico = useHistoricoScore({
    enabled: authLoaded && isAdmin && tab === 'historico',
    refMes: mesAlvo,
    refAno: anoAlvo,
    filtroPlanner,
    filtroSetor,
  })

  // Heatmap só carrega quando a tab está ativa (lazy)
  const heatmap = useHeatmapAtividade({
    enabled: authLoaded && isAdmin && tab === 'atividade',
    dias: 30,
  })

  const filtroAtivo = filtroPlanner !== 'Todos' || filtroSetor !== 'Todos'
  const limparFiltros = () => { setFiltroPlanner('Todos'); setFiltroSetor('Todos') }

  const mesLabel = `${MESES.find(m => m.v === mesAlvo)?.n || mesAlvo}_${anoAlvo}`

  const handleExportPDF = async () => {
    setExporting('pdf')
    const toastId = toast.loading('A gerar PDF do Monitor...')
    try {
      await exportEquipePDF({
        elementId: 'equipe-content',
        filename: `Monitor_Equipe_${mesLabel}.pdf`,
        isDark,
      })
      toast.success('PDF gerado!', { id: toastId })
    } catch (e: any) {
      toast.error(`Erro ao gerar PDF: ${e?.message || 'falha'}`, { id: toastId })
    } finally {
      setExporting(null)
    }
  }

  const handleExportXLSX = () => {
    setExporting('xlsx')
    const toastId = toast.loading('A gerar planilha...')
    try {
      exportEquipeXLSX({
        filename: `Monitor_Equipe_${mesLabel}.xlsx`,
        mesLabel,
        colaboradoresMes: colaboradores,
        destaqueSemana: { top: destaque.top, semanaLabel: destaque.semanaLabel },
        historico: historico.linhas.length > 0
          ? { linhas: historico.linhas, meses: historico.meses }
          : null,
      })
      toast.success('Planilha gerada!', { id: toastId })
    } catch (e: any) {
      toast.error(`Erro ao gerar planilha: ${e?.message || 'falha'}`, { id: toastId })
    } finally {
      setExporting(null)
    }
  }

  // KPIs agregados
  const kpis = useMemo(() => {
    const total = colaboradores.length
    const ativosHoje = colaboradores.filter(c => {
      if (!c.lastActivity) return false
      const diffH = (Date.now() - new Date(c.lastActivity).getTime()) / 3600000
      return diffH < 24
    }).length
    const scoreMedio = total === 0 ? 0 : Math.round(
      colaboradores.reduce((s, c) => s + c.score.total, 0) / total,
    )
    const totalAtrasadas = colaboradores.reduce((s, c) => s + c.metrics.atrasadas, 0)
    const totalConcluidas = colaboradores.reduce((s, c) => s + c.metrics.concluidas, 0)
    return { total, ativosHoje, scoreMedio, totalAtrasadas, totalConcluidas }
  }, [colaboradores])

  // ─── Gates ───────────────────────────────────────────────────────────
  if (!authLoaded) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center text-[#0f88a8] dark:text-[#38bdf8] font-medium animate-pulse">
        A verificar credenciais...
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-8 flex flex-col items-center justify-center text-center">
        <ShieldAlert size={64} className="text-[#b43a3d] dark:text-[#f87171] mb-4 opacity-80" />
        <h1 className="text-2xl font-bold text-[#063955] dark:text-white">Acesso Restrito</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-md">
          O Monitor da Equipe é exclusivo para administradores.
        </p>
        <button
          onClick={() => router.push('/tarefas')}
          className="mt-6 bg-[#0f88a8] hover:bg-[#0c708b] text-white px-6 py-2.5 rounded-xl font-medium shadow-sm"
        >
          Voltar ao Kanban
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-8 font-sans transition-colors">
      {/* Header */}
      <header className="mb-6 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col xl:flex-row xl:justify-between xl:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-[#0f88a8]/10 dark:bg-[#38bdf8]/10 p-3 rounded-xl text-[#0f88a8] dark:text-[#38bdf8]">
            <Users size={32} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#063955] dark:text-white tracking-tight">
              Monitor da Equipe
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
              Desempenho e acesso ao app por colaborador — {MESES.find(m => m.v === mesAlvo)?.n}/{anoAlvo}
              {filtroAtivo && (
                <span className="ml-2 inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider bg-[#0f88a8]/10 dark:bg-[#38bdf8]/10 text-[#0f88a8] dark:text-[#38bdf8] px-2 py-0.5 rounded">
                  Filtrado{filtroPlanner !== 'Todos' && ` · ${filtroPlanner}`}{filtroSetor !== 'Todos' && ` · ${filtroSetor}`}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={filtroPlanner}
            onChange={(e) => setFiltroPlanner(e.target.value)}
            className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 outline-none focus:border-[#0f88a8] min-w-[150px]"
          >
            <option value="Todos">Planner: Todos</option>
            {plannerOptions.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select
            value={filtroSetor}
            onChange={(e) => setFiltroSetor(e.target.value)}
            className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 outline-none focus:border-[#0f88a8] min-w-[150px]"
          >
            <option value="Todos">Setor: Todos</option>
            {setorOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {filtroAtivo && (
            <button
              onClick={limparFiltros}
              className="text-xs font-semibold text-slate-500 hover:text-[#063955] dark:hover:text-white px-2 transition-colors"
            >
              Limpar filtros
            </button>
          )}
          <select
            value={mesAlvo}
            onChange={(e) => setMesAlvo(Number(e.target.value))}
            className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 outline-none focus:border-[#0f88a8]"
          >
            {MESES.map(m => <option key={m.v} value={m.v}>{m.n}</option>)}
          </select>
          <input
            type="number"
            value={anoAlvo}
            onChange={(e) => setAnoAlvo(Number(e.target.value))}
            className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 w-24 outline-none focus:border-[#0f88a8]"
          />

          <div className="flex items-center gap-2 ml-1">
            <button
              onClick={handleExportXLSX}
              disabled={exporting !== null || colaboradores.length === 0}
              className="flex items-center gap-1.5 bg-[#2d6943] hover:bg-[#204e31] text-white px-3 py-2 rounded-xl text-xs font-bold transition-colors shadow-sm disabled:opacity-50"
              title="Exportar Excel com Mensal + Destaque Semana + Histórico"
            >
              <Download size={13} /> {exporting === 'xlsx' ? '...' : 'Excel'}
            </button>
            <button
              onClick={handleExportPDF}
              disabled={exporting !== null || colaboradores.length === 0}
              className="flex items-center gap-1.5 bg-[#C7A77B] hover:bg-[#A68A63] text-[#031D2D] px-3 py-2 rounded-xl text-xs font-bold transition-colors shadow-sm disabled:opacity-50"
              title="Exportar a vista atual em PDF"
            >
              <FileText size={13} /> {exporting === 'pdf' ? '...' : 'PDF'}
            </button>
          </div>
        </div>
      </header>

      <div id="equipe-content">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-6">
        <KpiCard label="Colaboradores" value={kpis.total} icon={<Users size={20} />} />
        <KpiCard label="Ativos hoje" value={kpis.ativosHoje} icon={<CheckCircle2 size={20} />} accent="emerald" />
        <KpiCard label="Score médio" value={kpis.scoreMedio} icon={<BarChart3 size={20} />} suffix="/100" />
        <KpiCard label="Concluídas" value={kpis.totalConcluidas} icon={<CheckCircle2 size={20} />} />
        <KpiCard label="Atrasadas" value={kpis.totalAtrasadas} icon={<AlertTriangle size={20} />} accent="danger" />
      </div>

      {/* Painel de config (admin) */}
      <ScoreConfigPanel weights={weights} onSaved={reload} />

      {/* Destaque da Semana — reconhecimento semanal pra compartilhar no WhatsApp */}
      <DestaqueSemana
        top={destaque.top}
        semanaLabel={destaque.semanaLabel}
        mensagem={destaque.mensagem}
        loading={destaque.loading}
      />

      {/* Tab switcher entre vista mensal e histórico */}
      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mb-6 w-fit">
        <button
          onClick={() => setTab('mensal')}
          className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'mensal' ? 'bg-white dark:bg-slate-700 shadow-sm text-[#063955] dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
        >
          Mensal
        </button>
        <button
          onClick={() => setTab('historico')}
          className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'historico' ? 'bg-white dark:bg-slate-700 shadow-sm text-[#063955] dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
        >
          Histórico (6 meses)
        </button>
        <button
          onClick={() => setTab('atividade')}
          className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'atividade' ? 'bg-white dark:bg-slate-700 shadow-sm text-[#063955] dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
        >
          Atividade (30 dias)
        </button>
      </div>

      {/* Pódio Top 3 + Ranking visual — só na vista Mensal */}
      {tab === 'mensal' && !loading && colaboradores.length > 0 && (
        <>
          <Podio colaboradores={colaboradores} />
          <ScoreRanking colaboradores={colaboradores} />
        </>
      )}

      {/* Vista Mensal: alerta de erro + tabela detalhada */}
      {tab === 'mensal' && erro && (
        <div className="mb-4 p-4 rounded-xl bg-[#b43a3d]/10 border border-[#b43a3d]/30 text-[#b43a3d] text-sm">
          <strong>Erro:</strong> {erro}
        </div>
      )}

      {tab === 'historico' ? (
        <>
          {historico.erro && (
            <div className="mb-4 p-4 rounded-xl bg-[#b43a3d]/10 border border-[#b43a3d]/30 text-[#b43a3d] text-sm">
              <strong>Erro:</strong> {historico.erro}
            </div>
          )}
          <HistoricoView linhas={historico.linhas} meses={historico.meses} loading={historico.loading} />
        </>
      ) : tab === 'atividade' ? (
        <HeatmapAtividade
          loading={heatmap.loading}
          matrizEquipe={heatmap.matrizEquipe}
          maxEquipe={heatmap.maxEquipe}
          porColaborador={heatmap.porColaborador}
          inicio={heatmap.inicio}
          fim={heatmap.fim}
          totalEventos={heatmap.totalEventos}
        />
      ) : (
      <main className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-[#0f88a8] dark:text-[#38bdf8] font-medium animate-pulse">
            A agregar métricas da equipe...
          </div>
        ) : colaboradores.length === 0 ? (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400">
            {filtroAtivo
              ? 'Nenhum colaborador tem tarefas neste recorte. Tente limpar os filtros ou trocar o período.'
              : 'Nenhum colaborador cadastrado em `responsaveis`.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 dark:bg-slate-950">
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase text-xs tracking-wider">
                  <th className="px-4 py-3.5 font-semibold">Colaborador</th>
                  <th className="px-4 py-3.5 font-semibold">Último acesso</th>
                  <th className="px-4 py-3.5 font-semibold text-center">Tarefas</th>
                  <th className="px-4 py-3.5 font-semibold text-center">Concluídas</th>
                  <th className="px-4 py-3.5 font-semibold text-center">No prazo</th>
                  <th className="px-4 py-3.5 font-semibold text-center">Atrasadas</th>
                  <th className="px-4 py-3.5 font-semibold text-center">Dias ativos</th>
                  <th className="px-4 py-3.5 font-semibold text-center">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {colaboradores.map(c => {
                  const pctConcl = c.metrics.totalAtribuidas === 0 ? 0 : Math.round((c.metrics.concluidas / c.metrics.totalAtribuidas) * 100)
                  const pctPrazo = c.metrics.concluidas === 0 ? 0 : Math.round((c.metrics.concluidasNoPrazo / c.metrics.concluidas) * 100)
                  return (
                    <tr key={c.responsavel_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      {/* Colaborador */}
                      <td className="px-4 py-5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="font-bold text-[15px] text-[#063955] dark:text-white leading-tight">{c.nome}</div>
                          {c.ausenciaAtiva && (
                            <span
                              className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded"
                              title={`${c.ausenciaAtiva.motivo || 'ausente'} · ${c.ausenciaAtiva.data_inicio} → ${c.ausenciaAtiva.data_fim}`}
                            >
                              🌴 {c.ausenciaAtiva.motivo || 'Ausente'}
                            </span>
                          )}
                        </div>
                        {c.email && <div className="text-xs text-slate-400 mt-0.5">{c.email}</div>}
                      </td>
                      {/* Último acesso */}
                      <td className="px-4 py-5">
                        {c.ausenciaAtiva ? (
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-amber-500" />
                            <span className="text-sm font-medium text-amber-700 dark:text-amber-400">Em férias</span>
                          </div>
                        ) : (
                          <PresencaDot lastActivity={c.lastActivity} />
                        )}
                      </td>
                      {/* Tarefas */}
                      <td className="px-4 py-5 text-center">
                        <span className="text-lg font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                          {c.metrics.totalAtribuidas}
                        </span>
                      </td>
                      {/* Concluídas */}
                      <td className="px-4 py-5 text-center">
                        <span className="text-lg font-semibold tabular-nums text-[#2d6943] dark:text-[#4ade80]">
                          {c.metrics.concluidas}
                        </span>
                        {c.metrics.totalAtribuidas > 0 && (
                          <span className="text-xs text-slate-400 ml-1.5 tabular-nums">({pctConcl}%)</span>
                        )}
                      </td>
                      {/* No prazo */}
                      <td className="px-4 py-5 text-center">
                        {c.metrics.concluidas > 0 ? (
                          <span className="text-lg font-semibold tabular-nums text-[#0f88a8] dark:text-[#38bdf8]">
                            {pctPrazo}%
                          </span>
                        ) : <span className="text-slate-300 text-lg">—</span>}
                      </td>
                      {/* Atrasadas */}
                      <td className="px-4 py-5 text-center">
                        {c.metrics.atrasadas > 0 ? (
                          <span className="text-lg font-bold tabular-nums text-[#b43a3d] dark:text-[#f87171]">
                            {c.metrics.atrasadas}
                          </span>
                        ) : <span className="text-lg text-slate-300 tabular-nums">0</span>}
                      </td>
                      {/* Dias ativos */}
                      <td className="px-4 py-5 text-center">
                        <span className="text-lg font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                          {c.metrics.diasUteisAtivos}
                        </span>
                        <span className="text-xs text-slate-400 tabular-nums">/{c.metrics.diasUteisPeriodo}</span>
                      </td>
                      {/* Score */}
                      <td className="px-4 py-5">
                        <div className="flex justify-center">
                          <ScoreBadge score={c.score} />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
      )}
      </div>{/* fim do equipe-content (área capturada no PDF) */}

      {/* Legenda */}
      <div className="mt-6 p-4 bg-white/50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-xl text-xs text-slate-500 dark:text-slate-400">
        <strong className="text-slate-700 dark:text-slate-300">Score atual:</strong>{' '}
        {weights.conclusao}% Conclusão + {weights.volume}% Volume + {weights.pontualidade}% Pontualidade + {weights.aderencia}% Aderência + {weights.uso}% Uso.
        Editável no painel "Configuração do Score" acima.
        <br />
        <span className="inline-flex items-center gap-1 mt-2 mr-3"><Clock size={12}/> Indicador de presença:</span>
        <span className="inline-flex items-center gap-1 mr-3"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> &lt;1h</span>
        <span className="inline-flex items-center gap-1 mr-3"><span className="w-2 h-2 rounded-full bg-emerald-500" /> hoje</span>
        <span className="inline-flex items-center gap-1 mr-3"><span className="w-2 h-2 rounded-full bg-amber-500" /> semana</span>
        <span className="inline-flex items-center gap-1 mr-3"><span className="w-2 h-2 rounded-full bg-[#b43a3d]" /> inativo</span>
      </div>
    </div>
  )
}

function KpiCard({ label, value, icon, suffix = '', accent = 'default' }: {
  label: string; value: number; icon: React.ReactNode; suffix?: string;
  accent?: 'default' | 'emerald' | 'danger'
}) {
  const colorClass = accent === 'emerald'
    ? 'text-[#2d6943] dark:text-[#4ade80]'
    : accent === 'danger'
    ? 'text-[#b43a3d] dark:text-[#f87171]'
    : 'text-slate-900 dark:text-white'

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
      <div className="flex justify-between items-start mb-2">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</span>
        <span className="text-slate-400">{icon}</span>
      </div>
      <div className={`text-2xl font-light mt-1 ${colorClass}`}>
        {value}{suffix && <span className="text-sm font-medium text-slate-400">{suffix}</span>}
      </div>
    </div>
  )
}
