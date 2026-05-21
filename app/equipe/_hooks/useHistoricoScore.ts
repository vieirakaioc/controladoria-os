'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getResponsaveis } from '@/lib/responsaveis'
import { iso, diasUteisNoIntervalo, diasUteisDistintos } from '../_lib/datas'
import { computeScore, DEFAULT_WEIGHTS, type Metrics, type ScoreBreakdown, type ScoreWeights } from '../_lib/score'

export type HistoricoMes = {
  ano: number
  mes: number          // 0..11
  label: string        // "Jan/26"
}

export type LinhaHistorico = {
  responsavel_id: string
  nome: string
  email: string | null
  /** Score de cada mês, indexado igual ao array `meses`. null = não tinha tarefa nesse mês. */
  scores: (ScoreBreakdown | null)[]
}

type Args = {
  enabled: boolean
  /** Quantos meses pra trás incluir, contando o atual. Default 6. */
  qtdMeses?: number
  /** Mês de referência (default = mês atual). Permite scrollar pro passado. */
  refMes?: number
  refAno?: number
  filtroPlanner?: string
  filtroSetor?: string
}

const MESES_NOMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

/**
 * Histórico de score por colaborador nos últimos N meses.
 * Faz UMA query grande do range inteiro e segmenta no JS — mais eficiente
 * que N queries paralelas pra cada mês.
 */
export function useHistoricoScore({
  enabled,
  qtdMeses = 6,
  refMes,
  refAno,
  filtroPlanner = 'Todos',
  filtroSetor = 'Todos',
}: Args) {
  const [linhas, setLinhas] = useState<LinhaHistorico[]>([])
  const [meses, setMeses] = useState<HistoricoMes[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setErro(null)
      try {
        const hoje = new Date()
        const mRef = refMes ?? hoje.getMonth()
        const aRef = refAno ?? hoje.getFullYear()

        // Calcula a lista de meses (mais antigo → mais recente)
        const listaMeses: HistoricoMes[] = []
        for (let i = qtdMeses - 1; i >= 0; i--) {
          const d = new Date(aRef, mRef - i, 1)
          listaMeses.push({
            ano: d.getFullYear(),
            mes: d.getMonth(),
            label: `${MESES_NOMES[d.getMonth()]}/${String(d.getFullYear()).slice(-2)}`,
          })
        }
        if (!cancelled) setMeses(listaMeses)

        // Range total: 1º dia do mês mais antigo → 1º dia do mês seguinte ao último
        const rangeInicio = new Date(listaMeses[0].ano, listaMeses[0].mes, 1)
        const ult = listaMeses[listaMeses.length - 1]
        const rangeFim = new Date(ult.ano, ult.mes + 1, 1)

        // 4 queries em paralelo
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
              task_id, planner_name, responsavel_id, responsaveis_lista,
              setores!atividades_setor_id_fkey (nome),
              responsaveis!atividades_responsavel_id_fkey (id, nome, email)
            )
          `).gte('data_vencimento', iso(rangeInicio)).lt('data_vencimento', iso(rangeFim)),
          supabase.from('user_activity').select('user_email, created_at')
            .gte('created_at', rangeInicio.toISOString())
            .lt('created_at', rangeFim.toISOString()),
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

        // Aplica filtros
        const tarefasFiltradas = ((tarefasData || []) as any[]).filter(t => {
          if (filtroPlanner !== 'Todos' && t.atividades?.planner_name !== filtroPlanner) return false
          if (filtroSetor !== 'Todos' && t.atividades?.setores?.nome !== filtroSetor) return false
          return true
        })

        // Segmenta tarefas e activity por mês
        type Agg = { total: number; concluidas: number; concluidasNoPrazo: number; atrasadas: number; pendentes: number }
        // chave: `${ano}-${mes}-${resp_id}` → Agg
        const aggMatrix = new Map<string, Agg>()
        const hojeIso = iso(new Date())

        for (const t of tarefasFiltradas) {
          const venc = t.data_vencimento ? t.data_vencimento.slice(0, 10) : null
          if (!venc) continue
          const [y, m] = venc.split('-').map(Number)
          const mesIdx = (m || 1) - 1
          const isConcluida = (t.status || '').toLowerCase().includes('concl')
          const conclDate = t.data_conclusao ? t.data_conclusao.slice(0, 10) : null
          const noPrazo = isConcluida && conclDate && venc && conclDate <= venc
          const isAtrasada = !isConcluida && venc < hojeIso

          const resps = getResponsaveis(t.atividades)
          for (const r of resps) {
            if (!r.id) continue
            const key = `${y}-${mesIdx}-${r.id}`
            if (!aggMatrix.has(key)) {
              aggMatrix.set(key, { total: 0, concluidas: 0, concluidasNoPrazo: 0, atrasadas: 0, pendentes: 0 })
            }
            const agg = aggMatrix.get(key)!
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

        // Activity por (email, mês)
        const actMatrix = new Map<string, string[]>()
        for (const ev of (activityData || [])) {
          const email = (ev.user_email || '').toLowerCase()
          if (!email) continue
          const ts = ev.created_at
          const [y, m] = ts.slice(0, 10).split('-').map(Number)
          const key = `${y}-${(m || 1) - 1}-${email}`
          if (!actMatrix.has(key)) actMatrix.set(key, [])
          actMatrix.get(key)!.push(ts)
        }

        // Pra cada mês, calcula maxConcluidas (referência do Volume)
        const maxConcluidasPorMes = new Map<string, number>()
        for (const m of listaMeses) {
          const key = `${m.ano}-${m.mes}`
          let max = 1
          for (const [k, agg] of aggMatrix.entries()) {
            if (k.startsWith(`${key}-`) && agg.concluidas > max) max = agg.concluidas
          }
          maxConcluidasPorMes.set(key, max)
        }

        // Monta as linhas finais
        const responsaveis = (respsData || []) as { id: string; nome: string; email: string | null }[]
        const rows: LinhaHistorico[] = responsaveis.map(resp => ({
          responsavel_id: resp.id,
          nome: resp.nome,
          email: resp.email,
          scores: listaMeses.map(m => {
            const key = `${m.ano}-${m.mes}-${resp.id}`
            const agg = aggMatrix.get(key)
            if (!agg || agg.total === 0) return null
            const emailLower = (resp.email || '').toLowerCase()
            const actKey = `${m.ano}-${m.mes}-${emailLower}`
            const acts = emailLower ? (actMatrix.get(actKey) || []) : []
            const diasUteisPeriodo = diasUteisNoIntervalo(
              new Date(m.ano, m.mes, 1),
              new Date(m.ano, m.mes + 1, 1),
            )
            const maxConcl = maxConcluidasPorMes.get(`${m.ano}-${m.mes}`) || 1

            const metrics: Metrics = {
              totalAtribuidas: agg.total,
              concluidas: agg.concluidas,
              concluidasNoPrazo: agg.concluidasNoPrazo,
              atrasadas: agg.atrasadas,
              pendentes: agg.pendentes,
              diasUteisAtivos: diasUteisDistintos(acts),
              diasUteisPeriodo,
              maxConcluidasNoPeriodo: maxConcl,
            }
            return computeScore(metrics, pesos)
          }),
        }))

        // Ordena pelo score do mês mais recente (desc)
        const idxAtual = listaMeses.length - 1
        rows.sort((a, b) => (b.scores[idxAtual]?.total || 0) - (a.scores[idxAtual]?.total || 0))

        // Esconde quem não tem score em mês nenhum
        const filtradas = rows.filter(r => r.scores.some(s => s !== null))

        if (!cancelled) setLinhas(filtradas)
      } catch (e: any) {
        if (!cancelled) setErro(e?.message || 'Erro ao carregar histórico.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [enabled, qtdMeses, refMes, refAno, filtroPlanner, filtroSetor])

  return { linhas, meses, loading, erro }
}
