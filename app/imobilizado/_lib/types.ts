/**
 * Modelo do fluxo de imobilizado.
 *
 * O desenho do processo (quais etapas, prazo, quem responde) vive no banco, em
 * `imobilizado_modelo_etapas`. O que está aqui são os tipos de leitura — nada
 * de regra de processo chumbada no código.
 */

export type StatusItem = 'em_andamento' | 'finalizado' | 'cancelado'

/** `bloqueada` = a etapa anterior ainda não terminou. Só `aberta` aceita conclusão. */
export type StatusEtapa = 'bloqueada' | 'aberta' | 'concluida' | 'dispensada'

export type TipoParticipante = 'participante' | 'observador'

/** O que o login atual pode fazer no módulo. `null` = não participa. */
export type Acesso = 'admin' | 'participante' | 'observador' | null

export type ModeloEtapa = {
  chave: string
  ordem: number
  titulo: string
  descricao: string
  area: string
  soFrota: boolean
  paralela: boolean
  exigeAnexo: boolean
  /** Campo do item que precisa estar preenchido para concluir (ex.: oc_numero). */
  exigeCampo: string | null
  prazoDiasUteis: number
  responsavelId: string | null
  ativo: boolean
}

export type Etapa = {
  id: string
  itemId: string
  chave: string
  ordem: number
  titulo: string
  area: string
  paralela: boolean
  exigeAnexo: boolean
  exigeCampo: string | null
  status: StatusEtapa
  responsavelId: string | null
  responsavelNome: string | null
  /** YYYY-MM-DD */
  prazo: string | null
  abertaEm: string | null
  concluidaEm: string | null
  concluidaPor: string | null
  observacao: string | null
}

export type Anexo = {
  id: string
  itemId: string
  etapaId: string | null
  etapaChave: string | null
  nome: string
  caminho: string
  url: string
  tipo: string | null
  tamanho: number | null
  enviadoPor: string | null
  enviadoEm: string
}

export type Item = {
  id: string
  numero: number
  nfNumero: string
  nfChave: string | null
  fornecedor: string
  descricao: string
  valor: number | null
  filialId: string | null
  empresa: string
  filial: string
  ehFrota: boolean
  centroCusto: string | null
  placa: string | null
  ocNumero: string | null
  /** Prefixo da pasta no Storage. */
  pasta: string
  /** YYYY-MM-DD — extremos dos dois agings. */
  atpvEm: string | null
  placaEm: string | null
  baixaEm: string | null
  status: StatusItem
  criadoPor: string | null
  criadoEm: string
  finalizadoEm: string | null
  etapas: Etapa[]
}

export type Filial = {
  id: string
  codEmpresa: string
  empresa: string
  codFilial: string
  filial: string
  cnpj: string | null
  ativo: boolean
}

/** "1 · COMBER LOGISTICA · 6 · Filial 6" — o rótulo do seletor. */
export function rotuloFilial(f: Filial): string {
  return `${f.empresa} · ${f.codFilial} ${f.filial}`
}

export type Participante = {
  id: number
  responsavelId: string
  nome: string
  email: string | null
  papel: string
  tipo: TipoParticipante
  ativo: boolean
}

export const ROTULO_STATUS_ITEM: Record<StatusItem, string> = {
  em_andamento: 'Em andamento',
  finalizado: 'Finalizado',
  cancelado: 'Cancelado',
}

export const ROTULO_STATUS_ETAPA: Record<StatusEtapa, string> = {
  bloqueada: 'Aguardando a anterior',
  aberta: 'Em aberto',
  concluida: 'Concluída',
  dispensada: 'Não se aplica',
}

/** Campos do item que uma etapa pode exigir preenchidos, e como chamá-los na tela. */
export const ROTULO_CAMPO: Record<string, string> = {
  oc_numero: 'Número da OC',
  placa: 'Placa',
  centro_custo: 'Centro de custo',
}

export function podeAgir(acesso: Acesso): boolean {
  return acesso === 'admin' || acesso === 'participante'
}
