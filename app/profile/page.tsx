'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Toaster, toast } from 'react-hot-toast'
import { User, Upload, Briefcase, Building, Info } from 'lucide-react' // 💡 CORREÇÃO AQUI: 'Info' adicionado!

export default function ProfilePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  
  const [userId, setUserId] = useState('')
  const [email, setEmail] = useState('')
  const [nome, setNome] = useState('')
  const [role, setRole] = useState('')
  
  const [salvando, setSalvando] = useState(false)

  // ESTADOS DA LOGO DA EMPRESA (Somente Admin)
  const [logoEmpresaUrl, setLogoEmpresaUrl] = useState('')
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    carregarPerfil()
  }, [])

  const carregarPerfil = async () => {
    setLoading(true)
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (authError || !authData?.user) {
        router.push('/login')
        return
      }

      const uid = authData.user.id
      setUserId(uid)
      setEmail(authData.user.email || '')

      const { data: profData } = await supabase.from('profiles').select('*').eq('id', uid).single()
      
      if (profData) {
        setNome(profData.full_name || '')
        setRole(profData.role || 'membro')
        
        // Se for admin, busca também a logo da empresa
        if (profData.role === 'admin') {
          const { data: configData } = await supabase.from('empresa_config').select('logo_url').eq('id', 1).single()
          if (configData) setLogoEmpresaUrl(configData.logo_url || '')
        }
      }
    } catch (e) {
      toast.error('Erro ao carregar o perfil.')
    } finally {
      setLoading(false)
    }
  }

  const salvarPerfil = async () => {
    if (!nome.trim()) return toast.error('O nome não pode estar vazio.')
    setSalvando(true)
    const toastId = toast.loading('A guardar perfil...')

    try {
      const { error } = await supabase.from('profiles').update({ full_name: nome }).eq('id', userId)
      if (error) throw error
      toast.success('Perfil guardado com sucesso!', { id: toastId })
    } catch (e) {
      toast.error('Erro ao guardar o perfil.', { id: toastId })
    } finally {
      setSalvando(false)
    }
  }

  const handleUploadLogoEmpresa = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploadingLogo(true)
    const toastId = toast.loading('A carregar a logo da empresa...')

    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `empresa-logo-${Date.now()}.${fileExt}`

      // Vamos usar o bucket "evidencias" que já existe
      const { error: uploadError } = await supabase.storage.from('evidencias').upload(fileName, file, { upsert: true })
      if (uploadError) throw uploadError

      const { data: publicUrlData } = supabase.storage.from('evidencias').getPublicUrl(fileName)
      const novaLogo = publicUrlData.publicUrl
      
      // Guarda a URL na tabela de configuração
      const { error: dbError } = await supabase.from('empresa_config').upsert({ id: 1, logo_url: novaLogo })
      if (dbError) throw dbError

      setLogoEmpresaUrl(novaLogo)
      toast.success('Logo da empresa atualizada! (Faça F5 para ver no menu)', { id: toastId })

    } catch (error: any) {
      toast.error('Erro ao carregar a logo. Tente novamente.', { id: toastId })
    } finally {
      setUploadingLogo(false)
      if (logoInputRef.current) logoInputRef.current.value = ''
    }
  }

  const resetarLogoEmpresa = async () => {
    if(!window.confirm('Tem a certeza que deseja remover a logo do menu?')) return
    setUploadingLogo(true)
    const toastId = toast.loading('A remover logo...')
    try {
      await supabase.from('empresa_config').update({ logo_url: null }).eq('id', 1)
      setLogoEmpresaUrl('')
      toast.success('Logo removida! (Faça F5)', { id: toastId })
    } catch (e) {
      toast.error('Erro ao remover a logo.', { id: toastId })
    } finally {
      setUploadingLogo(false)
    }
  }

  if (loading) return <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center text-[#031D2D] font-medium animate-pulse">A carregar perfil...</div>

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-8 font-sans">
      <Toaster position="bottom-right" toastOptions={{ style: { background: '#031D2D', color: '#fff', borderRadius: '12px' } }} />

      <header className="mb-8">
        <h1 className="text-3xl font-extrabold text-[#031D2D] dark:text-white tracking-tighter flex items-center gap-3">
          <User className="text-[#C7A77B]" size={28} /> O Meu Perfil
        </h1>
        <p className="text-slate-500 text-sm mt-1.5 font-medium">Gerir as suas informações pessoais e configurações de sistema.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        
        {/* CARD DO PERFIL DO USUÁRIO */}
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm p-8 flex flex-col transition-all">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
            <Briefcase size={20} className="text-slate-400" />
            <h2 className="text-lg font-bold text-slate-800 dark:text-white">Dados Pessoais</h2>
          </div>

          <div className="space-y-5">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">E-mail de Acesso</label>
              <input value={email} disabled className="w-full border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/50 rounded-xl px-4 py-3 outline-none text-slate-500 dark:text-slate-400 font-medium cursor-not-allowed" />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Nome Completo</label>
              <input value={nome} onChange={e => setNome(e.target.value)} className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 rounded-xl px-4 py-3 outline-none focus:border-[#C7A77B] text-slate-800 dark:text-white font-medium transition-colors" placeholder="O seu nome..." />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Nível de Permissão</label>
              <div className="flex items-center gap-2 mt-1">
                <span className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider border ${role === 'admin' ? 'bg-[#031D2D]/10 text-[#031D2D] border-[#031D2D]/20 dark:bg-[#C7A77B]/10 dark:text-[#C7A77B] dark:border-[#C7A77B]/20' : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'}`}>
                  {role === 'admin' ? '⭐ Administrador' : 'Membro da Equipa'}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-end">
            <button onClick={salvarPerfil} disabled={salvando} className="bg-[#031D2D] hover:bg-[#063955] text-[#E5D6A7] px-8 py-3 rounded-xl text-sm font-bold shadow-md transition-all disabled:opacity-50 tracking-tight">
              {salvando ? 'A guardar...' : 'Guardar Alterações'}
            </button>
          </div>
        </div>

        {/* CARD DE CONFIGURAÇÃO DA EMPRESA (VISÍVEL APENAS PARA ADMIN) */}
        {role === 'admin' && (
          <div className="bg-white dark:bg-slate-900 border border-[#C7A77B]/30 dark:border-[#C7A77B]/20 rounded-2xl shadow-lg p-8 flex flex-col relative overflow-hidden transition-all">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-[#C7A77B]"></div>
            
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
              <Building size={20} className="text-[#C7A77B]" />
              <h2 className="text-lg font-bold text-[#031D2D] dark:text-white">Branding / Identidade da Empresa</h2>
            </div>
            
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">
              Como Administrador, pode alterar a <strong className="text-slate-800 dark:text-slate-300">Logo do Menu Principal</strong>. Esta alteração reflete-se automaticamente no sistema para <strong>todos os utilizadores</strong>.
            </p>

            <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-950 mb-6">
              {logoEmpresaUrl ? (
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Logo Atual</span>
                  <div className="bg-[#031D2D] p-4 rounded-xl flex items-center justify-center min-w-[200px] shadow-inner mb-4">
                    <img src={logoEmpresaUrl} alt="Logo" className="max-h-16 object-contain" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo} className="text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2 rounded-lg hover:border-[#C7A77B] text-slate-700 dark:text-slate-200 transition-colors shadow-sm">
                      Substituir Logo
                    </button>
                    <button onClick={resetarLogoEmpresa} disabled={uploadingLogo} className="text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2 rounded-lg hover:border-[#b43a3d] hover:text-[#b43a3d] text-slate-500 transition-colors shadow-sm">
                      Remover
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-3">
                    <Upload size={24} className="text-slate-400" />
                  </div>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Nenhuma logo configurada</span>
                  <span className="text-xs text-slate-500 max-w-[250px] mb-4">Para melhor resultado, use uma imagem PNG com fundo transparente (Max. 2MB).</span>
                  
                  <button onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo} className="bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors">
                    {uploadingLogo ? 'A fazer upload...' : 'Selecionar Imagem'}
                  </button>
                </div>
              )}
              <input type="file" accept="image/*" ref={logoInputRef} className="hidden" onChange={handleUploadLogoEmpresa} />
            </div>

            <div className="mt-auto bg-[#0f88a8]/10 text-[#0f88a8] dark:bg-[#38bdf8]/10 dark:text-[#38bdf8] p-4 rounded-xl flex items-start gap-3">
              <Info size={20} className="shrink-0 mt-0.5" />
              <p className="text-xs font-medium leading-relaxed">
                Após alterar a imagem, pode ser necessário que os utilizadores façam atualizar a página (F5) para que o navegador baixe a nova logo em cache.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}