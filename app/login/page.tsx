'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type ViewMode = 'login' | 'signup' | 'reset'

export default function LoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('login')

  const traduzirErro = (mensagemOriginal: string) => {
    if (mensagemOriginal.includes('Invalid login credentials')) return 'E-mail ou senha incorretos.'
    if (mensagemOriginal.includes('User already registered')) return 'Este e-mail já está registrado.'
    if (mensagemOriginal.includes('Password should be at least')) return 'A senha deve ter pelo menos 6 caracteres.'
    return mensagemOriginal
  }

  const resetFormState = () => {
    setMsg('')
    setPassword('')
  }

  const handleAuth = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setMsg('')

    const emailNormalizado = email.trim().toLowerCase()

    try {
      if (viewMode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email: emailNormalizado,
          password,
        })

        if (error) {
          setMsg(`❌ ${traduzirErro(error.message)}`)
          return
        }

        router.push('/tarefas')
        return
      }

      if (viewMode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email: emailNormalizado,
          password,
        })

        if (error) {
          setMsg(`❌ ${traduzirErro(error.message)}`)
          return
        }

        setMsg('✅ Conta criada! Verifique o seu e-mail ou faça login.')
        setViewMode('login')
        setPassword('')
        return
      }

      if (!emailNormalizado) {
        setMsg('❌ Por favor, preencha o seu e-mail.')
        return
      }

      const { error } = await supabase.auth.resetPasswordForEmail(emailNormalizado, {
        redirectTo: 'https://controladoria-os.vercel.app/profile',
      })

      if (error) {
        setMsg(`❌ Erro: ${traduzirErro(error.message)}`)
        return
      }

      setMsg('✅ Link de recuperação enviado! Verifique a sua caixa de entrada.')
      setViewMode('login')
      setPassword('')
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Erro inesperado ao autenticar.'
      setMsg(`❌ ${mensagem}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 font-sans">
      <div className="flex w-full max-w-md flex-col items-center rounded-3xl border border-slate-100 bg-white p-10 shadow-xl transition-all">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#C7A77B]/20 bg-[#031D2D] shadow-lg">
          <span className="text-2xl font-black tracking-tighter text-[#C7A77B]">PC</span>
        </div>

        <h1 className="text-2xl font-extrabold tracking-tight text-[#031D2D]">
          Portal da Controladoria
        </h1>

        <p className="mt-2 mb-8 px-4 text-center text-sm font-medium text-slate-500">
          {viewMode === 'login' && 'Acesse o seu painel de gestão executiva.'}
          {viewMode === 'signup' && 'Crie uma conta para acessar o sistema.'}
          {viewMode === 'reset' &&
            'Insira o seu e-mail para receber um link seguro de recuperação de senha.'}
        </p>

        {msg && (
          <div
            className={`mb-6 flex w-full items-start gap-2 rounded-xl border p-4 text-sm font-medium ${
              msg.includes('✅')
                ? 'border-[#5A755C]/20 bg-[#5A755C]/10 text-[#2d6943]'
                : 'border-red-100 bg-red-50 text-red-600'
            }`}
          >
            {msg}
          </div>
        )}

        <form onSubmit={handleAuth} className="w-full space-y-5">
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-400">
              E-mail de acesso
            </label>
            <input
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-800 outline-none transition-colors focus:border-[#C7A77B] focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              placeholder="exemplo@empresa.com"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          {viewMode !== 'reset' && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-400">
                  Senha
                </label>

                {viewMode === 'login' && (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => {
                      setViewMode('reset')
                      resetFormState()
                    }}
                    className="text-xs font-bold text-[#C7A77B] transition-colors hover:text-[#A68A63] disabled:opacity-50"
                  >
                    Esqueceu a senha?
                  </button>
                )}
              </div>

              <input
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-800 outline-none transition-colors focus:border-[#C7A77B] focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                placeholder="••••••••"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !email || (viewMode !== 'reset' && !password)}
            className="mt-4 w-full rounded-xl bg-[#031D2D] py-3.5 font-bold tracking-wide text-[#E5D6A7] shadow-md transition-all hover:bg-[#063955] disabled:opacity-50"
          >
            {loading
              ? 'Processando...'
              : viewMode === 'login'
                ? 'Entrar no sistema'
                : viewMode === 'signup'
                  ? 'Criar conta'
                  : 'Enviar link de recuperação'}
          </button>
        </form>

        <div className="mt-8 w-full border-t border-slate-100 pt-6 text-center">
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              setViewMode(viewMode === 'login' ? 'signup' : 'login')
              resetFormState()
            }}
            className="text-sm font-semibold text-slate-500 transition-colors hover:text-[#031D2D] disabled:opacity-50"
          >
            {viewMode === 'login' ? 'Não tem conta? Criar nova conta' : 'Voltar ao login'}
          </button>
        </div>
      </div>
    </div>
  )
}