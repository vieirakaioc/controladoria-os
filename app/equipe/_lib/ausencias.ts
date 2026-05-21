// Helpers de ausência (modo férias).

export type Ausencia = {
  id: string
  responsavel_id: string
  data_inicio: string   // 'YYYY-MM-DD'
  data_fim: string      // 'YYYY-MM-DD'
  motivo: string | null
  observacao: string | null
  created_at: string
}

/**
 * Map<responsavel_id, Ausencia[]> — pra lookup rápido na agregação.
 */
export type AusenciasByResp = Map<string, Ausencia[]>

export function indexAusencias(ausencias: Ausencia[]): AusenciasByResp {
  const map: AusenciasByResp = new Map()
  for (const a of ausencias) {
    if (!map.has(a.responsavel_id)) map.set(a.responsavel_id, [])
    map.get(a.responsavel_id)!.push(a)
  }
  return map
}

/**
 * Retorna true se a data (string ISO yyyy-mm-dd) cai dentro de ALGUMA ausência
 * do responsável.
 */
export function ausente(respId: string, dataIso: string, idx: AusenciasByResp): boolean {
  const lista = idx.get(respId)
  if (!lista || lista.length === 0) return false
  return lista.some(a => dataIso >= a.data_inicio && dataIso <= a.data_fim)
}

/**
 * Conta quantos dias úteis (seg-sex) dentro de um intervalo [inicio, fim)
 * a pessoa estava ausente. Usado pra subtrair do denominador de "Uso do App".
 */
export function diasUteisAusentes(
  respId: string,
  inicio: Date,
  fim: Date,
  idx: AusenciasByResp,
): number {
  const lista = idx.get(respId)
  if (!lista || lista.length === 0) return 0
  let count = 0
  const cur = new Date(inicio)
  while (cur < fim) {
    const dow = cur.getDay()
    if (dow !== 0 && dow !== 6) {
      const iso = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`
      if (lista.some(a => iso >= a.data_inicio && iso <= a.data_fim)) count++
    }
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

/**
 * Retorna a ausência ATUAL (que contém hoje) de um responsável, ou null.
 */
export function ausenciaHoje(respId: string, idx: AusenciasByResp): Ausencia | null {
  const lista = idx.get(respId)
  if (!lista || lista.length === 0) return null
  const hoje = new Date()
  const hojeIso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`
  return lista.find(a => hojeIso >= a.data_inicio && hojeIso <= a.data_fim) || null
}
