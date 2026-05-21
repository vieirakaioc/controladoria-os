'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getResponsaveis } from '@/lib/responsaveis'
import {
  iso, startOfMonth, startOfNextMonth, diasUteisNoIntervalo, diasUteisDistintos,
} from '../_lib/datas'
import { computeScore, DEFAULT_WEIGHTS, type Metrics, type ScoreBreakdown, type ScoreWeights } from '../_lib/score'
import { type Ausencia, ausenciaHoje, ausente, diasUteisAusentes, indexAusencias, substitutoNaData } from '../_lib/ausencias'

export type ColaboradorRow = {
  responsavel_id: string
  nome: string
  email: string | null
  user_id: string | null            // null se a pessoa nunca logou no app
  lastActivity: string | null       // ISO ts da última atividade
  metrics: Metrics
  score: ScoreBreakdown
  /** Ausência ativa hoje (se houver) — mostra badge "🌴 Em férias" no Monitor */
  ausenciaAtiva: Ausencia | null
}

type Args = {
  mesAlvo: number
  anoAlvo: number
  /** Pula a busca se não for admin (page redireciona) */
  enabled: boolean
  /** 'Todos' = sem filtro; senão filtra por planner_name antes de agregar */
  filtroPlanner?: string
  /** 'Todos' = sem filtro; senão filtra por setor antes de agregar */
  filtroSetor?: string
}

/**
 * Carrega tudo que o /equipe precisa em poucas queries:
 *   1. responsaveis (lista mestre de pessoas)
 *   2. profiles (pra associar user_id e role)
 *   3. tarefas_diarias do mês alvo (com fk pra atividades.responsavel_id / lista)
 *   4. user_activity do mês alvo (pra calcular dias ativos + último acesso)
 *
 * Depois agrega tudo por responsável e calcula o score.
 */
export function useEquipeData({ mesAlvo, anoAlvo, enabled, filtroPlanner = 'Todos', filtroSetor = 'Todos' }: Args) {
  const [colaboradores, setColaboradores] = useState<ColaboradorRow[]>([])
  const [weights, setWeights] = useState<ScoreWeights>(DEFAULT_WEIGHTS)
  const [plannerOptions, setPlannerOptions] = useState<string[]>([])
  const [setorOptions, setSetorOptions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const reload = () => setReloadKey(k => k + 1)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setErro(null)
      try {
        const inicio = startOfMonth(anoAlvo, mesAlvo)
        const fim = startOfNextMonth(anoAlvo, mesAlvo)
        const diasUteisPeriodo = diasUteisNoIntervalo(inicio, fim)

        // Roda as 6 queries em paralelo (inclui ausencias)
        const [
          { data: respsData, error: errResps },
          { data: profilesData, error: errProfiles },
          { data: tarefasData, error: errTarefas },
          { data: activityData, error: errActivity },
          { data: scoreCfgData },
          { data: ausenciasData },
        ] = await Promise.all([
          supabase.from('responsaveis').select('id, nome, email').order('nome'),
          supabase.from('profiles').select('id, full_name, role'),
          supabase.from('tarefas_diarias').select(`
            id, data_vencimento, data_conclusao, status,
            atividades!tarefas_diarias_atividade_id_fkey (
              task_id, responsavel_id, responsaveis_lista,
              responsaveis!atividades_responsavel_id_fkey (id, nome, email)
            )
          `).gte('data_vencimento', iso(inicio)).lt('data_vencimento', iso(fim)),
          supabase.from('user_activity').select('user_id, user_email, event_type, created_at')
            .gte('created_at', inicio.toISOString())
            .lt('created_at', fim.toISOString()),
          supabase.from('score_config').select('peso_conclusao, peso_volume, peso_pontualidade, peso_aderencia, peso_uso').eq('id', 1).maybeSingle(),
          supabase.from('ausencias').select('id, responsavel_id, data_inicio, data_fim, motivo, observacao, substituto_id, created_at')
            .lte('data_inicio', iso(fim))   // começou antes do fim do mês
            .gte('data_fim', iso(inicio)),   // termina depois do início do mês
        ])

        // Lê pesos do banco se existir, senão usa default (45/25/15/10/5)
        const pesos: ScoreWeights = scoreCfgData
          ? {
              conclusao:    scoreCfgData.peso_conclusao,
              volume:       scoreCfgData.peso_volume ?? 0,
              pontualidade: scoreCfgData.peso_pontualidade ?? 0,
              aderencia:    scoreCfgData.peso_aderencia ?? 0,
              uso:          scoreCfgData.peso_uso,
            }
          : DEFAULT_WEIGHTS
        if (!cancelled) setWeights(pesos)

        if (errResps) throw errResps
        if (errProfiles) throw errProfiles
        if (errTarefas) throw errTarefas
        // user_activity pode estar vazia/sem permissão no início — não derruba
        const activity = errActivity ? [] : (activityData || [])
        const profiles = profilesData || []
        const tarefas = tarefasData || []
        const responsaveis = (respsData || []) as { id: string; nome: string; email: string | null }[]

        // Index profiles por email (caso-insensitive) — porque o link
        // responsavel ↔ user é por email (responsaveis.email == auth.users.email)
        // Pra isso precisamos do email do auth.users, mas profiles não tem email.
        // Trabalhamos por user_id direto do activity.
        const activityByEmail = new Map<string, { ts: string[]; lastTs: string | null }>()
        for (const ev of activity) {
          const email = (ev.user_email || '').toLowerCase()
          if (!email) continue
          if (!activityByEmail.has(email)) {
            activityByEmail.set(email, { ts: [], lastTs: null })
          }
          const agg = activityByEmail.get(email)!
          agg.ts.push(ev.created_at)
          if (!agg.lastTs || ev.created_at > agg.lastTs) agg.lastTs = ev.created_at
        }

        // Extrai opções únicas de planner/setor pra alimentar os selects de filtro
        const plannerSet = new Set<string>()
        const setorSet = new Set<string>()
        for (const t of tarefas as any[]) {
          const p = t.atividades?.planner_name
          const s = t.atividades?.setores?.nome
          if (p) plannerSet.add(p)
          if (s) setorSet.add(s)
        }
        if (!cancelled) {
          setPlannerOptions(Array.from(plannerSet).sort())
          setSetorOptions(Array.from(setorSet).sort())
        }

        // Aplica os filtros (se "Todos", passa direto)
        const tarefasFiltradas = (tarefas as any[]).filter(t => {
          const planner = t.atividades?.planner_name
          const setor = t.atividades?.setores?.nome
          if (filtroPlanner !== 'Todos' && planner !== filtroPlanner) return false
          if (filtroSetor !== 'Todos' && setor !== filtroSetor) return false
          return true
        })

        // Indexa ausências por responsável pra lookup rápido
        const ausenciasIdx = indexAusencias((ausenciasData || []) as Ausencia[])

        // Agrega tarefas por responsável (usando responsavel_id E responsaveis_lista)
        type AggTarefas = { total: number; concluidas: number; concluidasNoPrazo: number; atrasadas: number; pendentes: number }
        const tarefasByResp = new Map<string, AggTarefas>()
        const ensure = (id: string): AggTarefas => {
          if (!tarefasByResp.has(id)) {
            tarefasByResp.set(id, { total: 0, concluidas: 0, concluidasNoPrazo: 0, atrasadas: 0, pendentes: 0 })
          }
          return tarefasByResp.get(id)!
        }
        const hojeIso = iso(new Date())

        for (const t of tarefasFiltradas) {
          const resps = getResponsaveis(t.atividades) // pega lista efetiva
          if (resps.length === 0) continue

          const isConcluida = (t.status || '').toLowerCase().includes('concl')
          const conclDate = t.data_conclusao ? t.data_conclusao.slice(0, 10) : null
          const venc = t.data_vencimento ? t.data_vencimento.slice(0, 10) : null
          const noPrazo = isConcluida && conclDate && venc && conclDate <= venc
          const isAtrasada = !isConcluida && venc && venc < hojeIso

          for (const r of resps) {
            if (!r.id) continue

            // Decide PRA QUEM essa tarefa conta:
            //   - Se o responsável NÃO está ausente → pra ele mesmo
            //   - Se está ausente E tem substituto → pro substituto (cobertura)
            //   - Se está ausente E SEM substituto → não conta pra ninguém
            let alvoId: string | null = r.id as string
            if (venc && ausente(r.id as string, venc, ausenciasIdx)) {
              alvoId = substitutoNaData(r.id as string, venc, ausenciasIdx)
            }
            if (!alvoId) continue

            const agg = ensure(alvoId)
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

        // Calcula o maior volume de concluídas do mês — referência pro cálculo
        // de Volume no score. Se for 0 (mês sem nenhuma conclusão), vira 1 pra
        // evitar divisão por zero.
        const maxConcluidasNoPeriodo = Math.max(
          1,
          ...Array.from(tarefasByResp.values()).map(a => a.concluidas),
        )

        // Monta a lista final, juntando com profiles via email.
        // Quando há filtro ativo, oculta colaboradores sem tarefas no recorte
        // (não faz sentido mostrar 0/0/0 quando você está olhando um setor específico).
        const filtroAtivo = filtroPlanner !== 'Todos' || filtroSetor !== 'Todos'
        const rows: ColaboradorRow[] = responsaveis.map(resp => {
          const t = tarefasByResp.get(resp.id) || { total: 0, concluidas: 0, concluidasNoPrazo: 0, atrasadas: 0, pendentes: 0 }
          const emailLower = (resp.email || '').toLowerCase()
          const act = emailLower ? activityByEmail.get(emailLower) : undefined
          const diasUteisAtivos = act ? diasUteisDistintos(act.ts) : 0

          // Tenta achar o profile dessa pessoa pelo email
          // (profiles não tem email; precisaríamos cruzar com auth.users — pulamos aqui)
          // Como proxy: identifica se "tem user_id" pela presença de atividade
          const user_id = null  // não temos sem cruzar auth.users; deixa null

          // Subtrai os dias úteis em que a pessoa estava ausente do denominador
          // do "Uso do App" — assim não conta como se ela "tivesse que entrar"
          // estando de férias.
          const diasAusente = diasUteisAusentes(resp.id, inicio, fim, ausenciasIdx)
          const diasUteisAjustado = Math.max(0, diasUteisPeriodo - diasAusente)

          const metrics: Metrics = {
            totalAtribuidas: t.total,
            concluidas: t.concluidas,
            concluidasNoPrazo: t.concluidasNoPrazo,
            atrasadas: t.atrasadas,
            pendentes: t.pendentes,
            diasUteisAtivos,
            diasUteisPeriodo: diasUteisAjustado,
            maxConcluidasNoPeriodo,
          }

          return {
            responsavel_id: resp.id,
            nome: resp.nome,
            email: resp.email,
            user_id,
            lastActivity: act?.lastTs ?? null,
            metrics,
            score: computeScore(metrics, pesos),
            ausenciaAtiva: ausenciaHoje(resp.id, ausenciasIdx),
          }
        })

        // Ordena por score desc (admins veem quem rende mais primeiro)
        rows.sort((a, b) => b.score.total - a.score.total)

        // Se filtrou, esconde quem não tem nenhuma tarefa no recorte
        const rowsFinais = filtroAtivo
          ? rows.filter(r => r.metrics.totalAtribuidas > 0)
          : rows

        if (!cancelled) setColaboradores(rowsFinais)
      } catch (e: any) {
        if (!cancelled) setErro(e?.message || 'Erro ao carregar dados da equipe.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [mesAlvo, anoAlvo, enabled, reloadKey, filtroPlanner, filtroSetor])

  return { colaboradores, weights, plannerOptions, setorOptions, loading, erro, reload }
}
