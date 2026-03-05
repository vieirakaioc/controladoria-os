'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { 
  LayoutDashboard, 
  CheckSquare, 
  GitMerge, 
  User, 
  LogOut, 
  Home,
  ChevronLeft,
  ChevronRight,
  Shield
} from 'lucide-react'

// PALETA OFICIAL EXTRAÍDA DA IMAGEM:
// Ciano: #0f88a8
// Verde Escuro: #2d6943
// Areia/Amarelo: #efc486
// Cinza: #818284
// Vermelho: #b43a3d
// Azul Escuro (Fundo): #063955

const allNavItems = [
  { name: 'Início (Sincronizar)', href: '/', icon: Home, adminOnly: true },
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, adminOnly: true },
  { name: 'Controle de Tarefas', href: '/tarefas', icon: CheckSquare, adminOnly: false },
  { name: 'Workflows', href: '/workflows', icon: GitMerge, adminOnly: true },
  { name: 'Auditoria', href: '/auditoria', icon: Shield, adminOnly: true },
  { name: 'Meu Perfil', href: '/profile', icon: User, adminOnly: false },
]

export default function Sidebar() {
  const [isExpanded, setIsExpanded] = useState(true)
  const [userRole, setUserRole] = useState<string>('membro')
  const [userName, setUserName] = useState<string>('')
  const [avatarUrl, setAvatarUrl] = useState<string>('')
  const pathname = usePathname()

  useEffect(() => {
    const fetchUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('role, full_name, avatar_url')
          .eq('id', user.id)
          .single()
          
        if (data) {
          setUserRole(data.role || 'membro')
          setUserName(data.full_name || user.email?.split('@')[0] || 'Usuário')
          setAvatarUrl(data.avatar_url || '')
        }
      }
    }
    if (pathname !== '/login') fetchUserData()
  }, [pathname])

  if (pathname === '/login') return null

  const navItems = allNavItems.filter(item => !item.adminOnly || userRole === 'admin')

  return (
    // Fundo Azul Escuro Oficial (#063955)
    <aside className={`relative bg-[#063955] text-white transition-all duration-300 ease-in-out flex flex-col shadow-2xl ${isExpanded ? 'w-64' : 'w-20'}`}>
      
      {/* Topo / Logotipo Atualizado */}
      <div className="h-24 flex items-center justify-center border-b border-white/10 px-4">
        {isExpanded ? (
          <div className="flex flex-col items-center">
            <span className="text-lg font-bold tracking-tight text-white text-center leading-tight">Portal da<br/><span className="text-[#efc486]">Controladoria</span></span>
          </div>
        ) : (
          <span className="text-xl font-black tracking-tighter text-[#efc486]">PC</span>
        )}
      </div>

      {/* Botão de Expandir/Recolher usando a Cor Ciano (#0f88a8) */}
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="absolute -right-3 top-8 bg-[#0f88a8] text-white rounded-full p-1.5 shadow-lg hover:brightness-110 transition-all z-50"
      >
        {isExpanded ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
      </button>

      <nav className="flex-1 pt-8 space-y-2 px-3 overflow-y-auto custom-scrollbar">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon
          return (
            <Link 
              key={item.href} 
              href={item.href}
              // Item Ativo usa o Ciano (#0f88a8). Item inativo usa Cinza (#818284) com hover para Ciano.
              className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${
                isActive 
                  ? 'bg-[#0f88a8] text-white shadow-md' 
                  : 'text-[#818284] hover:bg-white/5 hover:text-white'
              } ${!isExpanded && 'justify-center'}`}
              title={!isExpanded ? item.name : ''}
            >
              <Icon size={20} className="shrink-0" />
              {isExpanded && <span className="text-sm font-medium whitespace-nowrap">{item.name}</span>}
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t border-white/10 bg-white/5">
        
        {/* Bloco do Utilizador com Foto */}
        <Link href="/profile" className={`flex items-center gap-3 mb-4 rounded-xl transition-all hover:bg-white/5 p-2 ${!isExpanded && 'justify-center'}`}>
          {avatarUrl ? (
            <img src={avatarUrl} alt="Avatar" className="w-9 h-9 rounded-full object-cover shrink-0 border-2 border-[#efc486]" />
          ) : (
            // Fundo Verde (#2d6943) para o avatar placeholder
            <div className="w-9 h-9 bg-[#2d6943] rounded-full flex items-center justify-center shrink-0 border-2 border-transparent">
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

        {/* Botão de Sair usando a cor Vermelha (#b43a3d) no hover */}
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