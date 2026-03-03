'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  LayoutDashboard, 
  CheckSquare, 
  GitMerge, 
  User, 
  LogOut, 
  Home,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'

const navItems = [
  { name: 'Início (Sincronizar)', href: '/', icon: Home },
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Controle de Tarefas', href: '/tarefas', icon: CheckSquare },
  { name: 'Workflows', href: '/workflows', icon: GitMerge },
  { name: 'Meu Perfil', href: '/profile', icon: User },
]

export default function Sidebar() {
  const [isExpanded, setIsExpanded] = useState(true)
  const pathname = usePathname()

  // Esconde o menu na tela de login
  if (pathname === '/login') return null

  return (
    <aside 
      className={`relative bg-[#0B1F3A] text-white transition-all duration-300 ease-in-out flex flex-col shadow-2xl ${
        isExpanded ? 'w-64' : 'w-20'
      }`}
    >
      {/* Cabeçalho do Menu */}
      <div className="h-24 flex items-center justify-center border-b border-white/10 px-4">
        {isExpanded ? (
          <div className="flex flex-col items-center">
            <span className="text-xl font-bold tracking-tight text-white">Controladoria OS</span>
          </div>
        ) : (
          <span className="text-xl font-black tracking-tighter text-indigo-400">OS</span>
        )}
      </div>

      {/* Botão de Expandir/Encolher */}
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="absolute -right-3 top-8 bg-indigo-600 text-white rounded-full p-1.5 shadow-lg hover:bg-indigo-500 transition-colors z-50"
      >
        {isExpanded ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
      </button>

      {/* Links de Navegação */}
      <nav className="flex-1 pt-8 space-y-2 px-3 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon
          
          return (
            <Link 
              key={item.href} 
              href={item.href}
              className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${
                isActive 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'text-gray-400 hover:bg-white/10 hover:text-white'
              } ${!isExpanded && 'justify-center'}`}
              title={!isExpanded ? item.name : ''}
            >
              <Icon size={20} className="shrink-0" />
              {isExpanded && <span className="text-sm font-medium whitespace-nowrap">{item.name}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Botão de Sair (Rodapé do menu) */}
      <div className="p-4 border-t border-white/10">
        <Link 
          href="/logout"
          className={`flex items-center gap-3 px-3 py-3 rounded-xl text-gray-400 hover:bg-red-500/20 hover:text-red-400 transition-all ${
            !isExpanded && 'justify-center'
          }`}
          title={!isExpanded ? 'Sair' : ''}
        >
          <LogOut size={20} className="shrink-0" />
          {isExpanded && <span className="text-sm font-medium whitespace-nowrap">Sair</span>}
        </Link>
      </div>
    </aside>
  )
}