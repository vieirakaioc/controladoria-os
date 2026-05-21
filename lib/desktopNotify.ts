// =============================================================================
// Notificações desktop do navegador (Notification API).
//
// LIMITAÇÃO: só funciona se o navegador estiver aberto (mesmo que tab oculta).
// Não é WebPush — não funciona com app fechado.
//
// Por que assim: WebPush requer Service Worker + VAPID keys + servidor próprio
// de push. Pra esse caso (admin já passa o dia no portal), a versão in-page
// resolve 90% do valor com 0 infra.
// =============================================================================

/** Estado da permissão. 'default' = nunca foi perguntada ainda. */
export function permissaoNotificacoes(): NotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'denied'
  return Notification.permission
}

/**
 * Pede permissão pra mostrar notificações. Idempotente — não pergunta duas
 * vezes se já foi respondida (granted ou denied).
 */
export async function pedirPermissaoNotificacoes(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'denied'
  if (Notification.permission !== 'default') return Notification.permission
  try {
    return await Notification.requestPermission()
  } catch {
    return 'denied'
  }
}

type Opcoes = {
  titulo: string
  corpo: string
  /** URL pra abrir ao clicar (opcional). */
  url?: string
  /** Mesmo identificador → substitui notificação anterior em vez de empilhar. */
  tag?: string
}

/**
 * Mostra a notificação desktop. Silencioso se:
 *   - Não tem permissão
 *   - Tab está em foco (não atrapalha quem está olhando o app)
 *   - Navegador não suporta
 */
export function notificarDesktop({ titulo, corpo, url, tag }: Opcoes) {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission !== 'granted') return
  // Não notifica se o usuário JÁ está olhando o app
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') return

  try {
    const n = new Notification(titulo, {
      body: corpo,
      tag: tag || 'portal-controladoria',
      icon: '/favicon.ico',
      badge: '/favicon.ico',
    })
    if (url) {
      n.onclick = () => {
        window.focus()
        window.location.href = url
        n.close()
      }
    }
    // Auto-fecha após 8s pra não acumular
    setTimeout(() => n.close(), 8000)
  } catch {
    // Algumas combinações de browser/contexto bloqueiam — falha silenciosa
  }
}
