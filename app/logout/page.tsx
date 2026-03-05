'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function LogoutPage() {
  useEffect(() => {
    const realizarLogout = async () => {
      // 1. Termina a sessão no banco de dados
      await supabase.auth.signOut()
      
      // 2. FORÇA O REFRESH TOTAL DA PÁGINA (Limpa o Cache Fantasma)
      window.location.href = '/login'
    }
    
    realizarLogout()
  }, [])

  return (
    <div className="min-h-screen bg-[#063955] flex flex-col items-center justify-center text-white">
      <div className="w-12 h-12 border-4 border-[#0f88a8] border-t-transparent rounded-full animate-spin mb-4"></div>
      <h2 className="text-xl font-semibold">A encerrar sessão com segurança...</h2>
      <p className="text-slate-400 text-sm mt-2">Limpando dados em cache.</p>
    </div>
  )
}