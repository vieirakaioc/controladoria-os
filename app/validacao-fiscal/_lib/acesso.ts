import type { Fluxo } from './types'

/**
 * Configuração de pessoas da Validação Fiscal.
 *
 * Entrada e saída são duas operações diferentes, com times diferentes: quem
 * cuida da escrita fiscal não responde nota emitida, e vice-versa. Por isso
 * cada fluxo tem o seu dono e a sua lista de e-mail.
 */

/** Quem fica com as tarefas de cada fluxo quando a planilha é importada. */
export const EMAIL_RESPONSAVEL: Record<Fluxo, string> = {
  saida: 'fernando.carvalho@comber.com.br',
  entrada: 'erica.araujo@comber.com.br',
}

/** Mantido para quem já importava antes de existir a separação por fluxo. */
export const EMAIL_RESPONSAVEL_PADRAO = EMAIL_RESPONSAVEL.saida

/** Recebem o resumo diário de cada fluxo, toda manhã de dia útil. */
export const EMAILS_RESUMO: Record<Fluxo, string[]> = {
  saida: [
    'fernando.carvalho@comber.com.br',
    'josi@comber.com.br',
    'kaio.vieira@comber.com.br',
    'fransley.batista@comber.com.br',
    'gabriely.alves@comber.com.br',
    'geraldo.modesto@comber.com.br',
    'fabiana.santos@comber.com.br',
    'marcus.nunes@comber.com.br',
  ],
  entrada: [
    'josi@comber.com.br',
    'kaio.vieira@comber.com.br',
    'fransley.batista@comber.com.br',
    'gabriely.alves@comber.com.br',
    'erica.araujo@comber.com.br',
  ],
}
