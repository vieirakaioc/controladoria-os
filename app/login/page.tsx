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

  const signIn = async () => {
    setLoading(true)
    setMsg('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setMsg('❌ ' + error.message)
      setLoading(false)
      return
    }
    setMsg('✅ Logado!')
    setLoading(false)
    router.push('/tarefas')
  }

  const signUp = async () => {
    setLoading(true)
    setMsg('')
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) {
      setMsg('❌ ' + error.message)
      setLoading(false)
      return
    }
    setMsg('✅ Conta criada! Agora faz login.')
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl shadow-xl p-8">
        <h1 className="text-3xl font-black text-indigo-950 uppercase tracking-tighter">Login</h1>
        <p className="text-gray-500 font-semibold mt-1">Acessar Controladoria OS</p>

        {msg && <div className="mt-4 text-sm font-black text-indigo-700">{msg}</div>}

        <div className="mt-6 space-y-3">
          <input
            className="w-full border border-gray-200 rounded-xl px-4 py-3 font-semibold"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="w-full border border-gray-200 rounded-xl px-4 py-3 font-semibold"
            placeholder="Senha"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button
            onClick={signIn}
            disabled={loading || !email || !password}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3 rounded-xl shadow-md disabled:opacity-50"
          >
            {loading ? '...' : 'Entrar'}
          </button>

          <button
            onClick={signUp}
            disabled={loading || !email || !password}
            className="w-full bg-white border border-gray-200 hover:bg-gray-50 font-black py-3 rounded-xl disabled:opacity-50"
          >
            Criar conta
          </button>

          <div className="text-xs text-gray-500 font-semibold">
            Dica: se você habilitou confirmação por email no Supabase, talvez precise confirmar antes de logar.
          </div>
        </div>
      </div>
    </div>
  )
}