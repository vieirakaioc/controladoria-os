import { CORES } from '@/app/validacao-fiscal/_lib/cores'
import { formatarInteiro, formatarMoeda } from '@/app/validacao-fiscal/_lib/formato'
import { formatarData } from '@/app/validacao-fiscal/_lib/prazo'

import type { Resumo } from './resumo'

/**
 * Relatório visual do imobilizado, em HTML de e-mail.
 *
 * Mesmas regras do relatório da validação fiscal: cliente de e-mail não tem
 * flexbox, grid nem folha de estilo externa — é tabela com estilo inline e cor
 * em hex. Feio de escrever, mas é o que chega igual no Outlook e no Gmail.
 */

const LARGURA = 640
const TINTA = '#0f172a'
const TINTA_FRACA = '#64748b'
const BORDA = '#e2e8f0'

/** Azul da espera: o mesmo papel que o navy tem na matriz, longe do verde. */
const ESPERA = '#3b6e8f'

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
        `<th align="${i === colunas.length - 1 ? 'right' : 'left'}"
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
              `<td align="${i === linha.length - 1 ? 'right' : 'left'}"
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

export function montarRelatorio(params: { resumo: Resumo; hoje: string; link: string }): string {
  const { resumo, hoje, link } = params

  // Doze linhas: passando disso o e-mail deixa de ser alerta e vira relatório
  // que ninguém lê até o fim. O resto está no painel, e o botão leva até lá.
  const linhasCriticas = resumo.criticos.slice(0, 12).map(({ item, etapa }) => [
    `<strong>${item.numero}</strong>`,
    escapar(item.descricao || item.fornecedor || `Nota ${item.nfNumero}`),
    escapar(etapa.titulo),
    escapar(etapa.responsavelNome || 'Sem responsável'),
    `<span style="color:${CORES.critico};font-weight:700;">${formatarData(etapa.prazo)}</span>`,
  ])

  const comAtraso = (c: { abertas: number; atrasadas: number; rotulo: string }) => [
    escapar(c.rotulo),
    formatarInteiro(c.abertas),
    c.atrasadas > 0
      ? `<span style="color:${CORES.critico};font-weight:700;">${formatarInteiro(c.atrasadas)}</span>`
      : '0',
  ]

  const emDia = Math.max(
    resumo.emAndamento - resumo.atrasados - resumo.emEspera - resumo.venceHoje,
    0,
  )

  return `
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f8fafc;padding:24px 0;">
<tr><td align="center">
<table width="${LARGURA}" cellpadding="0" cellspacing="0" role="presentation" style="width:${LARGURA}px;max-width:100%;">

  <tr><td style="background:#063955;border-radius:12px;padding:20px 22px;">
    <div style="font:700 18px/1.3 Arial,sans-serif;color:#ffffff;">Imobilizado</div>
    <div style="font:400 12px/1.6 Arial,sans-serif;color:#9fc4d4;padding-top:4px;">
      Situação em ${formatarData(hoje)} · ${formatarInteiro(resumo.total)} itens no fluxo
    </div>
  </td></tr>

  <tr><td style="padding-top:14px;">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="table-layout:fixed;">
      <tr>
        ${cartao('Em andamento', formatarInteiro(resumo.emAndamento), '#063955', 'Itens com etapa aberta')}
        ${cartao(
          'Com etapa atrasada',
          formatarInteiro(resumo.atrasados),
          resumo.atrasados > 0 ? CORES.critico : CORES.bom,
          resumo.atrasados === 0 ? 'Nenhum fora do prazo' : 'Passaram do prazo da etapa',
        )}
        ${cartao('Vencem hoje', formatarInteiro(resumo.venceHoje), CORES.atencao, 'Último dia da etapa')}
      </tr>
      <tr>
        ${cartao(
          'Em espera',
          formatarInteiro(resumo.emEspera),
          ESPERA,
          'Aguardando aprovação — prazo suspenso',
        )}
        ${cartao(
          'Aging médio',
          `${formatarInteiro(resumo.agingMedio)} d`,
          '#063955',
          'Do cadastro até hoje, nos itens abertos',
        )}
        ${cartao(
          'Placas em aberto',
          formatarInteiro(resumo.placasAbertas),
          resumo.placasAbertas > 0 ? CORES.atencao : CORES.bom,
          resumo.placasAbertas > 0
            ? `Maior espera: ${resumo.maiorPlaca} dias desde o ATPV`
            : 'Nenhuma pendente desde o ATPV',
        )}
      </tr>
      <tr>
        ${cartao(
          'Valor em andamento',
          formatarMoeda(resumo.valorEmAndamento),
          '#063955',
          'Soma dos itens que ainda não foram finalizados',
          3,
        )}
      </tr>
    </table>
  </td></tr>

  ${titulo('Situação dos itens')}
  ${barra([
    { rotulo: 'Em dia', valor: emDia, cor: CORES.bom },
    { rotulo: 'Vencem hoje', valor: resumo.venceHoje, cor: CORES.atencao },
    { rotulo: 'Atrasados', valor: resumo.atrasados, cor: CORES.critico },
    { rotulo: 'Em espera', valor: resumo.emEspera, cor: ESPERA },
    { rotulo: 'Finalizados', valor: resumo.finalizados, cor: CORES.concluido },
  ])}

  ${titulo('Precisa de ação agora')}
  ${tabela(['Nº', 'Item', 'Etapa', 'Responsável', 'Prazo'], linhasCriticas)}

  ${titulo('Onde o processo está represado')}
  ${tabela(['Etapa', 'Em aberto', 'Atrasadas'], resumo.porEtapa.map(comAtraso))}

  ${titulo('Carga por responsável')}
  ${tabela(
    ['Responsável', 'Em aberto', 'Atrasadas'],
    resumo.porResponsavel.slice(0, 10).map(comAtraso),
  )}

  <tr><td align="center" style="padding:26px 0 8px 0;">
    <a href="${escapar(link)}"
       style="background:#0f88a8;color:#ffffff;font:700 13px/1 Arial,sans-serif;
              padding:13px 26px;border-radius:8px;text-decoration:none;display:inline-block;">
      Abrir a matriz do imobilizado
    </a>
  </td></tr>

  <tr><td align="center" style="padding-bottom:6px;">
    <div style="font:400 11px/1.6 Arial,sans-serif;color:#94a3b8;">
      Gerado pelo Portal da Controladoria · Etapas sem responsável:
      ${formatarInteiro(resumo.semResponsavel)}
    </div>
  </td></tr>

</table>
</td></tr>
</table>`
}
