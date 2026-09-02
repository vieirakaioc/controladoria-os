'use client'

import { useCallback, useEffect, useState } from 'react'

import { listarResponsaveis } from '@/app/validacao-fiscal/_lib/api'
import type { Responsavel } from '@/app/validacao-fiscal/_lib/types'

import { descreverErro, listarItens, meuAcesso } from '../_lib/api'
import type { Acesso, Item } from '../_lib/types'

/**
 * Estado do módulo: os itens, quem sou eu aqui dentro e a lista de pessoas.
 *
 * O acesso vem do banco (`imob_meu_tipo`), não de uma lista no código: quem
 * decide é a mesma função que a RLS usa, então tela e banco nunca discordam.
 */
export function useImobilizado() {
  const [itens, setItens] = useState<Item[]>([])
  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([])
  const [acesso, setAcesso] = useState<Acesso>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  /**
   * `silencioso` recarrega sem acender o esqueleto de carregamento. Serve para
   * quando a tela já mostrou o resultado da ação (a linha excluída sumiu) e só
   * falta acertar o resto — piscar a página inteira aí faria parecer que algo
   * deu errado.
   */
  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setCarregando(true)
    setErro(null)
    try {
      const tipo = await meuAcesso()
      setAcesso(tipo)

      if (!tipo) {
        setItens([])
        return
      }

      const [lista, pessoas] = await Promise.all([listarItens(), listarResponsaveis()])
      setItens(lista)
      setResponsaveis(pessoas)
    } catch (falha) {
      setErro(descreverErro(falha))
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  const aplicarItem = useCallback((atualizado: Item) => {
    setItens((atuais) => atuais.map((i) => (i.id === atualizado.id ? atualizado : i)))
  }, [])

  const removerItem = useCallback((id: string) => {
    setItens((atuais) => atuais.filter((i) => i.id !== id))
  }, [])

  return {
    itens,
    responsaveis,
    acesso,
    carregando,
    erro,
    recarregar: carregar,
    aplicarItem,
    removerItem,
  }
}
