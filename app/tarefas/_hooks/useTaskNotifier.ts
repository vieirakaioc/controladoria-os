'use client'

import { useEffect } from 'react'
import { getResponsaveis } from '@/lib/responsaveis'
import type { Row } from '../_lib/types'

type Args = {
  rows: Row[]
  loading: boolean
  userEmail: string
  userName: string
}

/**
 * - Effect: uma vez por dia, envia um email-resumo com tarefas que vencem hoje
 *   pro usuário logado (cache em localStorage com chave por user+data).
 * - Função: sendEmailNotification(taskId, action, observacoes) dispara email
 *   pra todos os responsáveis daquela tarefa.
 */
export function useTaskNotifier({ rows, loading, userEmail, userName }: Args) {
  // Lembrete diário (1x por dia/email)
  useEffect(() => {
    if (loading || !userEmail || rows.length === 0) return

    const dt = new Date()
    const hojeLocal = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
    const cacheKey = `email_lembrete_${userEmail}_${hojeLocal}`
    if (typeof localStorage !== 'undefined' && localStorage.getItem(cacheKey)) return

    const meu = userEmail.trim().toLowerCase()
    const minhasHoje = rows.filter(r => {
      const isPend = !(r.status || '').toLowerCase().includes('concl')
      const isHoje = r.data_vencimento && r.data_vencimento.slice(0, 10) === hojeLocal
      const resps = getResponsaveis(r?.atividades)
      const sou = resps.some(res => (res.email || '').trim().toLowerCase() === meu)
      return isPend && isHoje && sou
    })

    if (minhasHoje.length === 0) return
    localStorage.setItem(cacheKey, 'true')

    const taskListHtml = minhasHoje
      .map(t => `<li><strong>${t.atividades?.nome_atividade}</strong></li>`)
      .join('')

    fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: userEmail,
        subject: `[Lembrete de Vencimento] ${minhasHoje.length} tarefa(s) expiram HOJE!`,
        taskName: 'Resumo Diário',
        action: 'exigem a sua atenção hoje',
        userName,
        observacoes: `Olá! As seguintes tarefas sob sua responsabilidade têm prazo de entrega para hoje (${dt.toLocaleDateString('pt-BR')}):<br/><br/><ul>${taskListHtml}</ul><br/>Acesse o Portal da Controladoria para atualizar os status.`,
      }),
    })
  }, [loading, rows, userEmail, userName])

  const sendEmailNotification = async (taskId: string, actionText: string, extraObs?: string) => {
    try {
      const task = rows.find(r => r.id === taskId)
      if (!task) return
      const resps = getResponsaveis(task.atividades)
      for (const resp of resps) {
        if (!resp.email) continue
        await fetch('/api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: resp.email,
            subject: `[Portal da Controladoria] Atualização de Tarefa: ${task.atividades?.nome_atividade}`,
            taskName: task.atividades?.nome_atividade,
            action: actionText,
            userName,
            observacoes: extraObs || task.observacoes || '',
          }),
        })
      }
    } catch {
      // silencioso — não bloqueia o fluxo principal
    }
  }

  return { sendEmailNotification }
}
