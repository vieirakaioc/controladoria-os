'use client'

import { formatarData } from './prazo'
import { estaFinalizada, type TarefaFiscal } from './types'

/**
 * E-mails da Validação Fiscal.
 *
 * Usa o mesmo /api/notify (Zoho) do resto do app. Nada aqui bloqueia o fluxo:
 * se o SMTP falhar, a importação e a matriz seguem funcionando — o aviso é um
 * complemento, não o registro. O registro é o banco.
 */

type Envio = {
  to: string
  subject: string
  taskName: string
  action: string
  userName: string
  observacoes: string
}

async function enviar(corpo: Envio): Promise<void> {
  try {
    await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...corpo,
        link: `${window.location.origin}/validacao-fiscal/matriz`,
        linkLabel: 'Abrir a matriz de correções',
      }),
    })
  } catch {
    // silencioso — mesmo critério do resto do app
  }
}

/** Avisa o responsável padrão de que uma planilha gerou tarefas novas. */
export async function avisarNovasTarefas(params: {
  destino: string
  quem: string
  arquivos: { arquivo: string; novas: number; duplicadas: number }[]
  prazo: string
}): Promise<void> {
  const novas = params.arquivos.reduce((soma, a) => soma + a.novas, 0)
  if (novas === 0) return

  const linhas = params.arquivos
    .map(
      (a) =>
        `<li><strong>${a.arquivo}</strong> — ${a.novas} nova(s)` +
        (a.duplicadas > 0 ? `, ${a.duplicadas} já existia(m)` : '') +
        '</li>',
    )
    .join('')

  await enviar({
    to: params.destino,
    subject: `[Validação Fiscal] ${novas} nova(s) correção(ões) — prazo ${formatarData(params.prazo)}`,
    taskName: 'Validação Fiscal',
    action: 'importada com novas correções para responder',
    userName: params.quem,
    observacoes:
      `Foram geradas <strong>${novas}</strong> tarefa(s) de correção fiscal, com prazo de resposta até ` +
      `<strong>${formatarData(params.prazo)}</strong>.<br/><br/><ul>${linhas}</ul>`,
  })
}

/**
 * Resumo diário de vencimento para a pessoa logada.
 *
 * Mesmo desenho do lembrete que já existe em /tarefas: roda no navegador de
 * quem abre o app, uma vez por dia, com trava em localStorage. Evita depender
 * de cron server-side.
 */
export async function avisarVencimentos(params: {
  tarefas: TarefaFiscal[]
  responsavelId: string | null
  email: string
  nome: string
  hoje: string
}): Promise<void> {
  if (!params.email || !params.responsavelId) return

  const trava = `vf_lembrete_${params.email}_${params.hoje}`
  if (typeof localStorage === 'undefined' || localStorage.getItem(trava)) return

  const minhas = params.tarefas.filter(
    (t) =>
      !estaFinalizada(t.status) && t.responsavelId === params.responsavelId && t.prazo <= params.hoje,
  )
  if (minhas.length === 0) return

  // Trava antes de enviar: se o envio falhar, é melhor perder um aviso do que
  // disparar em toda recarga da página.
  localStorage.setItem(trava, '1')

  const atrasadas = minhas.filter((t) => t.prazo < params.hoje).length
  const linhas = minhas
    .slice(0, 30)
    .map(
      (t) =>
        `<li><strong>${t.documento}</strong> — ${t.tipoDivergencia || 'correção'} ` +
        `(prazo ${formatarData(t.prazo)})</li>`,
    )
    .join('')

  await enviar({
    to: params.email,
    subject:
      atrasadas > 0
        ? `[Validação Fiscal] ${atrasadas} correção(ões) em atraso`
        : `[Validação Fiscal] ${minhas.length} correção(ões) vencem hoje`,
    taskName: 'Resumo da Validação Fiscal',
    action: 'estão no seu nome e precisam de resposta',
    userName: params.nome,
    observacoes:
      `Olá ${params.nome}, estas correções fiscais estão com você:<br/><br/><ul>${linhas}</ul>` +
      (minhas.length > 30 ? `<p>… e mais ${minhas.length - 30}.</p>` : ''),
  })
}
