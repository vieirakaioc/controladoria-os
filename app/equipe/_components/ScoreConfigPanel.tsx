'use client'

import { useEffect, useState } from 'react'
import { Settings, Save, ChevronDown, ChevronUp, RotateCcw, Wand2 } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { DEFAULT_WEIGHTS, SCORE_DIMENSIONS, sumWeights, type ScoreWeights } from '../_lib/score'

type Props = {
  weights: ScoreWeights
  onSaved: () => void
}

/**
 * Painel admin-only pra ajustar os pesos do score.
 *
 * 4 dimensões, cada uma com slider + input numérico. A soma DEVE ser 100;
 * a UI mostra o total atual em destaque (verde quando bater, vermelho quando não).
 *
 * Botões auxiliares:
 *   • "Normalizar pra 100" — escala proporcionalmente os pesos pra somar 100
 *   • "Defaults" — restaura a configuração padrão (60/20/10/10)
 */
export function ScoreConfigPanel({ weights, onSaved }: Props) {
  const [open, setOpen] = useState(false)
  const [local, setLocal] = useState<ScoreWeights>(weights)
  const [saving, setSaving] = useState(false)

  useEffect(() => { setLocal(weights) }, [weights])

  const total = sumWeights(local)
  const dirty = SCORE_DIMENSIONS.some(d => local[d.key] !== weights[d.key])
  const valido = total === 100

  const set = (key: keyof ScoreWeights, val: number) => {
    const v = Math.max(0, Math.min(100, Math.round(val)))
    setLocal(prev => ({ ...prev, [key]: v }))
  }

  const normalizar = () => {
    const s = sumWeights(local)
    if (s === 0) {
      setLocal(DEFAULT_WEIGHTS)
      return
    }
    // Escala cada peso proporcionalmente
    const escalado: any = {}
    SCORE_DIMENSIONS.forEach(d => {
      escalado[d.key] = Math.round((local[d.key] / s) * 100)
    })
    // Acerta arredondamento adicionando o resto à maior dimensão
    const novoTotal = (escalado.conclusao + escalado.pontualidade + escalado.aderencia + escalado.uso)
    if (novoTotal !== 100) {
      const diff = 100 - novoTotal
      const maior = SCORE_DIMENSIONS.reduce((a, b) => escalado[a.key] >= escalado[b.key] ? a : b)
      escalado[maior.key] += diff
    }
    setLocal(escalado)
  }

  const resetDefaults = () => setLocal(DEFAULT_WEIGHTS)

  const salvar = async () => {
    if (!valido) {
      toast.error(`Os pesos somam ${total}. Precisam somar 100 — use "Normalizar" se quiser corrigir automaticamente.`)
      return
    }
    setSaving(true)
    const toastId = toast.loading('A salvar configuração...')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase
        .from('score_config')
        .update({
          peso_conclusao:    local.conclusao,
          peso_pontualidade: local.pontualidade,
          peso_aderencia:    local.aderencia,
          peso_uso:          local.uso,
          updated_at:        new Date().toISOString(),
          updated_by:        user?.id ?? null,
        })
        .eq('id', 1)
      if (error) throw error
      toast.success('Configuração salva!', { id: toastId })
      onSaved()
    } catch (e: any) {
      toast.error(`Erro: ${e?.message || 'falha desconhecida'}`, { id: toastId })
    } finally {
      setSaving(false)
    }
  }

  // Resumo na header (mesmo fechado)
  const resumo = SCORE_DIMENSIONS
    .filter(d => weights[d.key] > 0)
    .map(d => `${weights[d.key]}% ${d.short}`)
    .join(' + ')

  return (
    <div className="mb-6 bg-white dark:bg-slate-900 border border-line dark:border-slate-800 rounded-lg shadow-card overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full p-4 flex items-center justify-between hover:bg-navy-50 dark:hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="bg-[#C7A77B]/10 dark:bg-[#C7A77B]/20 p-2 rounded-md text-[#C7A77B]">
            <Settings size={18} />
          </div>
          <div className="text-left">
            <div className="text-sm font-bold text-navy-700 dark:text-white">Configuração do Score</div>
            <div className="text-xs text-ink-500 dark:text-slate-400">
              Atual: <strong>{resumo || '—'}</strong> · admin only
            </div>
          </div>
        </div>
        {open ? <ChevronUp size={18} className="text-ink-400" /> : <ChevronDown size={18} className="text-ink-400" />}
      </button>

      {open && (
        <div className="px-6 pb-6 pt-2 border-t border-line dark:border-slate-800 bg-navy-50/30 dark:bg-slate-950/30">
          <p className="text-xs text-ink-700 dark:text-slate-400 mb-5 leading-relaxed">
            Defina o peso de cada dimensão. A soma <strong>precisa ser 100</strong> pra salvar.
            Use o botão "Normalizar pra 100" pra ajustar automaticamente.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
            {SCORE_DIMENSIONS.map(dim => (
              <div key={dim.key} className="bg-white dark:bg-slate-900 border border-line dark:border-slate-800 rounded-md p-4">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-bold text-navy-700 dark:text-white">
                    {dim.label}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={local[dim.key]}
                      onChange={e => set(dim.key, Number(e.target.value))}
                      disabled={saving}
                      className="w-16 bg-navy-50 dark:bg-slate-950 border border-line dark:border-slate-700 dark:text-white rounded-md px-2 py-1 text-sm font-bold text-center outline-none focus:border-teal-500 disabled:opacity-50"
                    />
                    <span className="text-sm text-ink-400 font-medium">%</span>
                  </div>
                </div>
                <p className="text-[11px] text-ink-500 dark:text-slate-400 leading-relaxed mb-3">
                  {dim.desc}
                </p>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={local[dim.key]}
                  onChange={e => set(dim.key, Number(e.target.value))}
                  disabled={saving}
                  className="w-full cursor-pointer disabled:opacity-50"
                  style={{ accentColor: dim.accent }}
                />
                <div className="mt-1 h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full transition-all duration-200"
                    style={{ width: `${local[dim.key]}%`, background: dim.accent }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Barra visual da composição total (segmented) */}
          {total > 0 && (
            <div className="mb-5">
              <div className="text-xs font-bold text-ink-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                Composição visual ({total}%)
              </div>
              <div className="h-4 w-full rounded-full overflow-hidden flex bg-navy-100 dark:bg-slate-800">
                {SCORE_DIMENSIONS.map(dim => {
                  // Normaliza pra mostrar proporcional, mesmo se total ≠ 100
                  const w = total > 0 ? (local[dim.key] / total) * 100 : 0
                  if (w === 0) return null
                  return (
                    <div
                      key={dim.key}
                      className="h-full transition-all duration-200 flex items-center justify-center text-[10px] font-bold text-white"
                      style={{ width: `${w}%`, background: dim.accent }}
                      title={`${dim.label}: ${local[dim.key]}%`}
                    >
                      {local[dim.key] >= 8 ? dim.short : ''}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="text-xs text-ink-500 dark:text-slate-400">
                Total:{' '}
                <strong className={valido ? 'text-emerald-600 dark:text-emerald-400' : 'text-[#b43a3d]'}>
                  {total}%
                </strong>
                {!valido && <span className="ml-2 text-[#b43a3d]">(precisa ser 100)</span>}
                {dirty && <span className="ml-3 text-amber-600 dark:text-amber-400">• alterações não salvas</span>}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={resetDefaults}
                disabled={saving}
                className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-line dark:border-slate-700 hover:bg-navy-100 dark:hover:bg-slate-700 text-ink-700 dark:text-slate-300 px-3 py-2 rounded-md text-xs font-semibold transition-colors disabled:opacity-50"
                title="Restaura 60/20/10/10"
              >
                <RotateCcw size={13} /> Defaults
              </button>
              <button
                onClick={normalizar}
                disabled={saving || total === 100 || total === 0}
                className="flex items-center gap-1.5 bg-[#C7A77B]/10 hover:bg-[#C7A77B]/20 border border-[#C7A77B]/30 text-[#A68A63] dark:text-[#E5D6A7] px-3 py-2 rounded-md text-xs font-semibold transition-colors disabled:opacity-50"
                title="Escala proporcionalmente pra somar 100"
              >
                <Wand2 size={13} /> Normalizar pra 100
              </button>
              <button
                onClick={salvar}
                disabled={saving || !dirty || !valido}
                className="flex items-center gap-2 bg-navy-700 hover:bg-[#042436] text-white px-5 py-2 rounded-md text-sm font-semibold transition-colors shadow-sm disabled:opacity-50"
              >
                <Save size={14} /> {saving ? 'A salvar...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
