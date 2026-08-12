'use client'

import * as XLSX from 'xlsx'

import { LAYOUTS, type LayoutPlanilha } from './planilhas'
import type { Origem } from './types'

/**
 * Modelo em branco de cada planilha aceita.
 *
 * Existe para acabar com o ciclo de "exportei diferente, não importou": quem
 * preenche o modelo tem, por construção, os cabeçalhos que a importação
 * procura. O arquivo sai com uma linha de exemplo comentada abaixo do
 * cabeçalho? Não — linha de exemplo viraria tarefa. Só o cabeçalho.
 */

/** Larguras aproximadas para o arquivo abrir legível, não em colunas coladas. */
function largura(coluna: string): number {
  return Math.min(Math.max(coluna.length + 4, 12), 42)
}

export function baixarModelo(origem: Origem): void {
  const layout = LAYOUTS.find((l) => l.origem === origem)
  if (!layout) return

  const planilha = XLSX.utils.aoa_to_sheet([layout.colunasMatriz])
  planilha['!cols'] = layout.colunasMatriz.map((coluna) => ({ wch: largura(coluna) }))

  const arquivo = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(arquivo, planilha, nomeDaAba(layout))

  XLSX.writeFile(arquivo, `modelo-${origem.replace(/_/g, '-')}.xlsx`)
}

/** Nome de aba do Excel: sem os caracteres proibidos e no limite de 31. */
function nomeDaAba(layout: LayoutPlanilha): string {
  return layout.rotulo.replace(/[\\/?*[\]:]/g, '-').slice(0, 31)
}
