'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [isLoginMode, setIsLoginMode] = useState(true)

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMsg('')

    if (isLoginMode) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setMsg('❌ Credenciais inválidas.')
        setLoading(false)
        return
      }
      router.push('/tarefas')
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setMsg('❌ ' + error.message)
        setLoading(false)
        return
      }
      setMsg('✅ Conta criada! Verifique o seu email ou faça login.')
      setIsLoginMode(true)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md bg-white border border-slate-100 rounded-3xl shadow-xl p-10 flex flex-col items-center">
        
        {/* Logotipo Simplificado */}
        <div className="h-16 w-16 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-md mb-6">
          <span className="text-white text-2xl font-bold tracking-tighter">OS</span>
        </div>

        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Controladoria OS</h1>
        <p className="text-slate-500 font-medium text-sm mt-2 text-center mb-8">
          {isLoginMode ? 'Aceda ao seu painel de gestão.' : 'Crie uma conta para aceder ao sistema.'}
        </p>

        {msg && (
          <div className={`w-full p-4 rounded-xl text-sm font-medium mb-6 ${msg.includes('✅') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
            {msg}
          </div>
        )}

        <form onSubmit={handleAuth} className="w-full space-y-4">
          <div>
            <label className="text-xs font-semibold tracking-wide text-slate-500 uppercase mb-2 block">Email</label>
            <input
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-sm outline-none focus:border-indigo-600 focus:bg-white transition-colors"
              placeholder="exemplo@empresa.com"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          
          <div>
            <label className="text-xs font-semibold tracking-wide text-slate-500 uppercase mb-2 block">Password</label>
            <input
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-sm outline-none focus:border-indigo-600 focus:bg-white transition-colors"
              placeholder="••••••••"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3.5 rounded-xl shadow-md disabled:opacity-50 transition-all mt-4"
          >
            {loading ? 'A processar...' : (isLoginMode ? 'Entrar no Sistema' : 'Criar Conta')}
          </button>
        </form>

        <button
          onClick={() => setIsLoginMode(!isLoginMode)}
          className="mt-8 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors"
        >
          {isLoginMode ? 'Não tem conta? Criar nova conta' : 'Já tem conta? Fazer login'}
        </button>

      </div>
    </div>
  )
}