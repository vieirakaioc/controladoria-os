'use client'

import { supabase } from '@/lib/supabase'

import { formatarData, hoje as dataDeHoje } from '@/app/validacao-fiscal/_lib/prazo'

import { listarItens, meuAcesso } from './api'
import { equipeDoProcesso } from './avisos'
import { montarRelatorio } from './relatorio'
import { calcularResumo } from './resumo'

/**
 * Resumo diário do imobilizado para quem está cadastrado no processo.
 *
 * Mesma mecânica do resumo da validação fiscal: em vez de cron no servidor, o
 * disparo acontece no navegador de quem abre o app. Como o e-mail vai para o
 * time inteiro, a trava é uma linha por dia em `imobilizado_envios` — a chave
 * primária na data garante que só o primeiro navegador do dia envia.
 *
 * A lista de destinatários não é fixa no código: são os participantes e
 * observadores ativos do processo. Incluir alguém no cadastro é o que passa a
 * mandar o resumo para ele, e é o mesmo cadastro que dá acesso à aba.
 */

const TABELA = 'imobilizado_envios'

/** Antes disso é madrugada; o resumo é para começar o dia. */
const HORA_MINIMA = 6

function ehFimDeSemana(dataISO: string): boolean {
  const [ano, mes, dia] = dataISO.split('-').map(Number)
  const diaSemana = new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay()
  return diaSemana === 0 || diaSemana === 6
}

function horaLocal(): number {
  return Number(
    new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      hour12: false,
    }).format(new Date()),
  )
}

export async function enviarResumoDiario(usuario: string): Promise<void> {
  const hoje = dataDeHoje()

  // Os prazos são em dias úteis; cobrar no sábado só gera ruído.
  if (ehFimDeSemana(hoje)) return
  if (horaLocal() < HORA_MINIMA) return

  try {
    // Quem não participa do processo não lê os itens (a RLS bloqueia), e
    // portanto não pode montar o resumo. Sair aqui evita reservar o dia e
    // devolver em seguida.
    if (!(await meuAcesso())) return

    // Consulta barata primeiro: na imensa maioria das aberturas o dia já foi
    // enviado, e aí nem vale buscar os itens.
    const { data: jaEnviado } = await supabase
      .from(TABELA)
      .select('data')
      .eq('data', hoje)
      .maybeSingle()

    if (jaEnviado) return

    const destinatarios = await equipeDoProcesso()
    if (destinatarios.length === 0) return

    // Reserva o dia ANTES de montar o e-mail. Se duas pessoas abrirem no mesmo
    // segundo, a segunda leva 23505 aqui e desiste — em vez de as duas
    // mandarem o resumo para a lista inteira.
    const { error: erroReserva } = await supabase.from(TABELA).insert({
      data: hoje,
      enviado_por: usuario || null,
      destinatarios: destinatarios.join(', '),
    })

    if (erroReserva) return

    try {
      const itens = await listarItens()
      if (itens.length === 0) throw new Error('sem itens para resumir')

      const resumo = calcularResumo(itens, hoje)

      const resposta = await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: destinatarios.join(', '),
          subject:
            `[Imobilizado] ${formatarData(hoje)} — ` +
            `${resumo.emAndamento} em andamento, ${resumo.atrasados} atrasado(s)`,
          html: montarRelatorio({
            resumo,
            hoje,
            link: `${window.location.origin}/imobilizado/matriz`,
          }),
        }),
      })

      const corpo = await resposta.json().catch(() => null)
      if (!resposta.ok || corpo?.success === false) throw new Error('envio recusado')
    } catch (falha) {
      // Devolve o dia: reserva sem e-mail enviado deixaria a equipe sem resumo
      // até amanhã. Assim a próxima pessoa que abrir tenta de novo.
      await supabase.from(TABELA).delete().eq('data', hoje)
      throw falha
    }
  } catch (falha) {
    if (typeof console !== 'undefined') {
      console.warn('[imobilizado] resumo diário não enviado:', falha)
    }
  }
}
