'use client'

import { useMemo, useState } from 'react'
import { Check, PencilLine, Search } from 'lucide-react'

import { formatarCelula, formatarInteiro } from '../_lib/formato'
import { formatarData, situacaoPrazo, textoPrazo } from '../_lib/prazo'
import { layoutDe } from '../_lib/planilhas'
import { ROTULO_ORIGEM, type Responsavel, type TarefaFiscal } from '../_lib/types'
import { ChipPrazo, Painel } from './Ui'
import { PainelResposta } from './PainelResposta'

type FiltroPrazo = 'todos' | 'abertas' | 'atrasadas' | 'vence_hoje' | 'concluidas'

const FILTROS: { valor: FiltroPrazo; rotulo: string }[] = [
  { valor: 'abertas', rotulo: 'Em aberto' },
  { valor: 'atrasadas', rotulo: 'Atrasadas' },
  { valor: 'vence_hoje', rotulo: 'Vencem hoje' },
  { valor: 'concluidas', rotulo: 'Concluídas' },
  { valor: 'todos', rotulo: 'Todas' },
]

const CAMPO =
  'rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#0f88a8]'

export function Matriz({
  tarefas,
  responsaveis,
  hoje,
  usuario,
  aoAtualizar,
}: {
  tarefas: TarefaFiscal[]
  responsaveis: Responsavel[]
  hoje: string
  usuario: string
  aoAtualizar: (t: TarefaFiscal) => void
}) {
  const [grupoAtivo, setGrupoAtivo] = useState<string | null>(null)
  const [filtroPrazo, setFiltroPrazo] = useState<FiltroPrazo>('abertas')
  const [filtroResponsavel, setFiltroResponsavel] = useState('todos')
  const [busca, setBusca] = useState('')
  const [emEdicao, setEmEdicao] = useState<TarefaFiscal | null>(null)

  const grupos = useMemo(() => {
    const mapa = new Map<string, { chave: string; rotulo: string; tarefas: TarefaFiscal[] }>()

    for (const tarefa of tarefas) {
      const chave = `${tarefa.origem}||${tarefa.aba}`
      const rotulo = tarefa.aba
        ? `${ROTULO_ORIGEM[tarefa.origem]} · ${tarefa.aba}`
        : ROTULO_ORIGEM[tarefa.origem]

      if (!mapa.has(chave)) mapa.set(chave, { chave, rotulo, tarefas: [] })
      mapa.get(chave)!.tarefas.push(tarefa)
    }

    return [...mapa.values()]
  }, [tarefas])

  const grupo = grupos.find((g) => g.chave === grupoAtivo) ?? grupos[0]

  const visiveis = useMemo(() => {
    if (!grupo) return []
    const termo = busca.trim().toLowerCase()

    return grupo.tarefas.filter((tarefa) => {
      const situacao = situacaoPrazo(tarefa.status, tarefa.prazo, tarefa.concluidoEm, hoje)

      if (filtroPrazo === 'abertas' && tarefa.status === 'concluida') return false
      if (filtroPrazo === 'concluidas' && tarefa.status !== 'concluida') return false
      if (filtroPrazo === 'atrasadas' && situacao !== 'atrasada') return false
      if (filtroPrazo === 'vence_hoje' && situacao !== 'vence_hoje') return false

      if (filtroResponsavel === 'sem' && tarefa.responsavelId) return false
      if (
        filtroResponsavel !== 'todos' &&
        filtroResponsavel !== 'sem' &&
        tarefa.responsavelId !== filtroResponsavel
      ) {
        return false
      }

      if (termo) {
        const alvo = [
          tarefa.documento,
          tarefa.emitente,
          tarefa.tipoDivergencia,
          tarefa.responsavelNome ?? '',
          tarefa.observacaoCorrecao ?? '',
          ...Object.values(tarefa.dados).map((v) => (v === null ? '' : String(v))),
        ]
          .join(' ')
          .toLowerCase()
        if (!alvo.includes(termo)) return false
      }

      return true
    })
  }, [grupo, filtroPrazo, filtroResponsavel, busca, hoje])

  if (!grupo) {
    return (
      <Painel titulo="Nenhuma tarefa">
        <p className="text-sm text-slate-500">
          Importe as planilhas para gerar as tarefas de correção.
        </p>
      </Painel>
    )
  }

  const layout = layoutDe(grupo.tarefas[0].origem)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {grupos.map((g) => {
          const abertas = g.tarefas.filter((t) => t.status !== 'concluida').length
          const ativa = g.chave === grupo.chave

          return (
            <button
              key={g.chave}
              type="button"
              onClick={() => setGrupoAtivo(g.chave)}
              aria-pressed={ativa}
              className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-all ${
                ativa
                  ? 'border-[#0f88a8] bg-[#0f88a8]/10 text-[#063955]'
                  : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-[#063955]'
              }`}
            >
              {g.rotulo}
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs tabular-nums text-slate-600">
                {abertas}/{g.tarefas.length}
              </span>
            </button>
          )
        })}
      </div>

      <Painel className="!p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2">
            <Search size={16} className="shrink-0 text-slate-400" />
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar em qualquer campo da planilha"
              className="w-64 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
            />
          </div>

          <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
            {FILTROS.map((f) => (
              <button
                key={f.valor}
                type="button"
                onClick={() => setFiltroPrazo(f.valor)}
                aria-pressed={filtroPrazo === f.valor}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                  filtroPrazo === f.valor
                    ? 'bg-white text-[#063955] shadow-sm'
                    : 'text-slate-500 hover:text-[#063955]'
                }`}
              >
                {f.rotulo}
              </button>
            ))}
          </div>

          <select
            value={filtroResponsavel}
            onChange={(e) => setFiltroResponsavel(e.target.value)}
            aria-label="Filtrar por responsável"
            className={CAMPO}
          >
            <option value="todos">Todos os responsáveis</option>
            <option value="sem">Sem responsável</option>
            {responsaveis.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nome}
              </option>
            ))}
          </select>

          <span className="ml-auto text-sm text-slate-500">
            {formatarInteiro(visiveis.length)} de {formatarInteiro(grupo.tarefas.length)} tarefas
          </span>
        </div>
      </Painel>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="max-h-[65vh] overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-20">
              <tr>
                {['', 'Prazo', 'Responsável', 'Observação da correção', ...layout.colunasMatriz].map(
                  (coluna, indice) => (
                    <th
                      key={`${coluna}-${indice}`}
                      scope="col"
                      className={`whitespace-nowrap border-b border-slate-200 bg-slate-50 px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400 ${
                        indice === 0 ? 'sticky left-0 z-30' : ''
                      }`}
                    >
                      {coluna}
                    </th>
                  ),
                )}
              </tr>
            </thead>

            <tbody>
              {visiveis.length === 0 && (
                <tr>
                  <td
                    colSpan={4 + layout.colunasMatriz.length}
                    className="px-4 py-10 text-center text-sm text-slate-400"
                  >
                    Nenhuma tarefa com esses filtros.
                  </td>
                </tr>
              )}

              {visiveis.map((tarefa) => {
                const situacao = situacaoPrazo(tarefa.status, tarefa.prazo, tarefa.concluidoEm, hoje)
                const concluida = tarefa.status === 'concluida'

                return (
                  <tr
                    key={tarefa.id}
                    className={`border-b border-slate-100 transition-colors hover:bg-slate-50 ${
                      concluida ? 'opacity-60' : ''
                    }`}
                  >
                    <td className="sticky left-0 z-10 bg-white px-3 py-2">
                      <button
                        type="button"
                        onClick={() => setEmEdicao(tarefa)}
                        className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-bold transition-all ${
                          concluida
                            ? 'border-slate-200 text-slate-400 hover:text-slate-700'
                            : 'border-[#0f88a8] text-[#0f88a8] hover:bg-[#0f88a8] hover:text-white'
                        }`}
                      >
                        {concluida ? (
                          <>
                            <Check size={13} />
                            Concluída
                          </>
                        ) : (
                          <>
                            <PencilLine size={13} />
                            Responder
                          </>
                        )}
                      </button>
                    </td>

                    <td className="whitespace-nowrap px-3 py-2">
                      <ChipPrazo
                        situacao={situacao}
                        complemento={concluida ? undefined : textoPrazo(tarefa.prazo, hoje)}
                      />
                      <div className="mt-1 text-[11px] tabular-nums text-slate-400">
                        {formatarData(tarefa.prazo)}
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                      {tarefa.responsavelNome ?? <span className="text-slate-400">Não atribuída</span>}
                    </td>

                    <td className="px-3 py-2">
                      <div
                        className="max-w-[280px] truncate text-slate-700"
                        title={tarefa.observacaoCorrecao ?? ''}
                      >
                        {tarefa.observacaoCorrecao ?? <span className="text-slate-400">—</span>}
                      </div>
                    </td>

                    {layout.colunasMatriz.map((coluna) => {
                      const numerica = layout.colunasNumericas.includes(coluna)
                      const moeda = layout.colunasMoeda.includes(coluna)

                      return (
                        <td
                          key={coluna}
                          className={`whitespace-nowrap px-3 py-2 text-slate-600 ${
                            numerica ? 'text-right tabular-nums' : ''
                          }`}
                        >
                          <span className="block max-w-[320px] truncate">
                            {formatarCelula(tarefa.dados[coluna], { moeda })}
                          </span>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {emEdicao && (
        <PainelResposta
          tarefa={emEdicao}
          responsaveis={responsaveis}
          hoje={hoje}
          usuario={usuario}
          aoFechar={() => setEmEdicao(null)}
          aoSalvar={(atualizada) => {
            aoAtualizar(atualizada)
            setEmEdicao(null)
          }}
        />
      )}
    </div>
  )
}
