'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Toaster, toast } from 'react-hot-toast'

import { useAuthGate } from './_hooks/useAuthGate'
import { useTarefas } from './_hooks/useTarefas'
import { useTarefaFilters } from './_hooks/useTarefaFilters'
import { useTaskNotifier } from './_hooks/useTaskNotifier'
import { useTarefaMutations } from './_hooks/useTarefaMutations'

import { Header } from './_components/Header'
import { KpiCards } from './_components/KpiCards'
import { FiltersBar } from './_components/FiltersBar'
import { SkeletonBoard, SkeletonCalendar, SkeletonList } from './_components/Skeletons'

import { ListView } from './_components/views/ListView'
import { BoardView } from './_components/views/BoardView'
import { TimeboardView } from './_components/views/TimeboardView'
import { CalendarView } from './_components/views/CalendarView'

import { AdHocModal } from './_components/modals/AdHocModal'
import { TaskDetailsModal } from './_components/modals/TaskDetailsModal'

import { MESES, type ViewMode } from './_lib/types'
import { downloadIcs, type IcsTask } from '@/lib/ics'
import { getResponsaveis } from '@/lib/responsaveis'

export default function TarefasPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const taskIdUrl = searchParams?.get('taskId')

  const hoje = new Date()
  const [mesAlvo, setMesAlvo] = useState<number>(hoje.getMonth())
  const [anoAlvo, setAnoAlvo] = useState<number>(hoje.getFullYear())
  const [plannerSel, setPlannerSel] = useState<string>('Todos')
  const [view, setView] = useState<ViewMode>('timeboard')

  const { userId, userName, userEmail, userRole, authLoaded } = useAuthGate()

  const tarefas = useTarefas({
    plannerSel, mesAlvo, anoAlvo, userEmail, userRole, authLoaded,
  })

  const filters = useTarefaFilters({
    rows: tarefas.rows,
    statuses: tarefas.statuses,
    mesAlvo, anoAlvo,
  })

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
    downloadIcs(tasks, `Tarefas_${mesNome}_${anoAlvo}.ics`, `Portal · ${mesNome}/${anoAlvo}`)
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
