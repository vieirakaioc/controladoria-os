'use client'

import { useMemo, useState } from 'react'
import { Check, PencilLine, Search, ShieldCheck } from 'lucide-react'

import { formatarCelula, formatarInteiro } from '../_lib/formato'
import { formatarData, situacaoPrazo, textoPrazo } from '../_lib/prazo'
import { layoutDe } from '../_lib/planilhas'
import { estaFinalizada, ROTULO_ORIGEM, type Responsavel, type TarefaFiscal } from '../_lib/types'
import { ChipPrazo, Painel } from './Ui'
import { PainelResposta } from './PainelResposta'

type FiltroPrazo =
  | 'todos'
  | 'abertas'
  | 'atrasadas'
  | 'vence_hoje'
  | 'corrigidas'
  | 'sem_correcao'

const FILTROS: { valor: FiltroPrazo; rotulo: string }[] = [
  { valor: 'abertas', rotulo: 'Em aberto' },
  { valor: 'atrasadas', rotulo: 'Atrasadas' },
  { valor: 'vence_hoje', rotulo: 'Vencem hoje' },
  { valor: 'corrigidas', rotulo: 'Corrigidas' },
  { valor: 'sem_correcao', rotulo: 'Sem correção' },
  { valor: 'todos', rotulo: 'Todas' },
]

const CAMPO =
  'rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#0f88a8]'

/** Coluna fixa da esquerda: largura travada e sombra marcando a borda de rolagem. */
const CONGELADA =
  'w-[186px] min-w-[186px] border-r border-slate-200 shadow-[8px_0_12px_-10px_rgba(15,23,42,0.45)]'

const ROTULO_TH = 'text-[11px] font-bold uppercase tracking-wider text-slate-500'

/**
 * Chave de acesso tem 44 dígitos e ocuparia meia tela sem informar nada: o que
 * distingue uma linha da outra está no fim. O valor inteiro fica no title e no
 * painel de detalhe.
 */
function fimDaChave(valor: string): string {
  return valor.length > 14 ? `…${valor.slice(-12)}` : valor
}

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

      if (filtroPrazo === 'abertas' && estaFinalizada(tarefa.status)) return false
      if (filtroPrazo === 'corrigidas' && tarefa.status !== 'concluida') return false
      if (filtroPrazo === 'sem_correcao' && tarefa.status !== 'sem_correcao') return false
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
          tarefa.motivoAndamento ?? '',
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
          const abertas = g.tarefas.filter((t) => !estaFinalizada(t.status)).length
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
        <div className="max-h-[70vh] overflow-auto">
          {/*
            w-max em vez de w-full: com w-full o navegador estica as colunas para
            preencher a tela e abre vãos enormes entre elas. Aqui cada coluna
            ocupa o que o conteúdo pede e a tabela rola na horizontal.
          */}
          <table className="w-max min-w-full border-collapse text-sm">
            <thead className="sticky top-0 z-20">
              <tr>
                <th
                  scope="col"
                  className={`${CONGELADA} sticky left-0 top-0 z-30 border-b border-slate-200 bg-slate-50 px-4 py-3 text-left ${ROTULO_TH}`}
                >
                  Tarefa e prazo
                </th>

                {['Responsável', 'Observação / motivo', ...layout.colunasMatriz].map(
                  (coluna, indice) => (
                    <th
                      key={`${coluna}-${indice}`}
                      scope="col"
                      className={`whitespace-nowrap border-b border-l border-slate-200 bg-slate-50 px-4 py-3 text-left ${ROTULO_TH} ${
                        layout.colunasNumericas.includes(coluna) ? 'text-right' : ''
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
                    colSpan={3 + layout.colunasMatriz.length}
                    className="px-4 py-12 text-center text-sm text-slate-400"
                  >
                    Nenhuma tarefa com esses filtros.
                  </td>
                </tr>
              )}

              {visiveis.map((tarefa, linha) => {
                const situacao = situacaoPrazo(tarefa.status, tarefa.prazo, tarefa.concluidoEm, hoje)
                const finalizada = estaFinalizada(tarefa.status)
                const semCorrecao = tarefa.status === 'sem_correcao'
                // A faixa zebrada precisa estar também na célula congelada, que
                // tem fundo próprio para o resto da linha passar por baixo.
                const faixa = linha % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'

                return (
                  <tr
                    key={tarefa.id}
                    className={`group border-b border-slate-100 ${faixa} hover:bg-[#0f88a8]/[0.06]`}
                  >
                    <td
                      className={`${CONGELADA} sticky left-0 z-10 px-4 py-3 align-top ${faixa} group-hover:bg-[#eef7fa]`}
                    >
                      <button
                        type="button"
                        onClick={() => setEmEdicao(tarefa)}
                        className={`inline-flex w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-bold transition-all ${
                          finalizada
                            ? 'border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-700'
                            : 'border-[#0f88a8] text-[#0f88a8] hover:bg-[#0f88a8] hover:text-white'
                        }`}
                      >
                        {semCorrecao ? (
                          <>
                            <ShieldCheck size={13} />
                            Sem correção
                          </>
                        ) : finalizada ? (
                          <>
                            <Check size={13} />
                            Corrigida
                          </>
                        ) : (
                          <>
                            <PencilLine size={13} />
                            Responder
                          </>
                        )}
                      </button>

                      <div className="mt-2 flex flex-col gap-1">
                        <ChipPrazo situacao={situacao} />
                        <span className="text-[11px] tabular-nums text-slate-400">
                          {finalizada
                            ? formatarData(tarefa.prazo)
                            : `${formatarData(tarefa.prazo)} · ${textoPrazo(tarefa.prazo, hoje)}`}
                        </span>
                        {tarefa.status === 'em_andamento' && (
                          <span className="text-[11px] font-semibold text-[#c98500]">
                            Em andamento
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="w-[150px] border-l border-slate-100 px-4 py-3 align-top text-slate-700">
                      {tarefa.responsavelNome ?? (
                        <span className="text-slate-300">Não atribuída</span>
                      )}
                    </td>

                    <td className="w-[250px] border-l border-slate-100 px-4 py-3 align-top">
                      {tarefa.observacaoCorrecao && (
                        <div
                          className="line-clamp-2 leading-snug text-slate-700"
                          title={tarefa.observacaoCorrecao}
                        >
                          {tarefa.observacaoCorrecao}
                        </div>
                      )}

                      {tarefa.status === 'em_andamento' && tarefa.motivoAndamento && (
                        <div
                          className="line-clamp-2 leading-snug text-slate-500"
                          title={tarefa.motivoAndamento}
                        >
                          <span className="font-semibold text-slate-400">Parada em: </span>
                          {tarefa.motivoAndamento}
                        </div>
                      )}

                      {!tarefa.observacaoCorrecao &&
                        !(tarefa.status === 'em_andamento' && tarefa.motivoAndamento) && (
                          <span className="text-slate-300">—</span>
                        )}
                    </td>

                    {layout.colunasMatriz.map((coluna) => {
                      const bruto = tarefa.dados[coluna]
                      const numerica = layout.colunasNumericas.includes(coluna)
                      const codigo = layout.colunasCodigo.includes(coluna)
                      const larga = layout.colunasLargas.includes(coluna)
                      const texto = formatarCelula(bruto, {
                        moeda: layout.colunasMoeda.includes(coluna),
                      })

                      return (
                        <td
                          key={coluna}
                          className={`border-l border-slate-100 px-4 py-3 align-top ${
                            numerica ? 'text-right tabular-nums text-slate-700' : 'text-slate-600'
                          }`}
                        >
                          {codigo ? (
                            <span
                              className="block whitespace-nowrap font-mono text-[11px] text-slate-500"
                              title={texto}
                            >
                              {fimDaChave(texto)}
                            </span>
                          ) : larga ? (
                            <span className="line-clamp-2 block w-[220px] leading-snug" title={texto}>
                              {texto}
                            </span>
                          ) : (
                            <span className="block max-w-[200px] truncate whitespace-nowrap" title={texto}>
                              {texto}
                            </span>
                          )}
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

      <p className="text-xs text-slate-400">
        A tabela rola para o lado — a primeira coluna fica fixa. Clique em Responder para ver a
        linha completa da planilha.
      </p>

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
