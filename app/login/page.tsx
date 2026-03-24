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

  const [viewMode, setViewMode] = useState<'login' | 'signup' | 'reset'>('login')

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMsg('')

    if (viewMode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setMsg('❌ Credenciais inválidas.')
        setLoading(false)
        return
      }
      router.push('/tarefas')
    } else if (viewMode === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setMsg('❌ ' + error.message)
        setLoading(false)
        return
      }
      setMsg('✅ Conta criada! Verifique o seu email ou faça login.')
      setViewMode('login')
      setLoading(false)
    } else if (viewMode === 'reset') {
      if (!email) {
        setMsg('❌ Por favor, preencha o seu e-mail.')
        setLoading(false)
        return
      }

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/profile`,
      })

      if (error) {
        setMsg('❌ Erro: ' + error.message)
      } else {
        setMsg('✅ Link de recuperação enviado! Verifique a sua caixa de entrada.')
        setViewMode('login')
      }
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md bg-white border border-slate-100 rounded-3xl shadow-xl p-10 flex flex-col items-center transition-all">
        <div className="h-16 w-16 bg-[#031D2D] rounded-2xl flex items-center justify-center shadow-lg mb-6 border border-[#C7A77B]/20">
          <span className="text-[#C7A77B] text-2xl font-black tracking-tighter">PC</span>
        </div>

        <h1 className="text-2xl font-extrabold text-[#031D2D] tracking-tight">Portal da Controladoria</h1>
        <p className="text-slate-500 font-medium text-sm mt-2 text-center mb-8 px-4">
          {viewMode === 'login' && 'Aceda ao seu painel de gestão executiva.'}
          {viewMode === 'signup' && 'Crie uma conta para aceder ao sistema.'}
          {viewMode === 'reset' && 'Insira o seu e-mail para receber um link seguro de recuperação de senha.'}
        </p>

        {msg && (
          <div
            className={`w-full p-4 rounded-xl text-sm font-medium mb-6 flex items-start gap-2 ${
              msg.includes('✅')
                ? 'bg-[#5A755C]/10 text-[#2d6943] border border-[#5A755C]/20'
                : 'bg-red-50 text-red-600 border border-red-100'
            }`}
          >
            {msg}
          </div>
        )}

        <form onSubmit={handleAuth} className="w-full space-y-5">
          <div>
            <label className="text-xs font-bold tracking-widest text-slate-400 uppercase mb-2 block">
              E-mail de Acesso
            </label>
            <input
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-sm outline-none focus:border-[#C7A77B] focus:bg-white transition-colors text-slate-800"
              placeholder="exemplo@empresa.com"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {viewMode !== 'reset' && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-bold tracking-widest text-slate-400 uppercase block">
                  Password
                </label>
                {viewMode === 'login' && (
                  <button
                    type="button"
                    onClick={() => {
                      setViewMode('reset')
                      setMsg('')
                    }}
                    className="text-xs font-bold text-[#C7A77B] hover:text-[#A68A63] transition-colors"
                  >
                    Esqueceu a senha?
                  </button>
                )}
              </div>
              <input
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-sm outline-none focus:border-[#C7A77B] focus:bg-white transition-colors text-slate-800"
                placeholder="••••••••"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !email || (viewMode !== 'reset' && !password)}
            className="w-full bg-[#031D2D] hover:bg-[#063955] text-[#E5D6A7] font-bold py-3.5 rounded-xl shadow-md disabled:opacity-50 transition-all mt-4 tracking-wide"
          >
            {loading
              ? 'A processar...'
              : viewMode === 'login'
                ? 'Entrar no Sistema'
                : viewMode === 'signup'
                  ? 'Criar Conta'
                  : 'Enviar Link de Recuperação'}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-100 w-full text-center">
          <button
            type="button"
            onClick={() => {
              setViewMode(viewMode === 'login' ? 'signup' : 'login')
              setMsg('')
            }}
            className="text-sm font-semibold text-slate-500 hover:text-[#031D2D] transition-colors"
          >
            {viewMode === 'login' ? 'Não tem conta? Criar nova conta' : 'Voltar ao Login'}
          </button>
        </div>
      </div>
    </div>
  )
}