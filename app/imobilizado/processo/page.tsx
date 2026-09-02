'use client'

import { useCallback, useEffect, useState } from 'react'
import { Truck, Users } from 'lucide-react'

import { CORES } from '@/app/validacao-fiscal/_lib/cores'

import { AvisoErro, Carregando, Painel, SemAcesso } from '../_components/Ui'
import { descreverErro, listarModelo, listarParticipantes, meuAcesso } from '../_lib/api'
import type { Acesso, ModeloEtapa, Participante } from '../_lib/types'

/**
 * O desenho do processo, como ele está no banco.
 *
 * Só leitura por enquanto: mostra prazo, dono e regras de cada etapa, e quem
 * participa. Editar aqui é o próximo passo — hoje o ajuste é um update no
 * Supabase, e esta tela é o lugar onde se vê o efeito dele.
 */
export default function PaginaProcesso() {
  const [modelo, setModelo] = useState<ModeloEtapa[]>([])
  const [pessoas, setPessoas] = useState<Participante[]>([])
  const [acesso, setAcesso] = useState<Acesso>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    try {
      const tipo = await meuAcesso()
      setAcesso(tipo)
      if (!tipo) return

      const [etapas, participantes] = await Promise.all([listarModelo(), listarParticipantes()])
      setModelo(etapas)
      setPessoas(participantes)
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
  if (carregando) return <Carregando linhas={3} />
  if (!acesso) return <SemAcesso />

  return (
    <div className="space-y-6">
      <Painel
        titulo="As etapas do processo"
        descricao="É este desenho que gera as etapas de cada item novo. Mudar aqui não mexe nos itens que já estão em andamento."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left">
                {['#', 'Etapa', 'Área', 'Prazo', 'Exige', 'Condição'].map((coluna) => (
                  <th
                    key={coluna}
                    scope="col"
                    className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400"
                  >
                    {coluna}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {modelo.map((etapa) => (
                <tr key={etapa.chave} className="border-b border-slate-100 align-top">
                  <td className="px-3 py-3 font-mono text-xs tabular-nums text-slate-400">
                    {String(etapa.ordem).padStart(2, '0')}
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-semibold text-[#063955]">{etapa.titulo}</div>
                    <div className="max-w-md text-xs leading-relaxed text-slate-500">
                      {etapa.descricao}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-600">{etapa.area || '—'}</td>
                  <td className="whitespace-nowrap px-3 py-3 tabular-nums text-slate-600">
                    {etapa.prazoDiasUteis} d.u.
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-500">
                    {[
                      etapa.exigeAnexo ? 'anexo' : null,
                      etapa.exigeCampo ? `campo ${etapa.exigeCampo}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    <div className="flex flex-col gap-1">
                      {etapa.soFrota && (
                        <span
                          className="inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold"
                          style={{ borderColor: CORES.acao, color: CORES.acao }}
                        >
                          <Truck size={11} />
                          só frota
                        </span>
                      )}
                      {etapa.paralela && (
                        <span className="text-[11px] font-semibold text-[#c98500]">
                          não bloqueia
                        </span>
                      )}
                      {!etapa.soFrota && !etapa.paralela && (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Painel>

      <Painel
        titulo="Quem participa"
        descricao="Participante responde etapa e anexa documento; observador acompanha e não altera nada. Quem não está aqui não enxerga o módulo."
      >
        {pessoas.length === 0 ? (
          <p className="text-sm text-slate-400">Ninguém cadastrado ainda.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {pessoas.map((p) => (
              <li
                key={p.id}
                className={`flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 ${
                  p.ativo ? '' : 'opacity-50'
                }`}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                  <Users size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-[#063955]">{p.nome}</div>
                  <div className="truncate text-xs text-slate-500">
                    {p.papel || '—'}
                    {p.email ? ` · ${p.email}` : ''}
                  </div>
                </div>
                <span
                  className="shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold"
                  style={
                    p.tipo === 'participante'
                      ? { borderColor: CORES.acao, color: CORES.acao }
                      : { borderColor: '#cbd5e1', color: '#64748b' }
                  }
                >
                  {p.tipo === 'participante' ? 'participante' : 'observador'}
                </span>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-4 text-xs leading-relaxed text-slate-400">
          Por enquanto o cadastro é feito no Supabase, na tabela{' '}
          <code className="text-[#0f88a8]">imobilizado_participantes</code>. A tela de edição entra
          em seguida — quis primeiro colocar o fluxo de pé.
        </p>
      </Painel>
    </div>
  )
}
