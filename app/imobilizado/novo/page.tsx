'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertCircle, AlertTriangle, Loader2, Plus, Truck } from 'lucide-react'

import { useAuthGate } from '@/app/tarefas/_hooks/useAuthGate'
import { CORES } from '@/app/validacao-fiscal/_lib/cores'

import { Carregando, Painel, SemAcesso } from '../_components/Ui'
import { useImobilizado } from '../_hooks/useImobilizado'
import { criarItem, descreverErro, itemComChassi, listarFiliais } from '../_lib/api'
import { caixaAlta, moedaDoTexto, textoDaMoeda } from '../_lib/formato'
import { podeAgir, rotuloFilial, type Filial } from '../_lib/types'

const CAMPO =
  'w-full rounded-md border border-line-strong bg-white px-3 py-2 text-sm text-ink-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-[#0f88a8]/20'

const ROTULO = 'text-xs font-semibold uppercase tracking-wider text-ink-400'

export default function PaginaNovoItem() {
  const router = useRouter()
  const { userName } = useAuthGate()
  const { acesso, carregando } = useImobilizado()

  const [nfNumero, setNfNumero] = useState('')
  const [nfChave, setNfChave] = useState('')
  const [fornecedor, setFornecedor] = useState('')
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState<number | null>(null)
  const [filiais, setFiliais] = useState<Filial[]>([])
  const [filialId, setFilialId] = useState('')
  const [ehFrota, setEhFrota] = useState(false)
  const [chassi, setChassi] = useState('')
  const [repetido, setRepetido] = useState<{ id: string; numero: number; descricao: string } | null>(
    null,
  )
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    listarFiliais()
      .then(setFiliais)
      .catch(() => setFiliais([]))
  }, [])

  /**
   * Procura o chassi enquanto a pessoa digita.
   *
   * Meio segundo de espera depois da última tecla: sem isso seria uma consulta
   * por caractere, e o aviso piscaria a cada letra de um chassi que ainda está
   * pela metade. Abaixo de 8 caracteres nem consulta — o começo do chassi é
   * igual em veículos do mesmo fabricante, e acusaria parentesco, não repetição.
   */
  useEffect(() => {
    const alvo = chassi.trim()

    const relogio = setTimeout(() => {
      if (!ehFrota || alvo.length < 8) {
        setRepetido(null)
        return
      }

      itemComChassi(alvo)
        .then(setRepetido)
        .catch(() => setRepetido(null))
    }, 500)

    return () => clearTimeout(relogio)
  }, [chassi, ehFrota])

  if (carregando) return <Carregando linhas={2} />
  if (!acesso) return <SemAcesso />

  if (!podeAgir(acesso)) {
    return (
      <Painel titulo="Somente leitura">
        <p className="text-sm leading-relaxed text-ink-700">
          Você acompanha este processo como observador. Cadastrar item é ação de participante.
        </p>
      </Painel>
    )
  }

  const enviar = async () => {
    if (!nfNumero.trim() && !descricao.trim()) {
      setErro('Informe ao menos o número da nota ou uma descrição do bem.')
      return
    }

    setErro(null)
    setSalvando(true)
    try {
      const item = await criarItem(
        {
          nfNumero: nfNumero.trim(),
          nfChave: nfChave.trim() || null,
          fornecedor: fornecedor.trim(),
          descricao: descricao.trim(),
          valor,
          filial: filiais.find((f) => f.id === filialId) ?? null,
          ehFrota,
          chassi: chassi.trim() || null,
        },
        userName,
      )

      router.push(`/imobilizado/${item.id}`)
    } catch (falha) {
      setErro(descreverErro(falha))
      setSalvando(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Painel
        titulo="Novo item do imobilizado"
        descricao="O fluxo nasce inteiro a partir daqui: as etapas são criadas e a pasta de documentos é aberta no mesmo momento."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="nf" className={ROTULO}>
              Número da nota
            </label>
            <input
              id="nf"
              value={nfNumero}
              onChange={(e) => setNfNumero(caixaAlta(e.target.value))}
              className={`mt-1.5 uppercase ${CAMPO}`}
            />
          </div>

          <div>
            <label htmlFor="filial" className={ROTULO}>
              Empresa e filial
            </label>
            <select
              id="filial"
              value={filialId}
              onChange={(e) => setFilialId(e.target.value)}
              className={`mt-1.5 ${CAMPO}`}
            >
              <option value="">Selecione…</option>
              {filiais.map((f) => (
                <option key={f.id} value={f.id}>
                  {rotuloFilial(f)}
                </option>
              ))}
            </select>
            {filiais.length === 0 && (
              <p className="mt-1.5 text-xs text-ink-400">
                Nenhuma filial cadastrada ainda — a lista vem da tabela <code>filiais</code>.
              </p>
            )}
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="fornecedor" className={ROTULO}>
              Fornecedor
            </label>
            <input
              id="fornecedor"
              value={fornecedor}
              onChange={(e) => setFornecedor(caixaAlta(e.target.value))}
              className={`mt-1.5 uppercase ${CAMPO}`}
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="descricao" className={ROTULO}>
              Descrição do bem
            </label>
            <input
              id="descricao"
              value={descricao}
              onChange={(e) => setDescricao(caixaAlta(e.target.value))}
              placeholder="O QUE É O ITEM — APARECE NA FILA E NA FICHA"
              className={`mt-1.5 uppercase ${CAMPO}`}
            />
          </div>

          <div>
            <label htmlFor="valor" className={ROTULO}>
              Valor
            </label>
            {/* Máscara em vez de type="number": o campo mostra R$ enquanto a
                pessoa digita, e aceita tanto "750000" quanto "R$ 7.500,00". */}
            <input
              id="valor"
              type="text"
              inputMode="numeric"
              value={textoDaMoeda(valor)}
              onChange={(e) => setValor(moedaDoTexto(e.target.value))}
              placeholder="R$ 0,00"
              className={`mt-1.5 tabular-nums ${CAMPO}`}
            />
          </div>

          <div>
            <label htmlFor="chave" className={ROTULO}>
              Chave de acesso
            </label>
            <input
              id="chave"
              value={nfChave}
              onChange={(e) => setNfChave(caixaAlta(e.target.value))}
              inputMode="numeric"
              className={`mt-1.5 font-mono text-xs uppercase ${CAMPO}`}
            />
          </div>
        </div>

        {/* A marca de frota decide quais etapas nascem — por isso ela fica em
            destaque, e não perdida no meio do formulário. */}
        <button
          type="button"
          onClick={() => setEhFrota((atual) => !atual)}
          aria-pressed={ehFrota}
          className={`mt-5 flex w-full items-center gap-3 rounded-md border p-4 text-left transition-all ${
            ehFrota ? 'border-teal-500 bg-teal-600/[0.06]' : 'border-line bg-white hover:border-line-strong'
          }`}
        >
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${
              ehFrota ? 'bg-teal-600 text-white' : 'bg-navy-100 text-ink-400'
            }`}
          >
            <Truck size={18} />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-navy-700">
              {ehFrota ? 'É frota' : 'Não é frota'}
            </span>
            <span className="block text-xs leading-relaxed text-ink-500">
              Frota acrescenta a etapa do ATPV e a atividade paralela de cadastrar a placa. Sem
              frota, essas etapas nem chegam a ser criadas.
            </span>
          </span>
        </button>

        {/* Só de frota, e por isso só aparece quando a marca está ligada: um
            campo de chassi num item que não é veículo é campo para errar. */}
        {ehFrota && (
          <div className="mt-4">
            <label htmlFor="chassi" className={ROTULO}>
              Chassi
            </label>
            <input
              id="chassi"
              value={chassi}
              onChange={(e) => setChassi(caixaAlta(e.target.value))}
              maxLength={17}
              placeholder="17 CARACTERES, COMO NO DOCUMENTO DO VEÍCULO"
              className={`mt-1.5 font-mono uppercase tracking-wide ${CAMPO}`}
            />

            {repetido && (
              <p
                role="status"
                className="mt-2 flex items-start gap-2 rounded-md border border-alerta-border bg-alerta-bg px-3 py-2 text-xs leading-relaxed text-ink-700"
              >
                <AlertTriangle size={14} className="mt-0.5 shrink-0 text-alerta" />
                <span>
                  Este chassi já está no item{' '}
                  <Link
                    href={`/imobilizado/${repetido.id}`}
                    target="_blank"
                    className="font-bold text-navy-700 underline underline-offset-2"
                  >
                    nº {repetido.numero}
                    {repetido.descricao ? ` · ${repetido.descricao}` : ''}
                  </Link>
                  . Confira antes de cadastrar — se for o mesmo veículo, o certo é continuar no item
                  que já existe.
                </span>
              </p>
            )}
          </div>
        )}

        {erro && (
          <p role="alert" className="mt-4 flex items-start gap-2 text-sm" style={{ color: CORES.critico }}>
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            {erro}
          </p>
        )}

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={enviar}
            disabled={salvando}
            className="inline-flex items-center gap-2 rounded-md bg-teal-600 px-5 py-2.5 text-sm font-bold text-white transition-all hover:brightness-110 disabled:opacity-40"
          >
            {salvando ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            Criar item e abrir o fluxo
          </button>

          <button
            type="button"
            onClick={() => router.push('/imobilizado')}
            disabled={salvando}
            className="rounded-md border border-line-strong px-5 py-2.5 text-sm font-semibold text-ink-700 transition-colors hover:bg-navy-50 disabled:opacity-40"
          >
            Cancelar
          </button>
        </div>
      </Painel>
    </div>
  )
}
