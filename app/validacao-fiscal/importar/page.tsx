'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react'

import { useAuthGate } from '@/app/tarefas/_hooks/useAuthGate'

import { FormularioImportacao } from '../_components/FormularioImportacao'
import { AvisoErro, Carregando, Painel } from '../_components/Ui'
import { descreverErro, excluirLote, listarLotes, resumoDoLote } from '../_lib/api'
import { CORES } from '../_lib/cores'
import { formatarData } from '../_lib/prazo'
import { ROTULO_ORIGEM, type LoteImportacao } from '../_lib/types'

export default function PaginaImportar() {
  const { userName, userRole, authLoaded } = useAuthGate()
  const [lotes, setLotes] = useState<LoteImportacao[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [alvo, setAlvo] = useState<LoteImportacao | null>(null)
  const [contagem, setContagem] = useState<{ total: number; respondidas: number } | null>(null)
  const [excluindo, setExcluindo] = useState(false)
  const [erroExclusao, setErroExclusao] = useState<string | null>(null)

  const ehAdmin = userRole === 'admin'

  const pedirExclusao = async (lote: LoteImportacao) => {
    setAlvo(lote)
    setContagem(null)
    setErroExclusao(null)
    try {
      setContagem(await resumoDoLote(lote.id))
    } catch (falha) {
      setErroExclusao(descreverErro(falha))
    }
  }

  const confirmarExclusao = async () => {
    if (!alvo) return
    setExcluindo(true)
    setErroExclusao(null)
    try {
      await excluirLote(alvo.id)
      setAlvo(null)
      setLotes(await listarLotes())
    } catch (falha) {
      setErroExclusao(descreverErro(falha))
    } finally {
      setExcluindo(false)
    }
  }

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro(null)
    try {
      setLotes(await listarLotes())
    } catch (falha) {
      setErro(descreverErro(falha))
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  if (erro) return <AvisoErro mensagem={erro} />
  if (carregando || !authLoaded) return <Carregando linhas={3} />

  return (
    <div className="space-y-6">
      <FormularioImportacao
        usuario={userName}
        podeImportar={userRole === 'admin'}
        aoImportar={carregar}
      />

      <Painel
        titulo="Importações recentes"
        descricao="Cada envio fica registrado com quantas tarefas gerou e qual prazo foi aplicado."
      >
        {lotes.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhuma planilha importada ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left">
                  {[
                    'Arquivo',
                    'Tipo',
                    'Importado por',
                    'Data',
                    'Novas',
                    'Já existiam',
                    'Prazo',
                    ...(ehAdmin ? [''] : []),
                  ].map((coluna, indice) => (
                    <th
                      key={`${coluna}-${indice}`}
                      scope="col"
                      className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400"
                    >
                      {coluna}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lotes.map((lote) => (
                  <tr key={lote.id} className="border-b border-slate-100">
                    <td
                      className="max-w-[280px] truncate px-3 py-3 font-medium text-[#063955]"
                      title={lote.arquivo}
                    >
                      {lote.arquivo}
                    </td>
                    <td className="px-3 py-3 text-slate-600">{ROTULO_ORIGEM[lote.origem]}</td>
                    <td className="px-3 py-3 text-slate-600">{lote.importadoPor ?? '—'}</td>
                    <td className="px-3 py-3 tabular-nums text-slate-600">
                      {new Date(lote.importadoEm).toLocaleString('pt-BR', {
                        timeZone: 'America/Sao_Paulo',
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </td>
                    <td className="px-3 py-3 tabular-nums font-bold text-[#063955]">{lote.novas}</td>
                    <td className="px-3 py-3 tabular-nums text-slate-400">{lote.duplicadas}</td>
                    <td className="px-3 py-3 tabular-nums text-slate-600">
                      {formatarData(lote.prazo)}
                    </td>

                    {ehAdmin && (
                      <td className="px-3 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => pedirExclusao(lote)}
                          aria-label={`Excluir a importação ${lote.arquivo}`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 transition-colors hover:border-[#b1272d] hover:text-[#b1272d]"
                        >
                          <Trash2 size={13} />
                          Excluir
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Painel>

      {alvo && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => !excluindo && setAlvo(null)}
            aria-hidden
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-label="Confirmar exclusão da importação"
            className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle size={22} className="mt-0.5 shrink-0" style={{ color: CORES.critico }} />
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-[#063955]">Excluir esta importação?</h2>
                <p className="mt-1 break-words text-sm text-slate-600">{alvo.arquivo}</p>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-600">
              {contagem === null ? (
                <span className="flex items-center gap-2 text-slate-400">
                  <Loader2 size={14} className="animate-spin" />
                  Conferindo o que será apagado…
                </span>
              ) : (
                <>
                  Serão apagadas <strong>{contagem.total}</strong> tarefa(s) desta importação
                  {contagem.respondidas > 0 && (
                    <>
                      , sendo{' '}
                      <strong style={{ color: CORES.critico }}>
                        {contagem.respondidas} já respondida(s)
                      </strong>{' '}
                      pelo time
                    </>
                  )}
                  . Não há como desfazer.
                  {contagem.total === 0 && (
                    <>
                      {' '}
                      Nenhuma tarefa restou neste lote — provavelmente as linhas vieram de uma
                      importação anterior.
                    </>
                  )}
                </>
              )}
            </div>

            {erroExclusao && (
              <p role="alert" className="mt-3 text-sm" style={{ color: CORES.critico }}>
                {erroExclusao}
              </p>
            )}

            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setAlvo(null)}
                disabled={excluindo}
                className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-40"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={confirmarExclusao}
                disabled={excluindo || contagem === null}
                className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white transition-all hover:brightness-110 disabled:opacity-40"
                style={{ background: CORES.critico }}
              >
                {excluindo ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                Excluir importação
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
