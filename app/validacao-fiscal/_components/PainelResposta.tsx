'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, Check, Loader2, Pencil, Trash2, X } from 'lucide-react'

import { CORES } from '../_lib/cores'
import { descreverErro, excluirTarefa, salvarResposta, type EdicaoTarefa } from '../_lib/api'
import { formatarCelula } from '../_lib/formato'
import { formatarData, situacaoPrazo, textoPrazo } from '../_lib/prazo'
import { layoutDe } from '../_lib/planilhas'
import {
  estaFinalizada,
  ROTULO_ORIGEM,
  ROTULO_STATUS,
  type Responsavel,
  type StatusTarefa,
  type TarefaFiscal,
} from '../_lib/types'
import { ChipPrazo } from './Ui'

const CAMPO =
  'w-full rounded-md border border-line-strong bg-white px-3 py-2 text-sm text-ink-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-[#0f88a8]/20'

const ROTULO = 'text-xs uppercase tracking-wider text-ink-400 font-semibold'

/** Os quatro desfechos possíveis, na ordem em que a tarefa costuma andar. */
const ESTADOS: { valor: StatusTarefa; ajuda: string }[] = [
  { valor: 'pendente', ajuda: 'Ainda não começou.' },
  { valor: 'em_andamento', ajuda: 'Começou e está parada em alguém ou em alguma etapa.' },
  { valor: 'concluida', ajuda: 'Havia divergência e ela foi corrigida.' },
  { valor: 'sem_correcao', ajuda: 'Foi conferida e já estava certa — nada a corrigir.' },
]

/**
 * Painel lateral onde o time responde a tarefa.
 *
 * Mostra a linha inteira da planilha porque a correção é feita no Sênior com
 * esses dados na mão — sem eles a pessoa teria que voltar ao arquivo original.
 */
export function PainelResposta({
  tarefa,
  responsaveis,
  hoje,
  usuario,
  aoFechar,
  aoSalvar,
  aoExcluir,
}: {
  tarefa: TarefaFiscal
  responsaveis: Responsavel[]
  hoje: string
  usuario: string
  aoFechar: () => void
  aoSalvar: (t: TarefaFiscal) => void
  aoExcluir: (id: string) => void
}) {
  const [responsavelId, setResponsavelId] = useState(tarefa.responsavelId ?? '')
  const [observacao, setObservacao] = useState(tarefa.observacaoCorrecao ?? '')
  const [status, setStatus] = useState<StatusTarefa>(tarefa.status)
  const [motivo, setMotivo] = useState(tarefa.motivoAndamento ?? '')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  const [editando, setEditando] = useState(false)
  const [excluindo, setExcluindo] = useState(false)
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false)
  const [edicao, setEdicao] = useState<EdicaoTarefa>({
    documento: tarefa.documento,
    emitente: tarefa.emitente,
    tipoDivergencia: tarefa.tipoDivergencia,
    valor: tarefa.valor,
    prazo: tarefa.prazo,
  })

  const layout = layoutDe(tarefa.origem)
  const situacao = situacaoPrazo(tarefa.status, tarefa.prazo, tarefa.concluidoEm, hoje)
  const encerrando = estaFinalizada(status)

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') aoFechar()
    }
    document.addEventListener('keydown', aoTeclar)
    return () => document.removeEventListener('keydown', aoTeclar)
  }, [aoFechar])

  const enviar = async () => {
    const texto = observacao.trim()
    const razao = motivo.trim()

    // Encerrar sem uma linha de justificativa não deixa rastro: seis meses
    // depois ninguém sabe o que foi feito nem por que nada precisou ser feito.
    if (status === 'concluida' && !texto) {
      setErro('Descreva a correção na observação antes de concluir.')
      return
    }
    if (status === 'sem_correcao' && !texto) {
      setErro('Explique na observação por que a linha já estava correta.')
      return
    }
    if (status === 'em_andamento' && !razao) {
      setErro('Informe o motivo — com quem a tarefa está ou o que falta.')
      return
    }
    if (editando && !edicao.documento.trim()) {
      setErro('O número do documento não pode ficar em branco.')
      return
    }
    if (editando && !/^\d{4}-\d{2}-\d{2}$/.test(edicao.prazo)) {
      setErro('Informe um prazo válido.')
      return
    }

    setErro(null)
    setSalvando(true)
    try {
      const escolhido = responsaveis.find((r) => r.id === responsavelId)
      const atualizada = await salvarResposta({
        id: tarefa.id,
        status,
        responsavelId: escolhido?.id ?? null,
        responsavelNome: escolhido?.nome ?? null,
        observacao: texto || null,
        motivo: razao || null,
        usuario,
        // Só vai o que a pessoa realmente abriu para editar — assim uma tela
        // aberta há dez minutos não sobrescreve o que outra pessoa corrigiu.
        edicao: editando
          ? { ...edicao, documento: edicao.documento.trim(), emitente: edicao.emitente.trim() }
          : undefined,
      })
      aoSalvar(atualizada)
    } catch (falha) {
      setErro(descreverErro(falha))
    } finally {
      setSalvando(false)
    }
  }

  const remover = async () => {
    setErro(null)
    setExcluindo(true)
    try {
      await excluirTarefa(tarefa.id)
      aoExcluir(tarefa.id)
    } catch (falha) {
      setErro(descreverErro(falha))
      setExcluindo(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={aoFechar} aria-hidden />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Responder correção do documento ${tarefa.documento}`}
        className="relative flex h-full w-full max-w-xl flex-col bg-navy-50 shadow-xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-line bg-white p-5">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-ink-400 font-semibold">
              {tarefa.aba ? `${ROTULO_ORIGEM[tarefa.origem]} · ${tarefa.aba}` : ROTULO_ORIGEM[tarefa.origem]}
            </p>
            <h2 className="mt-1 flex items-center gap-2 text-xl font-bold text-navy-700">
              <span className="shrink-0 rounded-md bg-navy-100 px-2 py-0.5 text-sm tabular-nums text-ink-500">
                Nº {tarefa.numero}
              </span>
              <span className="truncate">Documento {tarefa.documento}</span>
            </h2>
            <p className="mt-1 text-sm text-ink-700">{tarefa.tipoDivergencia}</p>
          </div>

          <button
            type="button"
            onClick={aoFechar}
            aria-label="Fechar"
            className="rounded-full border border-line p-2 text-ink-400 hover:text-ink-700 hover:bg-navy-100 transition-colors"
          >
            <X size={16} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <ChipPrazo
              situacao={situacao}
              complemento={
                estaFinalizada(tarefa.status) ? undefined : textoPrazo(tarefa.prazo, hoje)
              }
            />
            <span className="text-sm text-ink-500">Prazo: {formatarData(tarefa.prazo)}</span>
            <span className="rounded-full border border-line bg-white px-2.5 py-1 text-xs text-ink-700">
              {ROTULO_STATUS[tarefa.status]}
            </span>
          </div>

          <div className="bg-white rounded-lg border border-line p-4 space-y-4">
            <fieldset>
              <legend className="text-xs uppercase tracking-wider text-ink-400 font-semibold">
                Situação da tarefa
              </legend>

              <div className="mt-2 grid grid-cols-2 gap-2">
                {ESTADOS.map((estado) => {
                  const ativo = status === estado.valor

                  return (
                    <button
                      key={estado.valor}
                      type="button"
                      onClick={() => setStatus(estado.valor)}
                      aria-pressed={ativo}
                      className={`rounded-md border px-3 py-2.5 text-left text-sm font-semibold transition-all ${
                        ativo
                          ? 'border-teal-500 bg-teal-600/10 text-navy-700'
                          : 'border-line text-ink-500 hover:border-line-strong hover:text-navy-700'
                      }`}
                    >
                      {ROTULO_STATUS[estado.valor]}
                    </button>
                  )
                })}
              </div>

              <p className="mt-2 text-xs text-ink-500 leading-relaxed">
                {ESTADOS.find((e) => e.valor === status)?.ajuda}
              </p>
            </fieldset>

            {status === 'em_andamento' && (
              <div>
                <label
                  htmlFor="motivo"
                  className="text-xs uppercase tracking-wider text-ink-400 font-semibold"
                >
                  Motivo — com quem está / o que falta
                </label>
                <input
                  id="motivo"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Ex.: enviado para o fiscal da transportadora em 11/08."
                  className={`mt-2 ${CAMPO}`}
                />
                <p className="mt-1.5 text-xs text-ink-400">
                  Aparece na matriz para todo mundo saber por que a tarefa está parada.
                </p>
              </div>
            )}

            <div>
              <label htmlFor="responsavel" className="text-xs uppercase tracking-wider text-ink-400 font-semibold">
                Responsável
              </label>
              <select
                id="responsavel"
                value={responsavelId}
                onChange={(e) => setResponsavelId(e.target.value)}
                className={`mt-2 ${CAMPO}`}
              >
                <option value="">Não atribuída</option>
                {responsaveis.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="observacao" className="text-xs uppercase tracking-wider text-ink-400 font-semibold">
                Observação da correção
              </label>
              <textarea
                id="observacao"
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                rows={4}
                placeholder={
                  status === 'sem_correcao'
                    ? 'Por que a linha já estava correta.'
                    : 'O que foi corrigido, onde e quando.'
                }
                className={`mt-2 resize-y ${CAMPO}`}
              />
              <p className="mt-1.5 text-xs text-ink-400">
                {status === 'sem_correcao'
                  ? 'Obrigatória — é o que justifica encerrar sem mexer em nada.'
                  : 'Obrigatória para concluir — é o registro do que foi feito.'}
              </p>
            </div>

            {erro && (
              <p role="alert" className="flex items-start gap-2 text-sm" style={{ color: CORES.critico }}>
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                {erro}
              </p>
            )}

            {tarefa.concluidoEm && (
              <p className="text-xs text-ink-400">
                Concluída em{' '}
                {new Date(tarefa.concluidoEm).toLocaleString('pt-BR', {
                  timeZone: 'America/Sao_Paulo',
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
                {tarefa.concluidoPor ? ` por ${tarefa.concluidoPor}` : ''}.
              </p>
            )}
          </div>

          <section className="rounded-lg border border-line bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-navy-700">Dados da tarefa</h3>
                <p className="mt-1 text-xs text-ink-400 leading-relaxed">
                  Corrija o que veio errado da planilha. A linha original continua guardada abaixo.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setEditando((atual) => !atual)}
                aria-pressed={editando}
                className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-bold transition-colors ${
                  editando
                    ? 'border-teal-500 bg-teal-600/10 text-navy-700'
                    : 'border-line-strong text-ink-500 hover:border-teal-500 hover:text-teal-600'
                }`}
              >
                <Pencil size={13} />
                {editando ? 'Editando' : 'Editar'}
              </button>
            </div>

            {editando ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="ed-documento" className={ROTULO}>
                    Nº do documento
                  </label>
                  <input
                    id="ed-documento"
                    value={edicao.documento}
                    onChange={(e) => setEdicao((a) => ({ ...a, documento: e.target.value }))}
                    className={`mt-2 ${CAMPO}`}
                  />
                </div>

                <div>
                  <label htmlFor="ed-prazo" className={ROTULO}>
                    Prazo
                  </label>
                  <input
                    id="ed-prazo"
                    type="date"
                    value={edicao.prazo}
                    onChange={(e) => setEdicao((a) => ({ ...a, prazo: e.target.value }))}
                    className={`mt-2 ${CAMPO}`}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="ed-emitente" className={ROTULO}>
                    Emitente
                  </label>
                  <input
                    id="ed-emitente"
                    value={edicao.emitente}
                    onChange={(e) => setEdicao((a) => ({ ...a, emitente: e.target.value }))}
                    className={`mt-2 ${CAMPO}`}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="ed-tipo" className={ROTULO}>
                    Tipo de divergência
                  </label>
                  <input
                    id="ed-tipo"
                    value={edicao.tipoDivergencia}
                    onChange={(e) => setEdicao((a) => ({ ...a, tipoDivergencia: e.target.value }))}
                    className={`mt-2 ${CAMPO}`}
                  />
                </div>

                <div>
                  <label htmlFor="ed-valor" className={ROTULO}>
                    Valor
                  </label>
                  <input
                    id="ed-valor"
                    type="number"
                    step="0.01"
                    value={edicao.valor ?? ''}
                    onChange={(e) =>
                      setEdicao((a) => ({
                        ...a,
                        valor: e.target.value === '' ? null : Number(e.target.value),
                      }))
                    }
                    className={`mt-2 ${CAMPO}`}
                  />
                </div>

                <p className="self-end text-xs text-ink-400 leading-relaxed">
                  As alterações vão junto com o botão Salvar, lá embaixo.
                </p>
              </div>
            ) : (
              <dl className="mt-4 grid gap-x-4 gap-y-2 sm:grid-cols-2">
                {[
                  { rotulo: 'Nº do documento', valor: tarefa.documento || '—' },
                  { rotulo: 'Prazo', valor: formatarData(tarefa.prazo) },
                  { rotulo: 'Emitente', valor: tarefa.emitente || '—' },
                  { rotulo: 'Tipo de divergência', valor: tarefa.tipoDivergencia || '—' },
                ].map((item) => (
                  <div key={item.rotulo} className="min-w-0">
                    <dt className="text-xs text-ink-400">{item.rotulo}</dt>
                    <dd className="truncate text-sm text-ink-700" title={item.valor}>
                      {item.valor}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </section>

          <section>
            <h3 className="text-sm font-bold text-navy-700">Linha da planilha</h3>
            <p className="mt-1 text-xs text-ink-400">
              Todos os campos preenchidos na exportação original.
            </p>

            <dl className="mt-3 divide-y divide-slate-100 rounded-lg border border-line bg-white">
              {Object.entries(tarefa.dados).map(([campo, valor]) => (
                <div key={campo} className="flex gap-4 px-4 py-2.5">
                  <dt className="w-2/5 shrink-0 text-xs text-ink-400">{campo}</dt>
                  <dd className="min-w-0 flex-1 break-words text-sm text-ink-700">
                    {formatarCelula(valor, { moeda: layout.colunasMoeda.includes(campo) })}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        </div>

        <footer className="flex flex-wrap items-center gap-3 border-t border-line bg-white p-5">
          <button
            type="button"
            onClick={enviar}
            disabled={salvando}
            className="inline-flex items-center gap-2 rounded-md bg-teal-600 px-5 py-2.5 text-sm font-bold text-white transition-all hover:brightness-110 disabled:opacity-40"
          >
            {salvando ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            {encerrando ? `Encerrar como ${ROTULO_STATUS[status].toLowerCase()}` : 'Salvar resposta'}
          </button>

          <button
            type="button"
            onClick={aoFechar}
            disabled={salvando}
            className="rounded-md border border-line-strong px-5 py-2.5 text-sm font-semibold text-ink-700 transition-colors hover:bg-navy-50 disabled:opacity-40"
          >
            Cancelar
          </button>

          {estaFinalizada(tarefa.status) && !encerrando && (
            <span className="text-xs text-ink-500">
              Vai reabrir a tarefa e limpar a data de conclusão.
            </span>
          )}

          <div className="ml-auto">
            {confirmandoExclusao ? (
              <div className="flex flex-wrap items-center justify-end gap-3">
                <span className="text-xs leading-relaxed text-ink-700">
                  Apagar a tarefa nº {tarefa.numero}? Ela volta na próxima importação da mesma
                  planilha, mas a resposta se perde.
                </span>

                <button
                  type="button"
                  onClick={remover}
                  disabled={excluindo}
                  className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-bold text-white transition-all hover:brightness-110 disabled:opacity-40"
                  style={{ background: CORES.critico }}
                >
                  {excluindo ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                  Apagar
                </button>

                <button
                  type="button"
                  onClick={() => setConfirmandoExclusao(false)}
                  disabled={excluindo}
                  className="text-sm text-ink-500 transition-colors hover:text-navy-700 disabled:opacity-40"
                >
                  Manter
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmandoExclusao(true)}
                disabled={salvando}
                className="inline-flex items-center gap-1.5 rounded-md border border-line px-4 py-2.5 text-sm font-semibold text-ink-400 transition-colors hover:border-[#b1272d] hover:text-negativo disabled:opacity-40"
              >
                <Trash2 size={15} />
                Excluir
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  )
}
