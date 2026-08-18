import { situacaoPrazo } from './prazo'
import { estaFinalizada, ROTULO_ORIGEM, type TarefaFiscal } from './types'

/**
 * Indicadores do dashboard, calculados a partir da mesma lista que alimenta a
 * matriz. Fazer a conta aqui (e não em SQL) garante que o número do painel e o
 * selo da linha nunca discordem — os dois saem de `situacaoPrazo`.
 */

export type Contagem = {
  rotulo: string
  total: number
  pendentes: number
  atrasadas: number
}

export type Resumo = {
  total: number
  emAberto: number
  /** Encerradas, somando corrigidas e sem correção. */
  concluidas: number
  corrigidas: number
  semCorrecao: number
  emAndamento: number
  /** Alguém já pegou, mas o prazo estourou. */
  emAndamentoAtrasadas: number
  /** Alguém já pegou e ainda há prazo. */
  emAndamentoNoPrazo: number
  atrasadas: number
  venceHoje: number
  noPrazo: number
  concluidasComAtraso: number
  semResponsavel: number
  valorPendente: number
  mediaDiasResposta: number | null
  porTipo: Contagem[]
  porResponsavel: Contagem[]
  porOrigem: Contagem[]
  porEmitente: Contagem[]
}

function agrupar(
  tarefas: TarefaFiscal[],
  hoje: string,
  chave: (t: TarefaFiscal) => string,
): Contagem[] {
  const mapa = new Map<string, Contagem>()

  for (const tarefa of tarefas) {
    const rotulo = chave(tarefa)
    const atual = mapa.get(rotulo) ?? { rotulo, total: 0, pendentes: 0, atrasadas: 0 }

    atual.total++
    if (!estaFinalizada(tarefa.status)) {
      atual.pendentes++
      if (situacaoPrazo(tarefa.status, tarefa.prazo, tarefa.concluidoEm, hoje) === 'atrasada') {
        atual.atrasadas++
      }
    }

    mapa.set(rotulo, atual)
  }

  return [...mapa.values()].sort((a, b) => b.total - a.total)
}

export function calcularResumo(tarefas: TarefaFiscal[], hoje: string): Resumo {
  let concluidas = 0
  let atrasadas = 0
  let venceHoje = 0
  let noPrazo = 0
  let concluidasComAtraso = 0
  let semResponsavel = 0
  let valorPendente = 0
  let corrigidas = 0
  let semCorrecao = 0
  let emAndamento = 0
  let emAndamentoAtrasadas = 0

  const diasResposta: number[] = []

  for (const tarefa of tarefas) {
    const situacao = situacaoPrazo(tarefa.status, tarefa.prazo, tarefa.concluidoEm, hoje)

    switch (situacao) {
      case 'concluida_no_prazo':
        concluidas++
        break
      case 'concluida_com_atraso':
        concluidas++
        concluidasComAtraso++
        break
      case 'atrasada':
        atrasadas++
        break
      case 'vence_hoje':
        venceHoje++
        break
      case 'no_prazo':
        noPrazo++
        break
    }

    if (tarefa.status === 'concluida') corrigidas++
    if (tarefa.status === 'sem_correcao') semCorrecao++
    if (tarefa.status === 'em_andamento') {
      emAndamento++
      // Separar as duas é o que diferencia "tem gente cuidando" de "tem gente
      // cuidando e mesmo assim passou do prazo" — a segunda pede cobrança.
      if (situacao === 'atrasada') emAndamentoAtrasadas++
    }

    if (!estaFinalizada(tarefa.status)) {
      valorPendente += tarefa.valor ?? 0
      if (!tarefa.responsavelId && !tarefa.responsavelNome) semResponsavel++
    }

    if (estaFinalizada(tarefa.status) && tarefa.concluidoEm) {
      const dias =
        (new Date(tarefa.concluidoEm).getTime() - new Date(tarefa.criadoEm).getTime()) / 86_400_000
      if (Number.isFinite(dias) && dias >= 0) diasResposta.push(dias)
    }
  }

  return {
    total: tarefas.length,
    emAberto: tarefas.length - concluidas,
    concluidas,
    corrigidas,
    semCorrecao,
    emAndamento,
    emAndamentoAtrasadas,
    emAndamentoNoPrazo: emAndamento - emAndamentoAtrasadas,
    atrasadas,
    venceHoje,
    noPrazo,
    concluidasComAtraso,
    semResponsavel,
    valorPendente,
    mediaDiasResposta:
      diasResposta.length === 0
        ? null
        : diasResposta.reduce((s, d) => s + d, 0) / diasResposta.length,
    porTipo: agrupar(tarefas, hoje, (t) => t.tipoDivergencia || 'Sem classificação'),
    porResponsavel: agrupar(tarefas, hoje, (t) => t.responsavelNome || 'Sem responsável'),
    porOrigem: agrupar(tarefas, hoje, (t) =>
      t.aba ? `${ROTULO_ORIGEM[t.origem]} · ${t.aba}` : ROTULO_ORIGEM[t.origem],
    ),
    porEmitente: agrupar(tarefas, hoje, (t) => t.emitente || 'Sem emitente'),
  }
}
