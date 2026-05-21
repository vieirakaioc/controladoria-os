'use client'

import { useState } from 'react'
import { toast } from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { getResponsaveis, type ResponsavelLite } from '@/lib/responsaveis'
import { trackEvent } from '@/lib/activityTracker'
import type { ChecklistItem, Row } from '../_lib/types'

type Args = {
  rows: Row[]
  setRows: React.Dispatch<React.SetStateAction<Row[]>>
  statuses: string[]
  userName: string
  refresh: () => Promise<void>
  refreshPlanners: () => Promise<void>
  sendEmailNotification: (taskId: string, action: string, extraObs?: string) => Promise<void>
}

/**
 * Encapsula:
 *   - mutações de linhas (setStatus, excluirTarefa)
 *   - estado e ações do drawer de detalhes (abrir/fechar/salvar/concluir)
 *   - estado e ação de criação de tarefa Ad Hoc
 *
 * Mantém os dados otimistas em rows via setRows, e recarrega quando necessário.
 */
export function useTarefaMutations({
  rows, setRows, statuses, userName, refresh, refreshPlanners, sendEmailNotification,
}: Args) {
  // ─── DRAWER ────────────────────────────────────────────────────────────
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selected, setSelected] = useState<Row | null>(null)
  const [drawerNome, setDrawerNome] = useState('')
  const [drawerStatus, setDrawerStatus] = useState('')
  const [drawerObs, setDrawerObs] = useState('')
  const [drawerVenc, setDrawerVenc] = useState('')
  const [drawerAnexo, setDrawerAnexo] = useState('')
  const [drawerChecklists, setDrawerChecklists] = useState<ChecklistItem[]>([])
  const [drawerClassificacao, setDrawerClassificacao] = useState('')
  const [drawerResps, setDrawerResps] = useState<ResponsavelLite[]>([])
  const [drawerProjetoId, setDrawerProjetoId] = useState('')
  const [savingDrawer, setSavingDrawer] = useState(false)

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
    setDrawerProjetoId(r.atividades?.projeto_id || '')
    setDrawerOpen(true)
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
    setDrawerProjetoId('')
    setSavingDrawer(false)
  }

  // ─── ROW MUTATIONS ─────────────────────────────────────────────────────
  const setStatus = async (id: string, status: string) => {
    const toastId = toast.loading('A atualizar status...')
    setRows(prev => prev.map(r => (r.id === id ? { ...r, status } : r)))

    const patch: { status: string; data_conclusao: string | null } = {
      status,
      data_conclusao: status.toLowerCase().includes('concl') ? new Date().toISOString() : null,
    }
    const { error } = await supabase.from('tarefas_diarias').update(patch).eq('id', id)

    if (error) {
      toast.error('Erro ao atualizar o status.', { id: toastId })
      refresh()
      return
    }

    if (selected?.id === id) {
      setSelected({ ...selected, ...patch })
      setDrawerStatus(patch.status)
    }

    toast.success('Status atualizado!', { id: toastId })
    sendEmailNotification(id, `movida para o status "${status}"`, '')

    // Tracking: registra mudança de status (com flag concluído pra facilitar relatórios)
    const concluiu = status.toLowerCase().includes('concl')
    trackEvent(concluiu ? 'task_completed' : 'task_status_changed', {
      task_id: id,
      new_status: status,
    })
  }

  const excluirTarefa = async (tarefaId: string) => {
    if (!window.confirm('⚠️ Tem certeza que deseja excluir esta tarefa?\n\nEssa ação apagará a tarefa e seus comentários. Não pode ser desfeita.')) return

    const toastId = toast.loading('A excluir tarefa...')
    try {
      const tarefa = rows.find(r => r.id === tarefaId)
      await supabase.from('tarefa_comentarios').delete().eq('tarefa_id', tarefaId)
      const { error } = await supabase.from('tarefas_diarias').delete().eq('id', tarefaId)
      if (error) throw error

      // Ad Hoc: ao excluir a tarefa diária, apaga também a atividade matriz
      if (tarefa?.atividades?.frequencia === 'Ad Hoc' && tarefa.atividades.task_id) {
        await supabase.from('atividades').delete().eq('task_id', tarefa.atividades.task_id)
      }

      setRows(prev => prev.filter(r => r.id !== tarefaId))
      if (selected?.id === tarefaId) fecharDrawer()
      toast.success('Tarefa excluída permanentemente!', { id: toastId })
      trackEvent('task_deleted', { task_id: tarefaId })
    } catch {
      toast.error('Erro ao excluir a tarefa.', { id: toastId })
    }
  }

  const salvarDrawer = async () => {
    if (!selected) return
    if (!drawerNome.trim()) {
      toast.error('O título não pode estar vazio.')
      return
    }

    setSavingDrawer(true)
    const toastId = toast.loading('A guardar alterações...')

    const patch = {
      status: drawerStatus,
      observacoes: drawerObs || null,
      data_vencimento: drawerVenc || null,
      anexo_url: drawerAnexo || null,
      checklists: drawerChecklists,
      data_conclusao: drawerStatus.toLowerCase().includes('concl')
        ? (selected.data_conclusao || new Date().toISOString())
        : null,
    }

    try {
      const { error } = await supabase.from('tarefas_diarias').update(patch).eq('id', selected.id)
      if (error) throw error

      let mudouMatriz = false
      if (selected.atividades?.task_id) {
        const { error: errAtv } = await supabase.from('atividades').update({
          nome_atividade: drawerNome,
          classificacao: drawerClassificacao || null,
          responsaveis_lista: drawerResps.length > 0 ? drawerResps : null,
          projeto_id: drawerProjetoId || null,
        }).eq('task_id', selected.atividades.task_id)
        if (errAtv) throw errAtv
        mudouMatriz = true
      }

      // Atualização otimista: dados + matriz onde aplicável
      setRows(prev => prev.map(r => {
        let atualizado = { ...r }
        if (r.id === selected.id) atualizado = { ...atualizado, ...patch }
        if (mudouMatriz && r.atividades?.task_id === selected.atividades?.task_id) {
          atualizado.atividades = {
            ...atualizado.atividades,
            nome_atividade: drawerNome,
            classificacao: drawerClassificacao || null,
            responsaveis_lista: drawerResps,
            projeto_id: drawerProjetoId || null,
          }
        }
        return atualizado
      }))

      setSelected(prev => prev ? {
        ...prev, ...patch,
        atividades: {
          ...prev.atividades,
          nome_atividade: drawerNome,
          classificacao: drawerClassificacao || null,
          responsaveis_lista: drawerResps,
          projeto_id: drawerProjetoId || null,
        },
      } : prev)

      toast.success('Detalhes guardados!', { id: toastId })

      let emailObs = drawerObs || ''
      if (drawerAnexo) emailObs += `<br/><br/>📎 <strong>Anexo adicionado:</strong> <a href="${drawerAnexo}">Ver Ficheiro</a>`
      sendEmailNotification(selected.id, 'atualizada com novas observações/anexos', emailObs)
    } catch {
      toast.error('Erro ao guardar os detalhes.', { id: toastId })
    } finally {
      setSavingDrawer(false)
      fecharDrawer()
    }
  }

  const concluirNoDrawer = async () => {
    if (!selected) return
    if (drawerChecklists.length > 0 && drawerChecklists.some(c => !c.concluido)) {
      if (!window.confirm('Existem itens não concluídos no checklist! Tem a certeza que deseja concluir a tarefa matriz assim mesmo?')) return
    }
    await setStatus(selected.id, statuses[statuses.length - 1] || 'Concluído')
    fecharDrawer()
  }

  // ─── AD HOC ────────────────────────────────────────────────────────────
  const [adhocOpen, setAdhocOpen] = useState(false)
  const [adhocNome, setAdhocNome] = useState('')
  const [adhocSetorId, setAdhocSetorId] = useState('')
  const [adhocResps, setAdhocResps] = useState<ResponsavelLite[]>([])
  const [adhocProjetoId, setAdhocProjetoId] = useState('')
  const [adhocVenc, setAdhocVenc] = useState<string>(new Date().toISOString().slice(0, 10))
  const [adhocPrioridade, setAdhocPrioridade] = useState('Média')
  const [adhocClassificacao, setAdhocClassificacao] = useState('')
  const [adhocObs, setAdhocObs] = useState('')
  const [savingAdhoc, setSavingAdhoc] = useState(false)

  const resetAdhoc = () => {
    setAdhocNome(''); setAdhocSetorId(''); setAdhocResps([]); setAdhocProjetoId('')
    setAdhocVenc(new Date().toISOString().slice(0, 10))
    setAdhocPrioridade('Média'); setAdhocObs(''); setAdhocClassificacao('')
  }

  const criarAdHoc = async () => {
    const nome = adhocNome.trim()
    if (!nome || !adhocVenc) return
    setSavingAdhoc(true)
    const toastId = toast.loading('A criar tarefa e a notificar...')

    try {
      const taskId = crypto.randomUUID()
      const payloadAtv = {
        task_id: taskId,
        planner_name: 'Ad Hoc',
        nome_atividade: nome,
        setor_id: adhocSetorId || null,
        frequencia: 'Ad Hoc',
        status: 'Ativo',
        prioridade_descricao: adhocPrioridade,
        classificacao: adhocClassificacao || null,
        responsaveis_lista: adhocResps.length > 0 ? adhocResps : null,
        projeto_id: adhocProjetoId || null,
      }
      const { data: atv, error: errAtv } = await supabase
        .from('atividades').insert([payloadAtv]).select('task_id').single()
      if (errAtv) throw errAtv

      const payloadExec = {
        atividade_id: atv.task_id,
        data_vencimento: adhocVenc,
        status: statuses[0] || 'Pendente',
        observacoes: adhocObs || null,
      }
      const { data: execData, error: errExec } = await supabase
        .from('tarefas_diarias').insert([payloadExec]).select('id').single()
      if (errExec) throw errExec

      setAdhocOpen(false)
      resetAdhoc()

      // Notificações no app + email para cada envolvido
      adhocResps.forEach(async (resp) => {
        if (!resp.email) return
        await supabase.from('notificacoes').insert({
          user_email: resp.email,
          titulo: 'Nova Tarefa Ad Hoc',
          mensagem: `${userName} delegou a você: "${nome}" para o dia ${adhocVenc.slice(8, 10)}/${adhocVenc.slice(5, 7)}`,
          tarefa_id: execData.id,
        })
        await fetch('/api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: resp.email,
            subject: `[Portal da Controladoria] Nova Tarefa Ad Hoc: ${nome}`,
            taskName: nome,
            action: 'criada e atribuída a você',
            userName,
            observacoes: `Prazo: ${adhocVenc.slice(8, 10)}/${adhocVenc.slice(5, 7)}/${adhocVenc.slice(0, 4)}<br/>Prioridade: <strong>${adhocPrioridade}</strong><br/>Classificação: <strong>${adhocClassificacao || 'Nenhuma'}</strong><br/><br/>Detalhes Adicionais:<br/>${adhocObs || 'Nenhum detalhe fornecido.'}`,
          }),
        })
      })

      await refreshPlanners()
      await refresh()
      toast.success('Tarefa Ad Hoc criada!', { id: toastId })

      trackEvent('task_created', { task_id: atv.task_id, planner: 'Ad Hoc', nome })
    } catch {
      toast.error('Erro ao criar tarefa.', { id: toastId })
    } finally {
      setSavingAdhoc(false)
    }
  }

  return {
    // drawer state
    drawerOpen, selected,
    drawerNome, setDrawerNome,
    drawerStatus, setDrawerStatus,
    drawerObs, setDrawerObs,
    drawerVenc, setDrawerVenc,
    drawerAnexo, setDrawerAnexo,
    drawerChecklists, setDrawerChecklists,
    drawerClassificacao, setDrawerClassificacao,
    drawerResps, setDrawerResps,
    drawerProjetoId, setDrawerProjetoId,
    savingDrawer,
    abrirDrawer, fecharDrawer, salvarDrawer, concluirNoDrawer,

    // row actions
    setStatus, excluirTarefa,

    // ad hoc
    adhocOpen, setAdhocOpen,
    adhocNome, setAdhocNome,
    adhocSetorId, setAdhocSetorId,
    adhocResps, setAdhocResps,
    adhocProjetoId, setAdhocProjetoId,
    adhocVenc, setAdhocVenc,
    adhocPrioridade, setAdhocPrioridade,
    adhocClassificacao, setAdhocClassificacao,
    adhocObs, setAdhocObs,
    savingAdhoc, criarAdHoc,
  }
}
