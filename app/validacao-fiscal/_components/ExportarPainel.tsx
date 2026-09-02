'use client'

import { useState } from 'react'
import { AlertCircle, CheckCircle2, Download, Eye, Loader2, Mail } from 'lucide-react'

import { EMAILS_RESUMO } from '../_lib/acesso'
import { CORES } from '../_lib/cores'
import { formatarInteiro } from '../_lib/formato'
import { formatarData } from '../_lib/prazo'
import { montarRelatorio } from '../_lib/relatorio'
import { calcularResumo, type Resumo } from '../_lib/resumo'
import { ROTULO_FLUXO, type Fluxo, type TarefaFiscal } from '../_lib/types'
import { Painel } from './Ui'

const CAMPO =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#0f88a8] focus:ring-2 focus:ring-[#0f88a8]/20'

type Estado =
  | { fase: 'inicial' }
  | { fase: 'enviando' }
  | { fase: 'enviado'; destinos: string }
  | { fase: 'erro'; mensagem: string }

/**
 * Exporta o painel como relatório visual.
 *
 * O relatório é o mesmo nos dois caminhos — e-mail e arquivo — para o que
 * chega na caixa de entrada ser exatamente o que foi conferido na tela.
 */
export function ExportarPainel({
  fluxo,
  tarefas,
  hoje,
}: {
  fluxo: Fluxo
  tarefas: TarefaFiscal[]
  hoje: string
}) {
  // Mesma lista do envio automático: mandar à mão fora de hora não deveria
  // exigir redigitar os endereços.
  const [destinatarios, setDestinatarios] = useState(EMAILS_RESUMO[fluxo].join(', '))
  const [estado, setEstado] = useState<Estado>({ fase: 'inicial' })

  // Só as tarefas deste fluxo, e o resumo recalculado sobre elas: um número no
  // e-mail de entrada que somasse saída seria pior do que não ter e-mail.
  const doFluxo = tarefas.filter((t) => t.fluxo === fluxo)
  const resumo: Resumo = calcularResumo(doFluxo, hoje)

  const gerar = () =>
    montarRelatorio({
      resumo,
      tarefas: doFluxo,
      hoje,
      escopo: ROTULO_FLUXO[fluxo],
      link:
        typeof window === 'undefined'
          ? ''
          : `${window.location.origin}/validacao-fiscal/matriz`,
    })

  const abrirPrevia = () => {
    const janela = window.open('', '_blank')
    if (!janela) {
      setEstado({
        fase: 'erro',
        mensagem: 'O navegador bloqueou a janela da prévia. Libere o pop-up para este site.',
      })
      return
    }
    janela.document.write(gerar())
    janela.document.close()
  }

  const baixar = () => {
    const blob = new Blob([gerar()], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const ancora = document.createElement('a')
    ancora.href = url
    ancora.download = `validacao-fiscal-${fluxo}-${hoje}.html`
    ancora.click()
    URL.revokeObjectURL(url)
  }

  const enviar = async () => {
    const lista = destinatarios
      .split(/[;,\s]+/)
      .map((e) => e.trim())
      .filter(Boolean)

    if (lista.length === 0) {
      setEstado({ fase: 'erro', mensagem: 'Informe ao menos um e-mail.' })
      return
    }

    const invalido = lista.find((e) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e))
    if (invalido) {
      setEstado({ fase: 'erro', mensagem: `"${invalido}" não parece um e-mail válido.` })
      return
    }

    setEstado({ fase: 'enviando' })

    try {
      const resposta = await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: lista.join(', '),
          subject:
            `[Validação Fiscal] ${ROTULO_FLUXO[fluxo]} · ${formatarData(hoje)} — ` +
            `${resumo.emAberto} em aberto, ${resumo.atrasadas} atrasada(s)`,
          html: gerar(),
        }),
      })

      // A rota responde 200 com { success: false } quando o SMTP recusa; sem
      // olhar o corpo, um envio falho apareceria como sucesso.
      const corpo = await resposta.json().catch(() => null)
      if (!resposta.ok || corpo?.success === false) {
        throw new Error(corpo?.error || 'O servidor de e-mail recusou o envio.')
      }

      setEstado({ fase: 'enviado', destinos: lista.join(', ') })
    } catch (falha) {
      setEstado({
        fase: 'erro',
        mensagem: falha instanceof Error ? falha.message : 'Falha ao enviar o e-mail.',
      })
    }
  }

  return (
    <Painel
      titulo={`Enviar painel de ${ROTULO_FLUXO[fluxo].toLowerCase()}`}
      descricao={`Resumo visual com os indicadores, a fila do que está atrasado e a carga por responsável — só de ${ROTULO_FLUXO[fluxo].toLowerCase()} (${formatarInteiro(doFluxo.length)} tarefas).`}
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[280px] flex-1">
          <label htmlFor="destinatarios" className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Para
          </label>
          <input
            id="destinatarios"
            value={destinatarios}
            onChange={(e) => {
              setDestinatarios(e.target.value)
              setEstado({ fase: 'inicial' })
            }}
            placeholder="nome@comber.com.br, outro@comber.com.br"
            className={`mt-2 ${CAMPO}`}
          />
          <p className="mt-1.5 text-xs text-slate-400">
            Separe por vírgula para enviar a mais de uma pessoa.
          </p>
        </div>

        <button
          type="button"
          onClick={enviar}
          disabled={estado.fase === 'enviando'}
          className="inline-flex items-center gap-2 rounded-md bg-[#0f88a8] px-5 py-2.5 text-sm font-bold text-white transition-all hover:brightness-110 disabled:opacity-40"
        >
          {estado.fase === 'enviando' ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Mail size={16} />
          )}
          Enviar
        </button>

        <button
          type="button"
          onClick={abrirPrevia}
          className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:border-[#0f88a8] hover:text-[#0f88a8]"
        >
          <Eye size={16} />
          Ver antes
        </button>

        <button
          type="button"
          onClick={baixar}
          className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:border-[#0f88a8] hover:text-[#0f88a8]"
        >
          <Download size={16} />
          Baixar
        </button>
      </div>

      {estado.fase === 'enviado' && (
        <p className="mt-4 flex items-start gap-2 text-sm" style={{ color: CORES.bom }}>
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          Painel enviado para {estado.destinos}.
        </p>
      )}

      {estado.fase === 'erro' && (
        <p role="alert" className="mt-4 flex items-start gap-2 text-sm" style={{ color: CORES.critico }}>
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          {estado.mensagem}
        </p>
      )}
    </Painel>
  )
}
