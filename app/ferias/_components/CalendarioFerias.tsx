'use client'

import { useMemo } from 'react'

type Ausencia = {
  id: string
  responsavel_id: string
  data_inicio: string
  data_fim: string
  motivo: string | null
  responsaveis?: { nome: string } | null
}

type Props = {
  ausencias: Ausencia[]
  mes: number
  ano: number
}

// Cor por motivo (consistente em toda a UI)
function corMotivo(m: string | null): string {
  const s = (m || 'férias').toLowerCase()
  if (s.includes('férias') || s.includes('ferias')) return 'bg-amber-500'
  if (s.includes('licença') || s.includes('licenca')) return 'bg-violet-500'
  if (s.includes('atestado')) return 'bg-rose-500'
  if (s.includes('afastamento')) return 'bg-slate-500'
  return 'bg-emerald-500'
}

const DIAS_SEM = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

/**
 * Calendário do mês: linhas = pessoas, colunas = dias.
 * Célula colorida quando a pessoa está fora no dia.
 */
export function CalendarioFerias({ ausencias, mes, ano }: Props) {
  // Total de dias do mês
  const diasNoMes = useMemo(() => new Date(ano, mes + 1, 0).getDate(), [ano, mes])

  // Agrupa por pessoa, mantém só quem tem alguma ausência tocando esse mês
  const porPessoa = useMemo(() => {
    const map = new Map<string, { nome: string; ausencias: Ausencia[] }>()
    for (const a of ausencias) {
      const nome = a.responsaveis?.nome || 'Sem nome'
      if (!map.has(a.responsavel_id)) map.set(a.responsavel_id, { nome, ausencias: [] })
      map.get(a.responsavel_id)!.ausencias.push(a)
    }
    return Array.from(map.entries())
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => a.nome.localeCompare(b.nome))
  }, [ausencias])

  if (porPessoa.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-12 text-center text-slate-500 dark:text-slate-400">
        Ninguém tem ausência cadastrada nesse mês.
      </div>
    )
  }

  // Determina o dia da semana de cada dia do mês (pra mostrar cabeçalho)
  const diasInfo = Array.from({ length: diasNoMes }, (_, i) => {
    const d = new Date(ano, mes, i + 1)
    return { dia: i + 1, dow: d.getDay() }
  })

  const fmt = (iso: string) => {
    const [, m, d] = iso.split('-')
    return `${d}/${m}`
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-slate-50 dark:bg-slate-950">
            <tr>
              <th className="sticky left-0 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 z-10 min-w-[180px]">
                Colaborador
              </th>
              {diasInfo.map(({ dia, dow }) => (
                <th
                  key={dia}
                  className={`px-1 py-2 text-center text-[10px] font-mono ${dow === 0 || dow === 6 ? 'bg-slate-100 dark:bg-slate-800/60 text-slate-400' : 'text-slate-500 dark:text-slate-400'}`}
                  style={{ minWidth: '24px' }}
                >
                  <div className="text-[9px]">{DIAS_SEM[dow]}</div>
                  <div className="font-bold">{String(dia).padStart(2, '0')}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {porPessoa.map(pessoa => (
              <tr key={pessoa.id}>
                <td className="sticky left-0 bg-white dark:bg-slate-900 px-4 py-2.5 font-medium text-sm text-[#063955] dark:text-white z-10 whitespace-nowrap">
                  {pessoa.nome}
                </td>
                {diasInfo.map(({ dia, dow }) => {
                  const dataIso = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
                  const cobre = pessoa.ausencias.find(a => dataIso >= a.data_inicio && dataIso <= a.data_fim)
                  const isWeekend = dow === 0 || dow === 6
                  return (
                    <td
                      key={dia}
                      className={`p-0.5 text-center ${isWeekend ? 'bg-slate-50 dark:bg-slate-950/50' : ''}`}
                    >
                      {cobre && (
                        <div
                          className={`w-full h-6 rounded ${corMotivo(cobre.motivo)} opacity-90 hover:opacity-100 hover:ring-2 hover:ring-[#0f88a8]`}
                          title={`${pessoa.nome} · ${cobre.motivo || 'ausente'} · ${fmt(cobre.data_inicio)} → ${fmt(cobre.data_fim)}`}
                        />
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legenda */}
      <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
        <span className="font-semibold">Legenda:</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-500" /> férias</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-violet-500" /> licença</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-rose-500" /> atestado</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-slate-500" /> afastamento</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500" /> outro</span>
      </div>
    </div>
  )
}
