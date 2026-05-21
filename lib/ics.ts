// =============================================================================
// Gerador de arquivo .ics (iCalendar) — Google Calendar / Outlook / iOS / etc.
// Cada tarefa vira um VEVENT all-day no dia do vencimento.
// =============================================================================

export type IcsTask = {
  id: string
  nome: string
  data_vencimento: string | null   // yyyy-mm-dd
  status?: string | null
  setor?: string | null
  responsavel?: string | null
  planner?: string | null
  observacoes?: string | null
  classificacao?: string | null
}

const PRODID = '-//Portal da Controladoria//Tarefas//PT-BR'

/** Escapa caracteres especiais do formato ICS (vírgulas, quebras de linha, etc). */
function escapeIcs(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '')
}

/** Formata yyyy-mm-dd → yyyymmdd (formato ICS DATE) */
function fmtDate(iso: string): string {
  return iso.slice(0, 10).replace(/-/g, '')
}

/** Timestamp UTC atual no formato ICS yyyymmddThhmmssZ */
function nowUtcStamp(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
}

/**
 * Constrói o arquivo .ics a partir de uma lista de tarefas.
 * Tarefas sem data_vencimento são ignoradas.
 */
export function tasksToIcs(tasks: IcsTask[], calendarName = 'Portal da Controladoria'): string {
  const dtstamp = nowUtcStamp()

  const events = tasks
    .filter(t => !!t.data_vencimento)
    .map(t => {
      const dtstart = fmtDate(t.data_vencimento!)
      // DTEND num all-day event é exclusive (dia seguinte ao DTSTART)
      const dataObj = new Date(t.data_vencimento!.slice(0, 10) + 'T00:00:00')
      dataObj.setDate(dataObj.getDate() + 1)
      const dtend = `${dataObj.getFullYear()}${String(dataObj.getMonth() + 1).padStart(2, '0')}${String(dataObj.getDate()).padStart(2, '0')}`

      const partes = [
        t.setor && `Setor: ${t.setor}`,
        t.responsavel && `Responsável: ${t.responsavel}`,
        t.planner && `Planner: ${t.planner}`,
        t.classificacao && `Classificação: ${t.classificacao}`,
        t.status && `Status: ${t.status}`,
        t.observacoes && `\n${t.observacoes}`,
      ].filter(Boolean).join(' · ')

      const titulo = (t.status || '').toLowerCase().includes('concl')
        ? `✅ ${t.nome}`
        : t.nome

      return [
        'BEGIN:VEVENT',
        `UID:${t.id}@portal-controladoria`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART;VALUE=DATE:${dtstart}`,
        `DTEND;VALUE=DATE:${dtend}`,
        `SUMMARY:${escapeIcs(titulo)}`,
        partes ? `DESCRIPTION:${escapeIcs(partes)}` : null,
        'TRANSP:TRANSPARENT',
        'END:VEVENT',
      ].filter(Boolean).join('\r\n')
    })
    .join('\r\n')

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcs(calendarName)}`,
    events,
    'END:VCALENDAR',
  ].join('\r\n')
}

/** Dispara download do arquivo .ics no navegador. */
export function downloadIcs(tasks: IcsTask[], filename = 'tarefas.ics', calendarName?: string) {
  const conteudo = tasksToIcs(tasks, calendarName)
  const blob = new Blob([conteudo], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
