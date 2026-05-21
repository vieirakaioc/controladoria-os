'use client'

import { useEffect, useMemo, useState } from 'react'
import { getResponsaveis } from '@/lib/responsaveis'
import { getBucket } from '../_lib/helpers'
import type { Row, TimeBucket } from '../_lib/types'

type Args = {
  rows: Row[]
  statuses: string[]
  mesAlvo: number
  anoAlvo: number
}

/**
 * Estado dos filtros + derivações (filtradas, dashboard, board por status,
 * timeboard por data, calendarData). Tudo memoizado.
 */
export function useTarefaFilters({ rows, statuses, mesAlvo, anoAlvo }: Args) {
  const [filtroTexto, setFiltroTexto] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<string>('Todos')
  const [filtroSetor, setFiltroSetor] = useState<string>('Todos')
  const [filtroResp, setFiltroResp] = useState<string>('Todos')
  const [filtroClassificacao, setFiltroClassificacao] = useState<string>('Todos')
  const [filtroProjeto, setFiltroProjeto] = useState<string>('Todos')

  // Se o status filtrado deixar de existir após trocar workflow, reseta.
  useEffect(() => {
    if (filtroStatus !== 'Todos' && !statuses.includes(filtroStatus)) {
      setFiltroStatus('Todos')
    }
  }, [statuses, filtroStatus])

  const setorOptions = useMemo(
    () => Array.from(new Set(rows.map(r => r.atividades?.setores?.nome).filter(Boolean))).sort() as string[],
    [rows],
  )

  const respOptions = useMemo(() => {
    const all = new Set<string>()
    rows.forEach(r => getResponsaveis(r.atividades).forEach(res => { if (res.nome) all.add(res.nome) }))
    return Array.from(all).sort()
  }, [rows])

  const classifOptions = useMemo(
    () => Array.from(new Set(rows.map(r => r.atividades?.classificacao).filter(Boolean))).sort() as string[],
    [rows],
  )

  const filtradas = useMemo(() => {
    const q = filtroTexto.trim().toLowerCase()
    return rows.filter(r => {
      const atv = r.atividades || {}
      const nome = (atv.nome_atividade || '').toLowerCase()
      const st = r.status || statuses[0] || 'Pendente'
      const resps = getResponsaveis(atv)
      const matchesResp = resps.some(res => res.nome?.toLowerCase().includes(q))
      const okTexto = !q || nome.includes(q) || (atv.setores?.nome || '').toLowerCase().includes(q) || matchesResp
      const okStatus = filtroStatus === 'Todos' || st === filtroStatus
      const okSetor = filtroSetor === 'Todos' || atv.setores?.nome === filtroSetor
      const okResp = filtroResp === 'Todos' || resps.some(res => res.nome === filtroResp)
      const okClass = filtroClassificacao === 'Todos' || atv.classificacao === filtroClassificacao
      const okProj = filtroProjeto === 'Todos' || atv.projeto_id === filtroProjeto
      return okTexto && okStatus && okSetor && okResp && okClass && okProj
    })
  }, [rows, filtroTexto, filtroStatus, filtroSetor, filtroResp, filtroClassificacao, filtroProjeto, statuses])

  const dashboard = useMemo(() => {
    const done = filtradas.filter(r => (r.status || '').toLowerCase().includes('concl')).length
    const pendentes = filtradas.filter(r => !(r.status || '').toLowerCase().includes('concl'))
    return {
      total: filtradas.length,
      done,
      overdue: pendentes.filter(r => getBucket(r.data_vencimento) === 'Atrasadas').length,
      dueToday: pendentes.filter(r => getBucket(r.data_vencimento) === 'Hoje').length,
      dueTomorrow: pendentes.filter(r => getBucket(r.data_vencimento) === 'Amanhã').length,
      next7: pendentes.filter(r => getBucket(r.data_vencimento) === 'Próx 7 dias').length,
      pct: filtradas.length ? Math.round((done / filtradas.length) * 100) : 0,
    }
  }, [filtradas])

  const boardStatus = useMemo(() => {
    const b: Record<string, Row[]> = {}
    statuses.forEach(s => (b[s] = []))
    filtradas.forEach(r => {
      const st = r.status || statuses[0] || 'Pendente'
      if (b[st]) b[st].push(r)
    })
    return b
  }, [filtradas, statuses])

  const timeOrder: TimeBucket[] = useMemo(
    () => ['Atrasadas', 'Hoje', 'Amanhã', 'Próx 7 dias', 'Sem data'],
    [],
  )

  const timeboard = useMemo(() => {
    const b: Record<string, Row[]> = { 'Atrasadas': [], 'Hoje': [], 'Amanhã': [], 'Próx 7 dias': [], 'Sem data': [] }
    filtradas.forEach(r => {
      if ((r.status || '').toLowerCase().includes('concl')) return
      const bb = getBucket(r.data_vencimento)
      if (b[bb]) b[bb].push(r)
    })
    return b
  }, [filtradas])

  const calendarData = useMemo(() => {
    const dataAlvo = new Date(anoAlvo, mesAlvo, 1)
    const diasNoMes = new Date(anoAlvo, mesAlvo + 1, 0).getDate()
    const primeiroDiaSemana = dataAlvo.getDay()
    const diasVaziosInicio = Array.from({ length: primeiroDiaSemana }).map((_, i) => `empty-start-${i}`)
    const diasDoMes = Array.from({ length: diasNoMes }).map((_, i) => {
      const dia = i + 1
      const dataString = `${anoAlvo}-${String(mesAlvo + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
      const tarefasDoDia = filtradas.filter(t => t.data_vencimento?.startsWith(dataString))
      return { dia, dataString, tarefas: tarefasDoDia, isHoje: dataString === new Date().toISOString().slice(0, 10) }
    })
    const ultimoDiaSemana = new Date(anoAlvo, mesAlvo + 1, 0).getDay()
    const paddingFim = 6 - ultimoDiaSemana
    const diasVaziosFim = Array.from({ length: paddingFim }).map((_, i) => `empty-end-${i}`)
    return { diasVaziosInicio, diasDoMes, diasVaziosFim }
  }, [anoAlvo, mesAlvo, filtradas])

  const reset = () => {
    setFiltroTexto('')
    setFiltroSetor('Todos')
    setFiltroResp('Todos')
    setFiltroStatus('Todos')
    setFiltroClassificacao('Todos')
    setFiltroProjeto('Todos')
  }

  return {
    filtroTexto, filtroStatus, filtroSetor, filtroResp, filtroClassificacao, filtroProjeto,
    setFiltroTexto, setFiltroStatus, setFiltroSetor, setFiltroResp, setFiltroClassificacao, setFiltroProjeto,
    setorOptions, respOptions, classifOptions,
    filtradas, dashboard, boardStatus, timeOrder, timeboard, calendarData,
    reset,
  }
}
