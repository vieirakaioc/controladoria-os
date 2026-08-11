'use client'

import { useCallback, useEffect, useState } from 'react'

import { useAuthGate } from '@/app/tarefas/_hooks/useAuthGate'

import { FormularioImportacao } from '../_components/FormularioImportacao'
import { AvisoErro, Carregando, Painel } from '../_components/Ui'
import { descreverErro, listarLotes } from '../_lib/api'
import { formatarData } from '../_lib/prazo'
import { ROTULO_ORIGEM, type LoteImportacao } from '../_lib/types'

export default function PaginaImportar() {
  const { userName, userRole, authLoaded } = useAuthGate()
  const [lotes, setLotes] = useState<LoteImportacao[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

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
                  {['Arquivo', 'Tipo', 'Importado por', 'Data', 'Novas', 'Já existiam', 'Prazo'].map(
                    (coluna) => (
                      <th
                        key={coluna}
                        scope="col"
                        className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400"
                      >
                        {coluna}
                      </th>
                    ),
                  )}
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Painel>
    </div>
  )
}
