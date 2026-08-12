/**
 * Quem enxerga a Validação Fiscal.
 *
 * O módulo é restrito: não é trabalho da equipe inteira, e as planilhas trazem
 * valor e emitente de documento por documento. Esta lista existe em dois
 * lugares de propósito — aqui, para a tela não oferecer o que a pessoa não
 * pode abrir, e em `public.vf_pode_ver()` (docs/validacao-fiscal-schema.sql),
 * que é quem de fato barra a leitura no banco. Mudou aqui, muda lá.
 */

/** Recebe as tarefas por padrão quando uma planilha é importada. */
export const EMAIL_RESPONSAVEL_PADRAO = 'fernando.carvalho@comber.com.br'

/** E-mails com acesso ao módulo, além de qualquer admin. */
export const EMAILS_COM_ACESSO: string[] = [EMAIL_RESPONSAVEL_PADRAO]

export function podeVerValidacaoFiscal(papel: string, email: string): boolean {
  if (papel === 'admin') return true
  return EMAILS_COM_ACESSO.includes(email.trim().toLowerCase())
}
