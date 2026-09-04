'use client'

import { supabase } from '@/lib/supabase'

import { formatarData } from '@/app/validacao-fiscal/_lib/prazo'

import type { Etapa, Item } from './types'

/**
 * E-mails do fluxo de imobilizado.
 *
 * Usa o mesmo /api/notify (Zoho) do resto do portal. Nada aqui derruba a ação
 * principal: se o SMTP falhar, o item é criado e a etapa é concluída do mesmo
 * jeito — o aviso é complemento, o registro é o banco.
 *
 * Dois momentos, com alcances diferentes de propósito:
 *
 *   • tarefa nova  → todo mundo do processo, porque ninguém sabe que ela
 *                    existe até alguém contar;
 *   • etapa aberta → quem responde por ela, porque avisar o time inteiro a
 *                    cada passo transforma o e-mail em ruído e as pessoas
 *                    param de ler justamente o que era para lerem.
 */

type Envio = {
  to: string
  subject: string
  taskName: string
  action: string
  userName: string
  observacoes: string
}

async function enviar(corpo: Envio, item: Item): Promise<void> {
  try {
    await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...corpo,
        link: `${window.location.origin}/imobilizado/${item.id}`,
        linkLabel: 'Abrir o item',
      }),
    })
  } catch {
    // silencioso — ver comentário no topo
  }
}

/** E-mails de quem participa do processo e está ativo. */
async function equipeDoProcesso(): Promise<string[]> {
  const { data, error } = await supabase
    .from('imobilizado_participantes')
    .select('ativo, profiles (email)')
    .eq('ativo', true)

  if (error || !data) return []

  return data
    .map((linha) => (linha.profiles as unknown as { email?: string } | null)?.email ?? '')
    .filter((email) => email.includes('@'))
}

async function emailDoResponsavel(responsavelId: string | null): Promise<string | null> {
  if (!responsavelId) return null

  const { data } = await supabase
    .from('responsaveis')
    .select('email')
    .eq('id', responsavelId)
    .maybeSingle()

  const email = data?.email ?? ''
  return email.includes('@') ? email : null
}

function identificacao(item: Item): string {
  return `${item.descricao || item.fornecedor || `Nota ${item.nfNumero}`} (nº ${item.numero})`
}

/**
 * Avisa quem aprova que há uma ordem esperando por ele.
 *
 * É o único e-mail do módulo que sai para fora da equipe do processo, e por
 * isso o endereço vem do cadastro da etapa: quem aprova muda, e trocar isso
 * não pode exigir deploy. Sem endereço cadastrado, o aviso vai para a equipe —
 * alguém lá dentro sabe a quem cobrar, e o silêncio seria pior.
 */
export async function avisarAprovacaoPendente(
  item: Item,
  etapa: Etapa,
  aprovador: string | null,
  quem: string,
): Promise<void> {
  const destino =
    aprovador && aprovador.includes('@') ? aprovador : (await equipeDoProcesso()).join(', ')
  if (!destino) return

  await enviar(
    {
      to: destino,
      subject: `[Imobilizado] Aprovação pendente · item nº ${item.numero}`,
      taskName: identificacao(item),
      action: 'aguardando a sua aprovação',
      userName: quem,
      observacoes:
        `A etapa <strong>${etapa.titulo}</strong> do item ` +
        `<strong>${identificacao(item)}</strong> foi concluída e enviada para aprovação` +
        (item.ocNumero ? ` (OC <strong>${item.ocNumero}</strong>)` : '') +
        '.<br/><br/>O processo está parado esperando esta aprovação: o prazo das ' +
        'etapas seguintes fica suspenso até ela sair, e volta a correr de onde parou.',
    },
    item,
  )
}

/** Avisa quem está com as etapas paradas que a aprovação saiu. */
export async function avisarAprovacaoLiberada(
  item: Item,
  abertas: Etapa[],
  quem: string,
): Promise<void> {
  const destinos = new Set<string>()

  for (const etapa of abertas) {
    const email = await emailDoResponsavel(etapa.responsavelId)
    if (email) destinos.add(email)
  }

  const destino =
    destinos.size > 0 ? [...destinos].join(', ') : (await equipeDoProcesso()).join(', ')
  if (!destino) return

  const linhas = abertas
    .map((e) => `<li><strong>${e.titulo}</strong>${e.prazo ? `, até ${formatarData(e.prazo)}` : ''}</li>`)
    .join('')

  await enviar(
    {
      to: destino,
      subject: `[Imobilizado] Aprovação liberada · item nº ${item.numero}`,
      taskName: identificacao(item),
      action: 'liberado para seguir',
      userName: quem,
      observacoes:
        `A aprovação do item <strong>${identificacao(item)}</strong> saiu e o processo ` +
        'voltou a correr. Os dias de espera foram devolvidos ao prazo.' +
        (linhas ? `<br/><br/>Em aberto agora:<ul>${linhas}</ul>` : ''),
    },
    item,
  )
}

/** Avisa a equipe inteira de que entrou item novo no fluxo. */
export async function avisarItemNovo(item: Item, quem: string): Promise<void> {
  const equipe = await equipeDoProcesso()
  if (equipe.length === 0) return

  const abertas = item.etapas.filter((e) => e.status === 'aberta').sort((a, b) => a.ordem - b.ordem)

  const linhas = abertas
    .map(
      (e) =>
        `<li><strong>${e.titulo}</strong> — ${e.area || 'sem área'}` +
        (e.responsavelNome ? `, com ${e.responsavelNome}` : '') +
        (e.prazo ? `, até ${formatarData(e.prazo)}` : '') +
        (e.paralela ? ' <em>(corre em paralelo)</em>' : '') +
        '</li>',
    )
    .join('')

  await enviar(
    {
      to: equipe.join(', '),
      subject: `[Imobilizado] Item novo nº ${item.numero}${item.ehFrota ? ' · frota' : ''}`,
      taskName: identificacao(item),
      action: 'cadastrado no fluxo de imobilizado',
      userName: quem,
      observacoes:
        `Entrou no fluxo: <strong>${identificacao(item)}</strong>` +
        (item.filial ? `, ${item.filial}` : '') +
        `.<br/><br/>Já está em aberto:<ul>${linhas}</ul>`,
    },
    item,
  )
}

/**
 * Avisa quem responde pela etapa que acabou de abrir.
 *
 * Sem responsável definido, o aviso vai para a equipe: uma etapa aberta que
 * ninguém sabe que abriu é uma etapa que ninguém começa.
 */
export async function avisarEtapaAberta(item: Item, etapa: Etapa, quem: string): Promise<void> {
  const doResponsavel = await emailDoResponsavel(etapa.responsavelId)
  const destino = doResponsavel ?? (await equipeDoProcesso()).join(', ')
  if (!destino) return

  await enviar(
    {
      to: destino,
      subject: `[Imobilizado] ${etapa.titulo} · item nº ${item.numero}`,
      taskName: identificacao(item),
      action: `liberado para a etapa "${etapa.titulo}"`,
      userName: quem,
      observacoes:
        `A etapa <strong>${etapa.titulo}</strong> do item ` +
        `<strong>${identificacao(item)}</strong> está em aberto` +
        (etapa.prazo ? `, com prazo até <strong>${formatarData(etapa.prazo)}</strong>` : '') +
        `.<br/><br/>Área responsável: ${etapa.area || '—'}` +
        (doResponsavel ? '' : '<br/><em>Etapa ainda sem responsável definido.</em>'),
    },
    item,
  )
}
