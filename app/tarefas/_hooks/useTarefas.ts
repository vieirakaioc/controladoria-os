'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { getResponsaveis } from '@/lib/responsaveis'
import { iso } from '../_lib/helpers'
import type { Lookup, PlannerRow, Row, StatusRow } from '../_lib/types'

type Args = {
  plannerSel: string
  mesAlvo: number
  anoAlvo: number
  userEmail: string
  userRole: string
  authLoaded: boolean
}

/**
 * Carrega:
 *  - Listas de lookup (setores, responsaveis, classificacoes, projetos) — uma vez
 *  - Lista de planners disponíveis — uma vez
 *  - Workflow (statuses + ordem) — quando o planner muda
 *  - Linhas de tarefas_diarias do mês selecionado — quando filtros relevantes mudam
 *
 * Filtra automaticamente por responsável quando o usuário não é admin.
 */
export function useTarefas({ plannerSel, mesAlvo, anoAlvo, userEmail, userRole, authLoaded }: Args) {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  const [planners, setPlanners] = useState<string[]>([])
  const [statuses, setStatuses] = useState<string[]>([])
  const [statusOrderMap, setStatusOrderMap] = useState<Record<string, number>>({})

  const [setoresDb, setSetoresDb] = useState<Lookup[]>([])
  const [respsDb, setRespsDb] = useState<Lookup[]>([])
  const [classificacoesDb, setClassificacoesDb] = useState<Lookup[]>([])
  const [projetosDb, setProjetosDb] = useState<{ id: string; nome: string }[]>([])

  // Lookups + planners: carrega uma vez na montagem
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [{ data: s }, { data: r }, { data: c }, { data: p }, { data: pl }] = await Promise.all([
        supabase.from('setores').select('id,nome').order('nome', { ascending: true }),
        supabase.from('responsaveis').select('id,nome,email').order('nome', { ascending: true }),
        supabase.from('classificacoes').select('id,nome').order('nome', { ascending: true }),
        supabase.from('projetos').select('id,nome').eq('status', 'Em Andamento').order('nome', { ascending: true }),
        supabase.from('atividades').select('planner_name'),
      ])
      if (cancelled) return
      setSetoresDb((s || []) as Lookup[])
      setRespsDb((r || []) as Lookup[])
      setClassificacoesDb((c || []) as Lookup[])
      setProjetosDb((p || []) as { id: string; nome: string }[])
      const uniq = Array.from(
        new Set(((pl as PlannerRow[]) || []).map(x => x.planner_name))
      ).filter(Boolean).sort() as string[]
      setPlanners(uniq)
    })()
    return () => { cancelled = true }
  }, [])

  const carregarPlanners = useCallback(async () => {
    const { data, error } = await supabase.from('atividades').select('planner_name')
    if (error) return
    const uniq = Array.from(
      new Set((data as PlannerRow[]).map(x => x.planner_name))
    ).filter(Boolean).sort() as string[]
    setPlanners(uniq)
  }, [])

  const carregarWorkflow = useCallback(async (plannerName: string) => {
    let final = ['Pendente', 'Em andamento', 'Aguardando', 'Concluído']
    const map: Record<string, number> = {}

    if (plannerName && plannerName !== 'Todos') {
      const { data } = await supabase
        .from('planner_workflows')
        .select(`id, planner_name, planner_workflow_statuses (status_name, status_order)`)
        .eq('planner_name', plannerName)
        .maybeSingle()
      const st: StatusRow[] = ((data as any)?.planner_workflow_statuses || []) as StatusRow[]
      const ordered = st.slice().sort((a, b) => a.status_order - b.status_order).map(s => s.status_name)
      if (ordered.length > 0) final = ordered
    }

    final.forEach((name, idx) => (map[name] = idx))
    setStatuses(final)
    setStatusOrderMap(map)
  }, [])

  const carregar = useCallback(async () => {
    if (!plannerSel || !authLoaded || !userEmail) return
    setLoading(true)
    try {
      const inicio = new Date(anoAlvo, mesAlvo, 1)
      const fim = new Date(anoAlvo, mesAlvo + 1, 1)
      const pageSize = 1000
      let from = 0
      let acc: any[] = []

      // Paginação manual: Supabase devolve no máximo 1000 por request
      while (true) {
        const { data, error } = await supabase
          .from('tarefas_diarias')
          .select(`
            id, data_vencimento, status, data_conclusao, observacoes, anexo_url, checklists,
            atividades!tarefas_diarias_atividade_id_fkey (
              task_id, nome_atividade, planner_name, frequencia, prioridade_descricao, responsavel_id, classificacao, responsaveis_lista, projeto_id,
              setores!atividades_setor_id_fkey (nome), responsaveis!atividades_responsavel_id_fkey (nome, email)
            )
          `)
          .gte('data_vencimento', iso(inicio))
          .lt('data_vencimento', iso(fim))
          .order('data_vencimento', { ascending: true })
          .order('id', { ascending: true })
          .range(from, from + pageSize - 1)
        if (error) throw error
        const lote = data || []
        acc = acc.concat(lote)
        if (lote.length < pageSize) break
        from += pageSize
      }

      let baseData = acc
      if (userRole !== 'admin') {
        const meu = userEmail.trim().toLowerCase()
        baseData = baseData.filter((r: any) => {
          const resps = getResponsaveis(r?.atividades)
          return resps.some(res => (res.email || '').trim().toLowerCase() === meu)
        })
      }

      const filtrado = plannerSel === 'Todos'
        ? baseData
        : baseData.filter((r: any) => r?.atividades?.planner_name === plannerSel)
      setRows(filtrado as Row[])
    } catch {
      toast.error('Erro ao carregar tarefas da base de dados.')
    } finally {
      setLoading(false)
    }
  }, [plannerSel, mesAlvo, anoAlvo, userEmail, userRole, authLoaded])

  // Sempre que algo relevante mudar, recarrega workflow + rows
  useEffect(() => {
    if (!plannerSel || !authLoaded || !userEmail) return
    ;(async () => {
      await carregarWorkflow(plannerSel)
      await carregar()
    })()
  }, [plannerSel, mesAlvo, anoAlvo, authLoaded, userRole, userEmail, carregar, carregarWorkflow])

  return {
    rows, setRows,
    loading,
    refresh: carregar,
    planners, refreshPlanners: carregarPlanners,
    statuses, statusOrderMap,
    setoresDb, respsDb, classificacoesDb, projetosDb,
  }
}
