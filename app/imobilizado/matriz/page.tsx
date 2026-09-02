'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Check, Circle, Clock, Minus, Search, Truck } from 'lucide-react'

import { formatarInteiro } from '@/app/validacao-fiscal/_lib/formato'
import { hoje as dataDeHoje } from '@/app/validacao-fiscal/_lib/prazo'

import { AvisoErro, Carregando, Painel, SemAcesso } from '../_components/Ui'
import { useImobilizado } from '../_hooks/useImobilizado'
import { agingProcesso } from '../_lib/aging'
import type { Etapa, Item } from '../_lib/types'

/**
 * A matriz: um item por linha, uma etapa por coluna.
 *
 * O quadro mostra onde cada item está; a matriz mostra o caminho inteiro de
 * todos ao mesmo tempo — dá para ver, de relance, que etapa trava a operação
 * (uma coluna com muitas células em aberto) e que item está andando devagar
 * (uma linha que demora a ficar verde).
 */

/** Como está a célula — a etapa daquele item. */
type Sinal = 'concluida' | 'atrasada' | 'hoje' | 'aberta' | 'bloqueada' | 'ausente'

const ESTILO: Record<Sinal, { classe: string; rotulo: string }> = {
  concluida: { classe: 'bg-positivo text-white', rotulo: 'Concluída' },
  atrasada: { classe: 'bg-negativo text-white', rotulo: 'Atrasada' },
  hoje: { classe: 'bg-alerta text-white', rotulo: 'Vence hoje' },
  aberta: { classe: 'bg-teal-500 text-white', rotulo: 'Em aberto' },
  bloqueada: { classe: 'bg-navy-100 text-navy-400', rotulo: 'Aguardando a anterior' },
  ausente: { classe: 'bg-transparent text-ink-400', rotulo: 'Não se aplica a este item' },
}

function sinalDaEtapa(etapa: Etapa | undefined, hoje: string): Sinal {
  if (!etapa) return 'ausente'
  if (etapa.status === 'concluida') return 'concluida'
  if (etapa.status === 'bloqueada') return 'bloqueada'
  if (etapa.prazo && etapa.prazo < hoje) return 'atrasada'
  if (etapa.prazo === hoje) return 'hoje'
  return 'aberta'
}

function Icone({ sinal }: { sinal: Sinal }) {
  if (sinal === 'concluida') return <Check size={12} strokeWidth={3} />
  if (sinal === 'atrasada') return <AlertTriangle size={11} />
  if (sinal === 'hoje') return <Clock size={11} />
  if (sinal === 'aberta') return <Circle size={9} fill="currentColor" />
  if (sinal === 'bloqueada') return <Circle size={7} />
  return <Minus size={11} />
}

/**
 * O sinal do item inteiro.
 *
 * Um semáforo por linha, com a mesma regra do prazo das etapas: vermelho se
 * alguma etapa passou do prazo, âmbar se alguma vence hoje, verde se está tudo
 * em dia. Finalizado sai do semáforo — não há mais o que sinalizar.
 */
function sinalDoItem(item: Item, hoje: string): Sinal {
  if (item.status === 'finalizado') return 'concluida'

  const abertas = item.etapas.filter((e) => e.status === 'aberta')
  if (abertas.some((e) => e.prazo && e.prazo < hoje)) return 'atrasada'
  if (abertas.some((e) => e.prazo === hoje)) return 'hoje'
  return 'aberta'
}

export default function PaginaMatriz() {
  const { itens, acesso, carregando, erro } = useImobilizado()
  const [busca, setBusca] = useState('')
  const [soAbertos, setSoAbertos] = useState(true)
  const hoje = dataDeHoje()

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase()

    return itens.filter((item) => {
      if (soAbertos && item.status !== 'em_andamento') return false
      if (!termo) return true

      return [item.numero, item.nfNumero, item.fornecedor, item.descricao, item.filial]
        .join(' ')
        .toLowerCase()
        .includes(termo)
    })
  }, [itens, busca, soAbertos])

  // As colunas são a união das etapas dos itens em tela, na ordem do processo.
  // Item sem frota simplesmente deixa a célula vazia naquela coluna.
  const colunas = useMemo(() => {
    const mapa = new Map<string, { chave: string; titulo: string; ordem: number }>()

    for (const item of visiveis) {
      for (const etapa of item.etapas) {
        if (!mapa.has(etapa.chave)) {
          mapa.set(etapa.chave, { chave: etapa.chave, titulo: etapa.titulo, ordem: etapa.ordem })
        }
      }
    }

    return [...mapa.values()].sort((a, b) => a.ordem - b.ordem)
  }, [visiveis])

  // Quantas células em aberto cada etapa acumula — é o que revela o gargalo.
  const gargalo = useMemo(() => {
    const conta = new Map<string, number>()

    for (const item of visiveis) {
      for (const etapa of item.etapas) {
        if (etapa.status !== 'aberta') continue
        conta.set(etapa.chave, (conta.get(etapa.chave) ?? 0) + 1)
      }
    }

    return conta
  }, [visiveis])

  if (erro) return <AvisoErro mensagem={erro} />
  if (carregando) return <Carregando linhas={3} />
  if (!acesso) return <SemAcesso />

  if (itens.length === 0) {
    return (
      <Painel titulo="Nenhum item ainda">
        <p className="text-sm leading-relaxed text-ink-700">
          Cadastre o primeiro item para a matriz ganhar conteúdo.
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
              placeholder="Nº, nota, fornecedor…"
              className="w-56 bg-transparent text-sm text-ink-700 outline-none placeholder:text-ink-400"
            />
          </div>

          <button
            type="button"
            onClick={() => setSoAbertos((atual) => !atual)}
            aria-pressed={soAbertos}
            className={`rounded-md border px-3 py-2 text-sm font-semibold transition-colors ${
              soAbertos
                ? 'border-teal-500 bg-teal-50 text-teal-700'
                : 'border-line-strong bg-white text-ink-500 hover:text-navy-700'
            }`}
          >
            Só em andamento
          </button>

          {/* Legenda: a cor sozinha não diz nada para quem chega agora. */}
          <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1">
            {(['concluida', 'aberta', 'hoje', 'atrasada', 'bloqueada'] as const).map((s) => (
              <span key={s} className="flex items-center gap-1.5 text-[11px] text-ink-500">
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded ${ESTILO[s].classe}`}
                >
                  <Icone sinal={s} />
                </span>
                {ESTILO[s].rotulo}
              </span>
            ))}
          </div>
        </div>
      </Painel>

      <div className="panel surge overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-max min-w-full border-collapse text-sm">
            <thead className="bg-navy-50/70">
              <tr>
                <th
                  scope="col"
                  className="eyebrow sticky left-0 z-20 w-[260px] min-w-[260px] border-b border-r border-line bg-navy-50 px-4 py-2.5 text-left"
                >
                  Item
                </th>

                {colunas.map((coluna) => {
                  const emAberto = gargalo.get(coluna.chave) ?? 0

                  return (
                    <th
                      key={coluna.chave}
                      scope="col"
                      className="border-b border-l border-line px-3 py-2.5 text-center align-bottom"
                    >
                      <div className="eyebrow mx-auto max-w-[90px] leading-tight">
                        {coluna.titulo}
                      </div>
                      {/* O contador de abertos transforma a coluna em medida:
                          é onde o trabalho se acumula. */}
                      <div
                        className={`num mt-1 text-[11px] font-bold ${
                          emAberto > 0 ? 'text-teal-700' : 'text-ink-400'
                        }`}
                      >
                        {emAberto > 0 ? `${emAberto} em aberto` : '—'}
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>

            <tbody>
              {visiveis.length === 0 && (
                <tr>
                  <td
                    colSpan={colunas.length + 1}
                    className="px-4 py-12 text-center text-sm text-ink-400"
                  >
                    Nenhum item com esses filtros.
                  </td>
                </tr>
              )}

              {visiveis.map((item, linha) => {
                const sinal = sinalDoItem(item, hoje)
                const processo = agingProcesso(item, hoje)
                const faixa = linha % 2 === 1 ? 'bg-navy-50/40' : 'bg-white'

                return (
                  <tr key={item.id} className="group border-b border-line">
                    <th
                      scope="row"
                      className={`sticky left-0 z-10 border-r border-line px-4 py-2.5 text-left font-normal ${faixa} group-hover:bg-teal-50/60`}
                    >
                      <Link href={`/imobilizado/${item.id}`} className="flex items-center gap-2.5">
                        {/* O semáforo do item: mesma regra de prazo das
                            células, resumida em um sinal por linha. */}
                        <span
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${ESTILO[sinal].classe}`}
                          title={`Item ${ESTILO[sinal].rotulo.toLowerCase()}`}
                        >
                          <Icone sinal={sinal} />
                        </span>

                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5">
                            <span className="num text-[11px] font-semibold text-ink-400">
                              #{item.numero}
                            </span>
                            {item.ehFrota && <Truck size={11} className="text-cyan-600" />}
                          </span>
                          <span className="block truncate text-[13px] font-semibold text-navy-700">
                            {item.descricao || item.fornecedor || `Nota ${item.nfNumero}`}
                          </span>
                          <span className="num block text-[11px] text-ink-400">
                            {item.filial || '—'} · {processo?.dias ?? 0}d no fluxo
                          </span>
                        </span>
                      </Link>
                    </th>

                    {colunas.map((coluna) => {
                      const etapa = item.etapas.find((e) => e.chave === coluna.chave)
                      const s = sinalDaEtapa(etapa, hoje)

                      return (
                        <td
                          key={coluna.chave}
                          className={`border-l border-line px-3 py-2.5 text-center ${faixa} group-hover:bg-teal-50/60`}
                        >
                          <span
                            className={`inline-flex h-6 w-6 items-center justify-center rounded ${ESTILO[s].classe}`}
                            title={`${coluna.titulo}: ${ESTILO[s].rotulo}`}
                          >
                            <Icone sinal={s} />
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

      <p className="text-xs text-ink-400">
        {formatarInteiro(visiveis.length)} item(ns) · a coluna com mais células em aberto é onde o
        processo está represado.
      </p>
    </div>
  )
}
