'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { checarRetornoAmanha } from '@/lib/adminReminders'
import { notificarDesktop, pedirPermissaoNotificacoes, permissaoNotificacoes } from '@/lib/desktopNotify'
import {
  LayoutDashboard,
  CheckSquare,
  GitMerge,
  User,
  LogOut,
  Home,
  ChevronLeft,
  ChevronRight,
  Shield,
  Bell,
  CheckCheck,
  Key,
  Briefcase,
  Users,
  BookOpen,
  Plane,
  ScanLine
} from 'lucide-react'
import { podeVerValidacaoFiscal } from '@/app/validacao-fiscal/_lib/acesso'

const allNavItems = [
  { name: 'Início (Sincronizar)', href: '/', icon: Home, adminOnly: true },
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, adminOnly: false },
  { name: 'Gestão de Projetos', href: '/projetos', icon: Briefcase, adminOnly: false },
  { name: 'Controle de Tarefas', href: '/tarefas', icon: CheckSquare, adminOnly: false },
  // Módulo restrito: além de admin, só quem está na lista de acesso.
  { name: 'Validação Fiscal', href: '/validacao-fiscal', icon: ScanLine, adminOnly: false, restrito: true },
  { name: 'Monitor da Equipe', href: '/equipe', icon: Users, adminOnly: true },
  { name: 'Férias da Equipe', href: '/ferias', icon: Plane, adminOnly: false },
  { name: 'Workflows', href: '/workflows', icon: GitMerge, adminOnly: true },
  { name: 'Gestão de Acessos', href: '/acessos', icon: Key, adminOnly: true },
  { name: 'Auditoria', href: '/auditoria', icon: Shield, adminOnly: true },
  { name: 'Manual', href: '/ajuda', icon: BookOpen, adminOnly: false },
  { name: 'Meu Perfil', href: '/profile', icon: User, adminOnly: false },
]

export default function Sidebar() {
  const [isExpanded, setIsExpanded] = useState(true)
  const [userRole, setUserRole] = useState<string>('membro')
  const [userName, setUserName] = useState<string>('')
  const [userEmail, setUserEmail] = useState<string>('')
  const [avatarUrl, setAvatarUrl] = useState<string>('')
  const pathname = usePathname()
  const router = useRouter()

  const [logoEmpresa, setLogoEmpresa] = useState<string | null>(null)
  const [notificacoes, setNotificacoes] = useState<any[]>([])
  const [notifOpen, setNotifOpen] = useState(false)
  const unreadCount = notificacoes.filter(n => !n.lida).length

  const fetchNotificacoes = async (emailBusca: string) => {
    try {
      if (!emailBusca) return
      const { data, error } = await supabase
        .from('notificacoes')
        .select('*')
        .eq('user_email', emailBusca)
        .order('created_at', { ascending: false })
        .limit(20)
      if (!error && data) setNotificacoes(data)
    } catch (e) {
      console.error("Erro silencioso nas notificações", e)
    }
  }

  const fetchConfigEmpresa = async () => {
    try {
      // 💡 BLINDAGEM: Usamos maybeSingle para não dar erro se a tabela estiver vazia
      const { data, error } = await supabase.from('empresa_config').select('logo_url').eq('id', 1).maybeSingle()
      if (!error && data?.logo_url) {
        setLogoEmpresa(data.logo_url)
      }
    } catch (e) {
      console.error("Erro silencioso ao buscar logo", e)
    }
  }

  useEffect(() => {
    fetchConfigEmpresa()

    const fetchUserData = async (userId: string, email: string) => {
      setUserEmail(email)
      fetchNotificacoes(email)
      
      try {
        const { data } = await supabase.from('profiles').select('role, full_name, avatar_url').eq('id', userId).single()
        if (data) {
          setUserRole(data.role || 'membro')
          setUserName(data.full_name || email.split('@')[0] || 'Usuário')
          setAvatarUrl(data.avatar_url || '')

          // Avisos automáticos pra admin (1x/dia via localStorage)
          if (data.role === 'admin' && email) {
            checarRetornoAmanha(userId, email, data.full_name || email)
          }
        }
      } catch(e) {}
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) fetchUserData(session.user.id, session.user.email || '')
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetchUserData(session.user.id, session.user.email || '')
      } else {
        setUserName('')
        setUserEmail('')
        setUserRole('membro')
        setAvatarUrl('')
        setNotificacoes([])
      }
    })

    return () => subscription.unsubscribe()
  }, [pathname])

  // ─── Realtime: substitui o polling de 30s por uma subscription ─────────
  // Quando uma notificação nova chega (INSERT) ou é marcada como lida em outra
  // aba (UPDATE), o badge atualiza na hora — sem precisar esperar o intervalo.
  useEffect(() => {
    if (!userEmail) return

    const channel = supabase
      .channel(`notif-${userEmail}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notificacoes',
          filter: `user_email=eq.${userEmail}`,
        },
        (payload) => {
          const nova = payload.new as any
          setNotificacoes(prev => {
            // Evita duplicar se chegou via outro caminho (ex: refresh manual)
            if (prev.some(n => n.id === nova.id)) return prev
            return [nova, ...prev].slice(0, 20)
          })
          // Notificação desktop (silenciosa se tab visível ou sem permissão)
          notificarDesktop({
            titulo: nova.titulo || 'Portal da Controladoria',
            corpo: nova.mensagem || '',
            url: nova.tarefa_id ? `/tarefas?taskId=${nova.tarefa_id}` : '/tarefas',
            tag: `notif-${nova.id}`,
          })
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notificacoes',
          filter: `user_email=eq.${userEmail}`,
        },
        (payload) => {
          setNotificacoes(prev =>
            prev.map(n => (n.id === (payload.new as any).id ? (payload.new as any) : n)),
          )
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userEmail])

  // 💡 O DEEP LINKING BLINDADO
  const handleClickNotificacao = async (n: any) => {
    try {
      if (!n.lida) {
        setNotificacoes(prev => prev.map(notif => notif.id === n.id ? { ...notif, lida: true } : notif))
        await supabase.from('notificacoes').update({ lida: true }).eq('id', n.id)
      }
      
      setNotifOpen(false) 

      if (n.tarefa_id) {
        router.push(`/tarefas?taskId=${n.tarefa_id}`)
      } else {
        router.push('/tarefas')
      }
    } catch(e) {
      console.error("Erro no clique da notificação", e)
      router.push('/tarefas') // Fallback de segurança
    }
  }

  const marcarTodasComoLidas = async () => {
    setNotificacoes(prev => prev.map(n => ({ ...n, lida: true })))
    await supabase.from('notificacoes').update({ lida: true }).eq('user_email', userEmail).eq('lida', false)
  }

  if (pathname === '/login') return null

  const navItems = allNavItems.filter(item => {
    if (item.adminOnly && userRole !== 'admin') return false
    if (item.restrito && !podeVerValidacaoFiscal(userRole, userEmail)) return false
    return true
  })

  return (
    <aside className={`relative bg-[#063955] text-white transition-all duration-300 ease-in-out flex flex-col shadow-2xl z-50 ${isExpanded ? 'w-64' : 'w-20'}`}>
      
      <div className="h-24 flex items-center justify-center border-b border-white/10 px-4 shrink-0">
        {isExpanded ? (
          <div className="flex flex-col items-center">
            <span className="text-lg font-bold tracking-tight text-white text-center leading-tight">Portal da<br/><span className="text-[#efc486]">Controladoria</span></span>
          </div>
        ) : (
          <span className="text-xl font-black tracking-tighter text-[#efc486]">PC</span>
        )}
      </div>

      {logoEmpresa && (
        <div className={`flex justify-center items-center py-5 border-b border-white/5 shrink-0 bg-white/5 transition-all ${isExpanded ? 'px-4' : 'px-2'}`}>
          <img 
            src={logoEmpresa} 
            alt="Logo Empresa" 
            className={`object-contain transition-all duration-300 drop-shadow-md ${isExpanded ? 'max-h-16 max-w-full' : 'max-h-8 max-w-[40px]'}`} 
          />
        </div>
      )}

      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="absolute -right-3 top-8 bg-[#0f88a8] text-white rounded-full p-1.5 shadow-lg hover:brightness-110 transition-all z-50"
      >
        {isExpanded ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
      </button>

      <nav className="flex-1 pt-6 space-y-2 px-3 overflow-y-auto custom-scrollbar">
        {navItems.map((item) => {
          // startsWith para o item seguir destacado nas sub-rotas (ex:
          // /validacao-fiscal/matriz). '/' continua exato, senão casaria tudo.
          const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
          const Icon = item.icon
          return (
            <Link 
              key={item.href} 
              href={item.href}
              className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${
                isActive ? 'bg-[#0f88a8] text-white shadow-md' : 'text-[#818284] hover:bg-white/5 hover:text-white'
              } ${!isExpanded && 'justify-center'}`}
              title={!isExpanded ? item.name : ''}
            >
              <Icon size={20} className="shrink-0" />
              {isExpanded && <span className="text-sm font-medium whitespace-nowrap">{item.name}</span>}
            </Link>
          )
        })}
      </nav>

      {/* RODAPÉ DO MENU */}
      <div className="p-4 border-t border-white/10 bg-white/5 space-y-2 relative shrink-0">
        
        <button 
          onClick={() => {
            setNotifOpen(!notifOpen)
            // Pede permissão pra notificação desktop na primeira interação real
            // com o sino (intent claro do usuário). Idempotente.
            if (!notifOpen && permissaoNotificacoes() === 'default') {
              pedirPermissaoNotificacoes()
            }
          }}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all w-full relative ${
            notifOpen ? 'bg-[#0f88a8] text-white shadow-md' : 'text-[#818284] hover:bg-white/5 hover:text-white'
          } ${!isExpanded && 'justify-center'}`}
          title={!isExpanded ? 'Notificações' : ''}
        >
          <div className="relative shrink-0">
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-[#b43a3d] text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full animate-pulse">
                {unreadCount}
              </span>
            )}
          </div>
          {isExpanded && (
            <div className="flex flex-1 justify-between items-center">
              <span className="text-sm font-medium whitespace-nowrap">Notificações</span>
              {unreadCount > 0 && <span className="text-xs bg-[#b43a3d] px-2 py-0.5 rounded-full font-bold">{unreadCount}</span>}
            </div>
          )}
        </button>

        {notifOpen && (
          <div className="absolute bottom-4 left-full ml-4 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[450px] z-[100]">
            <div className="p-4 bg-[#063955] flex justify-between items-center text-white shrink-0">
              <span className="font-bold text-sm">Central de Alertas</span>
              {unreadCount > 0 && (
                <button onClick={marcarTodasComoLidas} className="text-xs text-[#0f88a8] hover:text-white flex items-center gap-1 transition-colors">
                  <CheckCheck size={14}/> Marcar lidas
                </button>
              )}
            </div>
            <div className="overflow-y-auto flex-1 p-2 space-y-1 bg-slate-50 custom-scrollbar">
              {notificacoes.map(n => (
                <div 
                  key={n.id} 
                  onClick={() => handleClickNotificacao(n)}
                  className={`p-3 rounded-xl cursor-pointer transition-all ${n.lida ? 'bg-white opacity-60 hover:opacity-100' : 'bg-[#0f88a8]/10 border border-[#0f88a8]/20 shadow-sm'}`}
                >
                  <h4 className={`text-xs ${n.lida ? 'font-semibold text-slate-700' : 'font-bold text-[#063955]'}`}>{n.titulo}</h4>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">{n.mensagem}</p>
                  <span className="text-[9px] text-slate-400 mt-2 block">{new Date(n.created_at).toLocaleString('pt-BR', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'})}</span>
                </div>
              ))}
              {notificacoes.length === 0 && (
                <div className="p-8 flex flex-col items-center justify-center text-center text-slate-400">
                  <Bell size={32} className="mb-2 opacity-50" />
                  <span className="text-xs font-medium">Nenhuma notificação por enquanto.</span>
                </div>
              )}
            </div>
          </div>
        )}

        <Link href="/profile" className={`flex items-center gap-3 mb-2 rounded-xl transition-all hover:bg-white/5 p-2 ${!isExpanded && 'justify-center'}`}>
          {avatarUrl ? (
            <img src={avatarUrl} alt="Avatar" className="w-9 h-9 rounded-full object-cover shrink-0 border border-[#efc486]" />
          ) : (
            <div className="w-9 h-9 bg-[#2d6943] rounded-full flex items-center justify-center shrink-0 border border-transparent">
              <span className="text-white font-bold text-sm">{userName.charAt(0).toUpperCase()}</span>
            </div>
          )}
          {isExpanded && (
            <div className="flex flex-col truncate">
              <span className="text-sm font-semibold text-white truncate">{userName}</span>
              <span className="text-[10px] uppercase tracking-wider text-[#efc486] font-bold">{userRole}</span>
            </div>
          )}
        </Link>

        <Link 
          href="/logout"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[#818284] hover:bg-[#b43a3d]/20 hover:text-[#b43a3d] transition-all ${!isExpanded && 'justify-center'}`}
          title={!isExpanded ? 'Sair' : ''}
        >
          <LogOut size={18} className="shrink-0" />
          {isExpanded && <span className="text-sm font-medium whitespace-nowrap">Terminar Sessão</span>}
        </Link>
      </div>

    </aside>
  )
}