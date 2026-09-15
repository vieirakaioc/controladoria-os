'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, Download, Eye, Loader2, Mail } from 'lucide-react'

import { CORES } from '@/app/validacao-fiscal/_lib/cores'
import { formatarInteiro } from '@/app/validacao-fiscal/_lib/formato'
import { formatarData } from '@/app/validacao-fiscal/_lib/prazo'

import { equipeDoProcesso } from '../_lib/avisos'
import { montarRelatorio } from '../_lib/relatorio'
import { calcularResumo } from '../_lib/resumo'
import type { Item } from '../_lib/types'
import { Painel } from './Ui'

const CAMPO =
  'w-full rounded-md border border-line-strong bg-white px-3 py-2 text-sm text-ink-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-[#0f88a8]/20'

type Estado =
  | { fase: 'inicial' }
  | { fase: 'enviando' }
  | { fase: 'enviado'; destinos: string }
  | { fase: 'erro'; mensagem: string }

/**
 * Exporta o painel do imobilizado como relatório visual.
 *
 * O relatório é o mesmo nos três caminhos — e-mail, prévia e arquivo — e é
 * também o que sai no resumo automático da manhã: o que chega na caixa de
 * entrada é exatamente o que foi conferido na tela.
 *
 * O arquivo baixado é HTML, e não PDF: abre no navegador, cola inteiro no
 * WhatsApp do grupo como imagem quando se tira print, e não depende de
 * biblioteca nova para gerar.
 */
export function ExportarPainel({ itens, hoje }: { itens: Item[]; hoje: string }) {
  // Padrão = quem está cadastrado no processo, a mesma lista do envio
  // automático. Mandar à mão fora de hora não deveria exigir redigitar
  // endereço nenhum — e continua editável para um envio pontual.
  const [destinatarios, setDestinatarios] = useState('')
  const [estado, setEstado] = useState<Estado>({ fase: 'inicial' })

  useEffect(() => {
    let vivo = true
    equipeDoProcesso()
      .then((lista) => {
        if (vivo) setDestinatarios(lista.join(', '))
      })
      .catch(() => {
        // Sem a lista o campo fica vazio e a pessoa digita. Um erro na tela
        // por causa do preenchimento automático seria pior do que o vazio.
      })
    return () => {
      vivo = false
    }
  }, [])

  const resumo = calcularResumo(itens, hoje)

  const gerar = () =>
    montarRelatorio({
      resumo,
      hoje,
      link: typeof window === 'undefined' ? '' : `${window.location.origin}/imobilizado/matriz`,
    })

  const assunto =
    `[Imobilizado] ${formatarData(hoje)} — ` +
    `${resumo.emAndamento} em andamento, ${resumo.atrasados} atrasado(s)`

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
    ancora.download = `imobilizado-${hoje}.html`
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
        body: JSON.stringify({ to: lista.join(', '), subject: assunto, html: gerar() }),
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
      titulo="Enviar o painel do imobilizado"
      descricao={`Resumo visual com os indicadores, o que precisa de ação hoje, onde o processo está represado e a carga por responsável — ${formatarInteiro(itens.length)} itens. Vai sozinho toda manhã para quem está cadastrado no processo; aqui é para enviar fora de hora ou para alguém de fora.`}
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[280px] flex-1">
          <label
            htmlFor="destinatarios-imob"
            className="text-xs font-semibold uppercase tracking-wider text-ink-400"
          >
            Para
          </label>
          <input
            id="destinatarios-imob"
            value={destinatarios}
            onChange={(e) => {
              setDestinatarios(e.target.value)
              setEstado({ fase: 'inicial' })
            }}
            placeholder="nome@comber.com.br, outro@comber.com.br"
            className={`mt-2 ${CAMPO}`}
          />
          <p className="mt-1.5 text-xs text-ink-400">
            Já vem com quem está cadastrado no processo. Separe por vírgula para enviar a mais
            gente.
          </p>
        </div>

        <button
          type="button"
          onClick={enviar}
          disabled={estado.fase === 'enviando'}
          className="inline-flex items-center gap-2 rounded-md bg-teal-600 px-5 py-2.5 text-sm font-bold text-white transition-all hover:brightness-110 disabled:opacity-40"
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
          className="inline-flex items-center gap-2 rounded-md border border-line-strong px-4 py-2.5 text-sm font-semibold text-ink-700 transition-colors hover:border-teal-500 hover:text-teal-600"
        >
          <Eye size={16} />
          Ver antes
        </button>

        <button
          type="button"
          onClick={baixar}
          className="inline-flex items-center gap-2 rounded-md border border-line-strong px-4 py-2.5 text-sm font-semibold text-ink-700 transition-colors hover:border-teal-500 hover:text-teal-600"
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
        <p
          role="alert"
          className="mt-4 flex items-start gap-2 text-sm"
          style={{ color: CORES.critico }}
        >
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          {estado.mensagem}
        </p>
      )}
    </Painel>
  )
}
