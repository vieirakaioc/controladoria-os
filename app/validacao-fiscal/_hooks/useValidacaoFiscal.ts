'use client'

import { useCallback, useEffect, useState } from 'react'

import { descreverErro, listarResponsaveis, listarTarefas } from '../_lib/api'
import type { Responsavel, TarefaFiscal } from '../_lib/types'

/**
 * Carrega tarefas e responsáveis. A matriz e o dashboard consomem o mesmo
 * estado, então os dois nunca mostram números diferentes da mesma realidade.
 */
export function useValidacaoFiscal() {
  const [tarefas, setTarefas] = useState<TarefaFiscal[]>([])
  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro(null)
    try {
      const [listaTarefas, listaResponsaveis] = await Promise.all([
        listarTarefas(),
        listarResponsaveis(),
      ])
      setTarefas(listaTarefas)
      setResponsaveis(listaResponsaveis)
    } catch (falha) {
      setErro(descreverErro(falha))
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  /** Substitui uma tarefa no estado após a resposta ser gravada. */
  const aplicarTarefa = useCallback((atualizada: TarefaFiscal) => {
    setTarefas((atuais) => atuais.map((t) => (t.id === atualizada.id ? atualizada : t)))
  }, [])

  return { tarefas, responsaveis, carregando, erro, recarregar: carregar, aplicarTarefa }
}
