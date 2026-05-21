'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Toaster, toast } from 'react-hot-toast'
import { Plane, Plus, Trash2, Calendar, UserCheck, ChevronLeft, ChevronRight } from 'lucide-react'
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
          .order('data_inicio', { ascending: false }),
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

  // Pode remover se for admin OU se a ausência for própria
  const podeRemover = (a: Ausencia) => isAdmin || a.responsavel_id === meuResponsavelId

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

  // Próximas (futuras + ativas hoje)
  const proximas = useMemo(() => {
    const hojeIso = new Date().toISOString().slice(0, 10)
    return ausencias
      .filter(a => a.data_fim >= hojeIso)
      .sort((a, b) => a.data_inicio.localeCompare(b.data_inicio))
      .slice(0, 5)
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
              onClick={() => { setModalRespFixoId(meuResponsavelId); setModalOpen(true) }}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-5 py-2.5 rounded-xl font-semibold transition-colors shadow-sm"
            >
              <Plus size={16} /> Solicitar minha ausência
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => { setModalRespFixoId(undefined); setModalOpen(true) }}
              className="flex items-center gap-2 bg-[#063955] hover:bg-[#042436] text-white px-5 py-2.5 rounded-xl font-semibold transition-colors shadow-sm"
            >
              <Plus size={16} /> Nova ausência (qualquer)
            </button>
          )}
        </div>
      </header>

      {/* Minhas ausências + Próximas (lado a lado) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Card: minhas ausências */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-5">
          <h3 className="text-xs font-bold text-[#063955] dark:text-white uppercase tracking-widest mb-3 flex items-center gap-2">
            <UserCheck size={13} className="text-amber-500" /> Minhas Ausências
          </h3>
          {meuResponsavelId == null ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Seu email não está cadastrado como responsável. Pede pro admin te adicionar.
            </p>
          ) : minhasAusencias.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Você não tem ausências cadastradas. Clica em "Solicitar minha ausência" pra adicionar.
            </p>
          ) : (
            <div className="space-y-2">
              {minhasAusencias.slice(0, 5).map(a => (
                <ItemAusencia key={a.id} a={a} respsById={respsById} onRemover={() => remover(a)} podeRemover={true} />
              ))}
              {minhasAusencias.length > 5 && (
                <p className="text-[11px] text-slate-400 mt-1">+ {minhasAusencias.length - 5} mais no histórico</p>
              )}
            </div>
          )}
        </div>

        {/* Card: próximas */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-5">
          <h3 className="text-xs font-bold text-[#063955] dark:text-white uppercase tracking-widest mb-3 flex items-center gap-2">
            <Calendar size={13} className="text-[#0f88a8]" /> Próximas Ausências da Equipe
          </h3>
          {proximas.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Ninguém tem ausência futura cadastrada.</p>
          ) : (
            <div className="space-y-2">
              {proximas.map(a => (
                <ItemAusencia key={a.id} a={a} respsById={respsById} onRemover={() => remover(a)} podeRemover={podeRemover(a)} />
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
                        <button onClick={() => remover(a)} className="text-slate-300 hover:text-[#b43a3d] dark:hover:text-[#f87171] transition-colors p-1" title="Remover">
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
      )}

      {modalOpen && (
        <NovaAusenciaModal
          responsaveis={responsaveis}
          responsavelFixoId={modalRespFixoId}
          isAdmin={isAdmin}
          onClose={() => setModalOpen(false)}
          onSaved={() => { setModalOpen(false); carregar() }}
        />
      )}
    </div>
  )
}

// ─── Helper de item compacto ───────────────────────────────────────────────
function ItemAusencia({
  a, respsById, onRemover, podeRemover,
}: {
  a: Ausencia; respsById: Map<string, Responsavel>;
  onRemover: () => void; podeRemover: boolean;
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
    <div className={`flex items-start justify-between gap-3 p-3 rounded-xl border ${bg}`}>
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
      {podeRemover && (
        <button
          onClick={onRemover}
          className="text-slate-300 hover:text-[#b43a3d] dark:hover:text-[#f87171] transition-colors p-1"
          title="Remover"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  )
}

function fmtBR(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}
