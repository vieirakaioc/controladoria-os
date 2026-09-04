'use client'

import { use, useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  ArrowLeft,
  Check,
  FileText,
  History,
  Loader2,
  Download,
  Paperclip,
  PauseCircle,
  Pencil,
  RotateCcw,
  Send,
  Trash2,
  Truck,
} from 'lucide-react'

import { useAuthGate } from '@/app/tarefas/_hooks/useAuthGate'
import { listarResponsaveis } from '@/app/validacao-fiscal/_lib/api'
import { CORES } from '@/app/validacao-fiscal/_lib/cores'
import { formatarMoeda } from '@/app/validacao-fiscal/_lib/formato'
import { formatarData, hoje as dataDeHoje } from '@/app/validacao-fiscal/_lib/prazo'
import type { Responsavel } from '@/app/validacao-fiscal/_lib/types'

import { AvisoErro, Carregando, ChipPrazo, Painel, SemAcesso } from '../_components/Ui'
import { agingPlaca, agingProcesso, textoAging } from '../_lib/aging'
import { caixaAlta, moedaDoTexto, textoDaMoeda } from '../_lib/formato'
import {
  anexar,
  atribuirEtapa,
  baixarPasta,
  atualizarItem,
  buscarItem,
  concluirEtapa,
  descreverErro,
  enviarParaAprovacao,
  excluirItem,
  impedimentos,
  liberarAprovacao,
  listarAnexos,
  listarFiliais,
  listarModelo,
  listarMovimentos,
  meuAcesso,
  reabrirEtapa,
  removerAnexo,
  type Movimento,
} from '../_lib/api'
import {
  emEspera,
  podeAgir,
  ROTULO_CAMPO,
  type Acesso,
  type Anexo,
  type Etapa,
  type ModeloEtapa,
  rotuloFilial,
  type Filial,
  type Item,
} from '../_lib/types'

const CAMPO =
  'w-full rounded-md border border-line-strong bg-white px-3 py-2 text-sm text-ink-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-[#0f88a8]/20'

export default function PaginaFicha({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { userName } = useAuthGate()

  const [item, setItem] = useState<Item | null>(null)
  const [anexos, setAnexos] = useState<Anexo[]>([])
  const [movimentos, setMovimentos] = useState<Movimento[]>([])
  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([])
  // O modelo vem do banco, e não da etapa gravada: descrição é texto de
  // orientação, e melhorar a explicação tem que valer para os itens que já
  // estão correndo. É dele também que sai quem aprova e qual etapa oferece o
  // envio para aprovação.
  const [modelo, setModelo] = useState<Record<string, ModeloEtapa>>({})
  const [filiais, setFiliais] = useState<Filial[]>([])
  const [acesso, setAcesso] = useState<Acesso>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setErro(null)
    try {
      const tipo = await meuAcesso()
      setAcesso(tipo)
      if (!tipo) return

      const [oItem, osAnexos, osMovs, pessoas, oModelo, asFiliais] = await Promise.all([
        buscarItem(id),
        listarAnexos(id),
        listarMovimentos(id),
        listarResponsaveis(),
        listarModelo(),
        listarFiliais(),
      ])

      setItem(oItem)
      setAnexos(osAnexos)
      setMovimentos(osMovs)
      setResponsaveis(pessoas)
      setModelo(Object.fromEntries(oModelo.map((m) => [m.chave, m])))
      setFiliais(asFiliais)
    } catch (falha) {
      setErro(descreverErro(falha))
    } finally {
      setCarregando(false)
    }
  }, [id])

  useEffect(() => {
    carregar()
  }, [carregar])

  if (erro) return <AvisoErro mensagem={erro} />
  if (carregando) return <Carregando linhas={3} />
  if (!acesso) return <SemAcesso />

  if (!item) {
    return (
      <Painel titulo="Item não encontrado">
        <p className="text-sm text-ink-700">
          Ele pode ter sido excluído, ou o link está errado.
        </p>
        <Link href="/imobilizado" className="mt-4 inline-block text-sm font-bold text-teal-600">
          Voltar para a fila
        </Link>
      </Painel>
    )
  }

  const hoje = dataDeHoje()
  const editavel = podeAgir(acesso)

  const sequenciais = item.etapas.filter((e) => !e.paralela).sort((a, b) => a.ordem - b.ordem)
  const paralelas = item.etapas.filter((e) => e.paralela)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/imobilizado"
          className="inline-flex items-center gap-2 text-sm font-semibold text-ink-500 transition-colors hover:text-navy-700"
        >
          <ArrowLeft size={16} />
          Fila
        </Link>

        <div className="flex flex-wrap items-center gap-3">
          {!editavel && (
            <span className="rounded-full border border-line bg-white px-3 py-1 text-xs font-semibold text-ink-500">
              Você acompanha este processo como observador
            </span>
          )}

          {editavel && <ExcluirItem item={item} anexos={anexos} />}
        </div>
      </div>

      <Cabecalho
        item={item}
        hoje={hoje}
        filiais={filiais}
        usuario={userName}
        editavel={editavel}
        aoMudar={carregar}
      />

      {emEspera(item) && (
        <FaixaEspera item={item} usuario={userName} editavel={editavel} aoMudar={carregar} />
      )}

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Painel
            titulo="Etapas"
            descricao="A etapa aberta é a única que aceita conclusão. Concluir libera a seguinte."
          >
            <div className="flex flex-col gap-3">
              {/* A posição é contada no fluxo deste item, não na ordem do
                  modelo: um item que não é frota não tem a etapa 2, e mostrar
                  "01, 03, 04" faria parecer que uma etapa sumiu. */}
              {sequenciais.map((etapa, posicao) => (
                <CartaoEtapa
                  key={etapa.id}
                  item={item}
                  etapa={etapa}
                  posicao={posicao + 1}
                  modelo={modelo[etapa.chave] ?? null}
                  anexos={anexos}
                  responsaveis={responsaveis}
                  usuario={userName}
                  editavel={editavel}
                  hoje={hoje}
                  aoMudar={carregar}
                />
              ))}
            </div>
          </Painel>

          {paralelas.length > 0 && (
            <Painel
              titulo="Em paralelo"
              descricao="Corre por fora: não bloqueia as etapas acima e pode continuar aberta depois de o item ser finalizado."
            >
              <div className="flex flex-col gap-3">
                {paralelas.map((etapa) => (
                  <CartaoEtapa
                    key={etapa.id}
                    item={item}
                    etapa={etapa}
                    posicao={null}
                    modelo={modelo[etapa.chave] ?? null}
                    anexos={anexos}
                    responsaveis={responsaveis}
                    usuario={userName}
                    editavel={editavel}
                    hoje={hoje}
                    aoMudar={carregar}
                  />
                ))}
              </div>
            </Painel>
          )}
        </div>

        <div className="space-y-6">
          <Pasta
            item={item}
            anexos={anexos}
            usuario={userName}
            editavel={editavel}
            aoMudar={carregar}
          />
          <Historico movimentos={movimentos} />
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────── cabeçalho ─────────────────────────── */

function Cabecalho({
  item,
  hoje,
  filiais,
  usuario,
  editavel,
  aoMudar,
}: {
  item: Item
  hoje: string
  filiais: Filial[]
  usuario: string
  editavel: boolean
  aoMudar: () => Promise<void>
}) {
  const [editando, setEditando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const doItem = () => ({
    nfNumero: item.nfNumero,
    nfChave: item.nfChave ?? '',
    fornecedor: item.fornecedor,
    descricao: item.descricao,
    valor: item.valor,
    filialId: item.filialId ?? '',
    ocNumero: item.ocNumero ?? '',
    centroCusto: item.centroCusto ?? '',
    placa: item.placa ?? '',
    chassi: item.chassi ?? '',
  })

  const [campos, setCampos] = useState(doItem)

  const processo = agingProcesso(item, hoje)
  const placa = agingPlaca(item, hoje)

  const abrir = () => {
    setCampos(doItem())
    setErro(null)
    setEditando(true)
  }

  const salvar = async () => {
    setSalvando(true)
    setErro(null)
    try {
      const escolhida = filiais.find((f) => f.id === campos.filialId) ?? null

      await atualizarItem(
        item,
        {
          nf_numero: campos.nfNumero,
          nf_chave: campos.nfChave || null,
          fornecedor: campos.fornecedor,
          descricao: campos.descricao,
          valor: campos.valor,
          filial_id: escolhida?.id ?? null,
          empresa: escolhida?.empresa ?? '',
          filial: escolhida ? (escolhida.codFilial + ' ' + escolhida.filial).trim() : '',
          oc_numero: campos.ocNumero || null,
          centro_custo: campos.centroCusto || null,
          placa: campos.placa || null,
          chassi: campos.chassi || null,
        },
        usuario,
      )

      setEditando(false)
      await aoMudar()
    } catch (falha) {
      setErro(descreverErro(falha))
    } finally {
      setSalvando(false)
    }
  }

  // Chassi só entra em item de frota — nos demais o campo não teria o que
  // receber, e um campo vazio a mais é um campo a mais para preencher errado.
  const CAMPOS_TEXTO = [
    { chave: 'nfNumero' as const, rotulo: 'Nota fiscal' },
    { chave: 'fornecedor' as const, rotulo: 'Fornecedor' },
    { chave: 'descricao' as const, rotulo: 'Descrição do bem' },
    { chave: 'ocNumero' as const, rotulo: 'Nº da OC' },
    { chave: 'centroCusto' as const, rotulo: 'Centro de custo' },
    ...(item.ehFrota
      ? [
          { chave: 'chassi' as const, rotulo: 'Chassi' },
          { chave: 'placa' as const, rotulo: 'Placa' },
        ]
      : []),
    { chave: 'nfChave' as const, rotulo: 'Chave de acesso' },
  ]

  return (
    <Painel>
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-navy-100 px-2 py-0.5 text-sm font-bold tabular-nums text-ink-500">
              Nº {item.numero}
            </span>
            {item.ehFrota && (
              <span className="inline-flex items-center gap-1 rounded-full border border-teal-500 px-2.5 py-0.5 text-xs font-semibold text-teal-600">
                <Truck size={12} />
                Frota
              </span>
            )}
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-400">
              {item.status === 'finalizado' ? 'Finalizado' : 'Em andamento'}
            </span>

            {/* Editar vale também depois de finalizado: erro de digitação
                costuma aparecer justamente quando alguém confere o item pronto. */}
            {editavel && !editando && (
              <button
                type="button"
                onClick={abrir}
                className="ml-1 inline-flex items-center gap-1.5 rounded-md border border-line-strong px-2.5 py-1 text-xs font-bold text-ink-500 transition-colors hover:border-teal-500 hover:text-teal-600"
              >
                <Pencil size={12} />
                Editar dados
              </button>
            )}
          </div>

          {editando ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {CAMPOS_TEXTO.map((campo) => (
                <div key={campo.chave}>
                  <label className="text-xs text-ink-400">{campo.rotulo}</label>
                  <input
                    value={campos[campo.chave]}
                    onChange={(e) =>
                      setCampos((atuais) => ({ ...atuais, [campo.chave]: caixaAlta(e.target.value) }))
                    }
                    className={`mt-1 uppercase ${CAMPO}`}
                  />
                </div>
              ))}

              <div>
                <label className="text-xs text-ink-400">Valor</label>
                <input
                  value={textoDaMoeda(campos.valor)}
                  onChange={(e) =>
                    setCampos((atuais) => ({ ...atuais, valor: moedaDoTexto(e.target.value) }))
                  }
                  inputMode="numeric"
                  placeholder="R$ 0,00"
                  className={`mt-1 tabular-nums ${CAMPO}`}
                />
              </div>

              <div>
                <label className="text-xs text-ink-400">Empresa e filial</label>
                <select
                  value={campos.filialId}
                  onChange={(e) => setCampos((atuais) => ({ ...atuais, filialId: e.target.value }))}
                  className={`mt-1 ${CAMPO}`}
                >
                  <option value="">Sem filial</option>
                  {filiais.map((f) => (
                    <option key={f.id} value={f.id}>
                      {rotuloFilial(f)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-3">
                <button
                  type="button"
                  onClick={salvar}
                  disabled={salvando}
                  className="inline-flex items-center gap-2 rounded-md bg-teal-600 px-4 py-2 text-sm font-bold text-white transition-all hover:brightness-110 disabled:opacity-40"
                >
                  {salvando ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                  Salvar
                </button>
                <button
                  type="button"
                  onClick={() => setEditando(false)}
                  disabled={salvando}
                  className="text-sm font-semibold text-ink-500 transition-colors hover:text-navy-700 disabled:opacity-40"
                >
                  Cancelar
                </button>
                <span className="text-xs leading-relaxed text-ink-400">
                  A marca de frota não muda aqui: ela decide quais etapas existem, e trocá-la agora
                  criaria ou apagaria etapas no meio do fluxo.
                </span>
              </div>

              {erro && (
                <p
                  role="alert"
                  className="text-sm sm:col-span-2 lg:col-span-3"
                  style={{ color: CORES.critico }}
                >
                  {erro}
                </p>
              )}
            </div>
          ) : (
            <>
              <h2 className="mt-2 text-xl font-bold text-navy-700">
                {item.descricao || item.fornecedor || `Nota ${item.nfNumero}`}
              </h2>

              <dl className="mt-4 grid gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { rotulo: 'Nota fiscal', valor: item.nfNumero || '—' },
                  { rotulo: 'Fornecedor', valor: item.fornecedor || '—' },
                  { rotulo: 'Empresa', valor: item.empresa || '—' },
                  { rotulo: 'Filial', valor: item.filial || '—' },
                  { rotulo: 'Valor', valor: formatarMoeda(item.valor) },
                  { rotulo: 'Nº da OC', valor: item.ocNumero || '—' },
                  { rotulo: 'Centro de custo', valor: item.centroCusto || '—' },
                  ...(item.ehFrota
                    ? [
                        { rotulo: 'Chassi', valor: item.chassi || '—' },
                        { rotulo: 'Placa', valor: item.placa || '—' },
                      ]
                    : []),
                ].map((campo) => (
                  <div key={campo.rotulo} className="min-w-0">
                    <dt className="text-xs text-ink-400">{campo.rotulo}</dt>
                    <dd className="truncate text-sm text-ink-700" title={campo.valor}>
                      {campo.valor}
                    </dd>
                  </div>
                ))}
              </dl>
            </>
          )}
        </div>

        <div className="flex gap-3">
          {[
            { rotulo: 'Aging do processo', valor: textoAging(processo) },
            { rotulo: 'Aging da placa', valor: textoAging(placa) },
          ].map((a) => (
            <div key={a.rotulo} className="rounded-md border border-line bg-navy-50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                {a.rotulo}
              </p>
              <p className="mt-1 text-lg font-bold text-navy-700">{a.valor}</p>
            </div>
          ))}
        </div>
      </div>
    </Painel>
  )
}

/* ───────────────────────── cartão da etapa ───────────────────────── */

function CartaoEtapa({
  item,
  etapa,
  posicao,
  modelo,
  anexos,
  responsaveis,
  usuario,
  editavel,
  hoje,
  aoMudar,
}: {
  item: Item
  etapa: Etapa
  /** Posição no fluxo deste item. `null` na paralela, que não entra na ordem. */
  posicao: number | null
  /** O desenho desta etapa: descrição, quem aprova, se oferece aprovação. */
  modelo: ModeloEtapa | null
  anexos: Anexo[]
  responsaveis: Responsavel[]
  usuario: string
  editavel: boolean
  hoje: string
  aoMudar: () => Promise<void>
}) {
  const [observacao, setObservacao] = useState(etapa.observacao ?? '')
  const [valorCampo, setValorCampo] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const concluida = etapa.status === 'concluida'
  const aberta = etapa.status === 'aberta'
  const doItem = anexos.filter((a) => a.etapaId === etapa.id)
  const faltas = impedimentos(item, etapa, anexos)
  const descricao = modelo?.descricao ?? ''
  const ofereceAprovacao = Boolean(modelo?.enviaAprovacao) && !emEspera(item)

  const concluir = async () => {
    setErro(null)
    setSalvando(true)
    try {
      // Campo obrigatório é gravado no item antes de fechar a etapa: é dado do
      // item (nº da OC, placa), não da etapa.
      if (etapa.exigeCampo && valorCampo.trim()) {
        await atualizarItem(item, { [etapa.exigeCampo]: valorCampo.trim() }, usuario)
        item = { ...item, [etapa.exigeCampo === 'oc_numero' ? 'ocNumero' : etapa.exigeCampo === 'placa' ? 'placa' : 'centroCusto']: valorCampo.trim() }
      }

      const pendencias = impedimentos(item, etapa, anexos)
      if (pendencias.length > 0) {
        setErro(pendencias[0])
        return
      }

      await concluirEtapa({ item, etapa, observacao: observacao.trim() || null, usuario })
      await aoMudar()
    } catch (falha) {
      setErro(descreverErro(falha))
    } finally {
      setSalvando(false)
    }
  }

  /**
   * Conclui e deixa o item esperando a aprovação de terceiro.
   *
   * Mesma checagem da conclusão normal — o campo obrigatório continua sendo
   * obrigatório. Enviar para aprovação sem o número da OC seria mandar o
   * aprovador procurar o que ele deveria estar recebendo.
   */
  const enviarAprovacao = async () => {
    setErro(null)
    setSalvando(true)
    try {
      if (etapa.exigeCampo && valorCampo.trim()) {
        await atualizarItem(item, { [etapa.exigeCampo]: valorCampo.trim() }, usuario)
        item = { ...item, [etapa.exigeCampo === 'oc_numero' ? 'ocNumero' : etapa.exigeCampo === 'placa' ? 'placa' : 'centroCusto']: valorCampo.trim() }
      }

      const pendencias = impedimentos(item, etapa, anexos)
      if (pendencias.length > 0) {
        setErro(pendencias[0])
        return
      }

      await enviarParaAprovacao({
        item,
        etapa,
        modelo,
        observacao: observacao.trim() || null,
        usuario,
      })
      await aoMudar()
    } catch (falha) {
      setErro(descreverErro(falha))
    } finally {
      setSalvando(false)
    }
  }

  const reabrir = async () => {
    setSalvando(true)
    try {
      await reabrirEtapa(item, etapa, usuario)
      await aoMudar()
    } catch (falha) {
      setErro(descreverErro(falha))
    } finally {
      setSalvando(false)
    }
  }

  const trocarResponsavel = async (idPessoa: string) => {
    const pessoa = responsaveis.find((r) => r.id === idPessoa) ?? null
    setSalvando(true)
    try {
      await atribuirEtapa(item, etapa, pessoa ? { id: pessoa.id, nome: pessoa.nome } : null, usuario)
      await aoMudar()
    } catch (falha) {
      setErro(descreverErro(falha))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div
      className={`rounded-lg border p-4 transition-colors ${
        aberta ? 'border-teal-500 bg-teal-600/[0.04]' : 'border-line bg-white'
      } ${concluida ? 'opacity-70' : ''}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-ink-400">
              {posicao === null ? '· ·' : String(posicao).padStart(2, '0')}
            </span>
            <h3 className="font-bold text-navy-700">{etapa.titulo}</h3>
            {concluida && <Check size={15} style={{ color: CORES.bom }} />}
          </div>
          {descricao && (
            <p className="mt-1 max-w-prose text-sm leading-relaxed text-ink-700">{descricao}</p>
          )}

          <p className="mt-1.5 text-xs text-ink-400">
            {etapa.area}
            {etapa.responsavelNome ? ` · ${etapa.responsavelNome}` : ''}
            {concluida && etapa.concluidaEm
              ? ` · concluída em ${new Date(etapa.concluidaEm).toLocaleDateString('pt-BR')}`
              : ''}
          </p>
        </div>

        <ChipPrazo
          prazo={etapa.prazo}
          hoje={hoje}
          concluida={concluida}
          bloqueada={etapa.status === 'bloqueada'}
          emEspera={emEspera(item)}
        />
      </div>

      {concluida && etapa.observacao && (
        <p className="mt-3 rounded-md bg-navy-50 p-3 text-sm leading-relaxed text-ink-700">
          {etapa.observacao}
        </p>
      )}

      {aberta && editavel && (
        <div className="mt-4 space-y-3">
          {etapa.exigeCampo && (
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-ink-400">
                {ROTULO_CAMPO[etapa.exigeCampo] ?? etapa.exigeCampo}
              </label>
              <input
                value={valorCampo}
                onChange={(e) => setValorCampo(caixaAlta(e.target.value))}
                placeholder="OBRIGATÓRIO PARA CONCLUIR ESTA ETAPA"
                className={`mt-1.5 uppercase ${CAMPO}`}
              />
            </div>
          )}

          <textarea
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            rows={2}
            placeholder="Observação (opcional) — o que foi feito nesta etapa."
            className={`resize-y ${CAMPO}`}
          />

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={concluir}
              disabled={salvando}
              className="inline-flex items-center gap-2 rounded-md bg-teal-600 px-4 py-2 text-sm font-bold text-white transition-all hover:brightness-110 disabled:opacity-40"
            >
              {salvando ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
              Concluir etapa
            </button>

            {/* Segundo caminho de conclusão, não uma etapa a mais: a OC foi
                criada e enviada, o trabalho desta etapa acabou, e o que falta
                é de outra pessoa — por isso o prazo para de correr. */}
            {ofereceAprovacao && (
              <button
                type="button"
                onClick={enviarAprovacao}
                disabled={salvando}
                title={
                  modelo?.aprovadorEmail
                    ? `Avisa ${modelo.aprovadorEmail} e suspende o prazo até a aprovação sair`
                    : 'Suspende o prazo até a aprovação sair'
                }
                className="inline-flex items-center gap-2 rounded-md border border-navy-300 bg-white px-4 py-2 text-sm font-bold text-navy-700 transition-all hover:bg-navy-50 disabled:opacity-40"
              >
                {salvando ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                Concluir e enviar para aprovação
              </button>
            )}

            <select
              value={etapa.responsavelId ?? ''}
              onChange={(e) => trocarResponsavel(e.target.value)}
              aria-label="Responsável pela etapa"
              className="rounded-md border border-line-strong bg-white px-3 py-2 text-sm text-ink-700 outline-none focus:border-teal-500"
            >
              <option value="">Sem responsável</option>
              {responsaveis.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nome}
                </option>
              ))}
            </select>

            {etapa.exigeAnexo && doItem.length === 0 && (
              <span className="text-xs" style={{ color: CORES.atencao }}>
                Esta etapa exige anexo — envie o documento na pasta ao lado.
              </span>
            )}
          </div>

          {faltas.length > 0 && !erro && (
            <p className="text-xs text-ink-500">{faltas.join(' ')}</p>
          )}

          {erro && (
            <p role="alert" className="flex items-start gap-1.5 text-sm" style={{ color: CORES.critico }}>
              <AlertCircle size={15} className="mt-0.5 shrink-0" />
              {erro}
            </p>
          )}
        </div>
      )}

      {concluida && editavel && (
        <button
          type="button"
          onClick={reabrir}
          disabled={salvando}
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-ink-400 transition-colors hover:text-navy-700 disabled:opacity-40"
        >
          <RotateCcw size={13} />
          Reabrir
        </button>
      )}

      {doItem.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {doItem.map((a) => (
            <li key={a.id}>
              <a
                href={a.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-2.5 py-1 text-xs text-ink-700 hover:border-teal-500 hover:text-teal-600"
              >
                <FileText size={12} />
                {a.nome}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ───────────────────────────── a pasta ───────────────────────────── */

function Pasta({
  item,
  anexos,
  usuario,
  editavel,
  aoMudar,
}: {
  item: Item
  anexos: Anexo[]
  usuario: string
  editavel: boolean
  aoMudar: () => Promise<void>
}) {
  const entrada = useRef<HTMLInputElement>(null)
  // null = seguir o processo. Só vira um id quando a pessoa escolhe outra
  // etapa à mão, e volta a null depois do envio.
  const [escolha, setEscolha] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // O documento quase sempre é da etapa que está aberta agora — pedir para a
  // pessoa selecionar seria pedir que ela repita o que a tela já sabe. A
  // sequencial vem antes da paralela: é ela que trava o fluxo.
  const sugerida =
    item.etapas
      .filter((e) => e.status === 'aberta' && !e.paralela)
      .sort((a, b) => a.ordem - b.ordem)[0] ??
    item.etapas.find((e) => e.status === 'aberta') ??
    null

  const etapaId = escolha ?? sugerida?.id ?? ''

  const enviar = async (arquivo: File) => {
    setErro(null)
    setEnviando(true)
    try {
      const etapa = item.etapas.find((e) => e.id === etapaId) ?? null
      await anexar({ item, etapa, arquivo, usuario })
      // Volta a seguir o processo: a próxima etapa vira o padrão sozinha.
      setEscolha(null)
      await aoMudar()
    } catch (falha) {
      setErro(descreverErro(falha))
    } finally {
      setEnviando(false)
      if (entrada.current) entrada.current.value = ''
    }
  }

  const baixar = async () => {
    setErro(null)
    setEnviando(true)
    try {
      await baixarPasta(item, anexos)
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : descreverErro(falha))
    } finally {
      setEnviando(false)
    }
  }

  const remover = async (anexo: Anexo) => {
    setEnviando(true)
    try {
      await removerAnexo(item, anexo, usuario)
      await aoMudar()
    } catch (falha) {
      setErro(descreverErro(falha))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Painel
      titulo="Pasta do item"
      descricao="Criada no cadastro. O documento vai para a etapa aberta; troque só se for de outra."
      acao={
        anexos.length > 0 ? (
          <button
            type="button"
            onClick={baixar}
            disabled={enviando}
            className="inline-flex items-center gap-1.5 rounded-md border border-teal-500 px-3 py-1.5 text-xs font-bold text-teal-600 transition-all hover:bg-teal-600 hover:text-white disabled:opacity-40"
          >
            {enviando ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            Baixar pasta (.zip)
          </button>
        ) : undefined
      }
    >
      {/* O caminho é a ponte para fora do sistema: é por ele que a pasta é
          encontrada no Storage quando for levada para o controle de vocês. */}
      <div className="mb-4 rounded-md bg-navy-50 px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
          Caminho no Storage
        </span>
        <p className="break-all font-mono text-xs text-ink-700">
          evidencias/{item.pasta}
        </p>
      </div>

      {editavel && (
        <div className="mb-4 space-y-2">
          <div>
            <label htmlFor="etapa-anexo" className="text-xs text-ink-400">
              {escolha === null && sugerida
                ? `Vai para a etapa aberta: ${sugerida.titulo}`
                : 'Etapa do documento'}
            </label>
            <select
              id="etapa-anexo"
              value={etapaId}
              onChange={(e) => setEscolha(e.target.value)}
              className={`mt-1 ${CAMPO}`}
            >
              <option value="">Documento geral do item</option>
              {item.etapas
                .slice()
                .sort((a, b) => a.ordem - b.ordem)
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.titulo}
                    {e.status === 'aberta' ? ' — aberta' : ''}
                    {e.status === 'concluida' ? ' — concluída' : ''}
                  </option>
                ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => entrada.current?.click()}
            disabled={enviando}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-line-strong bg-navy-50 px-4 py-3 text-sm font-semibold text-ink-500 transition-colors hover:border-teal-500 hover:text-teal-600 disabled:opacity-40"
          >
            {enviando ? <Loader2 size={15} className="animate-spin" /> : <Paperclip size={15} />}
            Anexar documento
          </button>

          <input
            ref={entrada}
            type="file"
            className="sr-only"
            onChange={(e) => {
              const arquivo = e.target.files?.[0]
              if (arquivo) enviar(arquivo)
            }}
          />
        </div>
      )}

      {erro && (
        <p role="alert" className="mb-3 text-sm" style={{ color: CORES.critico }}>
          {erro}
        </p>
      )}

      {anexos.length === 0 ? (
        <p className="text-sm text-ink-400">A pasta ainda está vazia.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {anexos.map((a) => (
            <li
              key={a.id}
              className="flex items-center gap-2 rounded-md border border-line bg-white px-3 py-2"
            >
              <FileText size={15} className="shrink-0 text-teal-600" />
              <div className="min-w-0 flex-1">
                <a
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block truncate text-sm text-ink-700 hover:text-teal-600"
                >
                  {a.nome}
                </a>
                <span className="text-[11px] text-ink-400">
                  {item.etapas.find((e) => e.id === a.etapaId)?.titulo ?? 'Geral'}
                  {a.enviadoPor ? ` · ${a.enviadoPor}` : ''}
                </span>
              </div>
              {editavel && (
                <button
                  type="button"
                  onClick={() => remover(a)}
                  aria-label={`Remover ${a.nome}`}
                  className="shrink-0 text-ink-400 transition-colors hover:text-negativo"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Painel>
  )
}

/* ─────────────────────────── histórico ─────────────────────────── */

function Historico({ movimentos }: { movimentos: Movimento[] }) {
  return (
    <Painel
      titulo="Histórico"
      descricao="Tudo o que aconteceu com este item, inclusive a atividade paralela."
    >
      {movimentos.length === 0 ? (
        <p className="text-sm text-ink-400">Nada registrado ainda.</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {movimentos.map((m) => (
            <li key={m.id} className="flex gap-3">
              <History size={14} className="mt-0.5 shrink-0 text-ink-400" />
              <div className="min-w-0">
                <p className="text-sm leading-snug text-ink-700">{m.descricao}</p>
                <p className="text-[11px] text-ink-400">
                  {new Date(m.criadoEm).toLocaleString('pt-BR', {
                    timeZone: 'America/Sao_Paulo',
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                  {m.autor ? ` · ${m.autor}` : ''}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Painel>
  )
}

/* ────────────────────────── espera por aprovação ────────────────────────── */

/**
 * O item está parado esperando terceiro.
 *
 * Ocupa a largura toda, entre o cabeçalho e as etapas, porque é a informação
 * que muda a leitura de tudo o que vem abaixo: sem ela, quem abre a ficha vê
 * uma etapa sem prazo correndo e conclui que o sistema esqueceu de cobrar.
 */
function FaixaEspera({
  item,
  usuario,
  editavel,
  aoMudar,
}: {
  item: Item
  usuario: string
  editavel: boolean
  aoMudar: () => Promise<void>
}) {
  const [liberando, setLiberando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const liberar = async () => {
    setLiberando(true)
    setErro(null)
    try {
      await liberarAprovacao(item, usuario)
      await aoMudar()
    } catch (falha) {
      setErro(descreverErro(falha))
    } finally {
      setLiberando(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-lg border border-navy-200 bg-navy-50 px-4 py-3">
      <PauseCircle size={20} className="shrink-0 text-navy-500" />

      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-navy-700">
          {item.esperaMotivo ?? 'Item em espera'}
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-ink-500">
          Parado desde {formatarData(item.esperaDesde)}. O prazo das etapas abertas está suspenso e
          volta a correr de onde parou quando a aprovação for liberada.
        </p>
        {erro && (
          <p role="alert" className="mt-1 text-xs" style={{ color: CORES.critico }}>
            {erro}
          </p>
        )}
      </div>

      {editavel && (
        <button
          type="button"
          onClick={liberar}
          disabled={liberando}
          className="inline-flex items-center gap-2 rounded-md bg-teal-600 px-4 py-2 text-sm font-bold text-white transition-all hover:brightness-110 disabled:opacity-40"
        >
          {liberando ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
          Aprovação liberada
        </button>
      )}
    </div>
  )
}

/* ─────────────────────────── excluir item ─────────────────────────── */

/**
 * Apaga o item inteiro.
 *
 * Fica no topo, longe dos botões de trabalho, e exige confirmação com o número
 * à vista: é a única ação da tela que não tem volta — etapas, anexos e
 * histórico vão junto.
 */
function ExcluirItem({ item, anexos }: { item: Item; anexos: Anexo[] }) {
  const router = useRouter()
  const [confirmando, setConfirmando] = useState(false)
  const [excluindo, setExcluindo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const remover = async () => {
    setExcluindo(true)
    setErro(null)
    try {
      await excluirItem(item, anexos)
      router.push('/imobilizado')
    } catch (falha) {
      setErro(descreverErro(falha))
      setExcluindo(false)
    }
  }

  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink-400 transition-colors hover:border-negativo hover:text-negativo"
      >
        <Trash2 size={13} />
        Excluir item
      </button>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-negativo-border bg-negativo-bg px-3 py-2">
      <span className="text-xs leading-snug text-ink-700">
        Apagar o item nº {item.numero}, suas {item.etapas.length} etapas
        {anexos.length > 0 ? ` e ${anexos.length} documento(s)` : ''}? Não há como desfazer.
      </span>

      <button
        type="button"
        onClick={remover}
        disabled={excluindo}
        className="inline-flex items-center gap-1.5 rounded-md bg-negativo px-3 py-1.5 text-xs font-bold text-white transition-all hover:brightness-110 disabled:opacity-40"
      >
        {excluindo ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
        Apagar
      </button>

      <button
        type="button"
        onClick={() => setConfirmando(false)}
        disabled={excluindo}
        className="text-xs font-semibold text-ink-500 transition-colors hover:text-navy-700 disabled:opacity-40"
      >
        Manter
      </button>

      {erro && <span className="text-xs text-negativo">{erro}</span>}
    </div>
  )
}
