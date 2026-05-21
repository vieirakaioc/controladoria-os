'use client'

import { presencaCor, ultimoAcessoLabel } from '../_lib/datas'

export function PresencaDot({ lastActivity }: { lastActivity: string | null | undefined }) {
  const cor = presencaCor(lastActivity)
  const label = ultimoAcessoLabel(lastActivity)
  return (
    <div className="flex items-center gap-2">
      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${cor}`} title={label} />
      <span className="text-sm font-medium text-slate-600 dark:text-slate-300">{label}</span>
    </div>
  )
}
