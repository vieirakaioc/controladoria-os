'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'

import { useAuthGate } from '@/app/tarefas/_hooks/useAuthGate'

import {
  AvisoErro,
  BarraDistribuicao,
  Carregando,
  Kpi,
  ListaBarras,
  Painel,
  type ItemBarra,
} from './_components/Ui'
import { useValidacaoFiscal } from './_hooks/useValidacaoFiscal'
import { CORES } from './_lib/cores'
import { formatarInteiro, formatarMoeda } from './_lib/formato'
import { PRAZO_DIAS_UTEIS, hoje } from './_lib/prazo'
import { calcularResumo } from './_lib/resumo'

export default function PaginaDashboard() {
  const { userName, userEmail } = useAuthGate()
  const { tarefas, carregando, erro } = useValidacaoFiscal({ email: userEmail, nome: userName })
  const referencia = hoje()

  const resumo = useMemo(() => calcularResumo(tarefas, referencia), [tarefas, referencia])

  if (erro) return <AvisoErro mensagem={erro} />
  if (carregando) return <Carregando linhas={4} />

  if (resumo.total === 0) {
    return (
      <Painel titulo="Nenhuma tarefa ainda">
        <p className="text-sm text-slate-600 leading-relaxed">
          Importe o relatório de divergências CT-e e a planilha de situações da logística para gerar
          as tarefas de correção.
        </p>
        <Link
          href="/validacao-fiscal/importar"
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#0f88a8] px-5 py-2.5 text-sm font-bold text-white transition-all hover:brightness-110"
        >
          Importar planilhas
          <ArrowUpRight size={16} />
        </Link>
      </Painel>
    )
  }

  const porTipo: ItemBarra[] = resumo.porTipo.map((c) => ({
    rotulo: c.rotulo,
    valor: c.total,
    nota: c.pendentes > 0 ? `${c.pendentes} em aberto` : 'tudo respondido',
  }))

  const porResponsavel: ItemBarra[] = resumo.porResponsavel
    .filter((c) => c.pendentes > 0)
    .map((c) => ({
      rotulo: c.rotulo,
      valor: c.pendentes,
      nota: c.atrasadas > 0 ? `${c.atrasadas} atrasada(s)` : undefined,
    }))

  const porOrigem: ItemBarra[] = resumo.porOrigem.map((c) => ({
    rotulo: c.rotulo,
    valor: c.total,
    nota: `${c.pendentes} em aberto`,
  }))

  const porEmitente: ItemBarra[] = resumo.porEmitente.map((c) => ({
    rotulo: c.rotulo,
    valor: c.total,
    nota: c.atrasadas > 0 ? `${c.atrasadas} atrasada(s)` : undefined,
  }))

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(250px,0.85fr)_2fr]">
        <Painel className="flex flex-col justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
              Correções em aberto
            </p>
            {/* Figura principal do painel — uma só por tela. */}
            <p className="mt-3 text-6xl font-bold leading-none text-[#063955]">
              {formatarInteiro(resumo.emAberto)}
            </p>
            <p className="mt-3 text-sm text-slate-500 leading-relaxed">
              de {formatarInteiro(resumo.total)} tarefas geradas · prazo de {PRAZO_DIAS_UTEIS} dias
              úteis por importação
            </p>
          </div>

          <Link
            href="/validacao-fiscal/matriz"
            className="mt-6 inline-flex items-center gap-2 self-start rounded-xl border border-[#0f88a8] px-4 py-2 text-sm font-bold text-[#0f88a8] transition-colors hover:bg-[#0f88a8] hover:text-white"
          >
            Abrir matriz
            <ArrowUpRight size={16} />
          </Link>
        </Painel>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Kpi
            rotulo="Atrasadas"
            valor={formatarInteiro(resumo.atrasadas)}
            tom={resumo.atrasadas > 0 ? 'critico' : 'neutro'}
            detalhe="Passaram do prazo sem resposta"
          />
          <Kpi
            rotulo="Vencem hoje"
            valor={formatarInteiro(resumo.venceHoje)}
            tom={resumo.venceHoje > 0 ? 'atencao' : 'neutro'}
            detalhe="Último dia para responder"
          />
          <Kpi
            rotulo="Corrigidas"
            valor={formatarInteiro(resumo.corrigidas)}
            tom="bom"
            detalhe={
              resumo.concluidasComAtraso > 0
                ? `${resumo.concluidasComAtraso} encerrada(s) fora do prazo`
                : 'Todas dentro do prazo'
            }
          />
          <Kpi
            rotulo="Sem correção"
            valor={formatarInteiro(resumo.semCorrecao)}
            detalhe="Conferidas e já estavam certas"
          />
          <Kpi
            rotulo="Em andamento"
            valor={formatarInteiro(resumo.emAndamento)}
            tom={resumo.emAndamento > 0 ? 'atencao' : 'neutro'}
            detalhe="Paradas com motivo registrado"
          />
          <Kpi
            rotulo="Valor em aberto"
            valor={formatarMoeda(resumo.valorPendente)}
            detalhe="Soma dos documentos pendentes"
          />
          <Kpi
            rotulo="Tempo médio de resposta"
            valor={
              resumo.mediaDiasResposta === null ? '—' : `${resumo.mediaDiasResposta.toFixed(1)} d`
            }
            detalhe="Da importação até a conclusão"
          />
        </div>
      </div>

      <Painel
        titulo="Situação do prazo"
        descricao="Como as tarefas geradas estão distribuídas em relação ao prazo de resposta."
      >
        <BarraDistribuicao
          segmentos={[
            { rotulo: 'Encerradas', valor: resumo.concluidas, cor: CORES.concluido },
            { rotulo: 'No prazo', valor: resumo.noPrazo, cor: CORES.bom },
            { rotulo: 'Vencem hoje', valor: resumo.venceHoje, cor: CORES.atencao },
            { rotulo: 'Atrasadas', valor: resumo.atrasadas, cor: CORES.critico },
          ]}
        />
      </Painel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Painel titulo="Tipo de divergência" descricao="Total de tarefas por motivo da correção.">
          <ListaBarras itens={porTipo} />
        </Painel>

        <Painel titulo="Carga por responsável" descricao="Tarefas em aberto atribuídas a cada pessoa.">
          <ListaBarras itens={porResponsavel} vazio="Nenhuma tarefa em aberto atribuída." />
        </Painel>

        <Painel titulo="Origem" descricao="Total de tarefas por planilha e aba.">
          <ListaBarras itens={porOrigem} />
        </Painel>

        <Painel titulo="Emitente" descricao="Total de tarefas por emitente do documento.">
          <ListaBarras itens={porEmitente} />
        </Painel>
      </div>
    </div>
  )
}
