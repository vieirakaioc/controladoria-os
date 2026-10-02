'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { comCache } from '@/lib/cacheConsulta'
import { getResponsaveis } from '@/lib/responsaveis'
import { ehDoProjeto, podeVerAtividade, soDoProjeto, type Perfil } from '@/lib/acessoProjeto'
import { apenasSubtarefas } from '../_lib/types'
import { iso } from '../_lib/helpers'
import type { Lookup, PlannerRow, Row, StatusRow } from '../_lib/types'

type Args = {
  plannerSel: string
  mesAlvo: number
  anoAlvo: number
  userEmail: string
  userRole: string
  /** Escopo, cargo, nome e e-mail juntos: é o que decide o que a pessoa vê. */
  perfil: Perfil
  /** Ignora mês e ano e traz tudo — inclusive tarefa sem data de vencimento. */
  todoPeriodo: boolean
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
export function useTarefas({ plannerSel, mesAlvo, anoAlvo, userEmail, userRole, perfil, todoPeriodo, authLoaded }: Args) {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  const [planners, setPlanners] = useState<string[]>([])
  const [statuses, setStatuses] = useState<string[]>([])
  const [statusOrderMap, setStatusOrderMap] = useState<Record<string, number>>({})

  const [setoresDb, setSetoresDb] = useState<Lookup[]>([])
  const [respsDb, setRespsDb] = useState<Lookup[]>([])
  const [classificacoesDb, setClassificacoesDb] = useState<Lookup[]>([])
  // Quem pode ser dono de subtarefa. Ver a montagem mais abaixo.
  const [donosDb, setDonosDb] = useState<Lookup[]>([])
  /** Quantas tarefas o mês anterior tem, quando o escolhido está quase vazio. */
  const [mesNaoGerado, setMesNaoGerado] = useState<{ mes: number; ano: number; anterior: number } | null>(null)
  const [projetosDb, setProjetosDb] = useState<{ id: string; nome: string }[]>([])

  // Lookups + planners: carrega uma vez na montagem
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      // Sem a varredura de `atividades` que existia aqui só para listar os
      // planners: ela lia a tabela inteira, custava 800 ms e a mesma informação
      // já vem junto das atividades carregadas em `carregar`.
      // Em cache: cinco listas que quase não mudam no expediente, rebuscadas
      // toda vez que a tela montava. Cada ida custa 220 a 250 ms de latência,
      // mesmo devolvendo 900 bytes.
      const [{ data: s }, { data: r }, { data: c }, { data: p }, { data: perfis }] = await Promise.all([
        comCache('setores', () => supabase.from('setores').select('id,nome').order('nome', { ascending: true })),
        comCache('responsaveis', () => supabase.from('responsaveis').select('id,nome,email').order('nome', { ascending: true })),
        comCache('classificacoes', () => supabase.from('classificacoes').select('id,nome').order('nome', { ascending: true })),
        comCache('projetos', () => supabase.from('projetos').select('id,nome').eq('status', 'Em Andamento').order('nome', { ascending: true })),
        comCache('profiles', () => supabase.from('profiles').select('id, full_name, email').order('full_name', { ascending: true })),
      ])
      if (cancelled) return
      setSetoresDb((s || []) as Lookup[])
      setRespsDb((r || []) as Lookup[])

      // Donos de subtarefa: quem tem login primeiro, depois quem só está na
      // planilha — sem repetir, pelo e-mail. Só `responsaveis` deixava de fora
      // todo usuário criado depois da última sincronização da planilha; só
      // `profiles` sumiria com quem nunca teve login. O e-mail é a chave
      // porque é por ele que o Controle de Tarefas decide quem enxerga a
      // subtarefa.
      const vistos = new Set<string>()
      const donos: Lookup[] = []
      for (const perfil of (perfis || []) as { id: string; full_name: string | null; email: string | null }[]) {
        const email = (perfil.email || '').trim().toLowerCase()
        if (!email || vistos.has(email)) continue
        vistos.add(email)
        donos.push({ id: email, nome: perfil.full_name?.trim() || email, email })
      }
      for (const resp of (r || []) as Lookup[]) {
        const email = (resp.email || '').trim().toLowerCase()
        if (email && vistos.has(email)) continue
        if (email) vistos.add(email)
        donos.push({ id: email || `r:${resp.id}`, nome: resp.nome, email: email || undefined })
      }
      donos.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      setDonosDb(donos)
      setClassificacoesDb((c || []) as Lookup[])
      setProjetosDb((p || []) as { id: string; nome: string }[])
      // A lista de planners é preenchida por `carregar`, junto das atividades.
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

      /*
       * Duas consultas rasas em vez de uma aninhada.
       *
       * Antes, cada tarefa do mês vinha com a atividade dentro — nome, planner,
       * setor e responsável repetidos linha a linha. Com 1.434 tarefas isso
       * eram 900 kB para montar e transmitir, e o servidor levava 1,7 s só
       * nisso, enquanto a consulta no banco custava 1,4 ms. O peso não era o
       * dado: era a repetição.
       *
       * Agora as tarefas vêm planas e as ~550 atividades vêm uma vez só, em
       * paralelo. A junção acontece aqui, e o formato entregue à tela é o mesmo
       * de antes — nenhuma outra parte do app precisa saber disso.
       */
      const buscarPagina = async (inicioPagina: number) => {
        let consulta = supabase
          .from('tarefas_diarias')
          .select('id, data_vencimento, status, data_conclusao, observacoes, anexo_url, checklists, atividade_id')

        // "Todo o período" não aplica filtro de data nenhum, em vez de uma
        // janela enorme: comparação com nulo é sempre falsa, e a janela ainda
        // descartaria a tarefa sem vencimento — justamente a que se perde de vista.
        if (!todoPeriodo) {
          consulta = consulta.gte('data_vencimento', iso(inicio)).lt('data_vencimento', iso(fim))
        }

        const { data, error } = await consulta
          .order('data_vencimento', { ascending: true, nullsFirst: false })
          .order('id', { ascending: true })
          .range(inicioPagina, inicioPagina + pageSize - 1)

        if (error) throw error
        return data || []
      }

      // A primeira página e as atividades saem juntas: uma não depende da outra,
      // e esperar em fila dobrava o tempo de abertura da tela.
      // As duas primeiras páginas saem juntas, e não em fila.
      //
      // O mês tem passado de 1.400 tarefas, então a segunda página quase sempre
      // existe — esperar a primeira para só então pedi-la custava 424 ms toda
      // vez. Quando o mês é pequeno, a segunda volta vazia e não custa nada
      // além de uma requisição.
      const [pagina1, pagina2, { data: atividadesData, error: erroAtividades }] = await Promise.all([
        buscarPagina(0),
        buscarPagina(pageSize),
        comCache('atividades', () =>
          supabase
            .from('atividades')
            .select(`
              task_id, nome_atividade, planner_name, frequencia, prioridade_descricao, responsavel_id, classificacao, responsaveis_lista, projeto_id,
              setores!atividades_setor_id_fkey (nome), responsaveis!atividades_responsavel_id_fkey (nome, email)
            `),
        ),
      ])
      if (erroAtividades) throw erroAtividades

      const planas = [...pagina1, ...pagina2]
      for (let from = pageSize * 2; planas.length === from; from += pageSize) {
        planas.push(...(await buscarPagina(from)))
      }

      type AtividadeJoin = { task_id: string; planner_name: string | null }
      const atividades = (atividadesData || []) as AtividadeJoin[]

      const porTaskId = new Map<string, AtividadeJoin>()
      for (const atv of atividades) porTaskId.set(String(atv.task_id), atv)

      const acc = planas.map((linha) => ({
        ...linha,
        atividades: porTaskId.get(String(linha.atividade_id)) ?? null,
      }))

      // Os planners saem das atividades que já estão em mãos. A consulta que
      // existia para isso varria a tabela inteira e custava 800 ms sozinha.
      const plannersDaBase = Array.from(
        new Set(atividades.map((a) => a.planner_name)),
      ).filter(Boolean).sort() as string[]
      if (plannersDaBase.length > 0) setPlanners(plannersDaBase)

      /*
       * O mês existe no calendário, mas pode não existir no banco.
       *
       * As tarefas do mês nascem da sincronização da tela Início. Até ela
       * rodar, o mês novo vem quase vazio — e a tela mostrava isso como se as
       * tarefas tivessem sumido, sem dizer por quê. Todo dia 1º a mesma dúvida.
       *
       * `acc` já é a contagem do mês inteiro, antes de filtrar por pessoa, e a
       * do mês anterior sai de um count sem corpo. A consulta extra só acontece
       * quando o mês está pobre o bastante para levantar a suspeita.
       */
      if (!todoPeriodo && acc.length < 50) {
        const anterior = new Date(anoAlvo, mesAlvo - 1, 1)
        const { count } = await supabase
          .from('tarefas_diarias')
          .select('id', { count: 'exact', head: true })
          .gte('data_vencimento', iso(anterior))
          .lt('data_vencimento', iso(inicio))

        const anteriores = count ?? 0
        setMesNaoGerado(
          anteriores >= 50 && acc.length < anteriores * 0.25
            ? { mes: mesAlvo, ano: anoAlvo, anterior: anteriores }
            : null,
        )
      } else {
        setMesNaoGerado(null)
      }

      let baseData = acc

      // Dono de subtarefa enxerga a tarefa, mesmo não sendo dono dela: sem
      // isso a subtarefa seria atribuída a alguém que nunca a encontra.
      const meuEmail = userEmail.trim().toLowerCase()
      const donoDeSubtarefa = (r: { checklists?: unknown }) =>
        apenasSubtarefas(r?.checklists as never).some(
          (c) => (c.responsavelEmail || '').trim().toLowerCase() === meuEmail,
        )

      if (soDoProjeto(perfil)) {
        // Quem é só do projeto tem regra própria: nada de rotina da
        // controladoria, e o admin do projeto vê as atividades de todo mundo
        // em vez de só as dele. A regra mora em lib/acessoProjeto para o
        // dashboard somar exatamente o que esta lista mostra.
        baseData = baseData.filter(
          (r) =>
            podeVerAtividade(perfil, r?.atividades) ||
            (ehDoProjeto(r?.atividades) && donoDeSubtarefa(r)),
        )
      } else if (userRole !== 'admin') {
        baseData = baseData.filter((r: any) => {
          const resps = getResponsaveis(r?.atividades)
          return (
            resps.some(res => (res.email || '').trim().toLowerCase() === meuEmail) ||
            donoDeSubtarefa(r)
          )
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
  }, [plannerSel, mesAlvo, anoAlvo, userEmail, userRole, perfil, todoPeriodo, authLoaded])

  // Sempre que algo relevante mudar, recarrega workflow + rows
  useEffect(() => {
    if (!plannerSel || !authLoaded || !userEmail) return
    ;(async () => {
      await carregarWorkflow(plannerSel)
      await carregar()
    })()
  }, [plannerSel, mesAlvo, anoAlvo, todoPeriodo, authLoaded, userRole, userEmail, carregar, carregarWorkflow])

  return {
    rows, setRows,
    loading,
    refresh: carregar,
    planners, refreshPlanners: carregarPlanners,
    statuses, statusOrderMap,
    setoresDb, respsDb, classificacoesDb, projetosDb, donosDb,
    mesNaoGerado,
  }
}
