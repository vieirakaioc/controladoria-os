'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Toaster, toast } from 'react-hot-toast'
import { ShieldAlert, ShieldCheck, Users } from 'lucide-react'

type Profile = {
  id: string
  full_name: string | null
  avatar_url: string | null
  role: string
}

export default function AcessosPage() {
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [updating, setUpdating] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string>('')

  useEffect(() => {
    const carregarAcessos = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      
      setCurrentUserId(user.id)

      // Verifica se é admin
      const { data: meuPerfil } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      
      if (meuPerfil?.role === 'admin') {
        setIsAdmin(true)
        
        // Puxa toda a gente
        const { data: todosPerfis, error } = await supabase
          .from('profiles')
          .select('*')
          .order('full_name', { ascending: true })
          
        if (!error && todosPerfis) {
          setProfiles(todosPerfis)
        }
      }
      
      setLoading(false)
    }

    carregarAcessos()
  }, [router])

  const alterarRole = async (userId: string, newRole: string) => {
    if (userId === currentUserId) {
      toast.error('Não pode alterar o seu próprio nível de acesso por aqui.')
      return
    }

    setUpdating(userId)
    const toastId = toast.loading('A atualizar permissões...')

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId)

      if (error) throw error

      setProfiles(prev => prev.map(p => p.id === userId ? { ...p, role: newRole } : p))
      toast.success('Nível de acesso atualizado com sucesso!', { id: toastId })
    } catch (err: any) {
      console.error(err)
      toast.error('Erro ao atualizar permissões. Verifique as políticas de segurança (RLS).', { id: toastId })
    } finally {
      setUpdating(null)
    }
  }

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-[#0f88a8] font-medium animate-pulse">A verificar credenciais de segurança...</div>

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 p-8 flex flex-col items-center justify-center text-center">
        <ShieldAlert size={64} className="text-[#b43a3d] mb-4 opacity-80" />
        <h1 className="text-2xl font-bold text-[#063955]">Acesso Restrito</h1>
        <p className="text-slate-500 mt-2 max-w-md">Esta área é um cofre de segurança. Apenas administradores do portal podem gerir os acessos da equipa.</p>
        <button onClick={() => router.push('/tarefas')} className="mt-6 bg-[#0f88a8] hover:bg-[#0c708b] transition-colors text-white px-6 py-2.5 rounded-xl font-medium shadow-sm">
          Voltar ao Kanban
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans">
      <Toaster position="bottom-right" toastOptions={{ style: { background: '#063955', color: '#fff', borderRadius: '12px' } }} />

      <header className="mb-8 bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
        <div className="bg-[#0f88a8]/10 p-3 rounded-xl text-[#0f88a8]">
          <ShieldCheck size={32} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#063955] tracking-tight">Gestão de Acessos</h1>
          <p className="text-slate-500 text-sm mt-1">Controle quem tem acesso de Administração ao Portal da Controladoria.</p>
        </div>
      </header>

      <main className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
          <span className="text-sm font-semibold text-[#063955] flex items-center gap-2">
            <Users size={16} className="text-[#0f88a8]" /> Utilizadores Registados ({profiles.length})
          </span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200 text-slate-500 uppercase text-xs tracking-wider">
                <th className="p-4 font-semibold">Colaborador</th>
                <th className="p-4 font-semibold">ID do Sistema</th>
                <th className="p-4 font-semibold">Nível Atual</th>
                <th className="p-4 font-semibold text-right">Ação / Alterar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {profiles.map((p) => (
                <tr key={p.id} className={`transition-colors text-sm ${p.id === currentUserId ? 'bg-[#0f88a8]/5' : 'hover:bg-slate-50'}`}>
                  
                  {/* IDENTIFICAÇÃO */}
                  <td className="p-4 flex items-center gap-3">
                    {p.avatar_url ? (
                      <img src={p.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover border border-slate-200 shadow-sm" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold shadow-sm">
                        {(p.full_name || '?').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <span className="font-bold text-[#063955] block">{p.full_name || 'Sem nome definido'}</span>
                      {p.id === currentUserId && <span className="text-[10px] uppercase font-bold text-[#0f88a8] tracking-widest block mt-0.5">Você</span>}
                    </div>
                  </td>

                  {/* ID */}
                  <td className="p-4 text-slate-400 font-mono text-xs">
                    {p.id.split('-')[0]}...
                  </td>

                  {/* NÍVEL ATUAL */}
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-md text-[10px] tracking-wide uppercase font-bold ${
                      p.role === 'admin' ? 'bg-[#063955] text-white' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {p.role}
                    </span>
                  </td>

                  {/* AÇÕES DE MUDANÇA */}
                  <td className="p-4 text-right">
                    <select 
                      value={p.role}
                      onChange={(e) => alterarRole(p.id, e.target.value)}
                      disabled={p.id === currentUserId || updating === p.id}
                      className="bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg px-3 py-2 outline-none focus:border-[#0f88a8] focus:ring-1 focus:ring-[#0f88a8] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <option value="membro">Membro (Padrão)</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </td>

                </tr>
              ))}
            </tbody>
          </table>
          
          {profiles.length === 0 && (
            <div className="p-12 text-center text-slate-500">Nenhum perfil encontrado.</div>
          )}
        </div>
      </main>

    </div>
  )
}