'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Toaster, toast } from 'react-hot-toast'
import { Plane, Plus, Trash2, ShieldAlert, Calendar } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type Responsavel = { id: string; nome: string; email: string | null }
type Ausencia = {
  id: string
  responsavel_id: string
  data_inicio: string
  data_fim: string
  motivo: string | null
  observacao: string | null
  created_at: string
  responsaveis?: { nome: string; email: string | null } | null
}

const MOTIVOS = ['férias', 'licença', 'atestado', 'afastamento', 'outro']

export default function FeriasPage() {
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  const [authLoaded, setAuthLoaded] = useState(false)
  const [ausencias, setAusencias] = useState<Ausencia[]>([])
  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([])
  const [loading, setLoading] = useState(true)

  // Form de nova ausência
  const [modalOpen, setModalOpen] = useState(false)
  const [respId, setRespId] = useState('')
  const [dataInicio, setDataInicio] = useState(new Date().toISOString().slice(0, 10))
  const [dataFim, setDataFim] = useState('')
  const [motivo, setMotivo] = useState('férias')
  const [obs, setObs] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (cancelled) return
      if (!user) { router.push('/login'); return }
      const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
      if (cancelled) return
      const admin = prof?.role === 'admin'
      setIsAdmin(admin)
      setAuthLoaded(true)
      if (admin) carregar()
    })()
    return () => { cancelled = true }
  }, [router])

  const carregar = async () => {
    setLoading(true)
    try {
      const [{ data: ausData }, { data: respData }] = await Promise.all([
        supabase.from('ausencias')
          .select('id, responsavel_id, data_inicio, data_fim, motivo, observacao, created_at, responsaveis (nome, email)')
          .order('data_inicio', { ascending: false }),
        supabase.from('responsaveis').select('id, nome, email').order('nome'),
      ])
      setAusencias((ausData || []) as unknown as Ausencia[])
      setResponsaveis((respData || []) as Responsavel[])
    } catch {
      toast.error('Erro ao carregar ausências.')
    } finally {
      setLoading(false)
    }
  }

  const salvar = async () => {
    if (!respId || !dataInicio || !dataFim) {
      toast.error('Preencha responsável, início e fim.')
      return
    }
    if (dataFim < dataInicio) {
      toast.error('Data fim precisa ser igual ou depois do início.')
      return
    }
    setSalvando(true)
    const toastId = toast.loading('A registrar ausência...')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('ausencias').insert({
        responsavel_id: respId,
        data_inicio: dataInicio,
        data_fim: dataFim,
        motivo: motivo || 'férias',
        observacao: obs || null,
        created_by: user?.id ?? null,
      })
      if (error) throw error
      toast.success('Ausência registrada!', { id: toastId })
      setModalOpen(false)
      setRespId('')
      setDataInicio(new Date().toISOString().slice(0, 10))
      setDataFim('')
      setMotivo('férias')
      setObs('')
      carregar()
    } catch (e: any) {
      toast.error(`Erro: ${e?.message || 'falha'}`, { id: toastId })
    } finally {
      setSalvando(false)
    }
  }

  const remover = async (id: string, nome: string) => {
    if (!window.confirm(`Remover ausência de ${nome}? As tarefas dentro desse período voltam a contar pro score.`)) return
    const toastId = toast.loading('A remover...')
    try {
      const { error } = await supabase.from('ausencias').delete().eq('id', id)
      if (error) throw error
      setAusencias(prev => prev.filter(a => a.id !== id))
      toast.success('Removida!', { id: toastId })
    } catch (e: any) {
      toast.error(`Erro: ${e?.message || 'falha'}`, { id: toastId })
    }
  }

  // Categoriza: ativas (contém hoje), futuras, passadas
  const { ativas, futuras, passadas } = useMemo(() => {
    const hoje = new Date().toISOString().slice(0, 10)
    return {
      ativas: ausencias.filter(a => a.data_inicio <= hoje && hoje <= a.data_fim),
      futuras: ausencias.filter(a => a.data_inicio > hoje),
      passadas: ausencias.filter(a => a.data_fim < hoje),
    }
  }, [ausencias])

  // ─── Gates ────────────────────────────────────────────────────────────
  if (!authLoaded) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center text-[#0f88a8] dark:text-[#38bdf8] font-medium animate-pulse">
        A verificar credenciais...
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-8 flex flex-col items-center justify-center text-center">
        <ShieldAlert size={64} className="text-[#b43a3d] dark:text-[#f87171] mb-4 opacity-80" />
        <h1 className="text-2xl font-bold text-[#063955] dark:text-white">Acesso Restrito</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-md">
          A gestão de férias é exclusiva para administradores.
        </p>
        <button
          onClick={() => router.push('/tarefas')}
          className="mt-6 bg-[#0f88a8] hover:bg-[#0c708b] text-white px-6 py-2.5 rounded-xl font-medium shadow-sm"
        >
          Voltar ao Kanban
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-8 font-sans transition-colors">
      <Toaster position="bottom-right" toastOptions={{ style: { background: '#063955', color: '#fff', borderRadius: '12px' } }} />

      <header className="mb-6 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col xl:flex-row xl:justify-between xl:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-amber-500/10 dark:bg-amber-500/20 p-3 rounded-xl text-amber-600 dark:text-amber-400">
            <Plane size={32} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#063955] dark:text-white tracking-tight">Gestão de Férias</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
              Períodos de ausência. Tarefas dentro desses dias não contam no score.
            </p>
          </div>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 bg-[#063955] hover:bg-[#042436] text-white px-5 py-2.5 rounded-xl font-semibold transition-colors shadow-sm"
        >
          <Plus size={16} /> Nova Ausência
        </button>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <CardCat label="Ativas hoje" count={ativas.length} color="amber" />
        <CardCat label="Futuras" count={futuras.length} color="sky" />
        <CardCat label="Passadas" count={passadas.length} color="slate" />
      </div>

      {loading ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 text-center text-[#0f88a8] dark:text-[#38bdf8] font-medium animate-pulse">
          A carregar ausências...
        </div>
      ) : ausencias.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 text-center text-slate-500 dark:text-slate-400">
          Nenhuma ausência registrada ainda. Clique em "Nova Ausência" pra começar.
        </div>
      ) : (
        <>
          <ListaSecao titulo="Ativas hoje" lista={ativas} onRemover={remover} destaque />
          <ListaSecao titulo="Próximas (futuras)" lista={futuras} onRemover={remover} />
          <ListaSecao titulo="Histórico (passadas)" lista={passadas} onRemover={remover} muted />
        </>
      )}

      {/* MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#031D2D]/60 dark:bg-black/80 backdrop-blur-md" onClick={() => !salvando && setModalOpen(false)} />
          <div className="relative bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-100 dark:border-slate-800">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start bg-slate-50/50 dark:bg-slate-950/50">
              <div>
                <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold tracking-wide uppercase">Nova Ausência</span>
                <h2 className="text-xl text-slate-900 dark:text-white font-semibold mt-1 flex items-center gap-2">
                  <Plane size={20} /> Registrar período fora
                </h2>
              </div>
              <button onClick={() => !salvando && setModalOpen(false)} disabled={salvando} className="text-slate-400 hover:text-[#063955] dark:hover:text-white p-2 disabled:opacity-50">✕</button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400 font-medium block mb-1">Colaborador</label>
                <select
                  value={respId}
                  onChange={e => setRespId(e.target.value)}
                  disabled={salvando}
                  className="w-full bg-transparent border border-slate-200 dark:border-slate-800 dark:text-white rounded-xl px-3 py-3 text-sm outline-none focus:border-[#0f88a8] disabled:opacity-50"
                >
                  <option value="" className="dark:bg-slate-900">— Selecione —</option>
                  {responsaveis.map(r => (
                    <option key={r.id} value={r.id} className="dark:bg-slate-900">
                      {r.nome}{r.email ? ` (${r.email})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 dark:text-slate-400 font-medium block mb-1">Início</label>
                  <input
                    type="date"
                    value={dataInicio}
                    onChange={e => setDataInicio(e.target.value)}
                    disabled={salvando}
                    className="w-full bg-transparent border border-slate-200 dark:border-slate-800 dark:text-white rounded-xl px-3 py-3 text-sm outline-none focus:border-[#0f88a8] disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 dark:text-slate-400 font-medium block mb-1">Fim (inclusivo)</label>
                  <input
                    type="date"
                    value={dataFim}
                    onChange={e => setDataFim(e.target.value)}
                    disabled={salvando}
                    className="w-full bg-transparent border border-slate-200 dark:border-slate-800 dark:text-white rounded-xl px-3 py-3 text-sm outline-none focus:border-[#0f88a8] disabled:opacity-50"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400 font-medium block mb-1">Motivo</label>
                <select
                  value={motivo}
                  onChange={e => setMotivo(e.target.value)}
                  disabled={salvando}
                  className="w-full bg-transparent border border-slate-200 dark:border-slate-800 dark:text-white rounded-xl px-3 py-3 text-sm outline-none focus:border-[#0f88a8] disabled:opacity-50"
                >
                  {MOTIVOS.map(m => <option key={m} value={m} className="dark:bg-slate-900">{m}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400 font-medium block mb-1">Observação (opcional)</label>
                <textarea
                  value={obs}
                  onChange={e => setObs(e.target.value)}
                  rows={3}
                  disabled={salvando}
                  className="w-full bg-transparent border border-slate-200 dark:border-slate-800 dark:text-white rounded-xl px-3 py-3 text-sm outline-none focus:border-[#0f88a8] disabled:opacity-50 resize-none"
                  placeholder="Ex: viagem programada, atestado médico nº..."
                />
              </div>
            </div>

            <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2 bg-slate-50 dark:bg-slate-950">
              <button
                onClick={() => setModalOpen(false)}
                disabled={salvando}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={salvar}
                disabled={salvando || !respId || !dataInicio || !dataFim}
                className="bg-[#063955] hover:bg-[#042436] text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm disabled:opacity-50"
              >
                {salvando ? 'A salvar...' : 'Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Auxiliares ────────────────────────────────────────────────────────────

function CardCat({ label, count, color }: { label: string; count: number; color: 'amber' | 'sky' | 'slate' }) {
  const cls = {
    amber: 'text-amber-600 dark:text-amber-400',
    sky: 'text-[#0f88a8] dark:text-[#38bdf8]',
    slate: 'text-slate-500 dark:text-slate-400',
  }[color]
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
      <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</div>
      <div className={`text-2xl font-light mt-1 ${cls}`}>{count}</div>
    </div>
  )
}

function ListaSecao({
  titulo, lista, onRemover, destaque = false, muted = false,
}: {
  titulo: string; lista: Ausencia[]; onRemover: (id: string, nome: string) => void
  destaque?: boolean; muted?: boolean
}) {
  if (lista.length === 0) return null
  return (
    <div className={`mb-6 ${muted ? 'opacity-60' : ''}`}>
      <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
        <Calendar size={12} /> {titulo} <span className="text-slate-300">({lista.length})</span>
      </h3>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-950">
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase text-xs tracking-wider">
                <th className="px-4 py-3 font-semibold">Colaborador</th>
                <th className="px-4 py-3 font-semibold">Início</th>
                <th className="px-4 py-3 font-semibold">Fim</th>
                <th className="px-4 py-3 font-semibold">Motivo</th>
                <th className="px-4 py-3 font-semibold">Observação</th>
                <th className="px-4 py-3 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {lista.map(a => (
                <tr key={a.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-sm ${destaque ? 'bg-amber-50/50 dark:bg-amber-500/5' : ''}`}>
                  <td className="px-4 py-3 font-medium text-[#063955] dark:text-white">
                    {a.responsaveis?.nome || '—'}
                    {a.responsaveis?.email && <div className="text-xs text-slate-400 font-normal">{a.responsaveis.email}</div>}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300 tabular-nums">{fmtBR(a.data_inicio)}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300 tabular-nums">{fmtBR(a.data_fim)}</td>
                  <td className="px-4 py-3">
                    <span className="inline-block bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-2 py-0.5 rounded text-xs font-medium">
                      {a.motivo || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 max-w-xs truncate" title={a.observacao || ''}>
                    {a.observacao || '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => onRemover(a.id, a.responsaveis?.nome || 'colaborador')}
                      className="text-slate-300 hover:text-[#b43a3d] dark:hover:text-[#f87171] transition-colors p-1"
                      title="Remover"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function fmtBR(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}
