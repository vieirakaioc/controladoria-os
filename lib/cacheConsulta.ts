/**
 * Guarda em memória o resultado de consultas de referência.
 *
 * Setores, responsáveis, classificações, projetos e perfis quase não mudam
 * durante o expediente, mas eram rebuscados toda vez que uma tela montava. No
 * portal cada ida ao Supabase custa 220 a 250 ms só de latência — mesmo uma
 * resposta de 900 bytes —, então cinco listas por tela viravam mais de um
 * segundo gasto em dado que já estava na mão um minuto antes.
 *
 * O cache vive no módulo: morre quando a aba é recarregada, e sobrevive à
 * navegação entre telas, que é exatamente o caso que se quer cobrir.
 *
 * A promessa é guardada, e não só o valor: duas telas pedindo a mesma lista no
 * mesmo instante compartilham uma requisição em vez de disparar duas.
 */

type Entrada = { emCache: Promise<unknown>; expiraEm: number }

const cache = new Map<string, Entrada>()

/** Dois minutos: curto o bastante para um cadastro novo aparecer sozinho. */
const VALIDADE_PADRAO = 120_000

// `buscar` devolve `PromiseLike`, e não `Promise`: o construtor de consultas do
// Supabase não é uma promessa de verdade, e com `Promise<T>` o TypeScript
// inferia o próprio construtor como resultado em vez da resposta dele.
export async function comCache<T>(
  chave: string,
  buscar: () => PromiseLike<T>,
  validadeMs: number = VALIDADE_PADRAO,
): Promise<T> {
  const agora = Date.now()
  const atual = cache.get(chave)

  if (atual && atual.expiraEm > agora) return atual.emCache as Promise<T>

  const emCache = Promise.resolve(buscar()).catch((erro) => {
    // Falha não fica guardada: a próxima tela tenta de novo em vez de herdar
    // o erro pelos dois minutos seguintes.
    cache.delete(chave)
    throw erro
  })

  cache.set(chave, { emCache, expiraEm: agora + validadeMs })
  return emCache
}

/**
 * Esquece o que está guardado.
 *
 * Sem argumento limpa tudo. Com um prefixo, limpa só o que começa com ele —
 * é o que a sincronização da planilha usa para o cadastro novo aparecer sem
 * esperar os dois minutos.
 */
export function limparCache(prefixo?: string): void {
  if (!prefixo) {
    cache.clear()
    return
  }
  for (const chave of cache.keys()) {
    if (chave.startsWith(prefixo)) cache.delete(chave)
  }
}
