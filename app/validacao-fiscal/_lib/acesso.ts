/**
 * Configuração de pessoas da Validação Fiscal.
 *
 * O módulo é visível para toda a equipe: o acompanhamento é coletivo. O que
 * continua restrito a admin é importar planilha e apagar um lote inteiro,
 * decidido nas policies de RLS (docs/validacao-fiscal-schema.sql).
 */

/** Recebe as tarefas por padrão quando uma planilha é importada. */
export const EMAIL_RESPONSAVEL_PADRAO = 'fernando.carvalho@comber.com.br'

/** Recebem o resumo do painel toda manhã de dia útil. */
export const EMAILS_RESUMO_DIARIO: string[] = [
  'fernando.carvalho@comber.com.br',
  'josi@comber.com.br',
  'kaio.vieira@comber.com.br',
  'fransley.batista@comber.com.br',
  'gabriely.alves@comber.com.br',
  'geraldo.modesto@comber.com.br',
  'fabiana.santos@comber.com.br',
  'marcus.nunes@comber.com.br',
]
