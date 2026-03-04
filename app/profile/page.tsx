'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function ProfilePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('membro')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [msg, setMsg] = useState('')
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setEmail(user.email || '')

      const { data } = await supabase
        .from('profiles')
        .select('full_name, role, avatar_url')
        .eq('id', user.id)
        .maybeSingle()

      if (data) {
        setFullName(data.full_name || '')
        setRole(data.role || 'membro')
        setAvatarUrl(data.avatar_url || '')
      }
      setLoading(false)
    }
    fetchProfile()
  }, [router])

  const salvarPerfil = async () => {
    setSaving(true)
    setMsg('A guardar...')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from('profiles')
      .upsert({ id: user.id, full_name: fullName.trim() || null }, { onConflict: 'id' })

    if (error) {
      setMsg('❌ Erro ao guardar perfil.')
    } else {
      setMsg('✅ Perfil atualizado com sucesso!')
    }
    
    setSaving(false)
    setTimeout(() => setMsg(''), 3000)
  }

  // Função mágica que faz o Upload da Imagem
  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploadingAvatar(true)
      const file = event.target.files?.[0]
      if (!file) return

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Cria um nome único para o ficheiro para não dar conflito no cache do navegador
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}-${Math.random()}.${fileExt}`
      const filePath = `${fileName}`

      // 1. Envia a imagem para a pasta "avatars" no Supabase Storage
      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file)
      if (uploadError) throw uploadError

      // 2. Pega no link público da imagem que acabou de enviar
      const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(filePath)
      const newAvatarUrl = publicUrlData.publicUrl

      // 3. Atualiza a tabela Profiles com este novo link
      await supabase.from('profiles').update({ avatar_url: newAvatarUrl }).eq('id', user.id)
      
      setAvatarUrl(newAvatarUrl)
      setMsg('✅ Foto de perfil atualizada!')
    } catch (error: any) {
      console.error(error)
      setMsg('❌ Erro ao enviar imagem: ' + error.message)
    } finally {
      setUploadingAvatar(false)
      setTimeout(() => setMsg(''), 3000)
    }
  }

  if (loading) return <div className="p-8 text-slate-500 font-medium">A carregar perfil...</div>

  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans flex justify-center items-start">
      <div className="w-full max-w-2xl">
        
        <header className="mb-8">
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Meu Perfil</h1>
          <p className="text-slate-500 text-sm mt-1">Gira as suas informações pessoais, foto e acessos</p>
        </header>

        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-8">
          {msg && (
            <div className={`mb-6 p-4 rounded-xl text-sm font-medium transition-colors ${msg.includes('✅') ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
              {msg}
            </div>
          )}

          {/* Secção do Avatar e Cargo */}
          <div className="flex items-center gap-6 mb-8 pb-8 border-b border-slate-100">
            
            {/* BOLINHA DA FOTO (Agora clicável) */}
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="relative h-24 w-24 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center text-3xl font-bold uppercase shadow-inner cursor-pointer overflow-hidden group border-2 border-transparent hover:border-indigo-400 transition-all"
              title="Clique para alterar a foto"
            >
              {uploadingAvatar ? (
                <span className="text-xs text-indigo-500 font-medium">A carregar</span>
              ) : avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                fullName ? fullName.charAt(0) : email.charAt(0)
              )}
              
              {/* Efeito de hover por cima da foto */}
              <div className="absolute inset-0 bg-slate-900/40 hidden group-hover:flex items-center justify-center transition-all">
                <span className="text-white text-xs font-medium">Trocar</span>
              </div>
            </div>
            
            {/* Input de arquivo invisível (escondido na tela) */}
            <input 
              type="file" 
              accept="image/*" 
              ref={fileInputRef} 
              onChange={handleAvatarUpload} 
              className="hidden" 
            />

            <div>
              <h2 className="text-xl font-semibold text-slate-800">{fullName || 'Sem nome'}</h2>
              <p className="text-slate-500 text-sm mt-0.5">{email}</p>
              <span className={`inline-block mt-3 px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase ${role === 'admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                Nível: {role}
              </span>
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-2">Nome Completo</label>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-400 bg-slate-50 focus:bg-white transition-colors" placeholder="Ex: Kaio Vieira" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-2">E-mail de Acesso</label>
              <input value={email} disabled className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none bg-slate-100 text-slate-400 cursor-not-allowed" />
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end">
            <button onClick={salvarPerfil} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 px-6 rounded-xl shadow-sm transition-all disabled:opacity-50">
              {saving ? 'A Guardar...' : 'Guardar Alterações'}
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}