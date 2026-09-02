'use client'

import { badge } from '../../_lib/helpers'
import type { Row } from '../../_lib/types'
import { getResponsaveis } from '@/lib/responsaveis'

type Props = {
  rows: Row[]
  excluirTarefa: (id: string) => void
  abrirDrawer: (r: Row) => void
}

export function ListView({ rows, excluirTarefa, abrirDrawer }: Props) {
  return (
    <main className="bg-white dark:bg-slate-900 rounded-lg shadow-card border border-line dark:border-slate-800 overflow-hidden transition-colors">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-navy-50 dark:bg-slate-950 border-b border-line dark:border-slate-800 text-ink-500 dark:text-slate-400 uppercase text-xs">
              <th className="p-4 font-medium">Vencimento</th>
              <th className="p-4 font-medium">Atividade</th>
              <th className="p-4 font-medium">Setor</th>
              <th className="p-4 font-medium">Responsável</th>
              <th className="p-4 font-medium">Status</th>
              <th className="p-4 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
            {rows.map((r) => {
              const respsList = getResponsaveis(r.atividades)
              const nomesTd = respsList.length > 0 ? respsList.map((res) => res.nome).join(', ') : '—'
              return (
                <tr key={r.id} className="hover:bg-navy-50 dark:hover:bg-slate-800/50 transition-colors text-sm">
                  <td className="p-4 text-ink-700 dark:text-slate-400">{r.data_vencimento ? String(r.data_vencimento).slice(0, 10) : '—'}</td>
                  <td className="p-4 font-medium text-ink-900 dark:text-white flex items-center gap-2">
                    {r.anexo_url && <span title="Tem anexo" className="text-teal-600">📎</span>}
                    <div className="flex flex-col">
                      <span>{r.atividades?.nome_atividade || '-'}</span>
                      {r.atividades?.classificacao && <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase mt-0.5">{r.atividades.classificacao}</span>}
                    </div>
                  </td>
                  <td className="p-4 text-ink-500 dark:text-slate-400">{r.atividades?.setores?.nome || '-'}</td>
                  <td className="p-4 text-ink-500 dark:text-slate-400 max-w-[150px] truncate" title={nomesTd}>{nomesTd}</td>
                  <td className="p-4"><span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${badge(r.status)}`}>{r.status}</span></td>
                  <td className="p-4 text-right flex justify-end items-center gap-3">
                    <button onClick={() => excluirTarefa(r.id)} className="text-ink-400 hover:text-[#b43a3d] dark:hover:text-[#f87171] transition-colors" title="Excluir">🗑️</button>
                    <button onClick={() => abrirDrawer(r)} className="text-teal-600 dark:text-[#38bdf8] hover:text-navy-700 dark:hover:text-white font-medium transition-colors">Detalhes</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </main>
  )
}
