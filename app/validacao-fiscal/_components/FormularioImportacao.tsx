'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload } from 'lucide-react'

import { CORES } from '../_lib/cores'
import {
  buscarResponsavelPorEmail,
  descreverErro,
  salvarLote,
  type ResultadoImportacao,
} from '../_lib/api'
import { EMAIL_RESPONSAVEL_PADRAO } from '../_lib/acesso'
import { avisarNovasTarefas } from '../_lib/avisos'
import { baixarModelo } from '../_lib/modelo'
import { PlanilhaInvalida, lerPlanilha } from '../_lib/parser'
import { LAYOUTS } from '../_lib/planilhas'
import { PRAZO_DIAS_UTEIS, calcularPrazo, formatarData } from '../_lib/prazo'
import { ROTULO_ORIGEM } from '../_lib/types'
import { Painel } from './Ui'

const TAMANHO_MAXIMO = 15 * 1024 * 1024

type Estado =
  | { situacao: 'inicial' }
  | { situacao: 'erro'; mensagem: string }
  | { situacao: 'sucesso'; resultados: ResultadoImportacao[]; ignoradas: number }

export function FormularioImportacao({
  usuario,
  podeImportar,
  aoImportar,
}: {
  usuario: string
  podeImportar: boolean
  aoImportar: () => void
}) {
  const [estado, setEstado] = useState<Estado>({ situacao: 'inicial' })
  const [arquivos, setArquivos] = useState<File[]>([])
  const [enviando, setEnviando] = useState(false)
  const entrada = useRef<HTMLInputElement>(null)

  const importar = async () => {
    if (arquivos.length === 0) return

    setEnviando(true)
    setEstado({ situacao: 'inicial' })

    const prazo = calcularPrazo()
    const resultados: ResultadoImportacao[] = []
    let ignoradas = 0

    try {
      // Todas as tarefas novas nascem no nome do responsável padrão. Sem dono,
      // a planilha vira uma lista que ninguém se sente encarregado de responder.
      const responsavelPadrao = await buscarResponsavelPorEmail(EMAIL_RESPONSAVEL_PADRAO)

      for (const arquivo of arquivos) {
        if (arquivo.size > TAMANHO_MAXIMO) {
          setEstado({
            situacao: 'erro',
            mensagem: `"${arquivo.name}" tem mais de 15 MB. Exporte apenas as abas de correção.`,
          })
          return
        }

        const leituras = lerPlanilha(await arquivo.arrayBuffer())

        for (const leitura of leituras) {
          ignoradas += leitura.ignoradas
          if (leitura.tarefas.length === 0) continue

          resultados.push(
            await salvarLote({
              origem: leitura.origem,
              arquivo: leitura.aba ? `${arquivo.name} · ${leitura.aba}` : arquivo.name,
              importadoPor: usuario || null,
              prazo,
              tarefas: leitura.tarefas,
              responsavelPadrao,
            }),
          )
        }
      }

      if (resultados.length === 0) {
        setEstado({
          situacao: 'erro',
          mensagem: 'As abas reconhecidas não tinham nenhuma linha com documento identificável.',
        })
        return
      }

      setEstado({ situacao: 'sucesso', resultados, ignoradas })
      aoImportar()

      // Depois de mostrar o resultado: o aviso é complemento, e uma falha de
      // SMTP não pode fazer parecer que a importação deu errado.
      await avisarNovasTarefas({
        destino: EMAIL_RESPONSAVEL_PADRAO,
        quem: usuario || 'Controladoria',
        prazo,
        arquivos: resultados.map((r) => ({
          arquivo: r.arquivo,
          novas: r.novas,
          duplicadas: r.duplicadas,
        })),
      })
    } catch (falha) {
      setEstado({
        situacao: 'erro',
        mensagem: falha instanceof PlanilhaInvalida ? falha.message : descreverErro(falha),
      })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="space-y-6">
      <Painel
        titulo="Importar planilhas"
        descricao={`Cada linha vira uma tarefa com prazo de ${PRAZO_DIAS_UTEIS} dias úteis a partir de hoje. Você pode enviar as duas planilhas de uma vez.`}
      >
        {!podeImportar && (
          <p
            className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm"
            style={{ color: CORES.atencao }}
          >
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            Importar planilha é restrito a administradores. Você pode acompanhar e responder as
            tarefas na matriz.
          </p>
        )}

        <div className="space-y-5">
          <div>
            <label
              htmlFor="planilhas"
              className={`flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
                podeImportar
                  ? 'cursor-pointer border-slate-300 bg-slate-50 hover:border-[#0f88a8] hover:bg-[#0f88a8]/5'
                  : 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-50'
              }`}
            >
              <Upload size={26} className="text-[#0f88a8]" />
              <span className="text-sm font-bold text-[#063955]">
                Clique para escolher os arquivos .xlsx
              </span>
              <span className="max-w-md text-xs text-slate-500 leading-relaxed">
                O tipo de planilha é reconhecido pelos cabeçalhos, não pelo nome do arquivo — pode
                renomear à vontade na exportação do Sênior.
              </span>
            </label>

            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <span className="text-xs text-slate-500 leading-relaxed">
                Deu erro de estrutura? Baixe o modelo, cole os dados nele e envie — os cabeçalhos já
                vêm exatamente como a importação espera.
              </span>

              <div className="ml-auto flex flex-wrap gap-2">
                {LAYOUTS.map((layout) => (
                  <button
                    key={layout.origem}
                    type="button"
                    onClick={() => baixarModelo(layout.origem)}
                    className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:border-[#0f88a8] hover:text-[#0f88a8]"
                  >
                    <Download size={13} />
                    Modelo {layout.rotulo}
                  </button>
                ))}
              </div>
            </div>

            <input
              ref={entrada}
              id="planilhas"
              type="file"
              multiple
              disabled={!podeImportar}
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              onChange={(e) => setArquivos(Array.from(e.target.files ?? []))}
            />

            {arquivos.length > 0 && (
              <ul className="mt-3 space-y-2">
                {arquivos.map((a) => (
                  <li
                    key={a.name}
                    className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                  >
                    <FileSpreadsheet size={16} className="shrink-0 text-[#0f88a8]" />
                    <span className="truncate">{a.name}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={importar}
              disabled={enviando || arquivos.length === 0 || !podeImportar}
              className="inline-flex items-center gap-2 rounded-xl bg-[#0f88a8] px-5 py-2.5 text-sm font-bold text-white transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {enviando ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Lendo planilhas…
                </>
              ) : (
                <>
                  <Upload size={16} />
                  Gerar tarefas
                </>
              )}
            </button>

            {arquivos.length > 0 && !enviando && (
              <button
                type="button"
                onClick={() => {
                  setArquivos([])
                  if (entrada.current) entrada.current.value = ''
                }}
                className="text-sm text-slate-500 hover:text-[#063955] transition-colors"
              >
                Limpar seleção
              </button>
            )}
          </div>
        </div>
      </Painel>

      {estado.situacao === 'erro' && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border bg-white p-5"
          style={{ borderColor: CORES.critico }}
        >
          <AlertCircle size={20} className="mt-0.5 shrink-0" style={{ color: CORES.critico }} />
          <div>
            <p className="font-bold" style={{ color: CORES.critico }}>
              Importação não concluída
            </p>
            <p className="mt-1 text-sm text-slate-600 leading-relaxed">{estado.mensagem}</p>
          </div>
        </div>
      )}

      {estado.situacao === 'sucesso' && (
        <Painel
          titulo="Importação concluída"
          acao={
            <Link
              href="/validacao-fiscal/matriz"
              className="rounded-xl border border-[#0f88a8] px-4 py-2 text-sm font-bold text-[#0f88a8] transition-colors hover:bg-[#0f88a8] hover:text-white"
            >
              Abrir matriz
            </Link>
          }
        >
          <ul className="space-y-3">
            {estado.resultados.map((r) => (
              <li key={r.loteId} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <CheckCircle2 size={16} style={{ color: CORES.bom }} />
                  <span className="font-bold text-[#063955]">{r.arquivo}</span>
                  <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] uppercase tracking-wider text-slate-500">
                    {ROTULO_ORIGEM[r.origem]}
                  </span>
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { rotulo: 'Linhas lidas', valor: String(r.total) },
                    { rotulo: 'Tarefas novas', valor: String(r.novas) },
                    { rotulo: 'Já existiam', valor: String(r.duplicadas) },
                    { rotulo: 'Prazo', valor: formatarData(r.prazo) },
                  ].map((item) => (
                    <div key={item.rotulo}>
                      <dt className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                        {item.rotulo}
                      </dt>
                      <dd className="mt-1 text-lg font-bold tabular-nums text-[#063955]">
                        {item.valor}
                      </dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>

          {estado.resultados[0].responsavelPadrao ? (
            <p className="mt-4 text-sm text-slate-600 leading-relaxed">
              As tarefas novas ficaram com <strong>{estado.resultados[0].responsavelPadrao}</strong>,
              que também recebeu o aviso por e-mail. A atribuição pode ser trocada linha a linha na
              matriz.
            </p>
          ) : (
            <p
              className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm"
              style={{ color: CORES.atencao }}
            >
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              As tarefas ficaram sem responsável: não há ninguém com o e-mail{' '}
              {EMAIL_RESPONSAVEL_PADRAO} no cadastro de responsáveis. O e-mail de aviso foi enviado
              assim mesmo.
            </p>
          )}

          <p className="mt-4 text-xs text-slate-500 leading-relaxed">
            Linhas já importadas antes não viram tarefa de novo — status, responsável e observação
            preenchidos pelo time são preservados.
            {estado.ignoradas > 0 &&
              ` ${estado.ignoradas} linha(s) sem número de documento foram ignoradas (totais e rodapé).`}
          </p>
        </Painel>
      )}
    </div>
  )
}
