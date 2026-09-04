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
  /**
   * De onde o prazo conta. `null` = de quando a própria etapa abre.
   *
   * Com uma chave aqui, a contagem começa na conclusão daquela outra etapa: o
   * ATPV é cobrado a partir do centro de custo, não de quando chega a vez dele
   * na fila, e a placa a partir do ATPV.
   */
  prazoAPartirDe: string | null
  prazoDiasUteis: number
  responsavelId: string | null
  /** Oferece o botão de enviar para aprovação — hoje, só a ordem de compra. */
  enviaAprovacao: boolean
  /** Para quem vai o aviso de aprovação pendente. */
  aprovadorEmail: string | null
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
  /** Etapa cuja conclusão dispara a contagem do prazo desta. */
  prazoAPartirDe: string | null
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
  /** Só de frota: identifica o veículo antes de haver placa. */
  chassi: string | null
  ocNumero: string | null
  /**
   * Desde quando o item está parado esperando terceiro (YYYY-MM-DD).
   *
   * Enquanto tem data aqui, prazo de etapa aberta não conta atraso: a espera
   * não é de quem está com a etapa.
   */
  esperaDesde: string | null
  esperaMotivo: string | null
  /** Chave da etapa que originou a espera. */
  esperaEtapa: string | null
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
  /** Perfil de login. É por ele que a RLS reconhece a pessoa. */
  profileId: string | null
  nome: string
  email: string | null
  papel: string
  tipo: TipoParticipante
  ativo: boolean
}

/** Pessoa com login no portal — a fonte da lista de participantes. */
export type Pessoa = {
  id: string
  nome: string
  email: string | null
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

/** Item parado esperando terceiro: o prazo das etapas abertas fica suspenso. */
export function emEspera(item: Item): boolean {
  return Boolean(item.esperaDesde)
}

/**
 * A etapa passou do prazo?
 *
 * Uma função só, usada por fila, quadro, matriz e ficha. Espalhar
 * `prazo < hoje` por quatro telas é o jeito garantido de a espera valer numa e
 * não valer na outra — e aí a pessoa vê a mesma etapa vermelha aqui e cinza
 * ali, sem entender qual das duas mente.
 */
export function etapaAtrasada(item: Item, etapa: Etapa, hoje: string): boolean {
  if (emEspera(item)) return false
  return etapa.status === 'aberta' && etapa.prazo !== null && etapa.prazo < hoje
}

/** Alguma etapa aberta passou do prazo. */
export function itemAtrasado(item: Item, hoje: string): boolean {
  return item.etapas.some((e) => etapaAtrasada(item, e, hoje))
}
