import { supabase } from '@/lib/supabase'
import { hoje as dataDeHoje, somarDiasUteis } from '@/app/validacao-fiscal/_lib/prazo'

import type {
  Acesso,
  Anexo,
  Etapa,
  Filial,
  Item,
  ModeloEtapa,
  Participante,
  StatusEtapa,
} from './types'

/**
 * Acesso ao Supabase para o fluxo de imobilizado.
 *
 * Quem pode ver e quem pode agir é decidido pelas policies de RLS
 * (docs/imobilizado-schema.sql). O que está aqui é a mecânica do fluxo: criar
 * as etapas de um item, abrir a seguinte quando uma fecha, e registrar cada
 * movimento na linha do próprio item.
 */

const TAB_MODELO = 'imobilizado_modelo_etapas'
const TAB_ITENS = 'imobilizado_itens'
const TAB_ETAPAS = 'imobilizado_etapas'
const TAB_ANEXOS = 'imobilizado_anexos'
const TAB_MOVS = 'imobilizado_movimentos'
const TAB_PARTICIPANTES = 'imobilizado_participantes'
const TAB_FILIAIS = 'filiais'
const BUCKET = 'evidencias'

/* ────────────────────────────── leitura ────────────────────────────── */

type LinhaItem = Record<string, unknown>
type LinhaEtapa = Record<string, unknown>

function texto(v: unknown): string {
  return v === null || v === undefined ? '' : String(v)
}

function ouNulo(v: unknown): string | null {
  return v === null || v === undefined ? null : String(v)
}

function mapearEtapa(l: LinhaEtapa): Etapa {
  return {
    id: String(l.id),
    itemId: String(l.item_id),
    chave: texto(l.chave),
    ordem: Number(l.ordem ?? 0),
    titulo: texto(l.titulo),
    area: texto(l.area),
    paralela: Boolean(l.paralela),
    exigeAnexo: Boolean(l.exige_anexo),
    exigeCampo: ouNulo(l.exige_campo),
    status: (l.status as StatusEtapa) ?? 'bloqueada',
    // responsaveis.id é bigint: o PostgREST devolve número, e o <select> da
    // tela compara com texto.
    responsavelId: l.responsavel_id === null || l.responsavel_id === undefined
      ? null
      : String(l.responsavel_id),
    responsavelNome: ouNulo(l.responsavel_nome),
    prazo: ouNulo(l.prazo),
    abertaEm: ouNulo(l.aberta_em),
    concluidaEm: ouNulo(l.concluida_em),
    concluidaPor: ouNulo(l.concluida_por),
    observacao: ouNulo(l.observacao),
  }
}

function mapearItem(l: LinhaItem, etapas: Etapa[]): Item {
  return {
    id: String(l.id),
    numero: Number(l.numero ?? 0),
    nfNumero: texto(l.nf_numero),
    nfChave: ouNulo(l.nf_chave),
    fornecedor: texto(l.fornecedor),
    descricao: texto(l.descricao),
    valor: l.valor === null || l.valor === undefined ? null : Number(l.valor),
    filialId: l.filial_id === null || l.filial_id === undefined ? null : String(l.filial_id),
    empresa: texto(l.empresa),
    filial: texto(l.filial),
    ehFrota: Boolean(l.eh_frota),
    centroCusto: ouNulo(l.centro_custo),
    placa: ouNulo(l.placa),
    ocNumero: ouNulo(l.oc_numero),
    pasta: texto(l.pasta),
    atpvEm: ouNulo(l.atpv_em),
    placaEm: ouNulo(l.placa_em),
    baixaEm: ouNulo(l.baixa_em),
    status: (l.status as Item['status']) ?? 'em_andamento',
    criadoPor: ouNulo(l.criado_por),
    criadoEm: texto(l.criado_em),
    finalizadoEm: ouNulo(l.finalizado_em),
    etapas: etapas.sort((a, b) => a.ordem - b.ordem),
  }
}

/** O que o login atual pode fazer. Vem do banco, não de lista no código. */
export async function meuAcesso(): Promise<Acesso> {
  const { data, error } = await supabase.rpc('imob_meu_tipo')
  if (error) return null
  return (data as Acesso) ?? null
}

export async function listarModelo(): Promise<ModeloEtapa[]> {
  const { data, error } = await supabase.from(TAB_MODELO).select('*').order('ordem')
  if (error) throw error

  return (data ?? []).map((l) => ({
    chave: texto(l.chave),
    ordem: Number(l.ordem),
    titulo: texto(l.titulo),
    descricao: texto(l.descricao),
    area: texto(l.area),
    soFrota: Boolean(l.so_frota),
    paralela: Boolean(l.paralela),
    exigeAnexo: Boolean(l.exige_anexo),
    exigeCampo: ouNulo(l.exige_campo),
    prazoDiasUteis: Number(l.prazo_dias_uteis ?? 1),
    responsavelId: l.responsavel_id === null ? null : String(l.responsavel_id),
    ativo: Boolean(l.ativo),
  }))
}

/**
 * Muda o prazo de uma etapa do processo.
 *
 * Vale para os itens criados daqui em diante: mexer no prazo de quem já está
 * em andamento moveria a régua no meio do jogo, e uma etapa que estava no
 * prazo ontem apareceria atrasada hoje sem ninguém ter feito nada.
 */
export async function atualizarPrazoModelo(chave: string, dias: number): Promise<void> {
  const { error } = await supabase
    .from(TAB_MODELO)
    .update({ prazo_dias_uteis: dias })
    .eq('chave', chave)

  if (error) throw error
}

const PAGINA = 500

export async function listarItens(): Promise<Item[]> {
  const itens: LinhaItem[] = []

  for (let pagina = 0; ; pagina++) {
    const { data, error } = await supabase
      .from(TAB_ITENS)
      .select('*')
      .order('numero', { ascending: false })
      .range(pagina * PAGINA, pagina * PAGINA + PAGINA - 1)

    if (error) throw error
    itens.push(...(data ?? []))
    if ((data ?? []).length < PAGINA) break
  }

  if (itens.length === 0) return []

  // Uma consulta para todas as etapas, e não uma por item: com 300 itens em
  // andamento seriam 300 idas ao banco só para desenhar a fila.
  const { data: etapas, error: erroEtapas } = await supabase
    .from(TAB_ETAPAS)
    .select('*')
    .in('item_id', itens.map((i) => String(i.id)))

  if (erroEtapas) throw erroEtapas

  const porItem = new Map<string, Etapa[]>()
  for (const linha of etapas ?? []) {
    const etapa = mapearEtapa(linha)
    const lista = porItem.get(etapa.itemId) ?? []
    lista.push(etapa)
    porItem.set(etapa.itemId, lista)
  }

  return itens.map((i) => mapearItem(i, porItem.get(String(i.id)) ?? []))
}

export async function buscarItem(id: string): Promise<Item | null> {
  const [{ data: item, error }, { data: etapas, error: erroEtapas }] = await Promise.all([
    supabase.from(TAB_ITENS).select('*').eq('id', id).maybeSingle(),
    supabase.from(TAB_ETAPAS).select('*').eq('item_id', id),
  ])

  if (error) throw error
  if (erroEtapas) throw erroEtapas
  if (!item) return null

  return mapearItem(item, (etapas ?? []).map(mapearEtapa))
}

export async function listarAnexos(itemId: string): Promise<Anexo[]> {
  const { data, error } = await supabase
    .from(TAB_ANEXOS)
    .select('*')
    .eq('item_id', itemId)
    .order('enviado_em')

  if (error) throw error

  return (data ?? []).map((l) => ({
    id: String(l.id),
    itemId: String(l.item_id),
    etapaId: ouNulo(l.etapa_id),
    etapaChave: ouNulo(l.etapa_chave),
    nome: texto(l.nome),
    caminho: texto(l.caminho),
    url: texto(l.url),
    tipo: ouNulo(l.tipo),
    tamanho: l.tamanho === null ? null : Number(l.tamanho),
    enviadoPor: ouNulo(l.enviado_por),
    enviadoEm: texto(l.enviado_em),
  }))
}

export type Movimento = {
  id: string
  tipo: string
  descricao: string
  autor: string | null
  criadoEm: string
}

export async function listarMovimentos(itemId: string): Promise<Movimento[]> {
  const { data, error } = await supabase
    .from(TAB_MOVS)
    .select('id, tipo, descricao, autor, criado_em')
    .eq('item_id', itemId)
    .order('criado_em', { ascending: false })

  if (error) throw error

  return (data ?? []).map((l) => ({
    id: String(l.id),
    tipo: texto(l.tipo),
    descricao: texto(l.descricao),
    autor: ouNulo(l.autor),
    criadoEm: texto(l.criado_em),
  }))
}

/* ────────────────────────────── escrita ────────────────────────────── */

/**
 * Registra o movimento na linha do item.
 *
 * Nunca derruba a ação principal: perder uma linha de histórico é ruim, perder
 * a conclusão de uma etapa porque o histórico falhou é pior.
 */
async function registrar(
  itemId: string,
  tipo: string,
  descricao: string,
  autor: string,
  etapaId?: string,
): Promise<void> {
  try {
    await supabase.from(TAB_MOVS).insert({
      item_id: itemId,
      etapa_id: etapaId ?? null,
      tipo,
      descricao,
      autor: autor || null,
    })
  } catch {
    // silencioso de propósito — ver comentário acima
  }
}

/** Empresas e filiais para o seletor. Cadastro de referência, fora do módulo. */
export async function listarFiliais(): Promise<Filial[]> {
  const { data, error } = await supabase
    .from(TAB_FILIAIS)
    .select('*')
    .eq('ativo', true)
    .order('empresa')
    .order('cod_filial')

  if (error) throw error

  return (data ?? []).map((l) => ({
    id: String(l.id),
    codEmpresa: texto(l.cod_empresa),
    empresa: texto(l.empresa),
    codFilial: texto(l.cod_filial),
    filial: texto(l.filial),
    cnpj: ouNulo(l.cnpj),
    ativo: Boolean(l.ativo),
  }))
}

export type NovoItem = {
  nfNumero: string
  nfChave: string | null
  fornecedor: string
  descricao: string
  valor: number | null
  /** A filial escolhida no seletor. Nome e empresa são copiados junto. */
  filial: Filial | null
  ehFrota: boolean
}

/**
 * Cria o item, a pasta e as etapas dele.
 *
 * As etapas nascem do modelo no banco: as `so_frota` só entram quando o item é
 * frota — não são criadas e puladas, porque etapa pulada continuaria contando
 * como pendência do item para sempre.
 */
export async function criarItem(entrada: NovoItem, usuario: string): Promise<Item> {
  const modelo = await listarModelo()

  const { data: criado, error } = await supabase
    .from(TAB_ITENS)
    .insert({
      nf_numero: entrada.nfNumero,
      nf_chave: entrada.nfChave,
      fornecedor: entrada.fornecedor,
      descricao: entrada.descricao,
      valor: entrada.valor,
      filial_id: entrada.filial?.id ?? null,
      empresa: entrada.filial?.empresa ?? '',
      filial: entrada.filial ? `${entrada.filial.codFilial} ${entrada.filial.filial}`.trim() : '',
      eh_frota: entrada.ehFrota,
      criado_por: usuario || null,
      // O número só existe depois do insert, e a pasta é nomeada por ele.
      // Gravamos um provisório e corrigimos na linha seguinte.
      pasta: 'imobilizado/pendente',
    })
    .select('*')
    .single()

  if (error) throw error

  const ano = new Date(String(criado.criado_em)).getFullYear()
  const pasta = `imobilizado/${ano}/${String(criado.numero).padStart(6, '0')}`

  await supabase.from(TAB_ITENS).update({ pasta }).eq('id', criado.id)

  const aplicaveis = modelo.filter((m) => m.ativo && (!m.soFrota || entrada.ehFrota))

  // A primeira etapa de trabalho já nasce aberta; as demais esperam a anterior.
  // As paralelas nascem abertas também: não dependem de ninguém, é o que as
  // torna paralelas.
  const primeiraSequencial = aplicaveis.filter((m) => !m.paralela).sort((a, b) => a.ordem - b.ordem)[0]

  const linhas = aplicaveis.map((m) => {
    const abre = m.paralela || m.chave === primeiraSequencial?.chave
    return {
      item_id: criado.id,
      chave: m.chave,
      ordem: m.ordem,
      titulo: m.titulo,
      area: m.area,
      paralela: m.paralela,
      exige_anexo: m.exigeAnexo,
      exige_campo: m.exigeCampo,
      responsavel_id: m.responsavelId,
      status: abre ? 'aberta' : 'bloqueada',
      prazo: abre ? somarDiasUteis(dataDeHoje(), m.prazoDiasUteis) : null,
      aberta_em: abre ? new Date().toISOString() : null,
    }
  })

  const { error: erroEtapas } = await supabase.from(TAB_ETAPAS).insert(linhas)
  if (erroEtapas) throw erroEtapas

  await registrar(
    String(criado.id),
    'criacao',
    `Item criado${entrada.ehFrota ? ' como frota' : ''} · ${linhas.length} etapas · pasta ${pasta}`,
    usuario,
  )

  const item = await buscarItem(String(criado.id))
  if (!item) throw new Error('item criado mas não encontrado')
  return item
}

/** O que impede uma etapa de ser concluída. Vazio = pode concluir. */
export function impedimentos(item: Item, etapa: Etapa, anexos: Anexo[]): string[] {
  const faltas: string[] = []

  if (etapa.status !== 'aberta') faltas.push('A etapa ainda não está aberta.')

  if (etapa.exigeAnexo && !anexos.some((a) => a.etapaId === etapa.id)) {
    faltas.push('Anexe o documento desta etapa antes de concluir.')
  }

  if (etapa.exigeCampo) {
    const valor = {
      oc_numero: item.ocNumero,
      placa: item.placa,
      centro_custo: item.centroCusto,
    }[etapa.exigeCampo]

    if (!valor || !String(valor).trim()) {
      faltas.push(`Preencha o campo obrigatório desta etapa antes de concluir.`)
    }
  }

  return faltas
}

/**
 * Conclui a etapa e abre a próxima da fila.
 *
 * Etapa paralela não abre nada e não impede o item de terminar — é o que
 * permite o cadastro da placa continuar em aberto depois de o item fechar.
 */
export async function concluirEtapa(params: {
  item: Item
  etapa: Etapa
  observacao: string | null
  usuario: string
}): Promise<void> {
  const { item, etapa, usuario } = params
  const agora = new Date().toISOString()
  const hoje = dataDeHoje()

  const { error } = await supabase
    .from(TAB_ETAPAS)
    .update({
      status: 'concluida',
      concluida_em: agora,
      concluida_por: usuario || null,
      observacao: params.observacao,
    })
    .eq('id', etapa.id)

  if (error) throw error

  // Datas que a etapa carimba no item: são os extremos dos dois agings.
  const carimbo: Record<string, string> = {}
  if (etapa.chave === 'atpv' && !item.atpvEm) carimbo.atpv_em = hoje
  if (etapa.chave === 'placa' && !item.placaEm) carimbo.placa_em = hoje
  if (etapa.chave === 'baixa' && !item.baixaEm) carimbo.baixa_em = hoje
  if (Object.keys(carimbo).length > 0) {
    await supabase.from(TAB_ITENS).update(carimbo).eq('id', item.id)
  }

  if (!etapa.paralela) {
    const seguinte = item.etapas
      .filter((e) => !e.paralela && e.status === 'bloqueada' && e.ordem > etapa.ordem)
      .sort((a, b) => a.ordem - b.ordem)[0]

    if (seguinte) {
      const modelo = await listarModelo()
      const dias = modelo.find((m) => m.chave === seguinte.chave)?.prazoDiasUteis ?? 1

      await supabase
        .from(TAB_ETAPAS)
        .update({
          status: 'aberta',
          aberta_em: agora,
          prazo: somarDiasUteis(hoje, dias),
        })
        .eq('id', seguinte.id)
    } else {
      // Sem etapa sequencial pendente o item está pronto, mesmo que a paralela
      // siga aberta.
      await supabase
        .from(TAB_ITENS)
        .update({ status: 'finalizado', finalizado_em: agora })
        .eq('id', item.id)

      await registrar(item.id, 'finalizacao', 'Item finalizado', usuario)
    }
  }

  await registrar(
    item.id,
    'etapa_concluida',
    `${etapa.titulo} concluída${params.observacao ? ` — ${params.observacao}` : ''}`,
    usuario,
    etapa.id,
  )
}

/** Reabre uma etapa concluída, devolvendo o item ao andamento. */
export async function reabrirEtapa(item: Item, etapa: Etapa, usuario: string): Promise<void> {
  const { error } = await supabase
    .from(TAB_ETAPAS)
    .update({ status: 'aberta', concluida_em: null, concluida_por: null })
    .eq('id', etapa.id)

  if (error) throw error

  if (item.status === 'finalizado') {
    await supabase
      .from(TAB_ITENS)
      .update({ status: 'em_andamento', finalizado_em: null })
      .eq('id', item.id)
  }

  await registrar(item.id, 'etapa_reaberta', `${etapa.titulo} reaberta`, usuario, etapa.id)
}

export async function atribuirEtapa(
  item: Item,
  etapa: Etapa,
  responsavel: { id: string; nome: string } | null,
  usuario: string,
): Promise<void> {
  const { error } = await supabase
    .from(TAB_ETAPAS)
    .update({
      responsavel_id: responsavel?.id ?? null,
      responsavel_nome: responsavel?.nome ?? null,
    })
    .eq('id', etapa.id)

  if (error) throw error

  await registrar(
    item.id,
    'atribuicao',
    responsavel ? `${etapa.titulo} atribuída a ${responsavel.nome}` : `${etapa.titulo} sem responsável`,
    usuario,
    etapa.id,
  )
}

/** Campos do item que a tela edita direto (flags e números das etapas). */
export async function atualizarItem(
  item: Item,
  mudancas: Partial<{
    oc_numero: string | null
    placa: string | null
    centro_custo: string | null
    nf_numero: string | null
    nf_chave: string | null
    fornecedor: string | null
    descricao: string | null
    filial: string | null
    filial_id: string | null
    empresa: string | null
    valor: number | null
  }>,
  usuario: string,
): Promise<void> {
  const { error } = await supabase.from(TAB_ITENS).update(mudancas).eq('id', item.id)
  if (error) throw error

  const resumo = Object.entries(mudancas)
    .map(([campo, valor]) => `${campo} = ${valor || '—'}`)
    .join(' · ')

  await registrar(item.id, 'edicao', resumo, usuario)
}

/* ────────────────────────────── a pasta ────────────────────────────── */

/**
 * Sobe o arquivo para a pasta do item.
 *
 * O nome no bucket começa pela etapa que enviou, para a pasta ficar legível
 * quando for baixada e levada para o controle de vocês.
 */
export async function anexar(params: {
  item: Item
  etapa: Etapa | null
  arquivo: File
  usuario: string
}): Promise<Anexo> {
  const { item, etapa, arquivo, usuario } = params

  const extensao = arquivo.name.split('.').pop() ?? 'dat'
  const prefixo = etapa ? etapa.chave : 'geral'
  const caminho = `${item.pasta}/${prefixo}-${Date.now()}.${extensao}`

  const { error: erroUpload } = await supabase.storage.from(BUCKET).upload(caminho, arquivo)
  if (erroUpload) throw erroUpload

  const { data: publica } = supabase.storage.from(BUCKET).getPublicUrl(caminho)

  const { data, error } = await supabase
    .from(TAB_ANEXOS)
    .insert({
      item_id: item.id,
      etapa_id: etapa?.id ?? null,
      etapa_chave: etapa?.chave ?? null,
      nome: arquivo.name,
      caminho,
      url: publica.publicUrl,
      tipo: arquivo.type || null,
      tamanho: arquivo.size,
      enviado_por: usuario || null,
    })
    .select('*')
    .single()

  if (error) throw error

  await registrar(
    item.id,
    'anexo',
    `${arquivo.name} anexado${etapa ? ` em ${etapa.titulo}` : ''}`,
    usuario,
    etapa?.id,
  )

  return {
    id: String(data.id),
    itemId: item.id,
    etapaId: etapa?.id ?? null,
    etapaChave: etapa?.chave ?? null,
    nome: arquivo.name,
    caminho,
    url: publica.publicUrl,
    tipo: arquivo.type || null,
    tamanho: arquivo.size,
    enviadoPor: usuario || null,
    enviadoEm: new Date().toISOString(),
  }
}

/**
 * Baixa a pasta inteira em um .zip.
 *
 * É o caminho da pasta para fora do sistema: os arquivos saem com o nome
 * original prefixado pela etapa, para o dossiê continuar legível depois de
 * levado para o controle de vocês.
 */
export async function baixarPasta(item: Item, anexos: Anexo[]): Promise<void> {
  if (anexos.length === 0) throw new Error('A pasta está vazia.')

  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()

  // Sequencial de propósito: uma pasta com dezenas de anexos dispararia
  // dezenas de downloads simultâneos do Storage.
  for (const anexo of anexos) {
    const { data, error } = await supabase.storage.from(BUCKET).download(anexo.caminho)
    if (error || !data) continue

    const etapa = anexo.etapaChave ? `${anexo.etapaChave}-` : ''
    zip.file(`${etapa}${anexo.nome}`, data)
  }

  const conteudo = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(conteudo)
  const ancora = document.createElement('a')
  ancora.href = url
  ancora.download = `imobilizado-${String(item.numero).padStart(6, '0')}.zip`
  ancora.click()
  URL.revokeObjectURL(url)
}

export async function removerAnexo(item: Item, anexo: Anexo, usuario: string): Promise<void> {
  await supabase.storage.from(BUCKET).remove([anexo.caminho])

  const { error } = await supabase.from(TAB_ANEXOS).delete().eq('id', anexo.id)
  if (error) throw error

  await registrar(item.id, 'anexo_removido', `${anexo.nome} removido`, usuario)
}

/* ─────────────────────── pessoas do processo ─────────────────────── */

export async function listarParticipantes(): Promise<Participante[]> {
  const { data, error } = await supabase
    .from(TAB_PARTICIPANTES)
    .select('id, papel, tipo, ativo, responsavel_id, responsaveis (nome, email)')
    .order('id')

  if (error) throw error

  return (data ?? []).map((l) => {
    const pessoa = l.responsaveis as unknown as { nome?: string; email?: string } | null
    return {
      id: Number(l.id),
      responsavelId: String(l.responsavel_id),
      nome: pessoa?.nome ?? '—',
      email: pessoa?.email ?? null,
      papel: texto(l.papel),
      tipo: (l.tipo as Participante['tipo']) ?? 'participante',
      ativo: Boolean(l.ativo),
    }
  })
}

export function descreverErro(erro: unknown): string {
  const e = erro as { code?: string; message?: string }

  if (e?.code === '42P01') {
    return 'As tabelas do imobilizado ainda não existem. Rode docs/imobilizado-schema.sql no editor SQL do Supabase.'
  }
  if (e?.code === '42501' || /row-level security/i.test(e?.message ?? '')) {
    return 'Sem permissão. Você precisa estar no cadastro de participantes do processo.'
  }
  if (/bucket/i.test(e?.message ?? '')) {
    return 'Falha ao guardar o arquivo. O bucket "evidencias" existe no Storage?'
  }
  return e?.message || 'Falha ao falar com o banco.'
}
