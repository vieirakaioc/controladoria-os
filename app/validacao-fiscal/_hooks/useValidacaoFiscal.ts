'use client'

import { useCallback, useEffect, useState } from 'react'

import { descreverErro, listarResponsaveis, listarTarefas } from '../_lib/api'
import { avisarVencimentos } from '../_lib/avisos'
import { hoje as dataDeHoje } from '../_lib/prazo'
import type { Responsavel, TarefaFiscal } from '../_lib/types'

/**
 * Carrega tarefas e responsáveis. A matriz e o dashboard consomem o mesmo
 * estado, então os dois nunca mostram números diferentes da mesma realidade.
 *
 * Recebendo o e-mail de quem está logado, dispara também o resumo diário de
 * vencimentos — mesmo desenho do lembrete de /tarefas.
 */
export function useValidacaoFiscal(usuario?: { email: string; nome: string }) {
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

  const email = usuario?.email ?? ''
  const nome = usuario?.nome ?? ''

  useEffect(() => {
    if (carregando || !email || tarefas.length === 0) return

    // O vínculo entre o login e a tarefa é o cadastro de responsáveis: a tarefa
    // guarda o id de lá, não o e-mail de quem entrou.
    const eu = responsaveis.find((r) => (r.email ?? '').toLowerCase() === email.toLowerCase())
    if (!eu) return

    avisarVencimentos({
      tarefas,
      responsavelId: eu.id,
      email,
      nome: nome || eu.nome,
      hoje: dataDeHoje(),
    })
  }, [carregando, tarefas, responsaveis, email, nome])

  /** Substitui uma tarefa no estado após a resposta ser gravada. */
  const aplicarTarefa = useCallback((atualizada: TarefaFiscal) => {
    setTarefas((atuais) => atuais.map((t) => (t.id === atualizada.id ? atualizada : t)))
  }, [])

  return { tarefas, responsaveis, carregando, erro, recarregar: carregar, aplicarTarefa }
}
