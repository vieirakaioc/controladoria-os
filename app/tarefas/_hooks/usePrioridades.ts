'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

import type { Quadrante } from '../_lib/types'

/**
 * A prioridade que a pessoa logada deu a cada atividade.
 *
 * A chave é `atividades.task_id`, e não a tarefa do dia: classificar a
 * ocorrência obrigaria a reclassificar tudo todo mês, e no mês seguinte a
 * matriz amanheceria vazia.
 *
 * A gravação é otimista — o cartão muda de quadrante na hora e a escrita vai
 * atrás. Arrastar é um gesto contínuo; esperar o banco a cada solta
 * transformaria a organização da matriz numa sequência de esperas.
 */
export function usePrioridades(userId: string) {
  const [mapa, setMapa] = useState<Record<string, Quadrante>>({})
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    if (!userId) return
    let cancelado = false

    ;(async () => {
      const { data } = await supabase
        .from('prioridades_eisenhower')
        .select('task_id, quadrante')
        .eq('user_id', userId)

      if (cancelado) return
      const novo: Record<string, Quadrante> = {}
      for (const linha of data ?? []) novo[String(linha.task_id)] = linha.quadrante as Quadrante
      setMapa(novo)
      setCarregando(false)
    })()

    return () => {
      cancelado = true
    }
  }, [userId])

  const definir = useCallback(
    async (taskId: string, quadrante: Quadrante | null) => {
      if (!userId || !taskId) return

      const anterior = mapa[taskId]
      setMapa((atual) => {
        const novo = { ...atual }
        if (quadrante) novo[taskId] = quadrante
        else delete novo[taskId]
        return novo
      })

      const { error } = quadrante
        ? await supabase
            .from('prioridades_eisenhower')
            .upsert({ user_id: userId, task_id: taskId, quadrante }, { onConflict: 'user_id,task_id' })
        : await supabase
            .from('prioridades_eisenhower')
            .delete()
            .eq('user_id', userId)
            .eq('task_id', taskId)

      // Falhou: devolve o cartão para onde estava. Deixá-lo no quadrante novo
      // faria a tela mentir até o próximo recarregamento.
      if (error) {
        setMapa((atual) => {
          const novo = { ...atual }
          if (anterior) novo[taskId] = anterior
          else delete novo[taskId]
          return novo
        })
      }
    },
    [userId, mapa],
  )

  return { mapa, carregando, definir }
}
