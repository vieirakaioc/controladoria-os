'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, Search, Truck } from 'lucide-react'

import { formatarInteiro, formatarMoeda } from '@/app/validacao-fiscal/_lib/formato'
import { formatarData, hoje as dataDeHoje } from '@/app/validacao-fiscal/_lib/prazo'

import { AvisoErro, Carregando, ChipPrazo, Kpi, Painel, SemAcesso } from './_components/Ui'
import { useImobilizado } from './_hooks/useImobilizado'
import { agingPlaca, agingProcesso, textoAging } from './_lib/aging'
import type { Etapa, Item } from './_lib/types'

type Filtro = 'andamento' | 'atrasados' | 'frota' | 'finalizados' | 'todos'

const FILTROS: { valor: Filtro; rotulo: string }[] = [
  { valor: 'andamento', rotulo: 'Em andamento' },
  { valor: 'atrasados', rotulo: 'Atrasados' },
  { valor: 'frota', rotulo: 'Frota' },
  { valor: 'finalizados', rotulo: 'Finalizados' },
  { valor: 'todos', rotulo: 'Todos' },
]

/** A etapa que representa o item na fila: a aberta de menor ordem. */
function etapaAtual(item: Item): Etapa | null {
  return (
    item.etapas
      .filter((e) => e.status === 'aberta' && !e.paralela)
      .sort((a, b) => a.ordem - b.ordem)[0] ?? null
  )
}

function paralelaAberta(item: Item): Etapa | null {
  return item.etapas.find((e) => e.paralela && e.status === 'aberta') ?? null
}

function temAtraso(item: Item, hoje: string): boolean {
  return item.etapas.some((e) => e.status === 'aberta' && e.prazo !== null && e.prazo < hoje)
}

export default function PaginaFila() {
  const { itens, acesso, carregando, erro } = useImobilizado()
  const [filtro, setFiltro] = useState<Filtro>('andamento')
  const [filtroFilial, setFiltroFilial] = useState('todas')
  const [busca, setBusca] = useState('')
  const hoje = dataDeHoje()

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase()

    return itens.filter((item) => {
      if (filtro === 'andamento' && item.status !== 'em_andamento') return false
      if (filtro === 'finalizados' && item.status !== 'finalizado') return false
      if (filtro === 'frota' && !item.ehFrota) return false
      if (filtro === 'atrasados' && !temAtraso(item, hoje)) return false

      if (filtroFilial !== 'todas' && item.filialId !== filtroFilial) return false

      if (termo) {
        const alvo = [
          item.numero,
          item.nfNumero,
          item.fornecedor,
          item.descricao,
          item.filial,
          item.empresa,
          item.placa ?? '',
          item.ocNumero ?? '',
        ]
          .join(' ')
          .toLowerCase()
        if (!alvo.includes(termo)) return false
      }

      return true
    })
  }, [itens, filtro, filtroFilial, busca, hoje])

  // O seletor sai dos itens que existem, não da tabela inteira: filtrar por
  // uma filial sem item nenhum só geraria tela vazia.
  const filiaisEmUso = useMemo(() => {
    const mapa = new Map<string, string>()
    for (const item of itens) {
      if (item.filialId) mapa.set(item.filialId, `${item.empresa} · ${item.filial}`.trim())
    }
    return [...mapa.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'))
  }, [itens])

  const resumo = useMemo(() => {
    const abertos = itens.filter((i) => i.status === 'em_andamento')
    const atrasados = abertos.filter((i) => temAtraso(i, hoje))
    const placas = itens
      .map((i) => agingPlaca(i, hoje))
      .filter((a): a is NonNullable<typeof a> => a !== null && a.aberto)

    const processos = abertos
      .map((i) => agingProcesso(i, hoje))
      .filter((a): a is NonNullable<typeof a> => a !== null)

    return {
      abertos: abertos.length,
      atrasados: atrasados.length,
      placasAbertas: placas.length,
      maiorPlaca: placas.reduce((maior, a) => Math.max(maior, a.dias), 0),
      mediaProcesso:
        processos.length === 0
          ? 0
          : Math.round(processos.reduce((s, a) => s + a.dias, 0) / processos.length),
    }
  }, [itens, hoje])

  if (erro) return <AvisoErro mensagem={erro} />
  if (carregando) return <Carregando linhas={4} />
  if (!acesso) return <SemAcesso />

  if (itens.length === 0) {
    return (
      <Painel titulo="Nenhum item ainda">
        <p className="text-sm leading-relaxed text-ink-700">
          Cadastre a primeira nota de patrimônio para o fluxo começar. As etapas nascem junto, e a
          pasta de documentos é criada no mesmo momento.
        </p>
        <Link
          href="/imobilizado/novo"
          className="mt-5 inline-flex items-center gap-2 rounded-md bg-teal-600 px-5 py-2.5 text-sm font-bold text-white transition-all hover:brightness-110"
        >
          Cadastrar item
          <ArrowUpRight size={16} />
        </Link>
      </Painel>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi rotulo="Em andamento" valor={formatarInteiro(resumo.abertos)} detalhe="Itens com etapa aberta" />
        <Kpi
          rotulo="Com etapa atrasada"
          valor={formatarInteiro(resumo.atrasados)}
          tom={resumo.atrasados > 0 ? 'critico' : 'neutro'}
          detalhe="Passaram do prazo da etapa"
        />
        <Kpi
          rotulo="Aging médio do processo"
          valor={`${formatarInteiro(resumo.mediaProcesso)} d`}
          detalhe="Do cadastro até a baixa, nos itens abertos"
        />
        <Kpi
          rotulo="Placas em aberto"
          valor={formatarInteiro(resumo.placasAbertas)}
          tom={resumo.placasAbertas > 0 ? 'atencao' : 'neutro'}
          detalhe={
            resumo.placasAbertas > 0
              ? `Maior espera: ${resumo.maiorPlaca} dias desde o ATPV`
              : 'Nenhuma pendente desde o ATPV'
          }
        />
      </div>

      <Painel className="!p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-md border border-line-strong bg-white px-3 py-2">
            <Search size={16} className="shrink-0 text-ink-400" />
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Nº, nota, fornecedor, placa…"
              className="w-60 bg-transparent text-sm text-ink-700 outline-none placeholder:text-ink-400"
            />
          </div>

          <div className="flex flex-wrap gap-1 rounded-md bg-navy-100 p-1">
            {FILTROS.map((f) => (
              <button
                key={f.valor}
                type="button"
                onClick={() => setFiltro(f.valor)}
                aria-pressed={filtro === f.valor}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                  filtro === f.valor
                    ? 'bg-white text-navy-700 shadow-sm'
                    : 'text-ink-500 hover:text-navy-700'
                }`}
              >
                {f.rotulo}
              </button>
            ))}
          </div>

          {filiaisEmUso.length > 0 && (
            <select
              value={filtroFilial}
              onChange={(e) => setFiltroFilial(e.target.value)}
              aria-label="Filtrar por empresa e filial"
              className="rounded-md border border-line-strong bg-white px-3 py-2 text-sm text-ink-700 outline-none focus:border-teal-500"
            >
              <option value="todas">Todas as filiais</option>
              {filiaisEmUso.map(([id, rotulo]) => (
                <option key={id} value={id}>
                  {rotulo}
                </option>
              ))}
            </select>
          )}

          <span className="ml-auto text-sm text-ink-500">
            {formatarInteiro(visiveis.length)} de {formatarInteiro(itens.length)} itens
          </span>
        </div>
      </Painel>

      <div className="overflow-hidden rounded-lg border border-line bg-white shadow-card">
        <div className="overflow-x-auto">
          <table className="w-max min-w-full border-collapse text-sm">
            <thead className="bg-navy-50">
              <tr>
                {['Nº', 'Nota / fornecedor', 'Empresa · filial', 'Valor', 'Etapa atual', 'Prazo', 'Aging', ''].map(
                  (coluna) => (
                    <th
                      key={coluna}
                      scope="col"
                      className="whitespace-nowrap border-b border-line px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-ink-500"
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
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-ink-400">
                    Nenhum item com esses filtros.
                  </td>
                </tr>
              )}

              {visiveis.map((item, linha) => {
                const atual = etapaAtual(item)
                const placa = paralelaAberta(item)
                const processo = agingProcesso(item, hoje)
                const finalizado = item.status === 'finalizado'

                return (
                  <tr
                    key={item.id}
                    className={`border-b border-line ${linha % 2 === 1 ? 'bg-navy-50/70' : ''} hover:bg-teal-600/[0.06]`}
                  >
                    <td className="whitespace-nowrap px-4 py-3 align-top">
                      <span className="font-bold tabular-nums text-navy-700">{item.numero}</span>
                      {item.ehFrota && (
                        <span className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-teal-600">
                          <Truck size={11} />
                          frota
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 align-top">
                      <div className="font-medium text-ink-700">{item.nfNumero || '—'}</div>
                      <div className="line-clamp-1 w-56 text-xs text-ink-500">
                        {item.fornecedor || item.descricao || '—'}
                      </div>
                    </td>

                    <td className="px-4 py-3 align-top">
                      <div className="whitespace-nowrap text-ink-700">{item.filial || '—'}</div>
                      <div className="line-clamp-1 w-40 text-xs text-ink-400">{item.empresa}</div>
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-right align-top tabular-nums text-ink-700">
                      {formatarMoeda(item.valor)}
                    </td>

                    <td className="px-4 py-3 align-top">
                      {finalizado ? (
                        <span className="text-sm font-semibold text-ink-400">Finalizado</span>
                      ) : (
                        <>
                          <div className="font-medium text-ink-700">{atual?.titulo ?? '—'}</div>
                          <div className="text-xs text-ink-500">{atual?.area ?? ''}</div>
                        </>
                      )}
                      {placa && (
                        <div className="mt-1 text-[11px] font-semibold text-alerta">
                          placa pendente
                        </div>
                      )}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 align-top">
                      <ChipPrazo prazo={atual?.prazo ?? null} hoje={hoje} concluida={finalizado} />
                      {atual?.prazo && !finalizado && (
                        <div className="mt-1 text-[11px] tabular-nums text-ink-400">
                          {formatarData(atual.prazo)}
                        </div>
                      )}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 align-top text-xs text-ink-700">
                      <div>Processo: {textoAging(processo)}</div>
                      <div className="text-ink-400">Placa: {textoAging(agingPlaca(item, hoje))}</div>
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-right align-top">
                      <Link
                        href={`/imobilizado/${item.id}`}
                        className="inline-flex items-center gap-1.5 rounded-md border border-teal-500 px-3 py-1.5 text-xs font-bold text-teal-600 transition-all hover:bg-teal-600 hover:text-white"
                      >
                        Abrir
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
