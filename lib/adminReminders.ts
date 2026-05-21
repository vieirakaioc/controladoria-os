// =============================================================================
// Avisos automáticos pro admin (rodam client-side, 1x/dia, com cache local).
//
// Filosofia: o app é usado todo dia útil pelo admin. Em vez de montar cron
// server-side (precisa hospedagem específica), os checks rodam no useEffect
// do Sidebar quando o admin abre o app. localStorage garante 1x por dia.
// =============================================================================

import { supabase } from './supabase'

const CACHE_PREFIX = 'admin_reminder_'

function jaRodouHoje(chave: string, userId: string): boolean {
  if (typeof localStorage === 'undefined') return true
  const hoje = new Date().toISOString().slice(0, 10)
  const cacheKey = `${CACHE_PREFIX}${chave}_${userId}_${hoje}`
  return localStorage.getItem(cacheKey) !== null
}

function marcarRodadoHoje(chave: string, userId: string) {
  if (typeof localStorage === 'undefined') return
  const hoje = new Date().toISOString().slice(0, 10)
  const cacheKey = `${CACHE_PREFIX}${chave}_${userId}_${hoje}`
  localStorage.setItem(cacheKey, '1')
}

/**
 * Avisa o admin sobre colaboradores que voltam de férias AMANHÃ.
 * Roda 1x/dia. Não dispara nada se ninguém volta.
 */
export async function checarRetornoAmanha(adminUserId: string, adminEmail: string, adminNome: string) {
  if (jaRodouHoje('retorno_amanha', adminUserId)) return
  try {
    const hoje = new Date()
    const hojeIso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`

    // Quem tem data_fim = hoje → volta amanhã
    const { data } = await supabase
      .from('ausencias')
      .select('data_inicio, data_fim, motivo, responsaveis(nome, email)')
      .eq('data_fim', hojeIso)

    if (!data || data.length === 0) {
      marcarRodadoHoje('retorno_amanha', adminUserId)
      return
    }

    const linhas = data.map((a: any) => {
      const nome = a.responsaveis?.nome || 'Colaborador'
      const motivo = a.motivo || 'ausência'
      return `<li><strong>${nome}</strong> volta amanhã (${motivo} de ${formataBR(a.data_inicio)} a ${formataBR(a.data_fim)})</li>`
    }).join('')

    await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: adminEmail,
        subject: `[Portal] ${data.length} colaborador(es) retorna(m) amanhã`,
        taskName: 'Retorno de Ausência',
        action: 'retornam de férias amanhã',
        userName: adminNome,
        observacoes: `Olá ${adminNome}, os seguintes colaboradores voltam amanhã ao trabalho:<br/><br/><ul>${linhas}</ul><br/>A partir de amanhã, as tarefas dentro do período voltam a contar no score deles.`,
      }),
    })

    marcarRodadoHoje('retorno_amanha', adminUserId)
  } catch (err) {
    if (typeof console !== 'undefined') console.warn('[adminReminders] retorno-amanhã falhou:', err)
  }
}

function formataBR(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}
