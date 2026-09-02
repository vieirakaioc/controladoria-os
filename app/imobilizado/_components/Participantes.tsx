'use client'

import { useState } from 'react'
import { Check, Loader2, Plus, Trash2, UserRound } from 'lucide-react'

import {
  atualizarParticipante,
  descreverErro,
  incluirParticipante,
  removerParticipante,
} from '../_lib/api'
import type { Participante, Pessoa, TipoParticipante } from '../_lib/types'
import { Painel } from './Ui'

const CAMPO =
  'w-full rounded-md border border-line-strong bg-white px-3 py-2 text-sm text-ink-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20'

/**
 * Quem entra no processo — e em que condição.
 *
 * Participante responde etapa e anexa; observador acompanha e não altera nada.
 * Quem não está aqui não enxerga o módulo, então esta tela é o que separa o
 * time do processo do resto do portal.
 */
export function Participantes({
  pessoas,
  doPortal,
  areas,
  ehAdmin,
  aoMudar,
}: {
  pessoas: Participante[]
  /** Todo mundo com login no portal. */
  doPortal: Pessoa[]
  /** Áreas donas das etapas — é o que a pessoa faz no processo. */
  areas: string[]
  ehAdmin: boolean
  aoMudar: () => Promise<void>
}) {
  const [novoId, setNovoId] = useState('')
  const [novoPapel, setNovoPapel] = useState('')
  const [novoTipo, setNovoTipo] = useState<TipoParticipante>('participante')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Quem já está no processo sai da lista de escolha: reincluir a mesma pessoa
  // não faria nada, e a opção só atrapalharia a busca visual.
  const disponiveis = doPortal.filter((r) => !pessoas.some((p) => p.profileId === r.id))

  const incluir = async () => {
    if (!novoId) return
    setSalvando(true)
    setErro(null)
    try {
      await incluirParticipante({ profileId: novoId, papel: novoPapel, tipo: novoTipo })
      setNovoId('')
      setNovoPapel('')
      await aoMudar()
    } catch (falha) {
      setErro(descreverErro(falha))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Painel
      titulo="Quem participa"
      descricao="Participante responde etapa e anexa documento; observador acompanha e não altera nada. Quem não está aqui não enxerga o módulo."
    >
      {ehAdmin && (
        <div className="mb-5 grid gap-3 rounded-md border border-line bg-navy-50 p-4 sm:grid-cols-[1.4fr_1.4fr_auto_auto]">
          <div>
            <label htmlFor="pessoa" className="eyebrow">
              Pessoa
            </label>
            <select
              id="pessoa"
              value={novoId}
              onChange={(e) => setNovoId(e.target.value)}
              className={`mt-1.5 ${CAMPO}`}
            >
              <option value="">Selecione…</option>
              {disponiveis.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nome}
                  {r.email ? ` · ${r.email}` : ''}
                </option>
              ))}
              {disponiveis.length === 0 && <option disabled>Todo mundo já está no processo</option>}
            </select>
          </div>

          <div>
            <label htmlFor="papel" className="eyebrow">
              O que faz no processo
            </label>
            {/* As áreas saem das etapas: papel digitado à mão criaria "Frota",
                "frota" e "FROTA" como se fossem três coisas. */}
            <select
              id="papel"
              value={novoPapel}
              onChange={(e) => setNovoPapel(e.target.value)}
              className={`mt-1.5 ${CAMPO}`}
            >
              <option value="">Selecione a área…</option>
              {areas.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
              <option value="Acompanhamento">Acompanhamento (não responde etapa)</option>
            </select>
          </div>

          <div>
            <label htmlFor="tipo" className="eyebrow">
              Tipo
            </label>
            <select
              id="tipo"
              value={novoTipo}
              onChange={(e) => setNovoTipo(e.target.value as TipoParticipante)}
              className={`mt-1.5 ${CAMPO}`}
            >
              <option value="participante">Participante</option>
              <option value="observador">Observador</option>
            </select>
          </div>

          <button
            type="button"
            onClick={incluir}
            disabled={salvando || !novoId}
            className="mt-auto inline-flex items-center justify-center gap-2 rounded-md bg-teal-600 px-4 py-2 text-sm font-bold text-white transition-all hover:brightness-110 disabled:opacity-40"
          >
            {salvando ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            Incluir
          </button>

          {erro && (
            <p role="alert" className="text-sm text-negativo sm:col-span-4">
              {erro}
            </p>
          )}
        </div>
      )}

      {pessoas.length === 0 ? (
        <p className="text-sm text-ink-400">Ninguém cadastrado ainda.</p>
      ) : (
        <ul className="grid gap-2 lg:grid-cols-2">
          {pessoas.map((p) => (
            <LinhaPessoa key={p.id} pessoa={p} areas={areas} ehAdmin={ehAdmin} aoMudar={aoMudar} />
          ))}
        </ul>
      )}
    </Painel>
  )
}

function LinhaPessoa({
  pessoa,
  areas,
  ehAdmin,
  aoMudar,
}: {
  pessoa: Participante
  areas: string[]
  ehAdmin: boolean
  aoMudar: () => Promise<void>
}) {
  const [salvando, setSalvando] = useState(false)
  const [confirmando, setConfirmando] = useState(false)

  const mudar = async (mudancas: Parameters<typeof atualizarParticipante>[1]) => {
    setSalvando(true)
    try {
      await atualizarParticipante(pessoa.id, mudancas)
      await aoMudar()
    } finally {
      setSalvando(false)
    }
  }

  const remover = async () => {
    setSalvando(true)
    try {
      await removerParticipante(pessoa.id)
      await aoMudar()
    } finally {
      setSalvando(false)
    }
  }

  return (
    <li
      className={`flex items-center gap-3 rounded-md border border-line bg-white px-3 py-2.5 ${
        pessoa.ativo ? '' : 'opacity-60'
      }`}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-navy-100 text-navy-600">
        <UserRound size={15} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-navy-700">{pessoa.nome}</div>

        {ehAdmin ? (
          <select
            value={pessoa.papel}
            onChange={(e) => mudar({ papel: e.target.value })}
            disabled={salvando}
            aria-label={`Área de ${pessoa.nome}`}
            className="mt-0.5 w-full truncate rounded border border-transparent bg-transparent px-1 py-0.5 text-xs text-ink-500 outline-none hover:border-line focus:border-teal-500"
          >
            {/* Papel que veio de antes do seletor continua listado, senão ele
                sumiria da tela ao abrir o campo. */}
            {pessoa.papel && !areas.includes(pessoa.papel) && (
              <option value={pessoa.papel}>{pessoa.papel}</option>
            )}
            <option value="">Sem área</option>
            {areas.map((area) => (
              <option key={area} value={area}>
                {area}
              </option>
            ))}
            <option value="Acompanhamento">Acompanhamento</option>
          </select>
        ) : (
          <div className="truncate text-xs text-ink-500">
            {pessoa.papel || '—'}
            {pessoa.email ? ` · ${pessoa.email}` : ''}
          </div>
        )}
      </div>

      {ehAdmin ? (
        <div className="flex shrink-0 items-center gap-2">
          <select
            value={pessoa.tipo}
            onChange={(e) => mudar({ tipo: e.target.value as TipoParticipante })}
            disabled={salvando}
            aria-label={`Tipo de ${pessoa.nome}`}
            className="rounded border border-line-strong bg-white px-2 py-1 text-[11px] font-semibold text-ink-700 outline-none focus:border-teal-500"
          >
            <option value="participante">participante</option>
            <option value="observador">observador</option>
          </select>

          <button
            type="button"
            onClick={() => mudar({ ativo: !pessoa.ativo })}
            disabled={salvando}
            title={pessoa.ativo ? 'Suspender o acesso' : 'Devolver o acesso'}
            className={`rounded border px-2 py-1 text-[11px] font-semibold transition-colors ${
              pessoa.ativo
                ? 'border-positivo-border bg-positivo-bg text-positivo'
                : 'border-line-strong text-ink-400'
            }`}
          >
            {pessoa.ativo ? 'ativo' : 'suspenso'}
          </button>

          {confirmando ? (
            <button
              type="button"
              onClick={remover}
              disabled={salvando}
              className="inline-flex items-center gap-1 rounded bg-negativo px-2 py-1 text-[11px] font-bold text-white"
            >
              {salvando ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
              Confirmar
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmando(true)}
              disabled={salvando}
              aria-label={`Remover ${pessoa.nome}`}
              className="text-ink-400 transition-colors hover:text-negativo"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ) : (
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
            pessoa.tipo === 'participante'
              ? 'border-teal-200 text-teal-700'
              : 'border-line-strong text-ink-500'
          }`}
        >
          {pessoa.tipo}
        </span>
      )}
    </li>
  )
}
