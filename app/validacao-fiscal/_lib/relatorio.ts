import { CORES } from './cores'
import { formatarInteiro, formatarMoeda } from './formato'
import { formatarData, situacaoPrazo } from './prazo'
import type { Resumo } from './resumo'
import { estaFinalizada, type TarefaFiscal } from './types'

/**
 * Relatório visual do painel, em HTML de e-mail.
 *
 * Regras diferentes das da tela: cliente de e-mail não tem flexbox, grid nem
 * folha de estilo externa. Tudo aqui é tabela com estilo inline e cor em hex —
 * feio de escrever, mas é o que chega igual no Outlook e no Gmail.
 */

const LARGURA = 640
const TINTA = '#0f172a'
const TINTA_FRACA = '#64748b'
const BORDA = '#e2e8f0'

function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Um cartão de indicador.
 *
 * `colunas` existe porque todas as linhas dividem a mesma grade: um cartão
 * largo sem colspan redefine a largura da primeira coluna e esmaga as outras
 * duas nas linhas de cima.
 */
function cartao(
  rotulo: string,
  valor: string,
  cor: string,
  detalhe?: string,
  colunas = 1,
): string {
  return `
    <td colspan="${colunas}" width="${Math.round((colunas / 3) * 100)}%" valign="top" style="padding:6px;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
             style="border:1px solid ${BORDA};border-radius:10px;background:#ffffff;">
        <tr><td style="padding:12px 14px;">
          <div style="font:600 10px/1.4 Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:${TINTA_FRACA};">
            ${escapar(rotulo)}
          </div>
          <div style="font:700 26px/1.1 Arial,sans-serif;color:${cor};padding-top:6px;">${valor}</div>
          ${
            detalhe
              ? `<div style="font:400 11px/1.5 Arial,sans-serif;color:${TINTA_FRACA};padding-top:6px;">${escapar(detalhe)}</div>`
              : ''
          }
        </td></tr>
      </table>
    </td>`
}

function titulo(texto: string): string {
  return `
    <tr><td style="padding:22px 0 10px 0;">
      <div style="font:700 15px/1.3 Arial,sans-serif;color:#063955;">${escapar(texto)}</div>
    </td></tr>`
}

/** Barra de composição: uma linha de tabela com células proporcionais. */
function barra(segmentos: { rotulo: string; valor: number; cor: string }[]): string {
  const total = segmentos.reduce((soma, s) => soma + s.valor, 0)
  if (total === 0) return ''

  const faixas = segmentos
    .filter((s) => s.valor > 0)
    .map(
      (s) =>
        `<td width="${Math.round((s.valor / total) * 100)}%" height="12"
             style="background:${s.cor};font-size:0;line-height:0;">&nbsp;</td>`,
    )
    .join('<td width="2" style="font-size:0;line-height:0;">&nbsp;</td>')

  const legenda = segmentos
    .map(
      (s) =>
        `<span style="white-space:nowrap;padding-right:14px;">
           <span style="display:inline-block;width:9px;height:9px;background:${s.cor};border-radius:9px;"></span>
           <span style="font:400 12px/1.6 Arial,sans-serif;color:${TINTA_FRACA};"> ${escapar(s.rotulo)}</span>
           <strong style="font:700 12px/1.6 Arial,sans-serif;color:${TINTA};"> ${formatarInteiro(s.valor)}</strong>
         </span>`,
    )
    .join('')

  return `
    <tr><td>
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
             style="border-radius:6px;overflow:hidden;"><tr>${faixas}</tr></table>
      <div style="padding-top:10px;">${legenda}</div>
    </td></tr>`
}

function tabela(colunas: string[], linhas: string[][]): string {
  if (linhas.length === 0) {
    return `<tr><td style="font:400 12px/1.6 Arial,sans-serif;color:${TINTA_FRACA};">Nada a listar.</td></tr>`
  }

  const cabecalho = colunas
    .map(
      (c, i) =>
        `<th align="${i === 0 ? 'left' : i === colunas.length - 1 ? 'right' : 'left'}"
             style="font:700 10px/1.4 Arial,sans-serif;letter-spacing:.06em;text-transform:uppercase;
                    color:${TINTA_FRACA};padding:8px 10px;border-bottom:1px solid ${BORDA};">${escapar(c)}</th>`,
    )
    .join('')

  const corpo = linhas
    .map(
      (linha) =>
        `<tr>${linha
          .map(
            (celula, i) =>
              `<td align="${i === 0 ? 'left' : i === linha.length - 1 ? 'right' : 'left'}"
                   style="font:400 12px/1.5 Arial,sans-serif;color:${TINTA};padding:8px 10px;
                          border-bottom:1px solid #f1f5f9;">${celula}</td>`,
          )
          .join('')}</tr>`,
    )
    .join('')

  return `
    <tr><td>
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
             style="border:1px solid ${BORDA};border-radius:10px;background:#ffffff;">
        <tr>${cabecalho}</tr>
        ${corpo}
      </table>
    </td></tr>`
}

export function montarRelatorio(params: {
  resumo: Resumo
  tarefas: TarefaFiscal[]
  hoje: string
  link: string
  /** "Notas de entrada", "Notas de saída" — some quando o relatório é geral. */
  escopo?: string
}): string {
  const { resumo, tarefas, hoje, link, escopo } = params

  // As que mais pedem ação: atrasadas primeiro, prazo mais antigo no topo.
  const criticas = tarefas
    .filter((t) => !estaFinalizada(t.status) && t.prazo <= hoje)
    .sort((a, b) => (a.prazo === b.prazo ? a.numero - b.numero : a.prazo < b.prazo ? -1 : 1))
    .slice(0, 12)

  const linhasCriticas = criticas.map((t) => {
    const atrasada = situacaoPrazo(t.status, t.prazo, t.concluidoEm, hoje) === 'atrasada'
    const tocando = t.status === 'em_andamento'

    // Quem está atrasado precisa saber se alguém já pegou a tarefa dele: sem
    // isso, a lista parece só uma cobrança sem endereço.
    const situacao = tocando
      ? `<span style="color:${CORES.atencao};font-weight:700;">Em andamento</span>` +
        (t.motivoAndamento
          ? `<div style="font:400 11px/1.4 Arial,sans-serif;color:${TINTA_FRACA};padding-top:2px;">
               ${escapar(t.motivoAndamento)}</div>`
          : '')
      : `<span style="color:${TINTA_FRACA};">Ninguém pegou</span>`

    return [
      `<strong>${t.numero}</strong>`,
      escapar(t.documento || '—'),
      escapar(t.responsavelNome || 'Sem responsável'),
      situacao,
      `<span style="color:${atrasada ? CORES.critico : CORES.atencao};font-weight:700;">
         ${formatarData(t.prazo)}</span>`,
    ]
  })

  const porResponsavel = resumo.porResponsavel
    .filter((c) => c.pendentes > 0)
    .slice(0, 10)
    .map((c) => [
      escapar(c.rotulo),
      formatarInteiro(c.pendentes),
      c.atrasadas > 0
        ? `<span style="color:${CORES.critico};font-weight:700;">${formatarInteiro(c.atrasadas)}</span>`
        : '0',
    ])

  const porTipo = resumo.porTipo
    .slice(0, 8)
    .map((c) => [escapar(c.rotulo), formatarInteiro(c.total), formatarInteiro(c.pendentes)])

  return `
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f8fafc;padding:24px 0;">
<tr><td align="center">
<table width="${LARGURA}" cellpadding="0" cellspacing="0" role="presentation" style="width:${LARGURA}px;max-width:100%;">

  <tr><td style="background:#063955;border-radius:12px;padding:20px 22px;">
    <div style="font:700 18px/1.3 Arial,sans-serif;color:#ffffff;">
      Validação Fiscal${escopo ? ` · ${escapar(escopo)}` : ''}
    </div>
    <div style="font:400 12px/1.6 Arial,sans-serif;color:#9fc4d4;padding-top:4px;">
      Situação em ${formatarData(hoje)} · ${formatarInteiro(resumo.total)} tarefas geradas
    </div>
  </td></tr>

  <tr><td style="padding-top:14px;">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
           style="table-layout:fixed;">
      <tr>
        ${cartao('Em aberto', formatarInteiro(resumo.emAberto), '#063955', 'Aguardando resposta')}
        ${cartao(
          'Atrasadas',
          formatarInteiro(resumo.atrasadas),
          CORES.critico,
          resumo.atrasadas === 0
            ? 'Nenhuma fora do prazo'
            : `${formatarInteiro(resumo.emAndamentoAtrasadas)} com alguém tocando, ` +
              `${formatarInteiro(resumo.atrasadas - resumo.emAndamentoAtrasadas)} parada(s)`,
        )}
        ${cartao('Vencem hoje', formatarInteiro(resumo.venceHoje), CORES.atencao, 'Último dia')}
      </tr>
      <tr>
        ${cartao(
          'Em andamento',
          formatarInteiro(resumo.emAndamento),
          resumo.emAndamentoAtrasadas > 0 ? CORES.critico : CORES.atencao,
          resumo.emAndamento === 0
            ? 'Ninguém tocando nenhuma'
            : `${formatarInteiro(resumo.emAndamentoAtrasadas)} fora do prazo, ` +
              `${formatarInteiro(resumo.emAndamentoNoPrazo)} dentro`,
        )}
        ${cartao('Corrigidas', formatarInteiro(resumo.corrigidas), CORES.bom, 'Divergência resolvida')}
        ${cartao('Sem correção', formatarInteiro(resumo.semCorrecao), TINTA_FRACA, 'Já estavam certas')}
      </tr>
      <tr>
        ${cartao(
          'Valor em aberto',
          formatarMoeda(resumo.valorPendente),
          '#063955',
          'Soma dos documentos que ainda não foram respondidos',
          3,
        )}
      </tr>
    </table>
  </td></tr>

  ${titulo('Situação do prazo')}
  ${barra([
    { rotulo: 'Encerradas', valor: resumo.concluidas, cor: CORES.concluido },
    { rotulo: 'No prazo', valor: resumo.noPrazo, cor: CORES.bom },
    { rotulo: 'Vencem hoje', valor: resumo.venceHoje, cor: CORES.atencao },
    { rotulo: 'Atrasadas', valor: resumo.atrasadas, cor: CORES.critico },
  ])}

  ${titulo('Precisa de resposta agora')}
  ${tabela(['Nº', 'Documento', 'Responsável', 'Situação', 'Prazo'], linhasCriticas)}

  ${titulo('Carga por responsável')}
  ${tabela(['Responsável', 'Em aberto', 'Atrasadas'], porResponsavel)}

  ${titulo('Tipo de divergência')}
  ${tabela(['Tipo', 'Total', 'Em aberto'], porTipo)}

  <tr><td align="center" style="padding:26px 0 8px 0;">
    <a href="${escapar(link)}"
       style="background:#0f88a8;color:#ffffff;font:700 13px/1 Arial,sans-serif;
              padding:13px 26px;border-radius:8px;text-decoration:none;display:inline-block;">
      Abrir a matriz de correções
    </a>
  </td></tr>

  <tr><td align="center" style="padding-bottom:6px;">
    <div style="font:400 11px/1.6 Arial,sans-serif;color:#94a3b8;">
      Gerado pelo Portal da Controladoria · Sem responsável: ${formatarInteiro(resumo.semResponsavel)}
    </div>
  </td></tr>

</table>
</td></tr>
</table>`
}
