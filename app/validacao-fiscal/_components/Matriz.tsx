'use client'

import { useMemo, useState } from 'react'
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  Loader2,
  PencilLine,
  Search,
  ShieldCheck,
  UserPlus,
} from 'lucide-react'

import { atribuirEmLote, descreverErro } from '../_lib/api'
import { CORES } from '../_lib/cores'
import { formatarCelula, formatarInteiro } from '../_lib/formato'
import { formatarData, situacaoPrazo, textoPrazo } from '../_lib/prazo'
import {
  estaFinalizada,
  ROTULO_FLUXO,
  ROTULO_ORIGEM,
  type Fluxo,
  type Responsavel,
  type TarefaFiscal,
} from '../_lib/types'
import { ChipPrazo, Painel } from './Ui'
import { PainelResposta } from './PainelResposta'

type FiltroPrazo =
  | 'todos'
  | 'abertas'
  | 'atrasadas'
  | 'vence_hoje'
  | 'em_andamento'
  | 'andamento_atrasado'
  | 'corrigidas'
  | 'sem_correcao'

const FILTROS: { valor: FiltroPrazo; rotulo: string }[] = [
  { valor: 'abertas', rotulo: 'Em aberto' },
  { valor: 'atrasadas', rotulo: 'Atrasadas' },
  { valor: 'vence_hoje', rotulo: 'Vencem hoje' },
  { valor: 'em_andamento', rotulo: 'Em andamento' },
  { valor: 'andamento_atrasado', rotulo: 'Em andamento atrasadas' },
  { valor: 'corrigidas', rotulo: 'Corrigidas' },
  { valor: 'sem_correcao', rotulo: 'Sem correção' },
  { valor: 'todos', rotulo: 'Todas' },
]

const CAMPO =
  'rounded-md border border-line-strong bg-white px-3 py-2 text-sm text-ink-700 outline-none focus:border-teal-500'

/** Coluna fixa da esquerda: largura travada e sombra marcando a borda de rolagem. */
const CONGELADA =
  'w-[186px] min-w-[186px] border-r border-line shadow-[8px_0_12px_-10px_rgba(15,23,42,0.45)]'

const ROTULO_TH = 'text-[11px] font-bold uppercase tracking-wider text-ink-500'

/**
 * Chave de acesso tem 44 dígitos e ocuparia meia tela sem informar nada: o que
 * distingue uma linha da outra está no fim. O valor inteiro fica no title e no
 * painel de detalhe.
 */
function fimDaChave(valor: string): string {
  return valor.length > 14 ? `…${valor.slice(-12)}` : valor
}

/** Colunas fora da planilha que também dá para ordenar. */
const CHAVE_NUMERO = '@numero'
const CHAVE_RESPONSAVEL = '@responsavel'
const CHAVE_OBSERVACAO = '@observacao'

/**
 * As colunas da matriz — as mesmas sempre.
 *
 * Já foram adaptativas, mostrando as colunas próprias de cada relatório, e o
 * resultado foi uma tabela que mudava de forma conforme o filtro: entrada e
 * saída pareciam telas diferentes. Um conjunto fixo é o que deixa a pessoa
 * aprender a matriz uma vez. A linha original inteira continua no painel, a um
 * clique de distância.
 */
const COLUNAS_COMUNS = [
  { chave: '@origem', rotulo: 'Planilha' },
  { chave: '@fluxo', rotulo: 'Fluxo' },
  { chave: '@documento', rotulo: 'Documento' },
  { chave: '@emitente', rotulo: 'Emitente / destinatário' },
  { chave: '@tipo', rotulo: 'Divergência' },
  { chave: '@filial', rotulo: 'Filial' },
  { chave: '@valor', rotulo: 'Valor' },
  { chave: '@emissao', rotulo: 'Emissão' },
] as const

const COMUNS_NUMERICAS = new Set(['@filial', '@valor'])
const COMUNS_LARGAS = new Set(['@emitente', '@tipo'])

function valorComum(tarefa: TarefaFiscal, chave: string): string | number | null {
  switch (chave) {
    case '@origem':
      return tarefa.aba ? `${ROTULO_ORIGEM[tarefa.origem]} · ${tarefa.aba}` : ROTULO_ORIGEM[tarefa.origem]
    case '@documento':
      return tarefa.documento
    case '@emitente':
      return tarefa.emitente
    case '@tipo':
      return tarefa.tipoDivergencia
    case '@filial':
      return tarefa.filial
    case '@fluxo':
      return ROTULO_FLUXO[tarefa.fluxo]
    case '@valor':
      return tarefa.valor
    case '@emissao':
      return tarefa.emissao
    default:
      return null
  }
}

type Ordenacao = { coluna: string; direcao: 'asc' | 'desc' }

function valorParaOrdenar(tarefa: TarefaFiscal, coluna: string): string | number | null {
  if (coluna === CHAVE_NUMERO) return tarefa.numero
  if (coluna === CHAVE_RESPONSAVEL) return tarefa.responsavelNome
  if (coluna === CHAVE_OBSERVACAO) return tarefa.observacaoCorrecao ?? tarefa.motivoAndamento
  return valorComum(tarefa, coluna)
}

/**
 * Compara duas células. Vazio sempre no fim, nos dois sentidos: quem ordena
 * está procurando conteúdo, e uma coluna cheia de branco no topo não ajuda.
 */
function comparar(a: string | number | null, b: string | number | null): number {
  const vazioA = a === null || a === ''
  const vazioB = b === null || b === ''
  if (vazioA || vazioB) return vazioA && vazioB ? 0 : vazioA ? 1 : -1

  if (typeof a === 'number' && typeof b === 'number') return a - b

  return String(a).localeCompare(String(b), 'pt-BR', { numeric: true, sensitivity: 'base' })
}

export function Matriz({
  tarefas,
  responsaveis,
  hoje,
  usuario,
  aoAtualizar,
  aoRemover,
}: {
  tarefas: TarefaFiscal[]
  responsaveis: Responsavel[]
  hoje: string
  usuario: string
  aoAtualizar: (t: TarefaFiscal) => void
  aoRemover: (id: string) => void
}) {
  const [filtroPrazo, setFiltroPrazo] = useState<FiltroPrazo>('abertas')
  const [filtroResponsavel, setFiltroResponsavel] = useState('todos')
  const [busca, setBusca] = useState('')
  const [emEdicao, setEmEdicao] = useState<TarefaFiscal | null>(null)
  const [donoEmLote, setDonoEmLote] = useState('')
  const [confirmandoLote, setConfirmandoLote] = useState(false)
  const [atribuindo, setAtribuindo] = useState(false)
  const [erroLote, setErroLote] = useState<string | null>(null)
  const [ordenacao, setOrdenacao] = useState<Ordenacao | null>(null)
  const [filtroFluxo, setFiltroFluxo] = useState<Fluxo | 'todos'>('todos')

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase()

    const filtradas = tarefas.filter((tarefa) => {
      const situacao = situacaoPrazo(tarefa.status, tarefa.prazo, tarefa.concluidoEm, hoje)

      if (filtroFluxo !== 'todos' && tarefa.fluxo !== filtroFluxo) return false

      if (filtroPrazo === 'abertas' && estaFinalizada(tarefa.status)) return false
      if (filtroPrazo === 'corrigidas' && tarefa.status !== 'concluida') return false
      if (filtroPrazo === 'sem_correcao' && tarefa.status !== 'sem_correcao') return false
      if (filtroPrazo === 'atrasadas' && situacao !== 'atrasada') return false
      if (filtroPrazo === 'vence_hoje' && situacao !== 'vence_hoje') return false
      if (filtroPrazo === 'em_andamento' && tarefa.status !== 'em_andamento') return false
      if (
        filtroPrazo === 'andamento_atrasado' &&
        (tarefa.status !== 'em_andamento' || situacao !== 'atrasada')
      ) {
        return false
      }

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

    // Sem escolha da pessoa, vale a ordem que veio do banco: em aberto
    // primeiro, prazo mais curto no topo.
    if (!ordenacao) return filtradas

    const sinal = ordenacao.direcao === 'asc' ? 1 : -1

    return [...filtradas].sort(
      (a, b) =>
        sinal * comparar(valorParaOrdenar(a, ordenacao.coluna), valorParaOrdenar(b, ordenacao.coluna)),
    )
  }, [tarefas, filtroPrazo, filtroFluxo, filtroResponsavel, busca, hoje, ordenacao])

  const colunas = COLUNAS_COMUNS.map((c) => ({ chave: c.chave, rotulo: c.rotulo }))
  const ehNumerica = (chave: string) => COMUNS_NUMERICAS.has(chave)

  /** Um clique ordena crescente, o seguinte inverte, o terceiro solta a coluna. */
  const alternarOrdem = (coluna: string) => {
    setOrdenacao((atual) => {
      if (atual?.coluna !== coluna) return { coluna, direcao: 'asc' }
      if (atual.direcao === 'asc') return { coluna, direcao: 'desc' }
      return null
    })
  }

  const ariaOrdem = (coluna: string): 'ascending' | 'descending' | 'none' => {
    if (ordenacao?.coluna !== coluna) return 'none'
    return ordenacao.direcao === 'asc' ? 'ascending' : 'descending'
  }

  // Função que devolve JSX, não um componente declarado aqui dentro: um
  // componente novo a cada render remontaria o cabeçalho a cada tecla digitada
  // na busca.
  const botaoOrdenar = (chave: string, rotulo: string, alinharDireita = false) => {
    const ativa = ordenacao?.coluna === chave
    const Icone = !ativa ? ArrowUpDown : ordenacao.direcao === 'asc' ? ArrowUp : ArrowDown

    return (
      <button
        type="button"
        onClick={() => alternarOrdem(chave)}
        title={`Ordenar por ${rotulo}`}
        className={`group flex w-full items-center gap-1.5 transition-colors hover:text-teal-600 ${
          alinharDireita ? 'justify-end' : ''
        } ${ativa ? 'text-teal-600' : ''}`}
      >
        {rotulo}
        <Icone
          size={12}
          className={`shrink-0 transition-opacity ${
            ativa ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'
          }`}
          aria-hidden
        />
      </button>
    )
  }

  const escolhidoParaLote = responsaveis.find((r) => r.id === donoEmLote) ?? null

  /** Atribui de uma vez as tarefas que estão na tela (aba + filtros ativos). */
  const atribuirVisiveis = async () => {
    setErroLote(null)
    setAtribuindo(true)
    try {
      const atualizadas = await atribuirEmLote(
        visiveis.map((t) => t.id),
        escolhidoParaLote,
      )
      atualizadas.forEach(aoAtualizar)
      setConfirmandoLote(false)
      setDonoEmLote('')
    } catch (falha) {
      setErroLote(descreverErro(falha))
    } finally {
      setAtribuindo(false)
    }
  }

  if (tarefas.length === 0) {
    return (
      <Painel titulo="Nenhuma tarefa">
        <p className="text-sm text-ink-500">
          Importe as planilhas para gerar as tarefas de correção.
        </p>
      </Painel>
    )
  }

  return (
    <div className="space-y-4">
      <Painel className="!p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-md border border-line-strong bg-white px-3 py-2">
            <Search size={16} className="shrink-0 text-ink-400" />
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar em qualquer campo da planilha"
              className="w-64 bg-transparent text-sm text-ink-700 outline-none placeholder:text-ink-400"
            />
          </div>

          {/* Entrada e saída são times diferentes: separar antes do prazo evita
              alguém responder o que não é da sua área. */}
          <div className="flex flex-wrap gap-1 rounded-md bg-navy-100 p-1">
            {([
              { valor: 'todos', rotulo: 'Todas' },
              { valor: 'saida', rotulo: 'Saídas' },
              { valor: 'entrada', rotulo: 'Entradas' },
            ] as const).map((f) => (
              <button
                key={f.valor}
                type="button"
                onClick={() => setFiltroFluxo(f.valor)}
                aria-pressed={filtroFluxo === f.valor}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                  filtroFluxo === f.valor
                    ? 'bg-white text-navy-700 shadow-sm'
                    : 'text-ink-500 hover:text-navy-700'
                }`}
              >
                {f.rotulo}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-1 rounded-md bg-navy-100 p-1">
            {FILTROS.map((f) => (
              <button
                key={f.valor}
                type="button"
                onClick={() => setFiltroPrazo(f.valor)}
                aria-pressed={filtroPrazo === f.valor}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                  filtroPrazo === f.valor
                    ? 'bg-white text-navy-700 shadow-sm'
                    : 'text-ink-500 hover:text-navy-700'
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

          <span className="ml-auto text-sm text-ink-500">
            {formatarInteiro(visiveis.length)} de {formatarInteiro(tarefas.length)} tarefas
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-line pt-3">
          <span className="text-sm font-semibold text-navy-700">Atribuir em lote</span>

          <select
            value={donoEmLote}
            onChange={(e) => {
              setDonoEmLote(e.target.value)
              setConfirmandoLote(false)
              setErroLote(null)
            }}
            aria-label="Responsável para as tarefas em tela"
            className={CAMPO}
          >
            <option value="">Escolha a pessoa…</option>
            {responsaveis.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nome}
              </option>
            ))}
          </select>

          {confirmandoLote ? (
            <>
              <span className="text-sm text-ink-700">
                Passar <strong>{formatarInteiro(visiveis.length)}</strong> tarefa(s) em tela para{' '}
                <strong>{escolhidoParaLote?.nome}</strong>?
              </span>

              <button
                type="button"
                onClick={atribuirVisiveis}
                disabled={atribuindo}
                className="inline-flex items-center gap-2 rounded-md bg-teal-600 px-4 py-2 text-sm font-bold text-white transition-all hover:brightness-110 disabled:opacity-40"
              >
                {atribuindo ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                Confirmar
              </button>

              <button
                type="button"
                onClick={() => setConfirmandoLote(false)}
                disabled={atribuindo}
                className="text-sm text-ink-500 transition-colors hover:text-navy-700 disabled:opacity-40"
              >
                Cancelar
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setConfirmandoLote(true)}
                disabled={!escolhidoParaLote || visiveis.length === 0}
                className="inline-flex items-center gap-2 rounded-md border border-teal-500 px-4 py-2 text-sm font-bold text-teal-600 transition-all hover:bg-teal-600 hover:text-white disabled:cursor-not-allowed disabled:border-line disabled:text-ink-400 disabled:hover:bg-transparent"
              >
                <UserPlus size={15} />
                Atribuir as {formatarInteiro(visiveis.length)} da tela
              </button>

              <span className="text-xs text-ink-400">
                Vale para a aba e os filtros ativos — inclusive as que já têm dono.
              </span>
            </>
          )}

          {erroLote && (
            <span
              role="alert"
              className="flex items-center gap-1.5 text-sm"
              style={{ color: CORES.critico }}
            >
              <AlertCircle size={15} />
              {erroLote}
            </span>
          )}
        </div>
      </Painel>

      <div className="overflow-hidden rounded-lg border border-line bg-white shadow-card">
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
                  aria-sort={ariaOrdem(CHAVE_NUMERO)}
                  className={`${CONGELADA} sticky left-0 top-0 z-30 border-b border-line bg-navy-50 px-4 py-3 text-left ${ROTULO_TH}`}
                >
                  {botaoOrdenar(CHAVE_NUMERO, 'Nº · tarefa')}
                </th>

                {[
                  { chave: CHAVE_RESPONSAVEL, rotulo: 'Responsável' },
                  { chave: CHAVE_OBSERVACAO, rotulo: 'Observação / motivo' },
                  ...colunas,
                ].map((coluna) => (
                  <th
                    key={coluna.chave}
                    scope="col"
                    aria-sort={ariaOrdem(coluna.chave)}
                    className={`whitespace-nowrap border-b border-l border-line bg-navy-50 px-4 py-3 text-left ${ROTULO_TH} ${
                      ehNumerica(coluna.chave) ? 'text-right' : ''
                    }`}
                  >
                    {botaoOrdenar(coluna.chave, coluna.rotulo, ehNumerica(coluna.chave))}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {visiveis.length === 0 && (
                <tr>
                  <td
                    colSpan={3 + colunas.length}
                    className="px-4 py-12 text-center text-sm text-ink-400"
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
                const faixa = linha % 2 === 1 ? 'bg-navy-50/70' : 'bg-white'

                return (
                  <tr
                    key={tarefa.id}
                    className={`group border-b border-line ${faixa} hover:bg-teal-600/[0.06]`}
                  >
                    <td
                      className={`${CONGELADA} sticky left-0 z-10 px-4 py-3 align-top ${faixa} group-hover:bg-[#eef7fa]`}
                    >
                      {/* Número da atividade, não a posição na lista: serve
                          para citar a tarefa fora do sistema e não muda quando
                          o filtro muda. */}
                      <span className="mb-1.5 block text-[11px] font-bold tabular-nums text-ink-400">
                        Nº {tarefa.numero}
                      </span>

                      <button
                        type="button"
                        onClick={() => setEmEdicao(tarefa)}
                        className={`inline-flex w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-md border px-3 py-1.5 text-xs font-bold transition-all ${
                          finalizada
                            ? 'border-line text-ink-400 hover:border-line-strong hover:text-ink-700'
                            : 'border-teal-500 text-teal-600 hover:bg-teal-600 hover:text-white'
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
                        <span className="text-[11px] tabular-nums text-ink-400">
                          {finalizada
                            ? formatarData(tarefa.prazo)
                            : `${formatarData(tarefa.prazo)} · ${textoPrazo(tarefa.prazo, hoje)}`}
                        </span>
                        <span className="text-[11px] text-ink-400">
                          {ROTULO_FLUXO[tarefa.fluxo]}
                        </span>
                        {tarefa.status === 'em_andamento' && (
                          <span
                            className="text-[11px] font-semibold"
                            style={{
                              color: situacao === 'atrasada' ? CORES.critico : CORES.atencao,
                            }}
                          >
                            Em andamento{situacao === 'atrasada' ? ' · fora do prazo' : ''}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="w-[150px] border-l border-line px-4 py-3 align-top text-ink-700">
                      {tarefa.responsavelNome ?? (
                        <span className="text-ink-400">Não atribuída</span>
                      )}
                    </td>

                    <td className="w-[250px] border-l border-line px-4 py-3 align-top">
                      {tarefa.observacaoCorrecao && (
                        <div
                          className="line-clamp-2 leading-snug text-ink-700"
                          title={tarefa.observacaoCorrecao}
                        >
                          {tarefa.observacaoCorrecao}
                        </div>
                      )}

                      {tarefa.status === 'em_andamento' && tarefa.motivoAndamento && (
                        <div
                          className="line-clamp-2 leading-snug text-ink-500"
                          title={tarefa.motivoAndamento}
                        >
                          <span className="font-semibold text-ink-400">Parada em: </span>
                          {tarefa.motivoAndamento}
                        </div>
                      )}

                      {!tarefa.observacaoCorrecao &&
                        !(tarefa.status === 'em_andamento' && tarefa.motivoAndamento) && (
                          <span className="text-ink-400">—</span>
                        )}
                    </td>

                    {colunas.map(({ chave: coluna }) => {
                      const numerica = ehNumerica(coluna)
                      const larga = COMUNS_LARGAS.has(coluna)
                      const texto = formatarCelula(valorComum(tarefa, coluna), {
                        moeda: coluna === '@valor',
                      })
                      const codigo = false

                      return (
                        <td
                          key={coluna}
                          className={`border-l border-line px-4 py-3 align-top ${
                            numerica ? 'text-right tabular-nums text-ink-700' : 'text-ink-700'
                          }`}
                        >
                          {codigo ? (
                            <span
                              className="block whitespace-nowrap font-mono text-[11px] text-ink-500"
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

      <p className="text-xs text-ink-400">
        A matriz é a mesma para entrada e saída. Para ver a linha exatamente como veio da planilha,
        com todas as colunas do arquivo, clique em Responder.
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
          aoExcluir={(id) => {
            aoRemover(id)
            setEmEdicao(null)
          }}
        />
      )}
    </div>
  )
}
