import { agingPlaca, agingProcesso } from './aging'
import { emEspera, etapaAtrasada, type Etapa, type Item } from './types'

/**
 * Os números do painel de imobilizado.
 *
 * Calculado uma vez e usado nos dois destinos — a tela e o relatório que vai
 * por e-mail. Se cada lado fizesse a sua própria conta, um dia eles
 * discordariam, e a discussão seria sobre qual dos dois mente.
 *
 * Atraso sai de `etapaAtrasada`, a mesma função das telas: item em espera de
 * aprovação não conta atraso aqui também.
 */

export type Contagem = {
  rotulo: string
  abertas: number
  atrasadas: number
  /** Posição no fluxo. Só as contagens por etapa usam; nas outras é 0. */
  ordem: number
}

export type Critico = {
  item: Item
  etapa: Etapa
}

export type Resumo = {
  total: number
  emAndamento: number
  finalizados: number
  atrasados: number
  venceHoje: number
  emEspera: number
  semResponsavel: number
  valorEmAndamento: number
  agingMedio: number
  placasAbertas: number
  maiorPlaca: number
  /** Onde o processo está represado: etapas abertas por etapa do fluxo. */
  porEtapa: Contagem[]
  porResponsavel: Contagem[]
  porArea: Contagem[]
  /** O que pede ação hoje: prazo mais antigo no topo. */
  criticos: Critico[]
}

function acumular(
  mapa: Map<string, Contagem>,
  chave: string,
  rotulo: string,
  atrasada: boolean,
  ordem = 0,
): void {
  const atual = mapa.get(chave) ?? { rotulo, abertas: 0, atrasadas: 0, ordem }
  atual.abertas += 1
  if (atrasada) atual.atrasadas += 1
  mapa.set(chave, atual)
}

export function calcularResumo(itens: Item[], hoje: string): Resumo {
  const emAndamento = itens.filter((i) => i.status === 'em_andamento')

  const porEtapa = new Map<string, Contagem>()
  const porResponsavel = new Map<string, Contagem>()
  const porArea = new Map<string, Contagem>()
  const criticos: Critico[] = []

  let venceHoje = 0
  let semResponsavel = 0

  for (const item of emAndamento) {
    for (const etapa of item.etapas) {
      if (etapa.status !== 'aberta') continue

      const atrasada = etapaAtrasada(item, etapa, hoje)

      acumular(porEtapa, etapa.chave, etapa.titulo, atrasada, etapa.ordem)
      acumular(porArea, etapa.area || '—', etapa.area || 'Sem área', atrasada)
      acumular(
        porResponsavel,
        etapa.responsavelId ?? 'sem',
        etapa.responsavelNome ?? 'Sem responsável',
        atrasada,
      )

      if (!etapa.responsavelId) semResponsavel += 1
      if (!emEspera(item) && etapa.prazo === hoje) venceHoje += 1
      if (atrasada) criticos.push({ item, etapa })
    }
  }

  // Atrasadas primeiro, e dentro do mesmo prazo o item mais antigo: quem está
  // esperando há mais tempo aparece antes.
  criticos.sort((a, b) => {
    const pa = a.etapa.prazo ?? ''
    const pb = b.etapa.prazo ?? ''
    if (pa !== pb) return pa < pb ? -1 : 1
    return a.item.numero - b.item.numero
  })

  const agings = emAndamento
    .map((i) => agingProcesso(i, hoje))
    .filter((a): a is NonNullable<typeof a> => a !== null)

  const placas = itens
    .map((i) => agingPlaca(i, hoje))
    .filter((a): a is NonNullable<typeof a> => a !== null && a.aberto)

  const ordenar = (mapa: Map<string, Contagem>) =>
    [...mapa.values()].sort((a, b) =>
      b.atrasadas === a.atrasadas ? b.abertas - a.abertas : b.atrasadas - a.atrasadas,
    )

  return {
    total: itens.length,
    emAndamento: emAndamento.length,
    finalizados: itens.filter((i) => i.status === 'finalizado').length,
    atrasados: emAndamento.filter((i) => i.etapas.some((e) => etapaAtrasada(i, e, hoje))).length,
    venceHoje,
    emEspera: emAndamento.filter(emEspera).length,
    semResponsavel,
    valorEmAndamento: emAndamento.reduce((soma, i) => soma + (i.valor ?? 0), 0),
    agingMedio:
      agings.length === 0
        ? 0
        : Math.round(agings.reduce((soma, a) => soma + a.dias, 0) / agings.length),
    placasAbertas: placas.length,
    maiorPlaca: placas.reduce((maior, a) => Math.max(maior, a.dias), 0),
    // A ordem do fluxo, e não a do volume: a etapa represada se enxerga
    // melhor quando elas aparecem na sequência em que acontecem.
    porEtapa: [...porEtapa.values()].sort((a, b) => a.ordem - b.ordem),
    porResponsavel: ordenar(porResponsavel),
    porArea: ordenar(porArea),
    criticos,
  }
}
