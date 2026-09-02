'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Loader2, Plus, Truck } from 'lucide-react'

import { useAuthGate } from '@/app/tarefas/_hooks/useAuthGate'
import { CORES } from '@/app/validacao-fiscal/_lib/cores'

import { Carregando, Painel, SemAcesso } from '../_components/Ui'
import { useImobilizado } from '../_hooks/useImobilizado'
import { criarItem, descreverErro, listarFiliais } from '../_lib/api'
import { podeAgir, rotuloFilial, type Filial } from '../_lib/types'

const CAMPO =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#0f88a8] focus:ring-2 focus:ring-[#0f88a8]/20'

const ROTULO = 'text-xs font-semibold uppercase tracking-wider text-slate-400'

export default function PaginaNovoItem() {
  const router = useRouter()
  const { userName } = useAuthGate()
  const { acesso, carregando } = useImobilizado()

  const [nfNumero, setNfNumero] = useState('')
  const [nfChave, setNfChave] = useState('')
  const [fornecedor, setFornecedor] = useState('')
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [filiais, setFiliais] = useState<Filial[]>([])
  const [filialId, setFilialId] = useState('')
  const [ehFrota, setEhFrota] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    listarFiliais()
      .then(setFiliais)
      .catch(() => setFiliais([]))
  }, [])

  if (carregando) return <Carregando linhas={2} />
  if (!acesso) return <SemAcesso />

  if (!podeAgir(acesso)) {
    return (
      <Painel titulo="Somente leitura">
        <p className="text-sm leading-relaxed text-slate-600">
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
          valor: valor.trim() === '' ? null : Number(valor.replace(',', '.')),
          filial: filiais.find((f) => f.id === filialId) ?? null,
          ehFrota,
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
            <input id="nf" value={nfNumero} onChange={(e) => setNfNumero(e.target.value)} className={`mt-1.5 ${CAMPO}`} />
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
              <p className="mt-1.5 text-xs text-slate-400">
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
              onChange={(e) => setFornecedor(e.target.value)}
              className={`mt-1.5 ${CAMPO}`}
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="descricao" className={ROTULO}>
              Descrição do bem
            </label>
            <input
              id="descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="O que é o item — aparece na fila e na ficha."
              className={`mt-1.5 ${CAMPO}`}
            />
          </div>

          <div>
            <label htmlFor="valor" className={ROTULO}>
              Valor
            </label>
            <input
              id="valor"
              type="number"
              step="0.01"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className={`mt-1.5 ${CAMPO}`}
            />
          </div>

          <div>
            <label htmlFor="chave" className={ROTULO}>
              Chave de acesso
            </label>
            <input
              id="chave"
              value={nfChave}
              onChange={(e) => setNfChave(e.target.value)}
              className={`mt-1.5 font-mono text-xs ${CAMPO}`}
            />
          </div>
        </div>

        {/* A marca de frota decide quais etapas nascem — por isso ela fica em
            destaque, e não perdida no meio do formulário. */}
        <button
          type="button"
          onClick={() => setEhFrota((atual) => !atual)}
          aria-pressed={ehFrota}
          className={`mt-5 flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-all ${
            ehFrota ? 'border-[#0f88a8] bg-[#0f88a8]/[0.06]' : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              ehFrota ? 'bg-[#0f88a8] text-white' : 'bg-slate-100 text-slate-400'
            }`}
          >
            <Truck size={18} />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-[#063955]">
              {ehFrota ? 'É frota' : 'Não é frota'}
            </span>
            <span className="block text-xs leading-relaxed text-slate-500">
              Frota acrescenta a etapa do ATPV e a atividade paralela de cadastrar a placa. Sem
              frota, essas etapas nem chegam a ser criadas.
            </span>
          </span>
        </button>

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
            className="inline-flex items-center gap-2 rounded-xl bg-[#0f88a8] px-5 py-2.5 text-sm font-bold text-white transition-all hover:brightness-110 disabled:opacity-40"
          >
            {salvando ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            Criar item e abrir o fluxo
          </button>

          <button
            type="button"
            onClick={() => router.push('/imobilizado')}
            disabled={salvando}
            className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-40"
          >
            Cancelar
          </button>
        </div>
      </Painel>
    </div>
  )
}
