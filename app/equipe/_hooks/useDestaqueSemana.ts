'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getResponsaveis } from '@/lib/responsaveis'
import { iso, diasUteisNoIntervalo, diasUteisDistintos } from '../_lib/datas'
import { fimDaSemana, inicioDaSemana, labelSemana } from '../_lib/semana'
import { computeScore, DEFAULT_WEIGHTS, type Metrics, type ScoreBreakdown, type ScoreWeights } from '../_lib/score'

export type DestaqueSemanal = {
  responsavel_id: string
  nome: string
  email: string | null
  metrics: Metrics
  score: ScoreBreakdown
  /** Posição. 1 = vencedor, 2 = vice, etc. */
  posicao: number
}

type Result = {
  /** Top 3 da semana, ordenados por score desc. Vazio se ninguém produziu. */
  top: DestaqueSemanal[]
  /** Label "12/05 a 18/05" pra mostrar no card. */
  semanaLabel: string
  loading: boolean
  /** Para a próxima fase: o texto pronto pra enviar no WhatsApp. */
  mensagem: string
}

/**
 * Calcula o destaque da semana CORRENTE (segunda 00:00 até próxima segunda 00:00).
 * Faz queries leves só do range semanal — não reusa o hook mensal pra ficar
 * independente do filtro de mês.
 */
export function useDestaqueSemana(enabled: boolean): Result {
  const [top, setTop] = useState<DestaqueSemanal[]>([])
  const [loading, setLoading] = useState(true)
  const [weights, setWeights] = useState<ScoreWeights>(DEFAULT_WEIGHTS)
  const semanaLabel = labelSemana()

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const inicio = inicioDaSemana()
        const fim = fimDaSemana()
        const diasUteisPeriodo = diasUteisNoIntervalo(inicio, fim)

        const [
          { data: respsData },
          { data: tarefasData },
          { data: activityData },
          { data: cfgData },
        ] = await Promise.all([
          supabase.from('responsaveis').select('id, nome, email').order('nome'),
          supabase.from('tarefas_diarias').select(`
            id, data_vencimento, data_conclusao, status,
            atividades!tarefas_diarias_atividade_id_fkey (
              task_id, responsavel_id, responsaveis_lista,
              responsaveis!atividades_responsavel_id_fkey (id, nome, email)
            )
          `).gte('data_vencimento', iso(inicio)).lt('data_vencimento', iso(fim)),
          supabase.from('user_activity').select('user_email, created_at')
            .gte('created_at', inicio.toISOString())
            .lt('created_at', fim.toISOString()),
          supabase.from('score_config').select('peso_conclusao, peso_volume, peso_pontualidade, peso_aderencia, peso_uso').eq('id', 1).maybeSingle(),
        ])

        const pesos: ScoreWeights = cfgData
          ? {
              conclusao:    cfgData.peso_conclusao,
              volume:       cfgData.peso_volume ?? 0,
              pontualidade: cfgData.peso_pontualidade ?? 0,
              aderencia:    cfgData.peso_aderencia ?? 0,
              uso:          cfgData.peso_uso,
            }
          : DEFAULT_WEIGHTS
        if (!cancelled) setWeights(pesos)

        // Atividade do app por email
        const activityByEmail = new Map<string, string[]>()
        for (const ev of (activityData || [])) {
          const email = (ev.user_email || '').toLowerCase()
          if (!email) continue
          if (!activityByEmail.has(email)) activityByEmail.set(email, [])
          activityByEmail.get(email)!.push(ev.created_at)
        }

        // Agrega tarefas por responsável
        type Agg = { total: number; concluidas: number; concluidasNoPrazo: number; atrasadas: number; pendentes: number }
        const aggByResp = new Map<string, Agg>()
        const hojeIso = iso(new Date())

        for (const t of (tarefasData || []) as any[]) {
          const resps = getResponsaveis(t.atividades)
          if (resps.length === 0) continue
          const isConcluida = (t.status || '').toLowerCase().includes('concl')
          const conclDate = t.data_conclusao ? t.data_conclusao.slice(0, 10) : null
          const venc = t.data_vencimento ? t.data_vencimento.slice(0, 10) : null
          const noPrazo = isConcluida && conclDate && venc && conclDate <= venc
          const isAtrasada = !isConcluida && venc && venc < hojeIso

          for (const r of resps) {
            if (!r.id) continue
            if (!aggByResp.has(r.id)) {
              aggByResp.set(r.id, { total: 0, concluidas: 0, concluidasNoPrazo: 0, atrasadas: 0, pendentes: 0 })
            }
            const agg = aggByResp.get(r.id)!
            agg.total++
            if (isConcluida) {
              agg.concluidas++
              if (noPrazo) agg.concluidasNoPrazo++
            } else {
              agg.pendentes++
              if (isAtrasada) agg.atrasadas++
            }
          }
        }

        const maxConcluidas = Math.max(1, ...Array.from(aggByResp.values()).map(a => a.concluidas))

        const rows: DestaqueSemanal[] = ((respsData || []) as any[]).map(resp => {
          const agg = aggByResp.get(resp.id) || { total: 0, concluidas: 0, concluidasNoPrazo: 0, atrasadas: 0, pendentes: 0 }
          const emailLower = (resp.email || '').toLowerCase()
          const acts = emailLower ? (activityByEmail.get(emailLower) || []) : []
          const metrics: Metrics = {
            totalAtribuidas: agg.total,
            concluidas: agg.concluidas,
            concluidasNoPrazo: agg.concluidasNoPrazo,
            atrasadas: agg.atrasadas,
            pendentes: agg.pendentes,
            diasUteisAtivos: diasUteisDistintos(acts),
            diasUteisPeriodo,
            maxConcluidasNoPeriodo: maxConcluidas,
          }
          return {
            responsavel_id: resp.id,
            nome: resp.nome,
            email: resp.email,
            metrics,
            score: computeScore(metrics, pesos),
            posicao: 0, // setamos depois do sort
          }
        })

        // Top 3 entre quem produziu alguma coisa
        const ranked = rows
          .filter(r => r.metrics.totalAtribuidas > 0)
          .sort((a, b) => b.score.total - a.score.total)
          .slice(0, 3)
          .map((r, i) => ({ ...r, posicao: i + 1 }))

        if (!cancelled) setTop(ranked)
      } catch {
        if (!cancelled) setTop([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [enabled])

  // Texto pronto pro WhatsApp (já usa formato fácil de colar)
  const mensagem = (() => {
    if (top.length === 0) {
      return `🏆 *Destaque da Semana* (${semanaLabel})\n\nEsta semana ainda não tivemos atividades concluídas. Vamos pra cima na próxima! 💪`
    }
    const linhas = top.map(d => {
      const medalha = d.posicao === 1 ? '🥇' : d.posicao === 2 ? '🥈' : '🥉'
      return `${medalha} *${d.nome}* — Score ${d.score.total}/100\n   ✅ ${d.metrics.concluidas} concluídas · 🎯 ${d.score.pontualidade}% no prazo`
    }).join('\n\n')
    return `🏆 *Destaque da Semana — Portal da Controladoria*\n📅 ${semanaLabel}\n\n${linhas}\n\nParabéns! 👏 Vamos manter o ritmo na próxima semana.`
  })()

  return { top, semanaLabel, loading, mensagem }
}
