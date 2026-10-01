'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Toaster, toast } from 'react-hot-toast'

import { useAuthGate } from './_hooks/useAuthGate'
import { useTarefas } from './_hooks/useTarefas'
import { useTarefaFilters } from './_hooks/useTarefaFilters'
import { useTaskNotifier } from './_hooks/useTaskNotifier'
import { usePrioridades } from './_hooks/usePrioridades'
import { useTarefaMutations } from './_hooks/useTarefaMutations'

import { Header } from './_components/Header'
import { KpiCards } from './_components/KpiCards'
import { FiltersBar } from './_components/FiltersBar'
import { SkeletonBoard, SkeletonCalendar, SkeletonList } from './_components/Skeletons'

import { ListView } from './_components/views/ListView'
import { BoardView } from './_components/views/BoardView'
import { EisenhowerView } from './_components/views/EisenhowerView'
import { TimeboardView } from './_components/views/TimeboardView'
import { CalendarView } from './_components/views/CalendarView'

import { AdHocModal } from './_components/modals/AdHocModal'
import { TaskDetailsModal } from './_components/modals/TaskDetailsModal'

import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'

import { MESES, type ViewMode } from './_lib/types'
import { downloadIcs, type IcsTask } from '@/lib/ics'
import { getResponsaveis } from '@/lib/responsaveis'

export default function TarefasPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const taskIdUrl = searchParams?.get('taskId')
  // Vindo de um projeto (?projeto=ID), a tela já abre filtrada nele e sem
  // janela de mês: as tarefas de um projeto atravessam meses, e abrir só o mês
  // corrente esconderia a maior parte delas sem dizer por quê.
  const projetoUrl = searchParams?.get('projeto') || null

  const hoje = new Date()
  const [mesAlvo, setMesAlvo] = useState<number>(hoje.getMonth())
  const [anoAlvo, setAnoAlvo] = useState<number>(hoje.getFullYear())
  const [todoPeriodo, setTodoPeriodo] = useState<boolean>(
    Boolean(projetoUrl) || searchParams?.get('periodo') === 'tudo',
  )
  const [plannerSel, setPlannerSel] = useState<string>('Todos')
  const [view, setView] = useState<ViewMode>('timeboard')

  const { userId, userName, userEmail, userRole, perfil, authLoaded } = useAuthGate()

  const tarefas = useTarefas({
    plannerSel, mesAlvo, anoAlvo, userEmail, userRole, perfil, todoPeriodo, authLoaded,
  })

  const filters = useTarefaFilters({
    rows: tarefas.rows,
    statuses: tarefas.statuses,
    mesAlvo, anoAlvo,
    projetoInicial: projetoUrl,
  })

  // A prioridade da matriz é por pessoa, então nasce do usuário logado.
  const prioridades = usePrioridades(userId)

  const { sendEmailNotification } = useTaskNotifier({
    rows: tarefas.rows,
    loading: tarefas.loading,
    userEmail, userName,
  })

  const m = useTarefaMutations({
    rows: tarefas.rows,
    setRows: tarefas.setRows,
    statuses: tarefas.statuses,
    userName,
    userEmail,
    refresh: tarefas.refresh,
    refreshPlanners: tarefas.refreshPlanners,
    sendEmailNotification,
  })

  // Deep link: ao chegar com ?taskId=X, abre o drawer dessa tarefa.
  useEffect(() => {
    if (tarefas.rows.length === 0 || tarefas.loading || !taskIdUrl || m.drawerOpen) return
    const task = tarefas.rows.find(r => r.id === taskIdUrl)
    if (task) {
      m.abrirDrawer(task)
    } else {
      toast.error('Tarefa da notificação não encontrada na vista atual.')
    }
    router.replace('/tarefas')
  }, [tarefas.rows, tarefas.loading, taskIdUrl, m.drawerOpen, m, router])

  // Handler: exporta as tarefas filtradas pra arquivo .ics (Google Calendar / Outlook)
  const handleExportIcs = () => {
    if (filters.filtradas.length === 0) {
      toast.error('Nenhuma tarefa pra exportar no filtro atual.')
      return
    }
    const tasks: IcsTask[] = filters.filtradas.map(r => {
      const atv = r.atividades || {}
      const resps = getResponsaveis(atv).map(x => x.nome).join(', ')
      return {
        id: r.id,
        nome: atv.nome_atividade || 'Tarefa',
        data_vencimento: r.data_vencimento,
        status: r.status,
        setor: atv.setores?.nome,
        responsavel: resps || null,
        planner: atv.planner_name,
        observacoes: r.observacoes,
        classificacao: atv.classificacao,
      }
    })
    const mesNome = MESES.find(m => m.v === mesAlvo)?.n || ''
    if (todoPeriodo) downloadIcs(tasks, 'Tarefas_todo_periodo.ics', 'Portal · Todo o período')
    else downloadIcs(tasks, `Tarefas_${mesNome}_${anoAlvo}.ics`, `Portal · ${mesNome}/${anoAlvo}`)
    toast.success(`${tasks.length} tarefa(s) exportada(s)!`)
  }

  const renderView = () => {
    if (tarefas.loading) {
      if (view === 'list') return <SkeletonList />
      if (view === 'calendar') return <SkeletonCalendar />
      return <SkeletonBoard columns={view === 'board' ? (tarefas.statuses.length || 4) : 5} />
    }

    if (view === 'list') {
      return (
        <ListView
          rows={filters.filtradas}
          excluirTarefa={m.excluirTarefa}
          abrirDrawer={m.abrirDrawer}
        />
      )
    }
    if (view === 'eisenhower') {
      return (
        <EisenhowerView
          rows={filters.filtradas}
          mapa={prioridades.mapa}
          definir={prioridades.definir}
          statuses={tarefas.statuses}
          statusOrderMap={tarefas.statusOrderMap}
          setStatus={m.setStatus}
          excluirTarefa={m.excluirTarefa}
          abrirDrawer={m.abrirDrawer}
        />
      )
    }
    if (view === 'board') {
      return (
        <BoardView
          statuses={tarefas.statuses}
          boardStatus={filters.boardStatus}
          statusOrderMap={tarefas.statusOrderMap}
          setStatus={m.setStatus}
          excluirTarefa={m.excluirTarefa}
          abrirDrawer={m.abrirDrawer}
        />
      )
    }
    if (view === 'timeboard') {
      return (
        <TimeboardView
          timeOrder={filters.timeOrder}
          timeboard={filters.timeboard}
          statuses={tarefas.statuses}
          statusOrderMap={tarefas.statusOrderMap}
          setStatus={m.setStatus}
          excluirTarefa={m.excluirTarefa}
          abrirDrawer={m.abrirDrawer}
        />
      )
    }
    return (
      <CalendarView data={filters.calendarData} abrirDrawer={m.abrirDrawer} />
    )
  }

  return (
    <div className="min-h-screen bg-navy-50 dark:bg-slate-950 p-8 font-sans relative transition-colors duration-300">
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: { background: '#063955', color: '#fff', fontSize: '14px', borderRadius: '12px', padding: '12px 20px' },
          success: { iconTheme: { primary: '#2d6943', secondary: '#fff' } },
          error: { iconTheme: { primary: '#b43a3d', secondary: '#fff' } },
        }}
      />

      <Header
        userRole={userRole}
        mesAlvo={mesAlvo}
        anoAlvo={anoAlvo}
        todoPeriodo={todoPeriodo}
        setTodoPeriodo={setTodoPeriodo}
        view={view}
        plannerSel={plannerSel}
        planners={tarefas.planners}
        setMesAlvo={setMesAlvo}
        setAnoAlvo={setAnoAlvo}
        setView={setView}
        setPlannerSel={setPlannerSel}
        onNovaAdHoc={() => m.setAdhocOpen(true)}
        onRefresh={tarefas.refresh}
        onExportIcs={handleExportIcs}
      />

      {/* Antes dos indicadores: sem este aviso, o mês recém-virado parece um
          mês em que as tarefas sumiram, e o número zerado em cima reforça a
          impressão errada. */}
      {tarefas.mesNaoGerado && !tarefas.loading && (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-alerta-border bg-alerta-bg px-4 py-3">
          <AlertTriangle size={18} className="shrink-0 text-alerta" />
          <p className="min-w-[240px] flex-1 text-sm leading-relaxed text-ink-700">
            <strong>
              {MESES.find(mm => mm.v === tarefas.mesNaoGerado!.mes)?.n}/{tarefas.mesNaoGerado!.ano} ainda
              não foi gerado.
            </strong>{' '}
            Há {filters.filtradas.length} tarefa(s) aqui e {tarefas.mesNaoGerado!.anterior} no mês anterior.
            As tarefas do mês nascem da sincronização na tela Início.
          </p>
          <button
            type="button"
            onClick={() => setTodoPeriodo(true)}
            className="rounded-md border border-line-strong bg-white px-3 py-2 text-xs font-semibold text-ink-700 transition-colors hover:border-teal-500 hover:text-teal-600"
          >
            Ver todo o período
          </button>
          <Link
            href="/"
            className="rounded-md bg-teal-600 px-4 py-2 text-xs font-bold text-white transition-all hover:brightness-110"
          >
            Ir para Início e sincronizar
          </Link>
        </div>
      )}

      <KpiCards stats={filters.dashboard} loading={tarefas.loading} />

      <FiltersBar
        filtroTexto={filters.filtroTexto}
        filtroStatus={filters.filtroStatus}
        filtroSetor={filters.filtroSetor}
        filtroResp={filters.filtroResp}
        filtroClassificacao={filters.filtroClassificacao}
        filtroProjeto={filters.filtroProjeto}
        setFiltroTexto={filters.setFiltroTexto}
        setFiltroStatus={filters.setFiltroStatus}
        setFiltroSetor={filters.setFiltroSetor}
        setFiltroResp={filters.setFiltroResp}
        setFiltroClassificacao={filters.setFiltroClassificacao}
        setFiltroProjeto={filters.setFiltroProjeto}
        statuses={tarefas.statuses}
        setorOptions={filters.setorOptions}
        respOptions={filters.respOptions}
        classifOptions={filters.classifOptions}
        projetosDb={tarefas.projetosDb}
        totalFiltradas={filters.filtradas.length}
        onReset={filters.reset}
      />

      {renderView()}

      {m.adhocOpen && (
        <AdHocModal
          setoresDb={tarefas.setoresDb}
          respsDb={tarefas.respsDb}
          classificacoesDb={tarefas.classificacoesDb}
          projetosDb={tarefas.projetosDb}
          adhocNome={m.adhocNome} setAdhocNome={m.setAdhocNome}
          adhocSetorId={m.adhocSetorId} setAdhocSetorId={m.setAdhocSetorId}
          adhocResps={m.adhocResps} setAdhocResps={m.setAdhocResps}
          adhocProjetoId={m.adhocProjetoId} setAdhocProjetoId={m.setAdhocProjetoId}
          adhocVenc={m.adhocVenc} setAdhocVenc={m.setAdhocVenc}
          adhocPrioridade={m.adhocPrioridade} setAdhocPrioridade={m.setAdhocPrioridade}
          adhocClassificacao={m.adhocClassificacao} setAdhocClassificacao={m.setAdhocClassificacao}
          adhocObs={m.adhocObs} setAdhocObs={m.setAdhocObs}
          savingAdhoc={m.savingAdhoc}
          onClose={() => m.setAdhocOpen(false)}
          onCriar={m.criarAdHoc}
        />
      )}

      {m.drawerOpen && m.selected && (
        <TaskDetailsModal
          selected={m.selected}
          statuses={tarefas.statuses}
          respsDb={tarefas.respsDb}
          donosDb={tarefas.donosDb}
          classificacoesDb={tarefas.classificacoesDb}
          projetosDb={tarefas.projetosDb}
          userId={userId}
          userName={userName}
          userEmail={userEmail}
          drawerNome={m.drawerNome} setDrawerNome={m.setDrawerNome}
          drawerStatus={m.drawerStatus} setDrawerStatus={m.setDrawerStatus}
          drawerObs={m.drawerObs} setDrawerObs={m.setDrawerObs}
          drawerVenc={m.drawerVenc} setDrawerVenc={m.setDrawerVenc}
          drawerAnexo={m.drawerAnexo} setDrawerAnexo={m.setDrawerAnexo}
          drawerChecklists={m.drawerChecklists} setDrawerChecklists={m.setDrawerChecklists}
          drawerClassificacao={m.drawerClassificacao} setDrawerClassificacao={m.setDrawerClassificacao}
          drawerResps={m.drawerResps} setDrawerResps={m.setDrawerResps}
          drawerProjetoId={m.drawerProjetoId} setDrawerProjetoId={m.setDrawerProjetoId}
          savingDrawer={m.savingDrawer}
          onClose={m.fecharDrawer}
          onSalvar={m.salvarDrawer}
          onConcluir={m.concluirNoDrawer}
          onExcluir={() => m.excluirTarefa(m.selected!.id)}
          onCommentSent={(msg) => sendEmailNotification(m.selected!.id, 'comentada', `Novo comentário de ${userName}: "${msg}"`)}
        />
      )}
    </div>
  )
}
