'use client'

type Props = {
  filtroTexto: string
  filtroStatus: string
  filtroSetor: string
  filtroResp: string
  filtroClassificacao: string
  filtroProjeto: string
  setFiltroTexto: (v: string) => void
  setFiltroStatus: (v: string) => void
  setFiltroSetor: (v: string) => void
  setFiltroResp: (v: string) => void
  setFiltroClassificacao: (v: string) => void
  setFiltroProjeto: (v: string) => void

  statuses: string[]
  setorOptions: string[]
  respOptions: string[]
  classifOptions: string[]
  projetosDb: { id: string; nome: string }[]

  totalFiltradas: number
  onReset: () => void
}

const baseSelect = 'bg-navy-50 dark:bg-slate-950 border border-line dark:border-slate-800 rounded-md px-4 py-2 text-sm text-ink-700 dark:text-slate-200 outline-none transition-colors'

export function FiltersBar({
  filtroTexto, filtroStatus, filtroSetor, filtroResp, filtroClassificacao, filtroProjeto,
  setFiltroTexto, setFiltroStatus, setFiltroSetor, setFiltroResp, setFiltroClassificacao, setFiltroProjeto,
  statuses, setorOptions, respOptions, classifOptions, projetosDb,
  totalFiltradas, onReset,
}: Props) {
  return (
    <div className="bg-white dark:bg-slate-900 p-4 rounded-lg shadow-card border border-line dark:border-slate-800 mb-6 flex flex-wrap gap-3 items-center transition-colors">
      <input
        value={filtroTexto}
        onChange={(e) => setFiltroTexto(e.target.value)}
        placeholder="Buscar atividade..."
        className="bg-navy-50 dark:bg-slate-950 border border-line dark:border-slate-800 rounded-md px-4 py-2 text-sm w-full md:w-64 outline-none focus:border-teal-500 dark:text-white transition-colors"
      />

      <select
        value={filtroProjeto}
        onChange={(e) => setFiltroProjeto(e.target.value)}
        className={`${baseSelect} text-[#C7A77B] dark:text-[#C7A77B] font-semibold`}
      >
        <option value="Todos">Projeto: Todos</option>
        {projetosDb.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
      </select>

      <select value={filtroClassificacao} onChange={(e) => setFiltroClassificacao(e.target.value)} className={baseSelect}>
        <option value="Todos">Classificação: Todas</option>
        {classifOptions.map(c => <option key={c} value={c}>{c}</option>)}
      </select>

      <select value={filtroSetor} onChange={(e) => setFiltroSetor(e.target.value)} className={baseSelect}>
        <option value="Todos">Setor: Todos</option>
        {setorOptions.map(s => <option key={s} value={s}>{s}</option>)}
      </select>

      <select value={filtroResp} onChange={(e) => setFiltroResp(e.target.value)} className={baseSelect}>
        <option value="Todos">Resp: Todos</option>
        {respOptions.map(r => <option key={r} value={r}>{r}</option>)}
      </select>

      <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className={baseSelect}>
        <option value="Todos">Status: Todos</option>
        {statuses.map(s => <option key={s} value={s}>{s}</option>)}
      </select>

      <button
        onClick={onReset}
        className="text-sm font-medium text-ink-500 hover:text-ink-900 dark:hover:text-ink-400 px-2 transition-colors"
      >
        Limpar Filtros
      </button>
      <span className="ml-auto text-sm font-medium text-ink-400">{totalFiltradas} tarefas</span>
    </div>
  )
}
