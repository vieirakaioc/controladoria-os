'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Toaster, toast } from 'react-hot-toast'
import { Plane, Plus, Trash2, Calendar, UserCheck, ChevronLeft, ChevronRight, Pencil } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { CalendarioFerias } from './_components/CalendarioFerias'
import { NovaAusenciaModal } from './_components/NovaAusenciaModal'

type Responsavel = { id: string; nome: string; email: string | null }
type Ausencia = {
  id: string
  responsavel_id: string
  data_inicio: string
  data_fim: string
  motivo: string | null
  observacao: string | null
  substituto_id: string | null
  created_at: string
  responsaveis?: { nome: string; email: string | null } | null
}

const MESES_NOMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

export default function FeriasPage() {
  const router = useRouter()
  const [authLoaded, setAuthLoaded] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [meuResponsavelId, setMeuResponsavelId] = useState<string | null>(null)

  const [ausencias, setAusencias] = useState<Ausencia[]>([])
  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([])
  const [loading, setLoading] = useState(true)

  // Mês do calendário (default = mês atual)
  const hojeRef = new Date()
  const [mesAlvo, setMesAlvo] = useState(hojeRef.getMonth())
  const [anoAlvo, setAnoAlvo] = useState(hojeRef.getFullYear())

  const [modalOpen, setModalOpen] = useState(false)
  const [modalRespFixoId, setModalRespFixoId] = useState<string | undefined>(undefined)
  const [modalEditing, setModalEditing] = useState<Ausencia | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (cancelled) return
      if (!user) { router.push('/login'); return }
      const email = user.email || ''
      setUserEmail(email)

      const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
      if (cancelled) return
      setIsAdmin(prof?.role === 'admin')
      setAuthLoaded(true)
      carregar(email)
    })()
    return () => { cancelled = true }
  }, [router])

  const carregar = async (email?: string) => {
    setLoading(true)
    try {
      const [{ data: ausData, error: errAus }, { data: respData }] = await Promise.all([
        // Sem embed — tem 2 FKs pra responsaveis (responsavel_id e substituto_id),
        // o que confunde o PostgREST. Fazemos o lookup do nome em JS com respData.
        supabase.from('ausencias')
          .select('id, responsavel_id, data_inicio, data_fim, motivo, observacao, substituto_id, created_at')
          .order('data_inicio', { ascending: true }),
        supabase.from('responsaveis').select('id, nome, email').order('nome'),
      ])
      if (errAus) {
        console.error('[ferias] erro ao ler ausencias:', errAus)
        toast.error(`Erro ao carregar: ${errAus.message}`)
        return
      }
      const resps = (respData || []) as Responsavel[]
      // Faz o join em JS: anexa { nome, email } do responsável em cada ausência
      const respsById = new Map<string, Responsavel>()
      resps.forEach(r => respsById.set(String(r.id), r))
      const aus: Ausencia[] = (ausData || []).map((a: any) => {
        const r = respsById.get(String(a.responsavel_id))
        return { ...a, responsaveis: r ? { nome: r.nome, email: r.email } : null }
      })
      setAusencias(aus)
      setResponsaveis(resps)

      // Localiza meu responsavel_id pelo email
      const meuEmail = (email || userEmail).toLowerCase()
      const meu = resps.find(r => (r.email || '').toLowerCase() === meuEmail)
      setMeuResponsavelId(meu?.id || null)
    } catch {
      toast.error('Erro ao carregar ausências.')
    } finally {
      setLoading(false)
    }
  }

  const remover = async (a: Ausencia) => {
    const nome = a.responsaveis?.nome || 'colaborador'
    if (!window.confirm(`Remover ausência de ${nome}? As tarefas dentro do período voltam ao score normal.`)) return
    const toastId = toast.loading('A remover...')
    try {
      const { error } = await supabase.from('ausencias').delete().eq('id', a.id)
      if (error) throw error
      setAusencias(prev => prev.filter(x => x.id !== a.id))
      toast.success('Removida!', { id: toastId })
    } catch (e: any) {
      toast.error(`Erro: ${e?.message || 'falha'}`, { id: toastId })
    }
  }

  // Pode remover/editar se for admin OU se a ausência for própria
  const podeRemover = (a: Ausencia) => isAdmin || a.responsavel_id === meuResponsavelId
  const podeEditar = podeRemover

  const editar = (a: Ausencia) => {
    setModalEditing(a)
    setModalRespFixoId(undefined)
    setModalOpen(true)
  }

  // Filtra ausências que tocam o mês selecionado
  const ausenciasDoMes = useMemo(() => {
    const mesInicio = `${anoAlvo}-${String(mesAlvo + 1).padStart(2, '0')}-01`
    const mesFim = `${anoAlvo}-${String(mesAlvo + 1).padStart(2, '0')}-31`
    return ausencias.filter(a => a.data_inicio <= mesFim && a.data_fim >= mesInicio)
  }, [ausencias, mesAlvo, anoAlvo])

  // Minhas ausências (todas)
  const minhasAusencias = useMemo(
    () => ausencias.filter(a => a.responsavel_id === meuResponsavelId),
    [ausencias, meuResponsavelId],
  )

  // Próximas (futuras + ativas hoje) — top 3 pra não poluir
  const proximas = useMemo(() => {
    const hojeIso = new Date().toISOString().slice(0, 10)
    return ausencias
      .filter(a => a.data_fim >= hojeIso)
      .sort((a, b) => a.data_inicio.localeCompare(b.data_inicio))
      .slice(0, 3)
  }, [ausencias])

  const navMes = (dir: -1 | 1) => {
    let m = mesAlvo + dir
    let a = anoAlvo
    if (m < 0) { m = 11; a-- }
    if (m > 11) { m = 0; a++ }
    setMesAlvo(m); setAnoAlvo(a)
  }

  // Mapa pra resolver nome do substituto rapidamente
  const respsById = useMemo(() => {
    const map = new Map<string, Responsavel>()
    responsaveis.forEach(r => map.set(r.id, r))
    return map
  }, [responsaveis])

  // ─── Gates ────────────────────────────────────────────────────────────
  if (!authLoaded || loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center text-[#0f88a8] dark:text-[#38bdf8] font-medium animate-pulse">
        A carregar...
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
            <h1 className="text-2xl font-bold text-[#063955] dark:text-white tracking-tight">Férias da Equipe</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
              Calendário de ausências, substitutos, próximas saídas. {isAdmin && '(Admin vê tudo)'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {meuResponsavelId && (
            <button
              onClick={() => { setModalEditing(null); setModalRespFixoId(meuResponsavelId); setModalOpen(true) }}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-5 py-2.5 rounded-xl font-semibold transition-colors shadow-sm"
            >
              <Plus size={16} /> Solicitar minha ausência
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => { setModalEditing(null); setModalRespFixoId(undefined); setModalOpen(true) }}
              className="flex items-center gap-2 bg-[#063955] hover:bg-[#042436] text-white px-5 py-2.5 rounded-xl font-semibold transition-colors shadow-sm"
            >
              <Plus size={16} /> Nova ausência (qualquer)
            </button>
          )}
        </div>
      </header>

      {/* Minhas ausências (hero) + Próximas (lado a lado) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Card: Minhas Ausências (visual destacado) */}
        <MinhasAusenciasCard
          meuResponsavelId={meuResponsavelId}
          minhas={minhasAusencias}
          respsById={respsById}
          onEditar={editar}
          onRemover={remover}
          onSolicitar={() => { setModalEditing(null); setModalRespFixoId(meuResponsavelId || undefined); setModalOpen(true) }}
        />

        {/* Card: Próximas da Equipe (top 3) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-5">
          <h3 className="text-xs font-bold text-[#063955] dark:text-white uppercase tracking-widest mb-3 flex items-center gap-2">
            <Calendar size={13} className="text-[#0f88a8]" /> Próximas da Equipe <span className="text-slate-300">(top 3)</span>
          </h3>
          {proximas.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Ninguém tem ausência futura cadastrada.</p>
          ) : (
            <div className="space-y-2">
              {proximas.map(a => (
                <ItemAusencia
                  key={a.id} a={a} respsById={respsById}
                  onRemover={() => remover(a)} onEditar={() => editar(a)}
                  podeRemover={podeRemover(a)} podeEditar={podeEditar(a)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Calendário do mês */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-5 mb-3 flex items-center justify-between">
        <h3 className="text-base font-bold text-[#063955] dark:text-white flex items-center gap-2">
          <Calendar size={18} className="text-[#0f88a8]" />
          {MESES_NOMES[mesAlvo]} {anoAlvo}
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navMes(-1)}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
            title="Mês anterior"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => { setMesAlvo(new Date().getMonth()); setAnoAlvo(new Date().getFullYear()) }}
            className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            Hoje
          </button>
          <button
            onClick={() => navMes(1)}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
            title="Próximo mês"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <CalendarioFerias ausencias={ausenciasDoMes} mes={mesAlvo} ano={anoAlvo} />

      {/* Tabela completa (admin) */}
      {isAdmin && ausencias.length > 0 && (
        <div className="mt-8">
          <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">
            Todas as Ausências ({ausencias.length})
          </h3>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-950">
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase text-xs tracking-wider">
                    <th className="px-4 py-3 font-semibold">Colaborador</th>
                    <th className="px-4 py-3 font-semibold">Início</th>
                    <th className="px-4 py-3 font-semibold">Fim</th>
                    <th className="px-4 py-3 font-semibold">Motivo</th>
                    <th className="px-4 py-3 font-semibold">Substituto</th>
                    <th className="px-4 py-3 font-semibold">Observação</th>
                    <th className="px-4 py-3 font-semibold text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {ausencias.map(a => (
                    <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-[#063955] dark:text-white">{a.responsaveis?.nome || '—'}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300 tabular-nums">{fmtBR(a.data_inicio)}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300 tabular-nums">{fmtBR(a.data_fim)}</td>
                      <td className="px-4 py-3">
                        <span className="inline-block bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-2 py-0.5 rounded text-xs font-medium">{a.motivo || '—'}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {a.substituto_id ? (respsById.get(a.substituto_id)?.nome || '?') : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 max-w-xs truncate" title={a.observacao || ''}>{a.observacao || '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button onClick={() => editar(a)} className="text-slate-300 hover:text-[#0f88a8] dark:hover:text-[#38bdf8] transition-colors p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" title="Editar">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => remover(a)} className="text-slate-300 hover:text-[#b43a3d] dark:hover:text-[#f87171] transition-colors p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" title="Remover">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {modalOpen && (
        <NovaAusenciaModal
          responsaveis={responsaveis}
          responsavelFixoId={modalRespFixoId}
          isAdmin={isAdmin}
          existing={modalEditing || undefined}
          onClose={() => { setModalOpen(false); setModalEditing(null) }}
          onSaved={() => { setModalOpen(false); setModalEditing(null); carregar() }}
        />
      )}
    </div>
  )
}

// ─── Helper de item compacto ───────────────────────────────────────────────
function ItemAusencia({
  a, respsById, onRemover, onEditar, podeRemover, podeEditar,
}: {
  a: Ausencia; respsById: Map<string, Responsavel>;
  onRemover: () => void; onEditar?: () => void;
  podeRemover: boolean; podeEditar?: boolean;
}) {
  const hojeIso = new Date().toISOString().slice(0, 10)
  const ativa = a.data_inicio <= hojeIso && hojeIso <= a.data_fim
  const futura = a.data_inicio > hojeIso
  const subst = a.substituto_id ? respsById.get(a.substituto_id)?.nome : null

  const bg = ativa
    ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30'
    : futura
      ? 'bg-sky-50 dark:bg-sky-500/10 border-sky-200 dark:border-sky-500/30'
      : 'bg-slate-50 dark:bg-slate-800/30 border-slate-100 dark:border-slate-700/50 opacity-60'

  return (
    <div className={`flex items-start justify-between gap-3 p-3 rounded-xl border ${bg} group`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-sm font-bold text-[#063955] dark:text-white">
          {a.responsaveis?.nome || 'Sem nome'}
          {ativa && <span className="text-[9px] uppercase font-bold tracking-widest bg-amber-500 text-white px-1.5 py-0.5 rounded">Ativa</span>}
        </div>
        <div className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 tabular-nums">
          {fmtBR(a.data_inicio)} → {fmtBR(a.data_fim)} · <span className="font-medium">{a.motivo || 'ausência'}</span>
        </div>
        {subst && (
          <div className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1 flex items-center gap-1">
            <UserCheck size={11} /> Substituto: {subst}
          </div>
        )}
      </div>
      <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
        {podeEditar && onEditar && (
          <button
            onClick={onEditar}
            className="text-slate-400 hover:text-[#0f88a8] dark:hover:text-[#38bdf8] hover:bg-white dark:hover:bg-slate-800 transition-colors p-1.5 rounded-lg"
            title="Editar"
          >
            <Pencil size={13} />
          </button>
        )}
        {podeRemover && (
          <button
            onClick={onRemover}
            className="text-slate-400 hover:text-[#b43a3d] dark:hover:text-[#f87171] hover:bg-white dark:hover:bg-slate-800 transition-colors p-1.5 rounded-lg"
            title="Remover"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Card de Minhas Ausências (visual destacado) ───────────────────────────
function MinhasAusenciasCard({
  meuResponsavelId, minhas, respsById, onEditar, onRemover, onSolicitar,
}: {
  meuResponsavelId: string | null
  minhas: Ausencia[]
  respsById: Map<string, Responsavel>
  onEditar: (a: Ausencia) => void
  onRemover: (a: Ausencia) => void
  onSolicitar: () => void
}) {
  const hojeIso = new Date().toISOString().slice(0, 10)
  const ativa = minhas.find(a => a.data_inicio <= hojeIso && hojeIso <= a.data_fim)
  const proxima = !ativa ? minhas
    .filter(a => a.data_inicio > hojeIso)
    .sort((a, b) => a.data_inicio.localeCompare(b.data_inicio))[0] : null
  const destaque = ativa || proxima
  const outras = minhas.filter(a => a.id !== destaque?.id).slice(0, 3)

  // Stats: dias totais programados no ano atual (apenas dias úteis dos períodos)
  const anoAtual = new Date().getFullYear()
  const diasTotais = minhas
    .filter(a => a.data_inicio.startsWith(String(anoAtual)) || a.data_fim.startsWith(String(anoAtual)))
    .reduce((s, a) => {
      const i = new Date(a.data_inicio + 'T00:00:00')
      const f = new Date(a.data_fim + 'T00:00:00')
      const diff = Math.round((f.getTime() - i.getTime()) / 86400000) + 1
      return s + diff
    }, 0)

  if (meuResponsavelId == null) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-5">
        <h3 className="text-xs font-bold text-[#063955] dark:text-white uppercase tracking-widest mb-3 flex items-center gap-2">
          <UserCheck size={13} className="text-amber-500" /> Minhas Ausências
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Seu email do login não corresponde a nenhum responsável cadastrado. Peça pro admin te adicionar em <code>responsaveis</code>.
        </p>
      </div>
    )
  }

  if (minhas.length === 0) {
    return (
      <div className="bg-gradient-to-br from-amber-50 via-white to-amber-50/30 dark:from-amber-500/10 dark:via-slate-900 dark:to-amber-500/5 border border-amber-200 dark:border-amber-500/30 rounded-2xl shadow-sm p-6">
        <h3 className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-widest mb-2 flex items-center gap-2">
          <Plane size={13} /> Minhas Ausências
        </h3>
        <p className="text-sm text-slate-700 dark:text-slate-200 mt-3 mb-4">
          Você ainda não tem nenhuma ausência cadastrada. Quando precisar tirar um período de férias, licença ou atestado, é só registrar aqui.
        </p>
        <button
          onClick={onSolicitar}
          className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-sm"
        >
          <Plus size={14} /> Cadastrar agora
        </button>
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-br from-amber-50 via-white to-amber-50/30 dark:from-amber-500/10 dark:via-slate-900 dark:to-amber-500/5 border border-amber-200 dark:border-amber-500/30 rounded-2xl shadow-sm p-5">
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-widest flex items-center gap-2">
          <Plane size={13} /> Minhas Ausências
        </h3>
        <div className="text-right">
          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400">{anoAtual}</div>
          <div className="text-sm font-bold text-[#063955] dark:text-white tabular-nums">{diasTotais} dia{diasTotais === 1 ? '' : 's'}</div>
        </div>
      </div>

      {/* Destaque (ativa ou próxima) */}
      {destaque && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-amber-200 dark:border-amber-500/30 p-3 mb-3 group">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded ${ativa ? 'bg-amber-500 text-white' : 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300'}`}>
                  {ativa ? 'Em curso' : 'Próxima'}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{destaque.motivo || 'ausência'}</span>
              </div>
              <div className="text-base font-bold text-[#063955] dark:text-white tabular-nums">
                {fmtBR(destaque.data_inicio)} → {fmtBR(destaque.data_fim)}
              </div>
              {destaque.substituto_id && (
                <div className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1 flex items-center gap-1">
                  <UserCheck size={11} /> Substituto: {respsById.get(destaque.substituto_id)?.nome || '?'}
                </div>
              )}
            </div>
            <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
              <button onClick={() => onEditar(destaque)} className="text-slate-400 hover:text-[#0f88a8] hover:bg-slate-100 dark:hover:bg-slate-800 p-1.5 rounded-lg transition-colors" title="Editar">
                <Pencil size={13} />
              </button>
              <button onClick={() => onRemover(destaque)} className="text-slate-400 hover:text-[#b43a3d] hover:bg-slate-100 dark:hover:bg-slate-800 p-1.5 rounded-lg transition-colors" title="Remover">
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Outras (compactas) */}
      {outras.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] uppercase font-bold tracking-widest text-slate-500 dark:text-slate-400 px-1">Outros períodos</div>
          {outras.map(a => (
            <div key={a.id} className="bg-white/60 dark:bg-slate-900/60 rounded-lg px-3 py-2 flex items-center justify-between gap-2 group hover:bg-white dark:hover:bg-slate-900 transition-colors">
              <div className="flex-1 text-xs tabular-nums text-slate-600 dark:text-slate-300">
                {fmtBR(a.data_inicio)} → {fmtBR(a.data_fim)}{' '}
                <span className="text-slate-400">· {a.motivo || 'ausência'}</span>
              </div>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => onEditar(a)} className="text-slate-400 hover:text-[#0f88a8] p-1 rounded transition-colors" title="Editar">
                  <Pencil size={12} />
                </button>
                <button onClick={() => onRemover(a)} className="text-slate-400 hover:text-[#b43a3d] p-1 rounded transition-colors" title="Remover">
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
          {minhas.length > 1 + outras.length && (
            <div className="text-[10px] text-slate-400 px-1 pt-1">+ {minhas.length - 1 - outras.length} no histórico</div>
          )}
        </div>
      )}
    </div>
  )
}

function fmtBR(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}
