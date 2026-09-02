'use client'

import { useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'react-hot-toast'

type Props = {
  value: string
  onChange: (url: string) => void
}

export function AnexoUploader({ value, onChange }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadingRef = useRef(false)

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    uploadingRef.current = true
    const toastId = toast.loading('A carregar ficheiro...')

    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `anexo-${Date.now()}-${Math.floor(Math.random() * 1000)}.${fileExt}`

      const { error: uploadError } = await supabase.storage.from('evidencias').upload(fileName, file)
      if (uploadError) throw uploadError

      const { data: publicUrlData } = supabase.storage.from('evidencias').getPublicUrl(fileName)
      onChange(publicUrlData.publicUrl)
      toast.success('Ficheiro anexado com sucesso! Lembre-se de Guardar a tarefa.', { id: toastId })
    } catch {
      toast.error('Erro ao carregar o ficheiro. O bucket "evidencias" foi criado?', { id: toastId })
    } finally {
      uploadingRef.current = false
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="bg-navy-50 dark:bg-slate-800/50 p-4 rounded-md border border-line dark:border-slate-700/50">
      <label className="text-xs text-navy-700 dark:text-slate-300 font-bold tracking-wide uppercase block mb-3">
        Evidência / Anexo
      </label>
      <div className="flex items-center gap-3">
        {value ? (
          <div className="flex items-center gap-2 bg-white dark:bg-slate-800 px-3 py-2 rounded-md text-sm font-medium w-full justify-between border border-line dark:border-slate-700 shadow-card">
            <a href={value} target="_blank" rel="noreferrer" className="text-teal-600 dark:text-[#38bdf8] hover:underline truncate w-full">
              📎 Ver Documento Anexado
            </a>
            <button onClick={() => onChange('')} className="text-ink-400 hover:text-[#b43a3d] p-1 ml-2 transition-colors">✕</button>
          </div>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-2 w-full bg-white dark:bg-slate-800 border border-dashed border-line-strong dark:border-slate-600 rounded-md px-4 py-3 text-sm text-ink-500 dark:text-slate-400 hover:border-teal-500 hover:text-teal-600 transition-colors"
          >
            📎 Clique para anexar uma evidência
          </button>
        )}
        <input type="file" ref={fileInputRef} className="hidden" onChange={handleUpload} />
      </div>
    </div>
  )
}
