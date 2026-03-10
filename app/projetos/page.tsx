'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Toaster, toast } from 'react-hot-toast'
import { Briefcase, Plus, Calendar, CheckCircle2, Clock } from 'lucide-react'

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
}

export default function ProjetosPage() {
  const router = useRouter()
  const [projetos, setProjetos] = useState<Projeto[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

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
      // 1. Busca os projetos
      const { data: projs, error } = await supabase.from('projetos').select('*').order('created_at', { ascending: false })
      if (error) throw error

      // 2. Busca as tarefas ligadas aos projetos para calcular o progresso
      const { data: tarefas } = await supabase
        .from('tarefas_diarias')
        .select(`status, atividades!inner(projeto_id)`)
        .not('atividades.projeto_id', 'is', null)

      const projetosComEstat = (projs || []).map(p => {
        const tarefasDoProj = (tarefas || []).filter((t: any) => t.atividades.projeto_id === p.id)
        const total = tarefasDoProj.length
        const concluidas = tarefasDoProj.filter(t => (t.status || '').toLowerCase().includes('concl')).length
        const progresso = total > 0 ? Math.round((concluidas / total) * 100) : 0

        return { ...p, estatisticas: { total_tarefas: total, concluidas, progresso } }
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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-8 font-sans">
      <Toaster position="bottom-right" toastOptions={{ style: { background: '#031D2D', color: '#fff' } }} />

      <header className="flex justify-between items-center mb-8 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
        <div>
          <h1 className="text-3xl font-extrabold text-[#031D2D] dark:text-white tracking-tighter flex items-center gap-3">
            <Briefcase className="text-[#C7A77B]" size={28} /> Gestão de Projetos
          </h1>
          <p className="text-slate-500 text-sm mt-1.5 font-medium">Acompanhe as macro-entregas e iniciativas da equipa.</p>
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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {projetos.map(proj => (
            <div key={proj.id} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col relative overflow-hidden group">
              {/* Barra superior de cor */}
              <div className={`absolute top-0 left-0 w-full h-1.5 ${proj.status === 'Concluído' ? 'bg-[#5A755C]' : 'bg-[#C7A77B]'}`}></div>
              
              <div className="flex justify-between items-start mb-4 pt-2">
                <h3 className="text-lg font-bold text-[#031D2D] dark:text-white leading-tight pr-4">{proj.nome}</h3>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md whitespace-nowrap ${proj.status === 'Concluído' ? 'bg-[#5A755C]/10 text-[#5A755C]' : 'bg-[#C7A77B]/10 text-[#C7A77B]'}`}>
                  {proj.status}
                </span>
              </div>
              
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 line-clamp-2 min-h-[40px]">{proj.descricao || 'Sem descrição'}</p>

              <div className="mt-auto space-y-5">
                <div className="flex justify-between text-xs font-medium text-slate-500">
                  <div className="flex items-center gap-1.5"><Calendar size={14}/> Início: {formatarData(proj.data_inicio)}</div>
                  <div className="flex items-center gap-1.5"><Clock size={14}/> Prazo: {formatarData(proj.data_fim_prevista)}</div>
                </div>

                <div className="pt-5 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex justify-between text-sm mb-2 font-medium">
                    <span className="text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                      <CheckCircle2 size={16} className={proj.estatisticas?.progresso === 100 ? 'text-[#5A755C]' : 'text-slate-400'}/> Progresso
                    </span>
                    <span className="text-[#031D2D] dark:text-white font-bold">{proj.estatisticas?.progresso}%</span>
                  </div>
                  <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-[#031D2D] dark:bg-[#C7A77B] rounded-full transition-all duration-1000 ease-out" style={{ width: `${proj.estatisticas?.progresso}%` }}></div>
                  </div>
                  <div className="mt-2 text-[11px] text-slate-400 text-right">
                    {proj.estatisticas?.concluidas} de {proj.estatisticas?.total_tarefas} tarefas concluídas
                  </div>
                </div>
              </div>
            </div>
          ))}
          {projetos.length === 0 && (
            <div className="col-span-full text-center py-20 text-slate-500 bg-white rounded-2xl border border-dashed border-slate-200">
              Nenhum projeto ativo. Clique em "Novo Projeto" para começar.
            </div>
          )}
        </div>
      )}

      {/* MODAL NOVO PROJETO */}
      {modalOpen && (
        <div className="fixed inset-0 bg-[#031D2D]/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h2 className="text-xl font-bold text-[#031D2D] dark:text-white">Criar Novo Projeto</h2>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">Nome do Projeto</label>
                <input value={novoNome} onChange={e => setNovoNome(e.target.value)} className="w-full border border-slate-200 dark:border-slate-700 bg-transparent rounded-xl px-4 py-2.5 outline-none focus:border-[#C7A77B] text-slate-800 dark:text-white" placeholder="Ex: Construção Dormitório..." />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">Descrição / Objetivo</label>
                <textarea value={novaDesc} onChange={e => setNovaDesc(e.target.value)} rows={3} className="w-full border border-slate-200 dark:border-slate-700 bg-transparent rounded-xl px-4 py-2.5 outline-none focus:border-[#C7A77B] text-slate-800 dark:text-white resize-none" placeholder="Qual o grande objetivo desta iniciativa?" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Data Início</label>
                  <input type="date" value={novoInicio} onChange={e => setNovoInicio(e.target.value)} className="w-full border border-slate-200 dark:border-slate-700 bg-transparent rounded-xl px-4 py-2.5 outline-none focus:border-[#C7A77B] text-slate-800 dark:text-white" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Previsão Fim</label>
                  <input type="date" value={novoFim} onChange={e => setNovoFim(e.target.value)} className="w-full border border-slate-200 dark:border-slate-700 bg-transparent rounded-xl px-4 py-2.5 outline-none focus:border-[#C7A77B] text-slate-800 dark:text-white" />
                </div>
              </div>
            </div>
            <div className="p-6 bg-slate-50 dark:bg-slate-950 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
              <button onClick={() => setModalOpen(false)} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">Cancelar</button>
              <button onClick={criarProjeto} disabled={salvando} className="bg-[#C7A77B] hover:bg-[#A68A63] text-[#031D2D] px-6 py-2.5 rounded-xl text-sm font-bold shadow-md transition-colors disabled:opacity-50">
                {salvando ? 'A criar...' : 'Salvar Projeto'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}