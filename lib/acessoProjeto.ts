/**
 * Quem vê o quê, agora que o portal atende dois públicos.
 *
 * A controladoria usa o portal inteiro. A implantação do Sankhya usa duas
 * telas — dashboard e controle de tarefas — e só com as atividades do projeto.
 *
 * As regras vivem todas aqui porque elas aparecem em lugares que não se falam:
 * o menu lateral, a lista de tarefas e o dashboard. Espalhar a condição pelos
 * três é o jeito garantido de o menu esconder uma tela que a consulta ainda
 * traz, ou de o dashboard somar atividade que a lista não mostra.
 *
 * A identidade da atividade não mudou: atividade com `projeto_id` é atividade
 * de projeto, sem `projeto_id` é rotina de controladoria. Nada novo para
 * preencher em lugar nenhum.
 */

import { getResponsaveis, type ResponsavelLite } from './responsaveis'

export type Escopo = 'projeto' | 'controladoria' | 'ambos'

/** Admin da implantação: vê todas as atividades do projeto, e nada além. */
export const ROLE_ADMIN_PROJETO = 'admin_projeto'

export const ROTULO_ESCOPO: Record<Escopo, string> = {
  controladoria: 'Controladoria',
  projeto: 'Projeto (Sankhya)',
  ambos: 'Controladoria e projeto',
}

/** O que o portal precisa saber sobre quem está logado. */
export type Perfil = {
  escopo: Escopo
  role: string
  email: string
  nome: string
}

export function normalizarEscopo(valor: string | null | undefined): Escopo {
  return valor === 'projeto' || valor === 'ambos' ? valor : 'controladoria'
}

/** Admin do portal: continua vendo tudo, como antes. */
export function ehAdminDoPortal(perfil: Perfil): boolean {
  return perfil.role === 'admin'
}

/**
 * Enxerga apenas o projeto.
 *
 * O admin do portal fica de fora mesmo se estiver marcado como projeto: quem
 * administra o portal não pode perder acesso ao portal por causa de uma marca
 * de escopo.
 */
export function soDoProjeto(perfil: Perfil): boolean {
  return perfil.escopo === 'projeto' && !ehAdminDoPortal(perfil)
}

/** Vê as atividades de projeto de todo mundo, e não só as suas. */
export function veTodoOProjeto(perfil: Perfil): boolean {
  return perfil.role === ROLE_ADMIN_PROJETO || ehAdminDoPortal(perfil)
}

/** As telas que quem é só do projeto usa. As outras não aparecem no menu. */
export const TELAS_DO_PROJETO = ['/dashboard', '/tarefas', '/ajuda', '/profile']

export function podeVerTela(perfil: Perfil, href: string): boolean {
  if (!soDoProjeto(perfil)) return true
  return TELAS_DO_PROJETO.includes(href)
}

/* ───────────────────────── filtro das atividades ───────────────────────── */

/**
 * O formato mínimo em que as telas trazem a atividade da tarefa.
 *
 * `any` porque é o que as consultas já devolvem em tarefas, dashboard e
 * projetos — e `getResponsaveis`, que é o leitor oficial de responsável do
 * app, também recebe assim. Tipar aqui um formato mais estreito só obrigaria
 * cada chamador a converter.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AtividadeParcial = any

function mesmaPessoa(pessoa: ResponsavelLite, perfil: Perfil): boolean {
  const email = (pessoa.email ?? '').trim().toLowerCase()
  if (email && perfil.email) return email === perfil.email.trim().toLowerCase()

  // Sem e-mail no cadastro da atividade, sobra o nome. É comparação frágil e
  // fica como reserva justamente por isso: o certo é o e-mail estar lá.
  const nome = (pessoa.nome ?? '').trim().toLowerCase()
  return Boolean(nome) && nome === perfil.nome.trim().toLowerCase()
}

export function ehDoProjeto(atividade: AtividadeParcial): boolean {
  const id = atividade?.projeto_id
  return id !== null && id !== undefined && id !== ''
}

/**
 * Esta atividade pode aparecer para esta pessoa?
 *
 * Uma função só para lista e dashboard. Para quem não é do projeto nada muda —
 * devolve `true` e as telas seguem como sempre foram.
 */
export function podeVerAtividade(perfil: Perfil, atividade: AtividadeParcial): boolean {
  if (!soDoProjeto(perfil)) return true

  // Fora do projeto não existe para quem é só do projeto, nem para o admin da
  // implantação: o escopo dele é a implantação, não o portal.
  if (!ehDoProjeto(atividade)) return false

  if (veTodoOProjeto(perfil)) return true

  return getResponsaveis(atividade).some((pessoa) => mesmaPessoa(pessoa, perfil))
}
