import { supabase } from '@/lib/supabase'

import {
  estaFinalizada,
  type LinhaPlanilha,
  type LoteImportacao,
  type Origem,
  type Responsavel,
  type StatusTarefa,
  type TarefaFiscal,
  type TarefaLida,
} from './types'

/**
 * Acesso ao Supabase para a Validação Fiscal.
 *
 * Tudo roda com o cliente anon do navegador, então as regras de quem pode
 * importar e quem pode responder vivem nas policies de RLS
 * (docs/validacao-fiscal-schema.sql), não aqui.
 */

const TAB_LOTES = 'validacao_fiscal_lotes'
const TAB_TAREFAS = 'validacao_fiscal_tarefas'

const CAMPOS = `
  id, lote_id, origem, aba, chave, documento, tipo_divergencia, emitente, filial,
  valor, emissao, dados, status, responsavel_id, responsavel_nome,
  observacao_correcao, motivo_andamento, prazo, concluido_em, concluido_por, criado_em
`

type LinhaTarefa = {
  id: string
  lote_id: string | null
  origem: Origem
  aba: string
  chave: string
  documento: string
  tipo_divergencia: string
  emitente: string
  filial: string
  valor: number | string | null
  emissao: string | null
  dados: LinhaPlanilha | null
  status: StatusTarefa
  // responsaveis.id é bigint: o PostgREST devolve número, não texto.
  responsavel_id: string | number | null
  responsavel_nome: string | null
  observacao_correcao: string | null
  motivo_andamento: string | null
  prazo: string
  concluido_em: string | null
  concluido_por: string | null
  criado_em: string
}

function mapear(linha: LinhaTarefa): TarefaFiscal {
  return {
    id: linha.id,
    loteId: linha.lote_id,
    origem: linha.origem,
    aba: linha.aba ?? '',
    chave: linha.chave,
    documento: linha.documento ?? '',
    tipoDivergencia: linha.tipo_divergencia ?? '',
    emitente: linha.emitente ?? '',
    filial: linha.filial ?? '',
    valor: linha.valor === null ? null : Number(linha.valor),
    emissao: linha.emissao,
    dados: linha.dados ?? {},
    status: linha.status,
    // Normaliza para texto aqui, na fronteira: o <select> do painel e o filtro
    // da matriz comparam com string, e 12 !== '12' silenciaria a atribuição.
    responsavelId: linha.responsavel_id === null ? null : String(linha.responsavel_id),
    responsavelNome: linha.responsavel_nome,
    observacaoCorrecao: linha.observacao_correcao,
    motivoAndamento: linha.motivo_andamento,
    prazo: linha.prazo,
    concluidoEm: linha.concluido_em,
    concluidoPor: linha.concluido_por,
    criadoEm: linha.criado_em,
  }
}

const PAGINA = 1000

/**
 * Carrega todas as tarefas.
 *
 * A paginação é obrigatória: o PostgREST corta em 1000 linhas por requisição e
 * um ano de importações passa disso — sem o laço, o dashboard começaria a
 * mentir silenciosamente depois de alguns meses.
 */
export async function listarTarefas(): Promise<TarefaFiscal[]> {
  const todas: TarefaFiscal[] = []

  for (let pagina = 0; ; pagina++) {
    const { data, error } = await supabase
      .from(TAB_TAREFAS)
      .select(CAMPOS)
      .order('prazo', { ascending: true })
      .order('documento', { ascending: true })
      .range(pagina * PAGINA, pagina * PAGINA + PAGINA - 1)

    if (error) throw error

    const linhas = (data ?? []) as unknown as LinhaTarefa[]
    todas.push(...linhas.map(mapear))

    if (linhas.length < PAGINA) break
  }

  // "Concluída" vem antes de "em_andamento"/"pendente" em ordem alfabética, e
  // ordenar por status no banco jogaria o que já foi resolvido para o topo.
  // A prioridade é o que ainda falta responder.
  return todas.sort((a, b) => {
    const abertaA = estaFinalizada(a.status) ? 1 : 0
    const abertaB = estaFinalizada(b.status) ? 1 : 0
    if (abertaA !== abertaB) return abertaA - abertaB
    if (a.prazo !== b.prazo) return a.prazo < b.prazo ? -1 : 1
    return a.documento.localeCompare(b.documento, 'pt-BR', { numeric: true })
  })
}

export async function listarLotes(limite = 20): Promise<LoteImportacao[]> {
  const { data, error } = await supabase
    .from(TAB_LOTES)
    .select('id, origem, arquivo, importado_por, importado_em, total_linhas, novas, duplicadas, prazo')
    .order('importado_em', { ascending: false })
    .limit(limite)

  if (error) throw error

  return (data ?? []).map((l) => ({
    id: l.id,
    origem: l.origem,
    arquivo: l.arquivo,
    importadoPor: l.importado_por,
    importadoEm: l.importado_em,
    totalLinhas: l.total_linhas,
    novas: l.novas,
    duplicadas: l.duplicadas,
    prazo: l.prazo,
  }))
}

export async function listarResponsaveis(): Promise<Responsavel[]> {
  const { data, error } = await supabase
    .from('responsaveis')
    .select('id, nome, email')
    .order('nome')

  if (error) throw error

  return (data ?? []).map((r) => ({
    id: String(r.id),
    nome: r.nome,
    email: r.email,
  }))
}

export type ResultadoImportacao = {
  loteId: string
  arquivo: string
  origem: Origem
  total: number
  novas: number
  duplicadas: number
  prazo: string
  /** Nome de quem ficou como responsável, ou null se o e-mail padrão não existe. */
  responsavelPadrao: string | null
}

/**
 * Busca o responsável padrão pelo e-mail. Devolve null em vez de estourar: uma
 * planilha importada sem dono é melhor do que uma importação recusada.
 */
export async function buscarResponsavelPorEmail(email: string): Promise<Responsavel | null> {
  const { data, error } = await supabase
    .from('responsaveis')
    .select('id, nome, email')
    .ilike('email', email)
    .maybeSingle()

  if (error || !data) return null
  return { id: String(data.id), nome: data.nome, email: data.email }
}

/** Grava um lote e suas tarefas. Linhas já importadas antes são ignoradas. */
export async function salvarLote(params: {
  origem: Origem
  arquivo: string
  importadoPor: string | null
  prazo: string
  tarefas: TarefaLida[]
  /** Dono inicial das tarefas novas. Tarefas já existentes não são tocadas. */
  responsavelPadrao: Responsavel | null
}): Promise<ResultadoImportacao> {
  // Uma planilha pode repetir a mesma linha; a chave natural resolve antes de
  // chegar ao banco, senão o upsert reclamaria de conflito no próprio lote.
  const unicas = [...new Map(params.tarefas.map((t) => [t.chave, t])).values()]

  const { data: lote, error: erroLote } = await supabase
    .from(TAB_LOTES)
    .insert({
      origem: params.origem,
      arquivo: params.arquivo,
      importado_por: params.importadoPor,
      prazo: params.prazo,
      total_linhas: params.tarefas.length,
    })
    .select('id')
    .single()

  if (erroLote) throw erroLote

  let novas = 0

  if (unicas.length > 0) {
    const linhas = unicas.map((t) => ({
      lote_id: lote.id,
      origem: t.origem,
      aba: t.aba,
      chave: t.chave,
      documento: t.documento,
      tipo_divergencia: t.tipoDivergencia,
      emitente: t.emitente,
      filial: t.filial,
      valor: t.valor,
      emissao: t.emissao,
      dados: t.dados,
      prazo: params.prazo,
      responsavel_id: params.responsavelPadrao?.id ?? null,
      responsavel_nome: params.responsavelPadrao?.nome ?? null,
    }))

    // ignoreDuplicates faz o papel do "on conflict do nothing": a resposta já
    // dada pelo time em uma importação anterior não pode ser sobrescrita.
    const { data: inseridas, error: erroTarefas } = await supabase
      .from(TAB_TAREFAS)
      .upsert(linhas, { onConflict: 'chave', ignoreDuplicates: true })
      .select('id')

    if (erroTarefas) throw erroTarefas
    novas = inseridas?.length ?? 0
  }

  const duplicadas = params.tarefas.length - novas

  // As tarefas já foram gravadas; se só o placar do lote falhar, o histórico
  // fica errado — vale avisar em vez de engolir.
  const { error: erroPlacar } = await supabase
    .from(TAB_LOTES)
    .update({ novas, duplicadas })
    .eq('id', lote.id)

  if (erroPlacar) throw erroPlacar

  return {
    loteId: lote.id,
    arquivo: params.arquivo,
    origem: params.origem,
    total: params.tarefas.length,
    novas,
    duplicadas,
    prazo: params.prazo,
    responsavelPadrao: params.responsavelPadrao?.nome ?? null,
  }
}

/** Quantas tarefas o lote gerou e quantas já foram respondidas. */
export async function resumoDoLote(loteId: string): Promise<{ total: number; respondidas: number }> {
  const { data, error } = await supabase
    .from(TAB_TAREFAS)
    .select('status, observacao_correcao')
    .eq('lote_id', loteId)

  if (error) throw error

  const linhas = data ?? []
  return {
    total: linhas.length,
    respondidas: linhas.filter(
      (l) => l.status !== 'pendente' || (l.observacao_correcao ?? '').trim() !== '',
    ).length,
  }
}

/**
 * Apaga uma importação e as tarefas que ela gerou.
 *
 * As tarefas vão primeiro de propósito: a coluna lote_id é "on delete set
 * null", então apagar só o lote deixaria as tarefas órfãs e invisíveis para
 * qualquer exclusão futura.
 */
export async function excluirLote(loteId: string): Promise<void> {
  const { error: erroTarefas } = await supabase.from(TAB_TAREFAS).delete().eq('lote_id', loteId)
  if (erroTarefas) throw erroTarefas

  const { error: erroLote } = await supabase.from(TAB_LOTES).delete().eq('id', loteId)
  if (erroLote) throw erroLote
}

/** Apaga uma única tarefa da matriz. */
export async function excluirTarefa(id: string): Promise<void> {
  const { error } = await supabase.from(TAB_TAREFAS).delete().eq('id', id)
  if (error) throw error
}

/** Grava a resposta do time para uma tarefa da matriz. */
export async function salvarResposta(entrada: {
  id: string
  status: StatusTarefa
  responsavelId: string | null
  responsavelNome: string | null
  observacao: string | null
  motivo: string | null
  usuario: string
}): Promise<TarefaFiscal> {
  const concluindo = estaFinalizada(entrada.status)

  const patch: Record<string, unknown> = {
    status: entrada.status,
    responsavel_id: entrada.responsavelId,
    responsavel_nome: entrada.responsavelNome,
    observacao_correcao: entrada.observacao,
    // O motivo descreve por que a tarefa está parada; encerrada, ele deixa de
    // valer e some junto para não confundir quem revisar depois.
    motivo_andamento: entrada.status === 'em_andamento' ? entrada.motivo : null,
    // Reabrir limpa o carimbo para o indicador de atraso não contar uma
    // conclusão que deixou de existir.
    concluido_em: concluindo ? new Date().toISOString() : null,
    concluido_por: concluindo ? entrada.usuario : null,
  }

  const { data, error } = await supabase
    .from(TAB_TAREFAS)
    .update(patch)
    .eq('id', entrada.id)
    .select(CAMPOS)
    .single()

  if (error) throw error
  return mapear(data as unknown as LinhaTarefa)
}

/** Mensagem curta e acionável para os erros mais comuns de Supabase/RLS. */
export function descreverErro(erro: unknown): string {
  const e = erro as { code?: string; message?: string; details?: string }

  if (e?.code === '42P01') {
    return 'As tabelas da Validação Fiscal não existem ainda. Rode docs/validacao-fiscal-schema.sql no editor SQL do Supabase.'
  }
  if (e?.code === '42501' || /row-level security/i.test(e?.message ?? '')) {
    return 'Sem permissão para esta ação. Importar planilha é restrito a administradores.'
  }
  if (e?.code === '23505') {
    return 'Essa linha já foi importada antes.'
  }
  return e?.message || 'Falha ao falar com o banco.'
}
