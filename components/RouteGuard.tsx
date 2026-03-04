'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function RouteGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session && pathname !== '/login') {
        // Se não tem login e tentou aceder ao sistema, expulsa para o login
        router.replace('/login')
      } else if (session && pathname === '/login') {
        // Se tem login e tentou ir para a página de login, atira para as tarefas
        router.replace('/tarefas')
      } else {
        // Tudo certo, permite ver o ecrã
        setAuthorized(true)
      }
    }

    checkAuth()

    // Fica a escutar caso a pessoa faça logout
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session && pathname !== '/login') {
        router.replace('/login')
      }
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [pathname, router])

  // Mostra um ecrã em branco seguro enquanto verifica a chave, para não piscar os dados da empresa
  if (!authorized) {
    return <div className="h-screen w-screen flex items-center justify-center bg-slate-50" />
  }

  return <>{children}</>
}