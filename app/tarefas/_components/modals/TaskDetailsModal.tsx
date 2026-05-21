'use client'

import { AnexoUploader } from './AnexoUploader'
import { ChecklistEditor } from './ChecklistEditor'
import { CommentsThread } from './CommentsThread'
import type { ChecklistItem, Lookup, Row } from '../../_lib/types'
import type { ResponsavelLite } from '@/lib/responsaveis'

type DrawerFields = {
  drawerNome: string; setDrawerNome: (v: string) => void
  drawerStatus: string; setDrawerStatus: (v: string) => void
  drawerObs: string; setDrawerObs: (v: string) => void
  drawerVenc: string; setDrawerVenc: (v: string) => void
  drawerAnexo: string; setDrawerAnexo: (v: string) => void
  drawerChecklists: ChecklistItem[]; setDrawerChecklists: (v: ChecklistItem[]) => void
  drawerClassificacao: string; setDrawerClassificacao: (v: string) => void
  drawerResps: ResponsavelLite[]; setDrawerResps: (v: ResponsavelLite[]) => void
  drawerProjetoId: string; setDrawerProjetoId: (v: string) => void
}

type Props = DrawerFields & {
  selected: Row
  statuses: string[]
  respsDb: Lookup[]
  classificacoesDb: Lookup[]
  projetosDb: { id: string; nome: string }[]
  userId: string
  userName: string
  userEmail: string

  savingDrawer: boolean
  onClose: () => void
  onSalvar: () => void
  onConcluir: () => void
  onExcluir: () => void
  onCommentSent?: (mensagem: string) => void
}

export function TaskDetailsModal(props: Props) {
  const {
    selected, statuses, respsDb, classificacoesDb, projetosDb,
    drawerNome, setDrawerNome,
    drawerStatus, setDrawerStatus,
    drawerObs, setDrawerObs,
    drawerVenc, setDrawerVenc,
    drawerAnexo, setDrawerAnexo,
    drawerChecklists, setDrawerChecklists,
    drawerClassificacao, setDrawerClassificacao,
    drawerResps, setDrawerResps,
    drawerProjetoId, setDrawerProjetoId,
    userId, userName, userEmail,
    savingDrawer,
    onClose, onSalvar, onConcluir, onExcluir, onCommentSent,
  } = props

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-[#031D2D]/60 dark:bg-black/80 backdrop-blur-md transition-opacity" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 w-full max-w-2xl max-h-[95vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start bg-slate-50/50 dark:bg-slate-950/50 shrink-0">
          <div className="w-full mr-4">
            <span className="text-xs text-[#0f88a8] dark:text-[#38bdf8] font-semibold tracking-wide uppercase">Detalhes da Tarefa</span>
            <input
              value={drawerNome}
              onChange={(e) => setDrawerNome(e.target.value)}
              className="w-full text-xl text-[#063955] dark:text-white font-semibold mt-1 bg-transparent border-b-2 border-transparent focus:border-[#0f88a8] outline-none transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 px-1 -ml-1 rounded"
              title="Clique para editar o nome da atividade"
            />
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
              <span>{selected.atividades?.setores?.nome || '—'}</span>
              <span>•</span>
              <span>{selected.atividades?.planner_name || '—'}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-[#063955] dark:hover:text-white p-2">✕</button>
        </div>

        {/* Body */}
        <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
          <div className="space-y-6">
            {/* Status + Vencimento */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400 font-medium block mb-1">Status</label>
                <select value={drawerStatus} onChange={e => setDrawerStatus(e.target.value)} className="w-full bg-transparent border border-slate-200 dark:border-slate-800 dark:text-white rounded-xl p-2.5 text-sm outline-none focus:border-[#0f88a8]">
                  {statuses.map(s => <option key={s} value={s} className="dark:bg-slate-900">{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400 font-medium block mb-1">Vencimento</label>
                <input type="date" value={drawerVenc} onChange={e => setDrawerVenc(e.target.value)} className="w-full bg-transparent border border-slate-200 dark:border-slate-800 dark:text-white rounded-xl p-2.5 text-sm outline-none focus:border-[#0f88a8]" />
              </div>
            </div>

            {/* Classificação + Projeto */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400 font-medium block mb-1">Classificação da Tarefa</label>
                <select value={drawerClassificacao} onChange={e => setDrawerClassificacao(e.target.value)} className="w-full bg-transparent border border-slate-200 dark:border-slate-800 dark:text-white rounded-xl p-2.5 text-sm outline-none focus:border-[#0f88a8]">
                  <option value="" className="dark:bg-slate-900">(Nenhuma)</option>
                  {classificacoesDb.map(c => <option key={c.id} value={c.nome} className="dark:bg-slate-900">{c.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400 font-medium block mb-1 text-[#C7A77B]">Vincular a Projeto</label>
                <select value={drawerProjetoId} onChange={e => setDrawerProjetoId(e.target.value)} className="w-full bg-transparent border border-[#C7A77B]/50 dark:border-slate-800 dark:text-white rounded-xl p-2.5 text-sm outline-none focus:border-[#C7A77B]">
                  <option value="" className="dark:bg-slate-900">(Sem Projeto)</option>
                  {projetosDb.map(p => <option key={p.id} value={p.id} className="dark:bg-slate-900">{p.nome}</option>)}
                </select>
              </div>
            </div>

            {/* Responsáveis */}
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-1 flex justify-between">
                <span>Envolvidos na Tarefa</span>
                <span className="text-[#0f88a8] font-bold">{drawerResps.length} selecionado(s)</span>
              </label>
              <div className="border rounded-xl p-2 max-h-36 overflow-y-auto bg-transparent border-slate-200 dark:border-slate-800 custom-scrollbar">
                {respsDb.map(r => {
                  const isChecked = drawerResps.some(dr => dr.id === r.id)
                  return (
                    <label key={r.id} className="flex items-center gap-3 p-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) setDrawerResps([...drawerResps, { id: r.id, nome: r.nome, email: r.email }])
                          else setDrawerResps(drawerResps.filter(dr => dr.id !== r.id))
                        }}
                        className="w-4 h-4 rounded border-slate-300 text-[#0f88a8] focus:ring-[#0f88a8] cursor-pointer"
                      />
                      <span className={`text-sm ${isChecked ? 'font-semibold text-[#0f88a8] dark:text-[#38bdf8]' : 'text-slate-700 dark:text-slate-300'}`}>{r.nome}</span>
                    </label>
                  )
                })}
              </div>
            </div>

            <ChecklistEditor items={drawerChecklists} onChange={setDrawerChecklists} />
            <AnexoUploader value={drawerAnexo} onChange={setDrawerAnexo} />

            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400 font-medium block mb-1">Observações Gerais</label>
              <textarea
                value={drawerObs}
                onChange={e => setDrawerObs(e.target.value)}
                rows={4}
                className="w-full bg-transparent border border-slate-200 dark:border-slate-800 dark:text-white rounded-xl p-3 text-sm outline-none focus:border-[#0f88a8]"
                placeholder="Informações adicionais..."
              />
            </div>

            <CommentsThread
              tarefa={selected}
              userId={userId}
              userName={userName}
              userEmail={userEmail}
              respsDb={respsDb}
              onSent={onCommentSent}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex justify-between bg-slate-50 dark:bg-slate-950 shrink-0">
          <button onClick={onExcluir} className="text-[#b43a3d] dark:text-[#f87171] hover:bg-[#b43a3d]/10 dark:hover:bg-[#b43a3d]/20 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors">
            Excluir Tarefa
          </button>
          <div className="flex gap-2">
            <button onClick={onSalvar} disabled={savingDrawer} className="bg-[#0f88a8] text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-[#0c708b] transition-colors shadow-sm disabled:opacity-50">
              {savingDrawer ? 'A guardar...' : 'Salvar'}
            </button>
            <button onClick={onConcluir} className="bg-[#2d6943] text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-[#204e31] transition-colors shadow-sm">
              ✓ Concluir
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
