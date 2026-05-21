'use client'

import { Trophy, Copy, Share2, Calendar } from 'lucide-react'
import { toast } from 'react-hot-toast'
import type { DestaqueSemanal } from '../_hooks/useDestaqueSemana'

type Props = {
  top: DestaqueSemanal[]
  semanaLabel: string
  mensagem: string
  loading: boolean
}

export function DestaqueSemana({ top, semanaLabel, mensagem, loading }: Props) {
  const copiarMensagem = async () => {
    try {
      await navigator.clipboard.writeText(mensagem)
      toast.success('Mensagem copiada! Cola no grupo do WhatsApp.')
    } catch {
      toast.error('Não consegui copiar — selecione e copie manualmente.')
    }
  }

  const compartilharWhatsApp = () => {
    // wa.me/?text= abre o WhatsApp (mobile ou Web) com o texto pré-carregado.
    // O usuário escolhe o grupo/contato e envia.
    const url = `https://wa.me/?text=${encodeURIComponent(mensagem)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  if (loading) {
    return (
      <div className="mb-6 bg-gradient-to-br from-amber-50 to-white dark:from-amber-500/10 dark:to-slate-900 border border-amber-200 dark:border-amber-500/30 rounded-2xl p-6 animate-pulse">
        <div className="h-6 w-48 bg-amber-200/50 dark:bg-amber-500/20 rounded mb-3" />
        <div className="h-4 w-32 bg-amber-100 dark:bg-amber-500/10 rounded" />
      </div>
    )
  }

  return (
    <div className="mb-6 bg-gradient-to-br from-amber-50 via-white to-amber-50/50 dark:from-amber-500/10 dark:via-slate-900 dark:to-amber-500/5 border-2 border-amber-200 dark:border-amber-500/30 rounded-2xl p-6 shadow-sm">
      {/* Header com botões */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="bg-amber-500/20 dark:bg-amber-500/30 p-2.5 rounded-xl text-amber-600 dark:text-amber-400">
            <Trophy size={22} />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#063955] dark:text-white flex items-center gap-2">
              Destaque da Semana
              <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider bg-amber-200/50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded">
                <Calendar size={10} /> {semanaLabel}
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Reconhecimento semanal pra compartilhar com a equipe
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={copiarMensagem}
            className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-3 py-2 rounded-xl text-xs font-semibold transition-colors shadow-sm"
          >
            <Copy size={13} /> Copiar
          </button>
          <button
            onClick={compartilharWhatsApp}
            className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-2 rounded-xl text-xs font-bold transition-colors shadow-sm"
          >
            <Share2 size={13} /> Compartilhar no WhatsApp
          </button>
        </div>
      </div>

      {/* Pódio compacto */}
      {top.length === 0 ? (
        <div className="text-center py-8 text-sm text-slate-500 dark:text-slate-400">
          Nenhuma tarefa concluída esta semana ainda. Voltamos segunda! 💪
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {top.map(d => {
            const medalha = d.posicao === 1 ? '🥇' : d.posicao === 2 ? '🥈' : '🥉'
            const ringColor =
              d.posicao === 1 ? 'ring-amber-400 dark:ring-amber-500'
              : d.posicao === 2 ? 'ring-slate-300 dark:ring-slate-500'
              : 'ring-orange-300 dark:ring-orange-500'
            return (
              <div
                key={d.responsavel_id}
                className={`bg-white dark:bg-slate-900 rounded-xl p-4 ring-2 ${ringColor} relative`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-3xl">{medalha}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-[#063955] dark:text-white truncate">{d.nome}</div>
                    {d.email && (
                      <div className="text-[10px] text-slate-400 truncate">{d.email}</div>
                    )}
                    <div className="mt-2 flex items-center gap-3 text-xs">
                      <div>
                        <span className="text-2xl font-light text-[#063955] dark:text-white tabular-nums">{d.score.total}</span>
                        <span className="text-[10px] text-slate-400 ml-0.5">/100</span>
                      </div>
                      <div className="text-slate-500 dark:text-slate-400 leading-tight text-[11px]">
                        ✅ {d.metrics.concluidas} concl.<br />
                        🎯 {d.score.pontualidade}% no prazo
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
