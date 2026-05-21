'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'react-hot-toast'
import { getResponsaveis, type ResponsavelLite } from '@/lib/responsaveis'
import type { Lookup, Row } from '../../_lib/types'

type Comment = {
  id: string
  tarefa_id: string
  autor_id: string | null
  autor: string | null
  mensagem: string
  created_at: string
}

type Props = {
  tarefa: Row
  userId: string
  userName: string
  userEmail: string
  respsDb: Lookup[]
  /** Chamado após enviar o comentário com sucesso. Útil pra disparar emails. */
  onSent?: (mensagem: string) => void
}

export function CommentsThread({ tarefa, userId, userName, userEmail, respsDb, onSent }: Props) {
  const [comentarios, setComentarios] = useState<Comment[]>([])
  const [comentNovo, setComentNovo] = useState('')
  const [mentionOpen, setMentionOpen] = useState(false)
  const [mentionFilter, setMentionFilter] = useState('')
  const comentInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('tarefa_comentarios')
        .select(`id, tarefa_id, autor_id, autor, mensagem, created_at`)
        .eq('tarefa_id', tarefa.id)
        .order('created_at', { ascending: false })
      if (!cancelled) setComentarios((data || []) as Comment[])
    })()
    return () => { cancelled = true }
  }, [tarefa.id])

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setComentNovo(val)
    const match = val.match(/(?:^|\s)@([a-zA-ZÀ-ÿ\s]*)$/)
    if (match) {
      setMentionOpen(true)
      setMentionFilter(match[1].trim())
    } else {
      setMentionOpen(false)
    }
  }

  const selectMention = (nome: string) => {
    const replaced = comentNovo.replace(/(?:^|\s)@([a-zA-ZÀ-ÿ\s]*)$/, ` @${nome} `)
    setComentNovo(replaced)
    setMentionOpen(false)
    comentInputRef.current?.focus()
  }

  const enviar = async () => {
    const msg = comentNovo.trim()
    if (!msg) return
    if (!userId) return

    const payload = { tarefa_id: tarefa.id, autor_id: userId, autor: userName || null, mensagem: msg }
    const { data, error } = await supabase.from('tarefa_comentarios').insert([payload]).select().single()
    if (error) {
      toast.error('Erro ao guardar o comentário.')
      return
    }

    setComentarios(prev => [data as Comment, ...prev])
    setComentNovo('')
    toast.success('Comentário enviado!')

    // Cria notificações: para responsáveis da tarefa
    const respsTask = getResponsaveis(tarefa.atividades) as ResponsavelLite[]
    respsTask.forEach(async (resp) => {
      if (resp.email && resp.email !== userEmail) {
        await supabase.from('notificacoes').insert({
          user_email: resp.email,
          titulo: 'Novo Comentário',
          mensagem: `${userName} comentou na tarefa: "${tarefa.atividades?.nome_atividade}"`,
          tarefa_id: tarefa.id,
        })
      }
    })

    // E para usuários mencionados (que não estejam já entre os responsáveis)
    const mentioned = respsDb.filter(r => msg.includes(`@${r.nome}`))
    for (const u of mentioned) {
      if (u.email !== userEmail && !respsTask.some(rt => rt.email === u.email)) {
        await supabase.from('notificacoes').insert({
          user_email: u.email,
          titulo: 'Mencionaram-no!',
          mensagem: `${userName} mencionou-o em "${tarefa.atividades?.nome_atividade}": "${msg}"`,
          tarefa_id: tarefa.id,
        })
      }
    }

    onSent?.(msg)
  }

  const filtradosMention = respsDb.filter(r => r.nome.toLowerCase().includes(mentionFilter.toLowerCase()))

  return (
    <div className="border-t border-slate-100 dark:border-slate-800 pt-5 relative">
      <label className="text-xs text-slate-500 dark:text-slate-400 font-medium block mb-2">
        Comentários e Histórico (Use @ para mencionar)
      </label>

      {mentionOpen && (
        <div className="absolute bottom-full mb-2 left-0 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50">
          <div className="bg-[#063955] dark:bg-slate-900 text-white text-xs font-bold px-4 py-2">Mencionar Colaborador</div>
          <div className="max-h-40 overflow-y-auto custom-scrollbar">
            {filtradosMention.map(r => (
              <div
                key={r.id}
                onClick={() => selectMention(r.nome)}
                className="px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer text-slate-700 dark:text-slate-200 border-b border-slate-100 dark:border-slate-700 last:border-0 transition-colors"
              >
                <span className="font-semibold text-sm text-[#0f88a8] dark:text-[#38bdf8] block">{r.nome}</span>
                <span className="text-[10px] text-slate-400 block">{r.email}</span>
              </div>
            ))}
            {filtradosMention.length === 0 && (
              <div className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 text-center bg-slate-50 dark:bg-slate-800">Ninguém encontrado...</div>
            )}
          </div>
        </div>
      )}

      <div className="flex gap-2 relative">
        <input
          ref={comentInputRef}
          value={comentNovo}
          onChange={handleInput}
          onKeyDown={e => e.key === 'Enter' && !mentionOpen && enviar()}
          placeholder="Escreva algo... (ex: @Patricia valida isto?)"
          className="flex-1 bg-transparent border border-slate-200 dark:border-slate-800 dark:text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-[#0f88a8] transition-colors"
        />
        <button onClick={enviar} className="bg-[#0f88a8] text-white px-4 rounded-xl text-sm font-medium hover:bg-[#0c708b] transition-colors">
          Enviar
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {comentarios.map(c => (
          <div key={c.id} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-100 dark:border-slate-700/50">
            <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
              <span className="font-bold text-[#063955] dark:text-slate-200">{c.autor || 'Usuário'}</span>
              <span>{String(c.created_at).slice(0, 16).replace('T', ' ')}</span>
            </div>
            <p
              className="text-sm text-slate-800 dark:text-slate-300 leading-relaxed"
              dangerouslySetInnerHTML={{
                __html: c.mensagem.replace(/@([a-zA-ZÀ-ÿ\s]+)/g, '<strong class="text-[#0f88a8] dark:text-[#38bdf8]">@$1</strong>'),
              }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
