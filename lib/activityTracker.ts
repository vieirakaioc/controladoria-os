// =============================================================================
// Activity Tracker — registra eventos no Supabase (tabela user_activity).
//
// Uso típico:
//   import { trackEvent, trackSession, trackPageView } from '@/lib/activityTracker'
//
//   await trackSession()                 // após login
//   await trackPageView('/tarefas')      // ao mudar de rota
//   await trackEvent('task_completed', { task_id: 'xyz' })
//
// Falha silenciosamente — nunca quebra o fluxo do usuário. Se o Supabase estiver
// fora, o evento simplesmente é descartado.
// =============================================================================

import { supabase } from './supabase'

export type ActivityEventType =
  | 'session_start'
  | 'page_view'
  | 'task_completed'
  | 'task_created'
  | 'task_status_changed'
  | 'task_deleted'
  | 'comment_sent'
  | 'sync_run'
  | (string & {})   // permite extensão sem perder autocompletar

const SESSION_TRACK_KEY = 'activity_session_tracked_today'

/**
 * Registra um evento livre na tabela user_activity.
 * Erros são logados no console mas não propagam.
 */
export async function trackEvent(
  eventType: ActivityEventType,
  eventData?: Record<string, unknown>,
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('user_activity').insert({
      user_id: user.id,
      user_email: user.email,
      event_type: eventType,
      event_data: eventData || null,
    })
  } catch (err) {
    // Silencioso por design — não quebra a UX se o tracking falhar
    if (typeof console !== 'undefined') console.warn('[activityTracker] falhou:', err)
  }
}

/**
 * Registra um session_start. Garante no máximo um por usuário por dia
 * (pra não inflar a tabela em cada page reload).
 */
export async function trackSession(): Promise<void> {
  if (typeof window === 'undefined') return
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const hoje = new Date().toISOString().slice(0, 10)
    const cacheKey = `${SESSION_TRACK_KEY}_${user.id}_${hoje}`
    if (localStorage.getItem(cacheKey)) return

    await trackEvent('session_start', {
      ts: new Date().toISOString(),
      user_agent: navigator.userAgent.slice(0, 200),
    })
    localStorage.setItem(cacheKey, '1')
  } catch (err) {
    if (typeof console !== 'undefined') console.warn('[activityTracker] session falhou:', err)
  }
}

/**
 * Registra uma navegação. Throttle simples pra não inflar com page reloads
 * — só registra se a página mudou em relação ao último page_view.
 */
let lastPageTracked: string | null = null
export async function trackPageView(path: string): Promise<void> {
  if (!path || path === lastPageTracked) return
  lastPageTracked = path
  await trackEvent('page_view', { page: path })
}
