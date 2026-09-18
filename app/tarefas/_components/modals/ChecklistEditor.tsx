'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, GripVertical, Pencil, Plus, Trash2 } from 'lucide-react'

import { apenasSubtarefas, ehBloco, type ChecklistItem, type Lookup } from '../../_lib/types'

type Props = {
  items: ChecklistItem[]
  onChange: (items: ChecklistItem[]) => void
  /** Quem pode ser dono de subtarefa — a mesma lista de "Envolvidos". */
  pessoas: Lookup[]
}

/**
 * Um bloco e as subtarefas dele.
 *
 * A lista gravada é plana (ver `ChecklistItem`); os grupos existem só aqui,
 * para desenhar e mover. O primeiro grupo não tem cabeçalho: são as
 * subtarefas soltas, de antes de existir bloco — checklist antigo cai todo ali.
 */
type Grupo = { bloco: ChecklistItem | null; itens: ChecklistItem[] }

function agrupar(items: ChecklistItem[]): Grupo[] {
  const grupos: Grupo[] = [{ bloco: null, itens: [] }]
  for (const c of items) {
    if (ehBloco(c)) grupos.push({ bloco: c, itens: [] })
    else grupos[grupos.length - 1].itens.push(c)
  }
  return grupos
}

function achatar(grupos: Grupo[]): ChecklistItem[] {
  return grupos.flatMap((g) => (g.bloco ? [g.bloco, ...g.itens] : g.itens))
}

type Arrasto = { tipo: 'item' | 'bloco'; id: string } | null

const CAMPO =
  'bg-white dark:bg-slate-900 border border-line dark:border-slate-700 dark:text-white rounded-md px-3 py-2 text-sm outline-none focus:border-teal-500'

export function ChecklistEditor({ items, onChange, pessoas }: Props) {
  const [novo, setNovo] = useState('')
  const [novoDono, setNovoDono] = useState('')
  const [novoBloco, setNovoBloco] = useState('')
  const [editando, setEditando] = useState<string | null>(null)
  const [rascunho, setRascunho] = useState('')
  const [arrasto, setArrasto] = useState<Arrasto>(null)
  const [alvo, setAlvo] = useState<string | null>(null)
  // Em qual bloco o campo "adicionar aqui" está aberto.
  const [addNoBloco, setAddNoBloco] = useState<string | null>(null)
  const [textoNoBloco, setTextoNoBloco] = useState('')

  const grupos = agrupar(items)
  const subtarefas = apenasSubtarefas(items)
  const feitas = subtarefas.filter((c) => c.concluido).length

  const dono = (idPessoa: string) => {
    const p = pessoas.find((x) => x.id === idPessoa)
    return {
      responsavelId: p?.id ?? null,
      responsavelNome: p?.nome ?? null,
      responsavelEmail: p?.email ?? null,
    }
  }

  const novaSubtarefa = (texto: string, idDono = ''): ChecklistItem => ({
    id: crypto.randomUUID(),
    texto: texto.trim(),
    concluido: false,
    tipo: 'item',
    ...dono(idDono),
  })

  /* ─────────────────────────── inclusão ─────────────────────────── */

  // Vai para o fim da lista, ou seja, para dentro do último bloco — que é o
  // que se está montando quando se digita em sequência.
  const adicionar = () => {
    if (!novo.trim()) return
    onChange([...items, novaSubtarefa(novo, novoDono)])
    setNovo('')
  }

  const adicionarBloco = () => {
    if (!novoBloco.trim()) return
    onChange([
      ...items,
      { id: crypto.randomUUID(), texto: novoBloco.trim(), concluido: false, tipo: 'bloco' },
    ])
    setNovoBloco('')
  }

  const adicionarNoBloco = (idBloco: string) => {
    if (!textoNoBloco.trim()) return
    const gs = agrupar(items)
    const g = gs.find((x) => x.bloco?.id === idBloco)
    if (!g) return
    g.itens.push(novaSubtarefa(textoNoBloco))
    onChange(achatar(gs))
    setTextoNoBloco('')
  }

  /* ─────────────────────────── edição ─────────────────────────── */

  const alterar = (id: string, mudanca: Partial<ChecklistItem>) =>
    onChange(items.map((c) => (c.id === id ? { ...c, ...mudanca } : c)))

  const abrirEdicao = (c: ChecklistItem) => {
    setEditando(c.id)
    setRascunho(c.texto)
  }

  const salvarEdicao = () => {
    if (editando && rascunho.trim()) alterar(editando, { texto: rascunho.trim() })
    setEditando(null)
  }

  /**
   * Remove a linha.
   *
   * Bloco sai sozinho: as subtarefas dele passam para o bloco de cima. Apagar
   * um cabeçalho não deveria levar junto o trabalho que estava embaixo dele.
   */
  const remover = (id: string) => onChange(items.filter((c) => c.id !== id))

  /* ─────────────────────────── ordem ─────────────────────────── */

  /**
   * Sobe ou desce uma posição.
   *
   * Subtarefa troca com a vizinha na lista plana — se a vizinha for um
   * cabeçalho, a subtarefa atravessa para o outro bloco, que é exatamente o
   * que se espera ao empurrá-la para cima do título. Bloco troca de lugar com
   * o bloco vizinho, levando as suas subtarefas.
   */
  const mover = (c: ChecklistItem, direcao: -1 | 1) => {
    if (ehBloco(c)) {
      const gs = agrupar(items)
      const i = gs.findIndex((g) => g.bloco?.id === c.id)
      const j = i + direcao
      // O grupo 0 é o das soltas, sem cabeçalho: bloco nenhum passa para cima dele.
      if (j < 1 || j >= gs.length) return
      ;[gs[i], gs[j]] = [gs[j], gs[i]]
      onChange(achatar(gs))
      return
    }

    const lista = [...items]
    const i = lista.findIndex((x) => x.id === c.id)
    const j = i + direcao
    if (j < 0 || j >= lista.length) return
    ;[lista[i], lista[j]] = [lista[j], lista[i]]
    onChange(lista)
  }

  /**
   * Solta o que está sendo arrastado sobre uma linha.
   *
   * Subtarefa sobre subtarefa entra antes dela; sobre um cabeçalho, entra como
   * primeira daquele bloco. Bloco arrastado leva as suas subtarefas e entra
   * antes do bloco de destino.
   */
  const soltar = (destino: ChecklistItem) => {
    if (!arrasto || arrasto.id === destino.id) return
    const gs = agrupar(items)

    if (arrasto.tipo === 'bloco') {
      const de = gs.findIndex((g) => g.bloco?.id === arrasto.id)
      if (de < 1) return
      const [grupo] = gs.splice(de, 1)
      let para = gs.findIndex((g) =>
        ehBloco(destino) ? g.bloco?.id === destino.id : g.itens.some((x) => x.id === destino.id),
      )
      if (para < 1) para = 1
      gs.splice(para, 0, grupo)
      onChange(achatar(gs))
      return
    }

    const origem = gs.find((g) => g.itens.some((x) => x.id === arrasto.id))
    const movido = origem?.itens.find((x) => x.id === arrasto.id)
    if (!origem || !movido) return
    origem.itens = origem.itens.filter((x) => x.id !== arrasto.id)

    if (ehBloco(destino)) {
      gs.find((g) => g.bloco?.id === destino.id)?.itens.unshift(movido)
    } else {
      const g = gs.find((x) => x.itens.some((i) => i.id === destino.id))
      if (!g) return
      g.itens.splice(g.itens.findIndex((i) => i.id === destino.id), 0, movido)
    }
    onChange(achatar(gs))
  }

  const propsArrasto = (c: ChecklistItem) => ({
    draggable: editando !== c.id,
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.effectAllowed = 'move'
      // Sem dado no evento o Firefox não inicia o arrasto.
      e.dataTransfer.setData('text/plain', c.id)
      setArrasto({ tipo: ehBloco(c) ? 'bloco' : 'item', id: c.id })
    },
    onDragOver: (e: React.DragEvent) => {
      if (!arrasto) return
      e.preventDefault()
      setAlvo(c.id)
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault()
      soltar(c)
      setArrasto(null)
      setAlvo(null)
    },
    onDragEnd: () => {
      setArrasto(null)
      setAlvo(null)
    },
  })

  /* ─────────────────────────── desenho ─────────────────────────── */

  const botoesOrdem = (c: ChecklistItem) => (
    <span className="flex flex-col opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
      <button
        type="button"
        onClick={() => mover(c, -1)}
        aria-label={`Subir "${c.texto}"`}
        className="text-ink-400 hover:text-navy-700 dark:hover:text-white"
      >
        <ChevronUp size={13} />
      </button>
      <button
        type="button"
        onClick={() => mover(c, 1)}
        aria-label={`Descer "${c.texto}"`}
        className="text-ink-400 hover:text-navy-700 dark:hover:text-white"
      >
        <ChevronDown size={13} />
      </button>
    </span>
  )

  const textoOuEdicao = (c: ChecklistItem, classe: string) =>
    editando === c.id ? (
      <input
        autoFocus
        value={rascunho}
        onChange={(e) => setRascunho(e.target.value)}
        onBlur={salvarEdicao}
        onKeyDown={(e) => {
          if (e.key === 'Enter') salvarEdicao()
          if (e.key === 'Escape') setEditando(null)
        }}
        className={`flex-1 ${CAMPO} py-1`}
      />
    ) : (
      <span
        onDoubleClick={() => abrirEdicao(c)}
        className={`flex-1 ${classe}`}
        title="Clique duas vezes para editar"
      >
        {c.texto}
      </span>
    )

  const acoes = (c: ChecklistItem) => (
    <span className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
      <button
        type="button"
        onClick={() => abrirEdicao(c)}
        aria-label={`Editar "${c.texto}"`}
        className="p-1 text-ink-400 hover:text-navy-700 dark:hover:text-white"
      >
        <Pencil size={13} />
      </button>
      <button
        type="button"
        onClick={() => remover(c.id)}
        aria-label={`Remover "${c.texto}"`}
        title={ehBloco(c) ? 'Remove só o título; as subtarefas passam para o bloco de cima' : 'Remover'}
        className="p-1 text-ink-400 hover:text-[#b43a3d] dark:hover:text-[#f87171]"
      >
        <Trash2 size={13} />
      </button>
    </span>
  )

  const linhaSubtarefa = (c: ChecklistItem) => (
    <div
      key={c.id}
      {...propsArrasto(c)}
      className={`group flex items-start gap-2 rounded-md border bg-white p-2 shadow-card transition-colors dark:bg-slate-800 ${
        alvo === c.id && arrasto?.id !== c.id
          ? 'border-teal-500 border-t-2'
          : 'border-line dark:border-slate-700'
      } ${arrasto?.id === c.id ? 'opacity-40' : ''}`}
    >
      <GripVertical size={14} className="mt-0.5 shrink-0 cursor-grab text-ink-300 dark:text-slate-600" />
      <input
        type="checkbox"
        checked={c.concluido}
        onChange={() => alterar(c.id, { concluido: !c.concluido })}
        className="mt-0.5 h-4 w-4 cursor-pointer rounded border-line-strong text-teal-600 focus:ring-[#0f88a8]"
      />
      <div className="min-w-0 flex-1">
        {textoOuEdicao(
          c,
          `block text-sm leading-snug ${c.concluido ? 'text-ink-400 line-through dark:text-slate-500' : 'text-ink-700 dark:text-slate-200'}`,
        )}
        {/* O dono fica na própria linha, sempre à vista: a subtarefa é de
            alguém mesmo quando a tarefa é de outra pessoa. */}
        <select
          value={c.responsavelId ?? ''}
          onChange={(e) => alterar(c.id, dono(e.target.value))}
          aria-label={`Dono de "${c.texto}"`}
          className={`mt-1 max-w-full rounded border-0 bg-transparent p-0 text-[11px] outline-none focus:ring-0 ${
            c.responsavelId ? 'font-semibold text-teal-600 dark:text-[#38bdf8]' : 'text-ink-400'
          }`}
        >
          <option value="">Sem dono</option>
          {pessoas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
      </div>
      {botoesOrdem(c)}
      {acoes(c)}
    </div>
  )

  return (
    <div className="rounded-md border border-line bg-navy-50 p-4 dark:border-slate-700/50 dark:bg-slate-800/50">
      <div className="mb-3 flex items-center justify-between">
        <label className="text-xs font-bold uppercase tracking-wide text-navy-700 dark:text-slate-300">
          Subtarefas / Checklist
        </label>
        {subtarefas.length > 0 && (
          <span className="rounded-full bg-teal-600/10 px-2 py-0.5 text-[10px] font-bold text-teal-600 dark:bg-[#38bdf8]/10 dark:text-[#38bdf8]">
            {feitas} de {subtarefas.length} concluídas
          </span>
        )}
      </div>

      <div className="mb-3 space-y-4">
        {grupos.map((g, indice) => {
          const feitasNoBloco = g.itens.filter((c) => c.concluido).length

          return (
            <div key={g.bloco?.id ?? 'soltas'} className="space-y-2">
              {g.bloco && (
                <div
                  {...propsArrasto(g.bloco)}
                  className={`group flex items-center gap-2 border-b-2 pb-1.5 ${
                    alvo === g.bloco.id && arrasto?.id !== g.bloco.id
                      ? 'border-teal-500'
                      : 'border-line-strong dark:border-slate-600'
                  } ${arrasto?.id === g.bloco.id ? 'opacity-40' : ''}`}
                >
                  <GripVertical size={14} className="shrink-0 cursor-grab text-ink-300 dark:text-slate-600" />
                  <span className="font-mono text-sm font-bold text-teal-600 dark:text-[#38bdf8]">
                    {indice}
                  </span>
                  {textoOuEdicao(g.bloco, 'text-sm font-bold text-navy-700 dark:text-white')}
                  <span className="text-xs font-semibold tabular-nums text-ink-400">
                    {feitasNoBloco}/{g.itens.length}
                  </span>
                  {botoesOrdem(g.bloco)}
                  {acoes(g.bloco)}
                </div>
              )}

              {g.itens.map(linhaSubtarefa)}

              {g.bloco &&
                (addNoBloco === g.bloco.id ? (
                  <input
                    autoFocus
                    value={textoNoBloco}
                    onChange={(e) => setTextoNoBloco(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') adicionarNoBloco(g.bloco!.id)
                      if (e.key === 'Escape') setAddNoBloco(null)
                    }}
                    onBlur={() => setAddNoBloco(null)}
                    placeholder="Nova subtarefa neste bloco — Enter para incluir"
                    className={`w-full ${CAMPO}`}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setAddNoBloco(g.bloco!.id)
                      setTextoNoBloco('')
                    }}
                    className="inline-flex items-center gap-1 pl-1 text-xs font-semibold text-ink-400 transition-colors hover:text-teal-600"
                  >
                    <Plus size={12} />
                    Adicionar neste bloco
                  </button>
                ))}
            </div>
          )
        })}
      </div>

      <div className="space-y-2 border-t border-line pt-3 dark:border-slate-700">
        <div className="flex flex-wrap gap-2">
          <input
            value={novo}
            onChange={(e) => setNovo(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && adicionar()}
            placeholder="Nova subtarefa..."
            className={`min-w-[180px] flex-1 ${CAMPO}`}
          />
          <select
            value={novoDono}
            onChange={(e) => setNovoDono(e.target.value)}
            aria-label="Dono da nova subtarefa"
            className={`${CAMPO} max-w-[160px]`}
          >
            <option value="">Sem dono</option>
            {pessoas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={adicionar}
            className="rounded-md bg-slate-200 px-3 text-sm font-medium text-ink-700 transition-colors hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
          >
            Adicionar
          </button>
        </div>

        <div className="flex gap-2">
          <input
            value={novoBloco}
            onChange={(e) => setNovoBloco(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && adicionarBloco()}
            placeholder="Novo bloco — ex.: Bancário e financeiro"
            className={`flex-1 ${CAMPO}`}
          />
          <button
            type="button"
            onClick={adicionarBloco}
            className="inline-flex items-center gap-1 rounded-md border border-teal-500 px-3 text-sm font-semibold text-teal-600 transition-colors hover:bg-teal-600 hover:text-white"
          >
            <Plus size={14} />
            Bloco
          </button>
        </div>

        <p className="text-[11px] leading-relaxed text-ink-400">
          Arraste pela alça para reordenar, ou use as setas. Clique duas vezes num texto para
          editar. Subtarefa nova entra no último bloco.
        </p>
      </div>
    </div>
  )
}
