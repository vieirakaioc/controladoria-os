'use client'

import type { Lookup } from '../../_lib/types'
import type { ResponsavelLite } from '@/lib/responsaveis'

type Props = {
  setoresDb: Lookup[]
  respsDb: Lookup[]
  classificacoesDb: Lookup[]
  projetosDb: { id: string; nome: string }[]

  adhocNome: string; setAdhocNome: (v: string) => void
  adhocSetorId: string; setAdhocSetorId: (v: string) => void
  adhocResps: ResponsavelLite[]; setAdhocResps: (v: ResponsavelLite[]) => void
  adhocProjetoId: string; setAdhocProjetoId: (v: string) => void
  adhocVenc: string; setAdhocVenc: (v: string) => void
  adhocPrioridade: string; setAdhocPrioridade: (v: string) => void
  adhocClassificacao: string; setAdhocClassificacao: (v: string) => void
  adhocObs: string; setAdhocObs: (v: string) => void

  savingAdhoc: boolean
  onClose: () => void
  onCriar: () => void
}

export function AdHocModal(props: Props) {
  const {
    setoresDb, respsDb, classificacoesDb, projetosDb,
    adhocNome, setAdhocNome,
    adhocSetorId, setAdhocSetorId,
    adhocResps, setAdhocResps,
    adhocProjetoId, setAdhocProjetoId,
    adhocVenc, setAdhocVenc,
    adhocPrioridade, setAdhocPrioridade,
    adhocClassificacao, setAdhocClassificacao,
    adhocObs, setAdhocObs,
    savingAdhoc, onClose, onCriar,
  } = props

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-[#031D2D]/60 dark:bg-black/80 backdrop-blur-md transition-opacity" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 w-full max-w-2xl max-h-[95vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start bg-slate-50/50 dark:bg-slate-950/50 shrink-0">
          <div>
            <span className="text-xs text-[#0f88a8] dark:text-[#38bdf8] font-semibold tracking-wide uppercase">Nova Tarefa Pontual</span>
            <h2 className="text-xl text-slate-900 dark:text-white font-semibold mt-1">Planner: Ad Hoc</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-[#063955] dark:hover:text-white p-2">✕</button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 flex-1 overflow-y-auto custom-scrollbar">
          <div>
            <label className="text-xs text-slate-500 dark:text-slate-400 font-medium block mb-1">Nome da atividade</label>
            <input
              value={adhocNome}
              onChange={(e) => setAdhocNome(e.target.value)}
              className="w-full bg-transparent border border-slate-200 dark:border-slate-800 dark:text-white rounded-xl px-4 py-3 text-sm outline-none focus:border-[#0f88a8]"
              placeholder="Ex: Ajustar lançamento X..."
            />
          </div>

          <div>
            <label className="text-xs text-slate-500 dark:text-slate-400 font-medium block mb-1">Setor</label>
            <select
              value={adhocSetorId}
              onChange={(e) => setAdhocSetorId(e.target.value)}
              className="w-full bg-transparent border border-slate-200 dark:border-slate-800 dark:text-white rounded-xl px-3 py-3 text-sm outline-none focus:border-[#0f88a8]"
            >
              <option value="" className="dark:bg-slate-900">(sem setor)</option>
              {setoresDb.map(s => <option key={s.id} value={s.id} className="dark:bg-slate-900">{s.nome}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-1 flex justify-between">
              <span>Envolvidos na Tarefa</span>
              <span className="text-[#0f88a8] font-bold">{adhocResps.length} selecionado(s)</span>
            </label>
            <div className="border rounded-xl p-2 max-h-36 overflow-y-auto bg-transparent border-slate-200 dark:border-slate-800 custom-scrollbar">
              {respsDb.map(r => {
                const isChecked = adhocResps.some(dr => dr.id === r.id)
                return (
                  <label key={r.id} className="flex items-center gap-3 p-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        if (e.target.checked) setAdhocResps([...adhocResps, { id: r.id, nome: r.nome, email: r.email }])
                        else setAdhocResps(adhocResps.filter(dr => dr.id !== r.id))
                      }}
                      className="w-4 h-4 rounded border-slate-300 text-[#0f88a8] focus:ring-[#0f88a8] cursor-pointer"
                    />
                    <span className={`text-sm ${isChecked ? 'font-semibold text-[#0f88a8] dark:text-[#38bdf8]' : 'text-slate-700 dark:text-slate-300'}`}>{r.nome}</span>
                  </label>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400 font-medium block mb-1">Vencimento</label>
              <input
                type="date"
                value={adhocVenc}
                onChange={(e) => setAdhocVenc(e.target.value)}
                className="w-full bg-transparent border border-slate-200 dark:border-slate-800 dark:text-white rounded-xl px-4 py-3 text-sm outline-none focus:border-[#0f88a8]"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400 font-medium block mb-1">Prioridade</label>
              <select
                value={adhocPrioridade}
                onChange={(e) => setAdhocPrioridade(e.target.value)}
                className="w-full bg-transparent border border-slate-200 dark:border-slate-800 dark:text-white rounded-xl px-3 py-3 text-sm outline-none focus:border-[#0f88a8]"
              >
                <option value="Baixa" className="dark:bg-slate-900">Baixa</option>
                <option value="Média" className="dark:bg-slate-900">Média</option>
                <option value="Alta" className="dark:bg-slate-900">Alta</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-500 dark:text-slate-400 font-medium block mb-1">Classificação</label>
            <select
              value={adhocClassificacao}
              onChange={(e) => setAdhocClassificacao(e.target.value)}
              className="w-full bg-transparent border border-slate-200 dark:border-slate-800 dark:text-white rounded-xl px-3 py-3 text-sm outline-none focus:border-[#0f88a8]"
            >
              <option value="" className="dark:bg-slate-900">(Nenhuma)</option>
              {classificacoesDb.map(c => <option key={c.id} value={c.nome} className="dark:bg-slate-900">{c.nome}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-500 dark:text-slate-400 font-medium block mb-1">Vincular a Projeto (Opcional)</label>
            <select
              value={adhocProjetoId}
              onChange={(e) => setAdhocProjetoId(e.target.value)}
              className="w-full bg-transparent border border-slate-200 dark:border-slate-800 dark:text-white rounded-xl px-3 py-3 text-sm outline-none focus:border-[#0f88a8]"
            >
              <option value="" className="dark:bg-slate-900">(Sem Projeto - Tarefa Solta)</option>
              {projetosDb.map(p => <option key={p.id} value={p.id} className="dark:bg-slate-900">{p.nome}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-500 dark:text-slate-400 font-medium block mb-1">Observações / Detalhes</label>
            <textarea
              value={adhocObs}
              onChange={(e) => setAdhocObs(e.target.value)}
              rows={4}
              className="w-full bg-transparent border border-slate-200 dark:border-slate-800 dark:text-white rounded-xl px-4 py-3 text-sm outline-none focus:border-[#0f88a8] resize-none"
              placeholder="Forneça instruções, links ou contexto adicional para quem vai executar a tarefa..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2 bg-slate-50 dark:bg-slate-950 shrink-0">
          <button onClick={onClose} className="px-5 py-3 rounded-xl text-sm font-semibold text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
            Cancelar
          </button>
          <button onClick={onCriar} disabled={savingAdhoc} className="bg-[#0f88a8] text-white px-5 py-3 rounded-xl text-sm font-semibold hover:bg-[#0c708b] transition-colors shadow-sm disabled:opacity-50">
            {savingAdhoc ? 'A processar...' : 'Criar Tarefa'}
          </button>
        </div>
      </div>
    </div>
  )
}
