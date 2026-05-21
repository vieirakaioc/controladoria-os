'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Args = {
  enabled: boolean
  /** Quantos dias pra trás incluir. Default 30. */
  dias?: number
}

export type ColaboradorAtividade = {
  email: string
  /** 24 contagens, indexadas por hora do dia (0..23). */
  porHora: number[]
  /** Total de eventos no período. */
  total: number
}

type Result = {
  loading: boolean
  /** Matriz [dia_da_semana][hora] = contagem de eventos. dia: 0=seg, 1=ter, ..., 6=dom. */
  matrizEquipe: number[][]
  /** Maior valor da matriz (pra normalizar a intensidade da cor). */
  maxEquipe: number
  /** Lista por colaborador, ordenada por total desc. */
  porColaborador: ColaboradorAtividade[]
  /** Intervalo da consulta. */
  inicio: Date
  fim: Date
  totalEventos: number
}

/**
 * Agrega user_activity dos últimos N dias em:
 *  - Matriz 7×24 da equipe inteira (dia_da_semana × hora_do_dia)
 *  - Distribuição por hora pra cada colaborador
 *
 * Usado pelo Heatmap de Atividade no /equipe → tab Atividade.
 */
export function useHeatmapAtividade({ enabled, dias = 30 }: Args): Result {
  const [data, setData] = useState<Result>({
    loading: true,
    matrizEquipe: Array.from({ length: 7 }, () => Array(24).fill(0)),
    maxEquipe: 0,
    porColaborador: [],
    inicio: new Date(),
    fim: new Date(),
    totalEventos: 0,
  })

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    ;(async () => {
      const fim = new Date()
      const inicio = new Date()
      inicio.setDate(inicio.getDate() - dias)
      inicio.setHours(0, 0, 0, 0)

      setData(prev => ({ ...prev, loading: true }))
      try {
        const { data: events } = await supabase
          .from('user_activity')
          .select('user_email, created_at')
          .gte('created_at', inicio.toISOString())
          .lt('created_at', fim.toISOString())

        if (cancelled) return

        const matriz = Array.from({ length: 7 }, () => Array(24).fill(0))
        const porColab = new Map<string, number[]>()
        let total = 0

        for (const ev of (events || [])) {
          const email = (ev.user_email || '').toLowerCase()
          if (!email) continue
          const d = new Date(ev.created_at)
          // getDay: 0=dom, 1=seg, ..., 6=sáb → converto pra 0=seg, ..., 6=dom
          const dow = (d.getDay() + 6) % 7
          const hour = d.getHours()
          matriz[dow][hour]++
          total++

          if (!porColab.has(email)) porColab.set(email, Array(24).fill(0))
          porColab.get(email)![hour]++
        }

        let max = 0
        for (const row of matriz) for (const v of row) if (v > max) max = v

        const porColaborador: ColaboradorAtividade[] = Array.from(porColab.entries())
          .map(([email, porHora]) => ({
            email,
            porHora,
            total: porHora.reduce((s, v) => s + v, 0),
          }))
          .sort((a, b) => b.total - a.total)

        setData({
          loading: false,
          matrizEquipe: matriz,
          maxEquipe: max,
          porColaborador,
          inicio,
          fim,
          totalEventos: total,
        })
      } catch {
        if (!cancelled) setData(prev => ({ ...prev, loading: false }))
      }
    })()
    return () => { cancelled = true }
  }, [enabled, dias])

  return data
}
