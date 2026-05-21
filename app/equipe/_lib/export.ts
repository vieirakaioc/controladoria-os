// Helpers de export do Monitor da Equipe (PDF + Excel).
// PDF usa html-to-image + jsPDF (igual ao /dashboard).
// Excel usa SheetJS (xlsx) com múltiplas abas.

import { toPng } from 'html-to-image'
import jsPDF from 'jspdf'
import * as XLSX from 'xlsx'
import type { ColaboradorRow } from '../_hooks/useEquipeData'
import type { DestaqueSemanal } from '../_hooks/useDestaqueSemana'
import type { HistoricoMes, LinhaHistorico } from '../_hooks/useHistoricoScore'

// ─── PDF ─────────────────────────────────────────────────────────────────
export async function exportEquipePDF(opts: {
  elementId: string
  filename: string
  isDark: boolean
}) {
  const input = document.getElementById(opts.elementId)
  if (!input) throw new Error('Elemento da página não encontrado.')

  const imgData = await toPng(input, {
    quality: 1,
    pixelRatio: 2,
    backgroundColor: opts.isDark ? '#0a0a0a' : '#f8fafc',
  })

  const pdfWidth = input.offsetWidth
  const pdfHeight = input.offsetHeight

  const pdf = new jsPDF({
    orientation: pdfWidth > pdfHeight ? 'l' : 'p',
    unit: 'px',
    format: [pdfWidth, pdfHeight],
  })

  pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)
  pdf.save(opts.filename)
}

// ─── Excel ───────────────────────────────────────────────────────────────
export function exportEquipeXLSX(opts: {
  filename: string
  mesLabel: string
  colaboradoresMes: ColaboradorRow[]
  destaqueSemana: { top: DestaqueSemanal[]; semanaLabel: string }
  historico: { linhas: LinhaHistorico[]; meses: HistoricoMes[] } | null
}) {
  const workbook = XLSX.utils.book_new()

  // ─── Aba 1: Mensal (detalhado) ─────────────────────────────────────────
  const linhasMensal = opts.colaboradoresMes.map(c => {
    const pctConcl = c.metrics.totalAtribuidas === 0
      ? 0
      : Math.round((c.metrics.concluidas / c.metrics.totalAtribuidas) * 100)
    return {
      'Colaborador': c.nome,
      'E-mail': c.email || '',
      'Tarefas Atribuídas': c.metrics.totalAtribuidas,
      'Concluídas': c.metrics.concluidas,
      '% Conclusão': pctConcl,
      'Concluídas no Prazo': c.metrics.concluidasNoPrazo,
      '% No Prazo': c.score.pontualidade,
      'Atrasadas': c.metrics.atrasadas,
      'Dias Ativos': c.metrics.diasUteisAtivos,
      'Dias Úteis do Mês': c.metrics.diasUteisPeriodo,
      'Score': c.score.total,
      'Score - Conclusão': c.score.conclusao,
      'Score - Volume': c.score.volume,
      'Score - Pontualidade': c.score.pontualidade,
      'Score - Aderência': c.score.aderencia,
      'Score - Uso': c.score.uso,
      'Último Acesso': c.lastActivity ? new Date(c.lastActivity).toLocaleString('pt-BR') : '—',
    }
  })
  const wsMensal = XLSX.utils.json_to_sheet(linhasMensal)
  XLSX.utils.book_append_sheet(workbook, wsMensal, `Mensal_${opts.mesLabel.replace(/[^\w]/g, '_')}`)

  // ─── Aba 2: Destaque da Semana ─────────────────────────────────────────
  const linhasDestaque = opts.destaqueSemana.top.map(d => ({
    'Posição': d.posicao,
    'Colaborador': d.nome,
    'E-mail': d.email || '',
    'Score': d.score.total,
    'Concluídas': d.metrics.concluidas,
    '% No Prazo': d.score.pontualidade,
    'Semana': opts.destaqueSemana.semanaLabel,
  }))
  if (linhasDestaque.length > 0) {
    const wsDestaque = XLSX.utils.json_to_sheet(linhasDestaque)
    XLSX.utils.book_append_sheet(workbook, wsDestaque, 'Destaque_Semana')
  }

  // ─── Aba 3: Histórico (se carregado) ───────────────────────────────────
  if (opts.historico && opts.historico.linhas.length > 0) {
    const linhasHistorico = opts.historico.linhas.map(linha => {
      const row: Record<string, string | number> = {
        'Colaborador': linha.nome,
        'E-mail': linha.email || '',
      }
      opts.historico!.meses.forEach((m, i) => {
        row[m.label] = linha.scores[i]?.total ?? ''
      })
      // Tendência: comparar último com penúltimo
      const ult = linha.scores[linha.scores.length - 1]?.total
      const pen = linha.scores[linha.scores.length - 2]?.total
      row['Tendência'] = (ult != null && pen != null) ? (ult - pen) : ''
      return row
    })
    const wsHistorico = XLSX.utils.json_to_sheet(linhasHistorico)
    XLSX.utils.book_append_sheet(workbook, wsHistorico, 'Historico_6_Meses')
  }

  XLSX.writeFile(workbook, opts.filename)
}
