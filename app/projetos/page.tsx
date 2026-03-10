'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Toaster, toast } from 'react-hot-toast'
import { Briefcase, Plus, Calendar, CheckCircle2, Clock, ChevronDown, ChevronUp, UserCircle } from 'lucide-react'

type Projeto = {
  id: string
  nome: string
  descricao: string
  status: string
  data_inicio: string
  data_fim_prevista: string
  estatisticas?: {
    total_tarefas: number
    concluidas: number
    progresso: number
  }
  tarefas?: any[] // 💡 NOVO: Guarda as tarefas vinculadas para o Drill-down
}

// 💡 Helper para manter as cores de status iguais às do Kanban
const badge = (s?: string | null) => {
  const st = (s || 'Pendente').toLowerCase()
  if (st.includes('concl')) return 'bg-[#2d6943]/10 text-[#2d6943] dark:bg-[#2d6943]/20 dark:text-[#4ade80]' 
  if (st.includes('and')) return 'bg-[#0f88a8]/10 text-[#0f88a8] dark:bg-[#0f88a8]/20 dark:text-[#7dd3fc]'   
  if (st.includes('aguard')) return 'bg-[#a78bfa]/10 text-[#7c3aed] dark:bg-[#a78bfa]/20 dark:text-[#c4b5fd]' 
  if (st.includes('pend')) return 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300'
  return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
}

// 💡 Helper para ler múltiplos responsáveis
const getResponsaveis = (atv: any) => {
  if (atv?.responsaveis_lista && Array.isArray(atv.responsaveis_lista) && atv.responsaveis_lista.length > 0) return atv.responsaveis_lista;
  if (atv?.responsaveis) return [atv.responsaveis];
  return [];
}

export default function ProjetosPage() {
  const router = useRouter()
  const [projetos, setProjetos] = useState<Projeto[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  
  // 💡 NOVO ESTADO: Controla qual projeto está com o Drill-down aberto
  const [expandedProjId, setExpandedProjId] = useState<string | null>(null)

  // Estado do Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [novoNome, setNovoNome] = useState('')
  const [novaDesc, setNovaDesc] = useState('')
  const [novoInicio, setNovoInicio] = useState(new Date().toISOString().slice(0, 10))
  const [novoFim, setNovoFim] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    verificarAcesso()
    carregarProjetos()
  }, [])

  const verificarAcesso = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return router.push('/login')
    const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    setIsAdmin(data?.role === 'admin')
  }

  const carregarProjetos = async () => {
    setLoading(true)
    try {
      const { data: projs, error } = await supabase.from('projetos').select('*').order('created_at', { ascending: false })
      if (error) throw error

      // 💡 ATUALIZADO: Agora busca também os detalhes internos das tarefas (Nome, Status, Responsáveis)
      const { data: tarefas } = await supabase
        .from('tarefas_diarias')
        .select(`
          id, status, data_vencimento, 
          atividades!inner(projeto_id, nome_atividade, responsaveis_lista, responsaveis(nome))
        `)
        .not('atividades.projeto_id', 'is', null)

      const projetosComEstat = (projs || []).map(p => {
        const tarefasDoProj = (tarefas || []).filter((t: any) => t.atividades.projeto_id === p.id)
        const total = tarefasDoProj.length
        const concluidas = tarefasDoProj.filter(t => (t.status || '').toLowerCase().includes('concl')).length
        const progresso = total > 0 ? Math.round((concluidas / total) * 100) : 0

        // Ordena as tarefas: Pendentes primeiro, Concluídas no final
        const tarefasOrdenadas = tarefasDoProj.sort((a, b) => {
          const aConcl = (a.status || '').toLowerCase().includes('concl') ? 1 : 0
          const bConcl = (b.status || '').toLowerCase().includes('concl') ? 1 : 0
          return aConcl - bConcl
        })

        return { ...p, estatisticas: { total_tarefas: total, concluidas, progresso }, tarefas: tarefasOrdenadas }
      })

      setProjetos(projetosComEstat)
    } catch (error) {
      toast.error('Erro ao carregar projetos.')
    } finally {
      setLoading(false)
    }
  }

  const criarProjeto = async () => {
    if (!novoNome.trim()) return toast.error('O nome do projeto é obrigatório.')
    setSalvando(true)
    const toastId = toast.loading('A criar projeto...')

    try {
      const payload = {
        nome: novoNome,
        descricao: novaDesc,
        data_inicio: novoInicio || null,
        data_fim_prevista: novoFim || null,
        status: 'Em Andamento'
      }

      const { error } = await supabase.from('projetos').insert([payload])
      if (error) throw error

      toast.success('Projeto criado com sucesso!', { id: toastId })
      setModalOpen(false)
      setNovoNome(''); setNovaDesc(''); setNovoFim('')
      carregarProjetos()
    } catch (error) {
      toast.error('Erro ao criar projeto.', { id: toastId })
    } finally {
      setSalvando(false)
    }
  }

  const formatarData = (d: string) => {
    if (!d) return '—'
    return `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`
  }

  const toggleExpand = (id: string) => {
    setExpandedProjId(prev => prev === id ? null : id)
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-8 font-sans">
      <Toaster position="bottom-right" toastOptions={{ style: { background: '#031D2D', color: '#fff' } }} />

      <header className="flex justify-between items-center mb-8 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100/50 dark:border-slate-800/50">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-950 dark:text-white tracking-tighter flex items-center gap-3">
            <Briefcase className="text-[#C7A77B]" size={28} /> Gestão de Projetos
          </h1>
          <p className="text-slate-500 text-sm mt-1.5 font-medium">Acompanhe as macro-entregas e faça drill-down nas atividades.</p>
        </div>

        {isAdmin && (
          <button onClick={() => setModalOpen(true)} className="flex items-center gap-2 bg-[#031D2D] hover:bg-[#063955] text-[#E5D6A7] px-6 py-3 rounded-xl text-sm font-bold transition-all shadow-md">
            <Plus size={18} /> Novo Projeto
          </button>
        )}
      </header>

      {loading ? (
        <div className="text-center py-20 text-[#031D2D] font-medium animate-pulse">A carregar portfólio...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {projetos.map(proj => {
            const isExpanded = expandedProjId === proj.id
            
            return (
              <div key={proj.id} className="bg-white dark:bg-slate-900 border border-slate-100/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col relative overflow-hidden group">
                <div className={`absolute top-0 left-0 w-full h-1.5 ${proj.status === 'Concluído' ? 'bg-[#5A755C]' : 'bg-[#C7A77B]'}`}></div>
                
                <div className="flex justify-between items-start mb-4 pt-2">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white leading-tight pr-4 tracking-tight">{proj.nome}</h3>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md whitespace-nowrap ${proj.status === 'Concluído' ? 'bg-[#5A755C]/10 text-[#5A755C]' : 'bg-[#C7A77B]/10 text-[#C7A77B]'}`}>
                    {proj.status}
                  </span>
                </div>
                
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 line-clamp-2 min-h-[40px]">{proj.descricao || 'Sem descrição'}</p>

                <div className="mt-auto space-y-6">
                  <div className="flex justify-between text-xs font-semibold text-slate-500 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-1.5"><Calendar size={14} className="text-[#C7A77B]"/> Início: {formatarData(proj.data_inicio)}</div>
                    <div className="flex items-center gap-1.5"><Clock size={14} className="text-[#031D2D] dark:text-white"/> Prazo: {formatarData(proj.data_fim_prevista)}</div>
                  </div>

                  <div className="pt-2">
                    <div className="flex justify-between text-sm mb-2 font-medium">
                      <span className="text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                        <CheckCircle2 size={16} className={proj.estatisticas?.progresso === 100 ? 'text-[#5A755C]' : 'text-slate-400'}/> Progresso
                      </span>
                      <span className="text-[#031D2D] dark:text-white font-bold">{proj.estatisticas?.progresso}%</span>
                    </div>
                    <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner">
                      <div className="h-full bg-[#031D2D] dark:bg-[#C7A77B] rounded-full transition-all duration-1000 ease-out" style={{ width: `${proj.estatisticas?.progresso}%` }}></div>
                    </div>
                    <div className="mt-2 flex justify-between items-center text-[11px] text-slate-400">
                      <span>{proj.estatisticas?.concluidas} de {proj.estatisticas?.total_tarefas} tarefas concluídas</span>
                      
                      {/* 💡 BOTÃO DRILL-DOWN */}
                      <button 
                        onClick={() => toggleExpand(proj.id)}
                        className="flex items-center gap-1 font-bold text-[#0f88a8] dark:text-[#38bdf8] hover:text-[#063955] dark:hover:text-white transition-colors"
                      >
                        {isExpanded ? 'Ocultar Tarefas' : 'Ver Tarefas'}
                        {isExpanded ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                      </button>
                    </div>
                  </div>

                  {/* 💡 SESSÃO DRILL-DOWN (LISTA DE TAREFAS) */}
                  {isExpanded && (
                    <div className="pt-5 mt-4 border-t border-slate-100 dark:border-slate-800 animate-in fade-in slide-in-from-top-4 duration-300">
                      <h4 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Detalhamento das Atividades</h4>
                      
                      <div className="space-y-2 max-h-[220px] overflow-y-auto custom-scrollbar pr-2">
                        {proj.tarefas?.map((t: any) => {
                          const respsList = getResponsaveis(t.atividades);
                          const nomes = respsList.length > 0 ? respsList.map((res:any) => res.nome).join(', ') : 'Sem Responsável';
                          
                          return (
                            <div key={t.id} className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-100 dark:border-slate-700/50 flex flex-col gap-2 hover:border-[#0f88a8]/30 transition-colors">
                              <div className="flex justify-between items-start gap-3">
                                <span className="text-sm font-semibold text-slate-800 dark:text-white leading-tight">
                                  {t.atividades?.nome_atividade || 'Tarefa sem nome'}
                                </span>
                                <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md whitespace-nowrap shrink-0 ${badge(t.status)}`}>
                                  {t.status}
                                </span>
                              </div>
                              
                              <div className="flex justify-between items-center text-[10px] font-medium">
                                <div className="flex items-center gap-1.5 text-slate-500 bg-white dark:bg-slate-900 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 truncate max-w-[180px]" title={nomes}>
                                  <UserCircle size={12} className="text-[#C7A77B]" />
                                  <span className="truncate">{nomes}</span>
                                </div>
                                <span className="text-slate-400">
                                  Vence: {formatarData(t.data_vencimento)}
                                </span>
                              </div>
                            </div>
                          )
                        })}
                        {(!proj.tarefas || proj.tarefas.length === 0) && (
                          <div className="text-center py-6 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                            <p className="text-xs text-slate-400 font-medium">Nenhuma tarefa vinculada a este projeto ainda.</p>
                          </div>
                        )}
                      </div>
                      
                      <div className="mt-4 text-center">
                         <button onClick={() => router.push('/tarefas')} className="text-xs font-bold text-[#C7A77B] hover:text-[#A68A63] transition-colors underline underline-offset-2">
                           Ir para o Kanban Gerir Tarefas
                         </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          
          {projetos.length === 0 && (
            <div className="col-span-full text-center py-20 text-slate-500 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 shadow-sm">
              Nenhum projeto ativo no momento. 
              {isAdmin && <span className="block mt-2 font-semibold text-[#031D2D] dark:text-white">Clique no botão "Novo Projeto" lá no topo para começar.</span>}
            </div>
          )}
        </div>
      )}

      {/* MODAL NOVO PROJETO (Apenas Admin) */}
      {modalOpen && isAdmin && (
        <div className="fixed inset-0 bg-[#031D2D]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/50">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Criar Novo Projeto</h2>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600 bg-white dark:bg-slate-800 rounded-full p-1 border border-slate-200 dark:border-slate-700 transition-colors">✕</button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Nome do Projeto</label>
                <input value={novoNome} onChange={e => setNovoNome(e.target.value)} className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 rounded-xl px-4 py-3 outline-none focus:border-[#C7A77B] text-slate-800 dark:text-white font-medium transition-colors" placeholder="Ex: Construção Dormitório..." />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Descrição / Objetivo</label>
                <textarea value={novaDesc} onChange={e => setNovaDesc(e.target.value)} rows={3} className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 rounded-xl px-4 py-3 outline-none focus:border-[#C7A77B] text-slate-800 dark:text-white font-medium resize-none transition-colors" placeholder="Qual o grande objetivo desta iniciativa?" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Data Início</label>
                  <input type="date" value={novoInicio} onChange={e => setNovoInicio(e.target.value)} className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 rounded-xl px-4 py-3 outline-none focus:border-[#C7A77B] text-slate-800 dark:text-white font-medium transition-colors" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Previsão Fim</label>
                  <input type="date" value={novoFim} onChange={e => setNovoFim(e.target.value)} className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 rounded-xl px-4 py-3 outline-none focus:border-[#C7A77B] text-slate-800 dark:text-white font-medium transition-colors" />
                </div>
              </div>
            </div>
            <div className="p-6 bg-slate-50/50 dark:bg-slate-950/50 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
              <button onClick={() => setModalOpen(false)} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors">Cancelar</button>
              <button onClick={criarProjeto} disabled={salvando} className="bg-[#C7A77B] hover:bg-[#A68A63] text-[#031D2D] px-6 py-2.5 rounded-xl text-sm font-bold shadow-md transition-colors disabled:opacity-50 tracking-tight">
                {salvando ? 'A processar...' : 'Salvar Projeto'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}