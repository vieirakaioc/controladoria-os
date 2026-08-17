'use client'

import { supabase } from '@/lib/supabase'

import { EMAILS_RESUMO_DIARIO } from './acesso'
import { listarTarefas } from './api'
import { formatarData, hoje as dataDeHoje } from './prazo'
import { montarRelatorio } from './relatorio'
import { calcularResumo } from './resumo'

/**
 * Resumo diário do painel para a equipe.
 *
 * Segue a filosofia já usada em lib/adminReminders.ts: em vez de cron no
 * servidor, o disparo acontece no navegador de quem abre o app. A diferença é
 * que este e-mail vai para o time inteiro, então a trava não pode ser local —
 * é uma linha por dia em validacao_fiscal_envios, e a chave primária na data
 * garante que só o primeiro navegador do dia envia.
 */

const TABELA = 'validacao_fiscal_envios'

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

  // O prazo é contado em dias úteis; cobrar no sábado só gera ruído.
  if (ehFimDeSemana(hoje)) return
  if (horaLocal() < HORA_MINIMA) return

  try {
    // Consulta barata primeiro: na imensa maioria das aberturas o dia já foi
    // enviado, e aí nem vale buscar as tarefas.
    const { data: jaEnviado } = await supabase
      .from(TABELA)
      .select('data')
      .eq('data', hoje)
      .maybeSingle()

    if (jaEnviado) return

    // Reserva o dia ANTES de montar o e-mail. Se duas pessoas abrirem no mesmo
    // segundo, a segunda leva 23505 aqui e desiste — em vez de as duas
    // mandarem o resumo para as oito pessoas.
    const { error: erroReserva } = await supabase.from(TABELA).insert({
      data: hoje,
      enviado_por: usuario || null,
      destinatarios: EMAILS_RESUMO_DIARIO.join(', '),
    })

    if (erroReserva) return

    try {
      const tarefas = await listarTarefas()
      if (tarefas.length === 0) throw new Error('sem tarefas para resumir')

      const resumo = calcularResumo(tarefas, hoje)

      const resposta = await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: EMAILS_RESUMO_DIARIO.join(', '),
          subject: `[Validação Fiscal] Painel de ${formatarData(hoje)} — ${resumo.emAberto} em aberto, ${resumo.atrasadas} atrasada(s)`,
          html: montarRelatorio({
            resumo,
            tarefas,
            hoje,
            link: `${window.location.origin}/validacao-fiscal/matriz`,
          }),
        }),
      })

      const corpo = await resposta.json().catch(() => null)
      if (!resposta.ok || corpo?.success === false) throw new Error('envio recusado')
    } catch (falha) {
      // Devolve o dia: a reserva sem e-mail enviado deixaria a equipe sem
      // resumo até amanhã. Assim a próxima pessoa que abrir tenta de novo.
      await supabase.from(TABELA).delete().eq('data', hoje)
      throw falha
    }
  } catch (falha) {
    if (typeof console !== 'undefined') {
      console.warn('[validacao-fiscal] resumo diário não enviado:', falha)
    }
  }
}
