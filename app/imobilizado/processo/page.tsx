'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, Loader2, Truck, Users } from 'lucide-react'

import { CORES } from '@/app/validacao-fiscal/_lib/cores'

import { AvisoErro, Carregando, Painel, SemAcesso } from '../_components/Ui'
import {
  atualizarPrazoModelo,
  descreverErro,
  listarModelo,
  listarParticipantes,
  meuAcesso,
} from '../_lib/api'
import type { Acesso, ModeloEtapa, Participante } from '../_lib/types'

/**
 * O desenho do processo, como ele está no banco.
 *
 * Mostra prazo, área dona e regras de cada etapa, e quem participa. O prazo é
 * editável por admin; o resto ainda é ajuste no Supabase.
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
        descricao={
          acesso === 'admin'
            ? 'É este desenho que gera as etapas de cada item novo. O prazo é editável e vale a partir do próximo item — mexer no de quem já está em andamento moveria a régua no meio do jogo.'
            : 'É este desenho que gera as etapas de cada item novo. Só administrador ajusta o prazo.'
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                {['#', 'Etapa', 'Área', 'Prazo', 'Exige', 'Condição'].map((coluna) => (
                  <th
                    key={coluna}
                    scope="col"
                    className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-ink-400"
                  >
                    {coluna}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {modelo.map((etapa) => (
                <tr key={etapa.chave} className="border-b border-line align-top">
                  <td className="px-3 py-3 font-mono text-xs tabular-nums text-ink-400">
                    {String(etapa.ordem).padStart(2, '0')}
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-semibold text-navy-700">{etapa.titulo}</div>
                    <div className="max-w-md text-xs leading-relaxed text-ink-500">
                      {etapa.descricao}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-ink-700">{etapa.area || '—'}</td>
                  <td className="whitespace-nowrap px-3 py-3">
                    {acesso === 'admin' ? (
                      <CampoPrazo
                        chave={etapa.chave}
                        valor={etapa.prazoDiasUteis}
                        aoSalvar={carregar}
                      />
                    ) : (
                      <span className="tabular-nums text-ink-700">{etapa.prazoDiasUteis} d.u.</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-xs text-ink-500">
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
                        <span className="text-[11px] font-semibold text-alerta">
                          não bloqueia
                        </span>
                      )}
                      {!etapa.soFrota && !etapa.paralela && (
                        <span className="text-xs text-ink-400">—</span>
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
          <p className="text-sm text-ink-400">Ninguém cadastrado ainda.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {pessoas.map((p) => (
              <li
                key={p.id}
                className={`flex items-center gap-3 rounded-md border border-line bg-white px-3 py-2.5 ${
                  p.ativo ? '' : 'opacity-50'
                }`}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-navy-100 text-ink-400">
                  <Users size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-navy-700">{p.nome}</div>
                  <div className="truncate text-xs text-ink-500">
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

        <p className="mt-4 text-xs leading-relaxed text-ink-400">
          Por enquanto o cadastro é feito no Supabase, na tabela{' '}
          <code className="text-teal-600">imobilizado_participantes</code>. A tela de edição entra
          em seguida — quis primeiro colocar o fluxo de pé.
        </p>
      </Painel>
    </div>
  )
}

/**
 * Prazo editável de uma etapa.
 *
 * Salva no blur e não a cada tecla: com salvamento por tecla, digitar "10"
 * gravaria 1 antes de gravar 10, e por um instante a etapa teria prazo errado.
 */
function CampoPrazo({
  chave,
  valor,
  aoSalvar,
}: {
  chave: string
  valor: number
  aoSalvar: () => Promise<void>
}) {
  const [rascunho, setRascunho] = useState(String(valor))
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const gravar = async () => {
    const dias = Number(rascunho)

    if (!Number.isInteger(dias) || dias < 1 || dias > 365) {
      setErro('Entre 1 e 365')
      setRascunho(String(valor))
      return
    }

    if (dias === valor) return

    setErro(null)
    setSalvando(true)
    try {
      await atualizarPrazoModelo(chave, dias)
      await aoSalvar()
      setSalvo(true)
      setTimeout(() => setSalvo(false), 1800)
    } catch (falha) {
      setErro(descreverErro(falha))
      setRascunho(String(valor))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={1}
        max={365}
        value={rascunho}
        onChange={(e) => setRascunho(e.target.value)}
        onBlur={gravar}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') setRascunho(String(valor))
        }}
        aria-label={`Prazo da etapa em dias úteis`}
        className="w-16 rounded-md border border-line-strong bg-white px-2 py-1 text-sm tabular-nums text-ink-700 outline-none focus:border-teal-500"
      />
      <span className="text-xs text-ink-400">d.u.</span>
      {salvando && <Loader2 size={13} className="animate-spin text-ink-400" />}
      {salvo && <Check size={13} style={{ color: CORES.bom }} />}
      {erro && <span className="text-[11px]" style={{ color: CORES.critico }}>{erro}</span>}
    </div>
  )
}
