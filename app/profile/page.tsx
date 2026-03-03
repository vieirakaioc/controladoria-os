'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function ProfilePage() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    setMsg('')
    const { data } = await supabase.auth.getUser()
    const u = data?.user
    if (!u) {
      router.push('/login')
      return
    }

    const { data: prof } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', u.id)
      .maybeSingle()

    setFullName(prof?.full_name || '')
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const save = async () => {
    setMsg('Salvando...')
    const { data } = await supabase.auth.getUser()
    const u = data?.user
    if (!u) {
      router.push('/login')
      return
    }

    const payload = { id: u.id, full_name: fullName.trim() || null }

    const { error } = await supabase
      .from('profiles')
      .upsert(payload, { onConflict: 'id' })

    if (error) {
      console.error(error)
      setMsg('❌ Erro ao salvar: ' + error.message)
      return
    }

    setMsg('✅ Salvo!')
    setTimeout(() => setMsg(''), 1200)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <div className="max-w-xl mx-auto bg-white border border-gray-200 rounded-2xl shadow-xl p-8">
        <h1 className="text-3xl font-black text-indigo-950 uppercase tracking-tighter">Perfil</h1>
        <p className="text-gray-500 font-semibold mt-1">Defina seu nome pra aparecer nos comentários</p>

        {msg && <div className="mt-4 text-sm font-black text-indigo-700">{msg}</div>}

        {loading ? (
          <div className="mt-6 text-gray-500 font-semibold">Carregando...</div>
        ) : (
          <div className="mt-6 space-y-3">
            <input
              className="w-full border border-gray-200 rounded-xl px-4 py-3 font-semibold"
              placeholder="Seu nome (ex: Lucas Mendonça)"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />

            <button
              onClick={save}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3 px-6 rounded-xl shadow-md"
            >
              Salvar
            </button>

            <button
              onClick={() => router.push('/tarefas')}
              className="bg-white border border-gray-200 hover:bg-gray-50 font-black py-3 px-6 rounded-xl"
            >
              Voltar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}