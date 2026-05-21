import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Durante o build estático (e em qualquer execução server-side), Next pode
// avaliar este módulo em contextos onde as env vars ainda não foram resolvidas
// (ex: prerender de /_not-found no Vercel). Em vez de derrubar o build, logamos
// um aviso e seguimos com placeholders — assim as páginas estáticas geram, e
// qualquer chamada REAL à API do Supabase falha com mensagem clara em runtime.
if (!supabaseUrl || !supabaseAnonKey) {
  const msg = 'Missing Supabase env vars. Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no .env.local (dev) ou nas Environment Variables do Vercel (produção).'
  if (typeof window !== 'undefined') {
    // No navegador isso vira erro visível na devtools — útil em produção
    // porque significa que o build NÃO inlinou as env vars.
    console.error('[supabase] ' + msg)
  } else {
    // Server-side (build/SSR): só warning, não throw.
    console.warn('[supabase] ' + msg)
  }
}

export const supabase = createClient(
  supabaseUrl || 'http://placeholder.invalid',
  supabaseAnonKey || 'placeholder',
  {
    auth: {
      // localStorage = sessão persiste entre fechar/abrir o navegador.
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  },
)
