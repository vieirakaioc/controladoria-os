import { diasEntre, hoje as dataDeHoje } from '@/app/validacao-fiscal/_lib/prazo'

import type { Item } from './types'

/**
 * Os dois agings do imobilizado.
 *
 * São perguntas diferentes e não podem virar um número só:
 *
 *   • processo — do cadastro do item até a baixa. Mede o fluxo inteiro.
 *   • placa    — do ATPV até o cadastro da placa. Só frota, corre por fora, e
 *                pode continuar aberto depois de o item ser finalizado.
 *
 * Um aging "aberto" conta até hoje; fechado, para na data final.
 */

export type Aging = {
  dias: number
  /** Ainda correndo: a data final não chegou. */
  aberto: boolean
}

function contar(inicio: string | null, fim: string | null, referencia: string): Aging | null {
  if (!inicio) return null
  const aberto = !fim
  return { dias: Math.max(diasEntre(inicio.slice(0, 10), (fim ?? referencia).slice(0, 10)), 0), aberto }
}

export function agingProcesso(item: Item, referencia: string = dataDeHoje()): Aging | null {
  return contar(item.criadoEm, item.baixaEm, referencia)
}

/** Só existe para frota, e só depois de o ATPV entrar. */
export function agingPlaca(item: Item, referencia: string = dataDeHoje()): Aging | null {
  if (!item.ehFrota) return null
  return contar(item.atpvEm, item.placaEm, referencia)
}

export function textoAging(aging: Aging | null): string {
  if (!aging) return '—'
  const dias = `${aging.dias} ${aging.dias === 1 ? 'dia' : 'dias'}`
  return aging.aberto ? `${dias} (correndo)` : dias
}
