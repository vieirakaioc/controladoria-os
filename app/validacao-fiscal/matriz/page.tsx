'use client'

import { useAuthGate } from '@/app/tarefas/_hooks/useAuthGate'

import { Matriz } from '../_components/Matriz'
import { AvisoErro, Carregando } from '../_components/Ui'
import { useValidacaoFiscal } from '../_hooks/useValidacaoFiscal'
import { hoje } from '../_lib/prazo'

export default function PaginaMatriz() {
  const { userName, userEmail, authLoaded } = useAuthGate()
  const { tarefas, responsaveis, carregando, erro, aplicarTarefa } = useValidacaoFiscal({
    email: userEmail,
    nome: userName,
  })

  if (erro) return <AvisoErro mensagem={erro} />
  if (carregando || !authLoaded) return <Carregando linhas={4} />

  return (
    <Matriz
      tarefas={tarefas}
      responsaveis={responsaveis}
      hoje={hoje()}
      usuario={userName}
      aoAtualizar={aplicarTarefa}
    />
  )
}
