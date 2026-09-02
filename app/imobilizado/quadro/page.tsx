'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Search, Truck } from 'lucide-react'

import { formatarInteiro, formatarMoeda } from '@/app/validacao-fiscal/_lib/formato'
import { diasEntre, formatarData, hoje as dataDeHoje } from '@/app/validacao-fiscal/_lib/prazo'

import { AvisoErro, Carregando, Painel, SemAcesso } from '../_components/Ui'
import { useImobilizado } from '../_hooks/useImobilizado'
import { agingPlaca, agingProcesso } from '../_lib/aging'
import type { Etapa, Item } from '../_lib/types'

/**
 * O quadro: uma coluna por etapa, o item parado na etapa em que está.
 *
 * A fila responde "o que falta fazer"; o quadro responde "onde o trabalho
 * está entalado". São perguntas diferentes, e é por isso que as duas telas
 * existem sobre os mesmos dados.
 *
 * Um item aparece em uma coluna só — a etapa sequencial aberta. A paralela não
 * gera segunda carta: ela vira um selo na carta do próprio item, porque tudo
 * do item vive na mesma linha.
 */

type Coluna = {
  chave: string
  titulo: string
  area: string
  itens: Item[]
}

const COLUNA_FINAL = '@finalizado'

function etapaAberta(item: Item): Etapa | null {
  return (
    item.etapas
      .filter((e) => e.status === 'aberta' && !e.paralela)
      .sort((a, b) => a.ordem - b.ordem)[0] ?? null
  )
}

export default function PaginaQuadro() {
  const { itens, acesso, carregando, erro } = useImobilizado()
  const [busca, setBusca] = useState('')
  const [soFrota, setSoFrota] = useState(false)
  const hoje = dataDeHoje()

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase()

    return itens.filter((item) => {
      if (soFrota && !item.ehFrota) return false
      if (!termo) return true

      return [item.numero, item.nfNumero, item.fornecedor, item.descricao, item.filial, item.placa ?? '']
        .join(' ')
        .toLowerCase()
        .includes(termo)
    })
  }, [itens, busca, soFrota])

  // As colunas saem das etapas que existem nos itens em tela, na ordem do
  // processo. Assim uma etapa exclusiva de frota some do quadro quando não há
  // item de frota — coluna vazia permanente é ruído.
  const colunas = useMemo(() => {
    const mapa = new Map<string, Coluna>()

    for (const item of visiveis) {
      for (const etapa of item.etapas) {
        if (etapa.paralela) continue
        if (!mapa.has(etapa.chave)) {
          mapa.set(etapa.chave, {
            chave: etapa.chave,
            titulo: etapa.titulo,
            area: etapa.area,
            itens: [],
          })
        }
      }
    }

    const ordem = new Map<string, number>()
    for (const item of visiveis) {
      for (const etapa of item.etapas) ordem.set(etapa.chave, etapa.ordem)
    }

    const lista = [...mapa.values()].sort(
      (a, b) => (ordem.get(a.chave) ?? 0) - (ordem.get(b.chave) ?? 0),
    )

    for (const item of visiveis) {
      if (item.status === 'finalizado') continue
      const aberta = etapaAberta(item)
      if (!aberta) continue
      mapa.get(aberta.chave)?.itens.push(item)
    }

    const finalizados = visiveis.filter((i) => i.status === 'finalizado')

    return [
      ...lista,
      { chave: COLUNA_FINAL, titulo: 'Finalizados', area: '', itens: finalizados },
    ]
  }, [visiveis])

  if (erro) return <AvisoErro mensagem={erro} />
  if (carregando) return <Carregando linhas={3} />
  if (!acesso) return <SemAcesso />

  if (itens.length === 0) {
    return (
      <Painel titulo="Nenhum item ainda">
        <p className="text-sm leading-relaxed text-ink-700">
          Cadastre o primeiro item para o quadro ganhar conteúdo.
        </p>
      </Painel>
    )
  }

  return (
    <div className="space-y-5">
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

          <button
            type="button"
            onClick={() => setSoFrota((atual) => !atual)}
            aria-pressed={soFrota}
            className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-semibold transition-colors ${
              soFrota
                ? 'border-teal-500 bg-teal-50 text-teal-700'
                : 'border-line-strong bg-white text-ink-500 hover:text-navy-700'
            }`}
          >
            <Truck size={15} />
            Só frota
          </button>

          <span className="ml-auto text-sm text-ink-500">
            {formatarInteiro(visiveis.filter((i) => i.status === 'em_andamento').length)} em
            andamento · {formatarInteiro(visiveis.length)} no total
          </span>
        </div>
      </Painel>

      {/* Rolagem horizontal no container, não na página: o quadro cresce com o
          número de etapas e a barra de filtros acima tem que ficar parada. */}
      <div className="overflow-x-auto pb-3">
        <div className="flex min-h-[60vh] gap-4">
          {colunas.map((coluna) => (
            <ColunaQuadro key={coluna.chave} coluna={coluna} hoje={hoje} />
          ))}
        </div>
      </div>
    </div>
  )
}

function ColunaQuadro({ coluna, hoje }: { coluna: Coluna; hoje: string }) {
  const final = coluna.chave === COLUNA_FINAL
  const atrasados = coluna.itens.filter((item) => {
    const aberta = etapaAberta(item)
    return aberta?.prazo != null && aberta.prazo < hoje
  }).length

  return (
    <section className="flex w-[300px] shrink-0 flex-col rounded-lg border border-line bg-navy-50/60">
      <header className="flex items-start justify-between gap-2 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-bold text-navy-700" title={coluna.titulo}>
            {coluna.titulo}
          </h2>
          <p className="eyebrow mt-0.5">{final ? 'encerrados' : coluna.area || '—'}</p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {atrasados > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-negativo-bg px-2 py-0.5 text-[11px] font-bold text-negativo">
              <AlertTriangle size={10} />
              {atrasados}
            </span>
          )}
          <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold tabular-nums text-ink-500 shadow-sm">
            {coluna.itens.length}
          </span>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-2.5 p-3">
        {coluna.itens.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-ink-400">Nada aqui.</p>
        ) : (
          coluna.itens.map((item) => <Carta key={item.id} item={item} hoje={hoje} final={final} />)
        )}
      </div>
    </section>
  )
}

function Carta({ item, hoje, final }: { item: Item; hoje: string; final: boolean }) {
  const aberta = etapaAberta(item)
  const processo = agingProcesso(item, hoje)
  const placa = agingPlaca(item, hoje)

  // Dias parados NESTA etapa — a métrica que o quadro existe para mostrar.
  // Diferente do aging do processo: um item pode ter 40 dias de vida e 2 na
  // etapa atual, e é o segundo número que diz onde cobrar.
  const naEtapa = aberta?.abertaEm ? diasEntre(aberta.abertaEm.slice(0, 10), hoje) : null

  const atrasada = aberta?.prazo != null && aberta.prazo < hoje
  const venceHoje = aberta?.prazo === hoje

  const paralelaAberta = item.etapas.find((e) => e.paralela && e.status === 'aberta')

  return (
    <Link
      href={`/imobilizado/${item.id}`}
      className={`group block rounded-md border bg-white p-3 shadow-card transition-shadow hover:shadow-card-hover ${
        atrasada ? 'border-negativo-border' : venceHoje ? 'border-alerta-border' : 'border-line'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-[11px] font-semibold tabular-nums text-ink-400">
          #{item.numero}
        </span>

        {item.ehFrota && (
          <span className="inline-flex items-center gap-1 rounded-full bg-cyan-50 px-1.5 py-0.5 text-[10px] font-bold text-cyan-700">
            <Truck size={9} />
            frota
          </span>
        )}
      </div>

      <p className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-navy-700">
        {item.descricao || item.fornecedor || `Nota ${item.nfNumero}`}
      </p>

      <p className="mt-0.5 truncate text-[11px] text-ink-500" title={item.filial}>
        {item.filial || '—'}
      </p>

      <p className="mt-1.5 text-xs font-semibold tabular-nums text-ink-700">
        {formatarMoeda(item.valor)}
      </p>

      {/* Os dois tempos, lado a lado: o da etapa cobra a pessoa que está com
          ela; o do processo cobra o fluxo inteiro. */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-2 text-[11px]">
        {!final && naEtapa !== null && (
          <span
            className={`font-bold tabular-nums ${
              atrasada ? 'text-negativo' : venceHoje ? 'text-alerta' : 'text-ink-500'
            }`}
          >
            {naEtapa}d nesta etapa
          </span>
        )}

        {processo && (
          <span className="tabular-nums text-ink-400">{processo.dias}d no total</span>
        )}

        {!final && aberta?.prazo && (
          <span className={`ml-auto tabular-nums ${atrasada ? 'text-negativo' : 'text-ink-400'}`}>
            {atrasada ? 'venceu ' : 'vence '}
            {formatarData(aberta.prazo)}
          </span>
        )}
      </div>

      {paralelaAberta && (
        <p className="mt-2 flex items-center gap-1 rounded bg-alerta-bg px-2 py-1 text-[10px] font-semibold text-alerta">
          Placa pendente
          {placa && placa.aberto ? ` · ${placa.dias}d desde o ATPV` : ''}
        </p>
      )}
    </Link>
  )
}
