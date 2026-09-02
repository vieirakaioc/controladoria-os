'use client'

import { useState } from 'react'
import { Plane, UserCheck, Pencil } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { supabase } from '@/lib/supabase'

type Responsavel = { id: string; nome: string; email: string | null }
type AusenciaEdit = {
  id: string
  responsavel_id: string
  data_inicio: string
  data_fim: string
  motivo: string | null
  observacao: string | null
  substituto_id: string | null
  aprovacao_status: string | null
}

type Props = {
  responsaveis: Responsavel[]
  /** Se preenchido, fixa o responsável (modo "minha ausência" pro membro). */
  responsavelFixoId?: string
  isAdmin: boolean
  /** Se preenchido, abre em modo EDIT (UPDATE em vez de INSERT). */
  existing?: AusenciaEdit
  onClose: () => void
  onSaved: () => void
}

const MOTIVOS = ['férias', 'licença', 'atestado', 'afastamento', 'outro']
const APROVACAO_OPCOES = ['Não solicitada', 'Solicitada', 'Aprovada', 'Recusada']

export function NovaAusenciaModal({
  responsaveis, responsavelFixoId, isAdmin, existing, onClose, onSaved,
}: Props) {
  const isEdit = !!existing
  const [respId, setRespId] = useState(existing?.responsavel_id || responsavelFixoId || '')
  const [dataInicio, setDataInicio] = useState(existing?.data_inicio || new Date().toISOString().slice(0, 10))
  const [dataFim, setDataFim] = useState(existing?.data_fim || '')
  const [motivo, setMotivo] = useState(existing?.motivo || 'férias')
  const [substitutoId, setSubstitutoId] = useState(existing?.substituto_id || '')
  const [aprovacaoStatus, setAprovacaoStatus] = useState(existing?.aprovacao_status || 'Não solicitada')
  const [obs, setObs] = useState(existing?.observacao || '')
  const [salvando, setSalvando] = useState(false)

  const salvar = async () => {
    if (!respId || !dataInicio || !dataFim) {
      toast.error('Preencha colaborador, início e fim.')
      return
    }
    if (dataFim < dataInicio) {
      toast.error('Data fim precisa ser igual ou depois do início.')
      return
    }
    if (substitutoId && substitutoId === respId) {
      toast.error('O substituto não pode ser a mesma pessoa que vai sair.')
      return
    }

    setSalvando(true)
    const toastId = toast.loading(isEdit ? 'A atualizar ausência...' : 'A registrar ausência...')
    try {
      const payload = {
        responsavel_id: respId,
        data_inicio: dataInicio,
        data_fim: dataFim,
        motivo: motivo || 'férias',
        observacao: obs || null,
        substituto_id: substitutoId || null,
        aprovacao_status: aprovacaoStatus || 'Não solicitada',
      }

      let res
      if (isEdit && existing) {
        res = await supabase.from('ausencias').update(payload).eq('id', existing.id)
      } else {
        const { data: authData } = await supabase.auth.getUser()
        res = await supabase.from('ausencias').insert({ ...payload, created_by: authData?.user?.id ?? null })
      }
      if (res.error) throw res.error
      toast.success(isEdit ? 'Atualizada!' : 'Ausência registrada!', { id: toastId })
      onSaved()
    } catch (e: any) {
      toast.error(`Erro: ${e?.message || 'falha'}`, { id: toastId })
    } finally {
      setSalvando(false)
    }
  }

  const respLockado = !!responsavelFixoId

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#031D2D]/60 dark:bg-black/80 backdrop-blur-md" onClick={() => !salvando && onClose()} />
      <div className="relative bg-white dark:bg-slate-900 w-full max-w-lg rounded-lg shadow-xl flex flex-col overflow-hidden border border-slate-100 dark:border-slate-800">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start bg-slate-50/50 dark:bg-slate-950/50">
          <div>
            <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold tracking-wide uppercase">
              {isEdit ? 'Editar Ausência' : 'Nova Ausência'}
            </span>
            <h2 className="text-xl text-slate-900 dark:text-white font-semibold mt-1 flex items-center gap-2">
              {isEdit ? <Pencil size={20} /> : <Plane size={20} />}
              {isEdit ? 'Editar período' : (respLockado ? 'Solicitar minha ausência' : 'Registrar período fora')}
            </h2>
          </div>
          <button onClick={onClose} disabled={salvando} className="text-slate-400 hover:text-[#063955] dark:hover:text-white p-2 disabled:opacity-50">✕</button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="text-xs text-slate-500 dark:text-slate-400 font-medium block mb-1">Colaborador</label>
            <select
              value={respId}
              onChange={e => setRespId(e.target.value)}
              disabled={salvando || respLockado}
              className="w-full bg-transparent border border-slate-200 dark:border-slate-800 dark:text-white rounded-md px-3 py-3 text-sm outline-none focus:border-[#0f88a8] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <option value="" className="dark:bg-slate-900">— Selecione —</option>
              {responsaveis.map(r => (
                <option key={r.id} value={r.id} className="dark:bg-slate-900">
                  {r.nome}{r.email ? ` (${r.email})` : ''}
                </option>
              ))}
            </select>
            {respLockado && !isAdmin && (
              <p className="text-[11px] text-slate-400 mt-1">Você só pode cadastrar a própria ausência. Pra outras pessoas, pede pro admin.</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400 font-medium block mb-1">Início</label>
              <input
                type="date"
                value={dataInicio}
                onChange={e => setDataInicio(e.target.value)}
                disabled={salvando}
                className="w-full bg-transparent border border-slate-200 dark:border-slate-800 dark:text-white rounded-md px-3 py-3 text-sm outline-none focus:border-[#0f88a8] disabled:opacity-50"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400 font-medium block mb-1">Fim (inclusivo)</label>
              <input
                type="date"
                value={dataFim}
                onChange={e => setDataFim(e.target.value)}
                disabled={salvando}
                className="w-full bg-transparent border border-slate-200 dark:border-slate-800 dark:text-white rounded-md px-3 py-3 text-sm outline-none focus:border-[#0f88a8] disabled:opacity-50"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-500 dark:text-slate-400 font-medium block mb-1">Motivo</label>
            <select
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              disabled={salvando}
              className="w-full bg-transparent border border-slate-200 dark:border-slate-800 dark:text-white rounded-md px-3 py-3 text-sm outline-none focus:border-[#0f88a8] disabled:opacity-50"
            >
              {MOTIVOS.map(m => <option key={m} value={m} className="dark:bg-slate-900">{m}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-500 dark:text-slate-400 font-medium block mb-1 flex items-center gap-1.5">
              <UserCheck size={13} className="text-emerald-600" /> Substituto (opcional)
            </label>
            <select
              value={substitutoId}
              onChange={e => setSubstitutoId(e.target.value)}
              disabled={salvando}
              className="w-full bg-transparent border border-slate-200 dark:border-slate-800 dark:text-white rounded-md px-3 py-3 text-sm outline-none focus:border-[#0f88a8] disabled:opacity-50"
            >
              <option value="" className="dark:bg-slate-900">Ninguém (tarefas não contam)</option>
              {responsaveis.filter(r => r.id !== respId).map(r => (
                <option key={r.id} value={r.id} className="dark:bg-slate-900">
                  {r.nome}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Se preenchido, as tarefas vencendo nesse período contam pro score do substituto.
            </p>
          </div>

          <div>
            <label className="text-xs text-slate-500 dark:text-slate-400 font-medium block mb-1">
              Status no Sênior (sistema da empresa)
            </label>
            <select
              value={aprovacaoStatus}
              onChange={e => setAprovacaoStatus(e.target.value)}
              disabled={salvando}
              className="w-full bg-transparent border border-slate-200 dark:border-slate-800 dark:text-white rounded-md px-3 py-3 text-sm outline-none focus:border-[#0f88a8] disabled:opacity-50"
            >
              {APROVACAO_OPCOES.map(o => <option key={o} value={o} className="dark:bg-slate-900">{o}</option>)}
            </select>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Acompanha o pedido no Sênior. Atualiza pra "Aprovada" quando o RH liberar oficialmente.
            </p>
          </div>

          <div>
            <label className="text-xs text-slate-500 dark:text-slate-400 font-medium block mb-1">Observação (opcional)</label>
            <textarea
              value={obs}
              onChange={e => setObs(e.target.value)}
              rows={3}
              disabled={salvando}
              className="w-full bg-transparent border border-slate-200 dark:border-slate-800 dark:text-white rounded-md px-3 py-3 text-sm outline-none focus:border-[#0f88a8] disabled:opacity-50 resize-none"
              placeholder="Ex: viagem programada, atestado médico nº..."
            />
          </div>
        </div>

        <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2 bg-slate-50 dark:bg-slate-950">
          <button
            onClick={onClose}
            disabled={salvando}
            className="px-5 py-2.5 rounded-md text-sm font-semibold text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={salvar}
            disabled={salvando || !respId || !dataInicio || !dataFim}
            className="bg-[#063955] hover:bg-[#042436] text-white px-5 py-2.5 rounded-md text-sm font-semibold transition-colors shadow-sm disabled:opacity-50"
          >
            {salvando ? 'A salvar...' : (isEdit ? 'Salvar alterações' : 'Registrar')}
          </button>
        </div>
      </div>
    </div>
  )
}
