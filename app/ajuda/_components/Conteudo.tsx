'use client'

import {
  AlertTriangle, Briefcase, CheckSquare, Download, Info, Key, LayoutDashboard,
  Play, Shield, Sparkles, Upload, Users, BarChart3,
} from 'lucide-react'
import Link from 'next/link'
import { Section } from './Section'

/**
 * Todo o texto do manual em PT-BR. Manter aqui pra facilitar editar/atualizar.
 * Cada <Section id="..."> bate com o id em sections.ts (usado pelo TOC).
 */
export function Conteudo() {
  return (
    <div className="flex-1 min-w-0">

      {/* 1. VISÃO GERAL */}
      <Section id="visao-geral" title="Visão Geral" subtitle="O que o Portal da Controladoria faz e quando usar cada coisa.">
        <p>
          O Portal é um sistema de <strong>gestão de tarefas recorrentes</strong> da Controladoria. Ele transforma
          uma lista de <em>rotinas-mãe</em> (definida no Excel) num cronograma diário automático que gera
          cartões no Kanban com data de vencimento, respeitando dias úteis e feriados.
        </p>
        <p>Em resumo, todo mês o admin faz três coisas:</p>
        <ol>
          <li><strong>Importa</strong> a planilha de atividades (se houve mudança nas rotinas).</li>
          <li><strong>Executa a Sincronização</strong> do mês alvo.</li>
          <li><strong>Acompanha</strong> a execução pela aba Tarefas, Dashboard e Monitor da Equipe.</li>
        </ol>
        <p>
          Os colaboradores recebem notificações no app e por e-mail, podem comentar, anexar evidências,
          e fechar tarefas no Kanban — tudo é registrado em auditoria.
        </p>
      </Section>

      {/* 2. GLOSSÁRIO */}
      <Section id="glossario" title="Glossário" subtitle="Quatro conceitos pra ler o app com clareza.">
        <div className="not-prose grid sm:grid-cols-2 gap-3 my-4">
          <ConceitoCard
            icone={<LayoutDashboard size={18} />}
            termo="Atividade"
            desc="A regra-mãe (rotina). Define O QUE precisa ser feito, COM QUE FREQUÊNCIA, e QUEM responde. Ex: 'Fechamento de Caixa - Diário'."
          />
          <ConceitoCard
            icone={<CheckSquare size={18} />}
            termo="Tarefa Diária"
            desc="Uma OCORRÊNCIA da atividade. Cada cartão no Kanban é uma tarefa diária com data de vencimento. Ex: 'Fechamento de Caixa - 12/05/2026'."
          />
          <ConceitoCard
            icone={<Briefcase size={18} />}
            termo="Planner"
            desc="Agrupamento das atividades por departamento/área (Fiscal, Contábil, RH...). Permite ter workflows de status diferentes por planner."
          />
          <ConceitoCard
            icone={<Sparkles size={18} />}
            termo="Ad Hoc"
            desc="Tarefa pontual, criada por dentro do app (não vem da planilha). Útil pra demandas extraordinárias que não viram rotina."
          />
        </div>
      </Section>

      {/* 3. IMPORTAÇÃO */}
      <Section
        id="importacao"
        title="Importar Atividades"
        subtitle="Como subir a base de rotinas via Excel — esse é o fluxo principal."
      >
        <h3 className="text-base font-bold text-[#063955] dark:text-white">
          📌 Recomendação: <em>sempre</em> exporta antes de importar
        </h3>
        <p>
          Vai em <strong>Início (Sincronizar)</strong> e clica em <Inline icon={<Download size={14} />}>Exportar</Inline>.
          O arquivo gerado já vem com a estrutura certinha — duas abas, todas as colunas, dados atuais. Use ele como modelo:
          edita o que precisar, salva, e importa de volta com <Inline icon={<Upload size={14} />}>Importar Excel</Inline>.
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 italic">
          ⚠️ Se você criar uma planilha do zero, vai dar erro "Aba ListBox não encontrada".
          A planilha precisa de duas abas: <code>Lista</code> e <code>ListBox</code>.
        </p>

        <h3 className="text-base font-bold text-[#063955] dark:text-white mt-6">Aba <code>Lista</code> — as atividades</h3>
        <p>Cada linha é uma rotina. Colunas:</p>
        <div className="not-prose my-4 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <tr><th className="text-left p-2 border border-slate-200 dark:border-slate-700">Coluna</th><th className="text-left p-2 border border-slate-200 dark:border-slate-700">Obrigatório</th><th className="text-left p-2 border border-slate-200 dark:border-slate-700">O que é</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200">
              <Coluna nome="Task_ID" obrig="Recomendado" desc='ID único da atividade. Se omitir, o sistema gera um. Mantenha o ID se for ATUALIZAR uma atividade existente.' />
              <Coluna nome="Planner Name" obrig="Sim" desc="Departamento/área. Ex: Fiscal, Contábil." />
              <Coluna nome="Setor" obrig="Sim" desc="Setor responsável (precisa existir na ListBox)." />
              <Coluna nome="Atividade" obrig="Sim" desc="Nome descritivo da rotina. Ex: 'Apuração de ICMS'." />
              <Coluna nome="Responsável" obrig="Sim" desc="Nome da pessoa (deve existir na ListBox com e-mail correspondente)." />
              <Coluna nome="Prioridade" obrig="Não" desc="Nível numérico (1=Alta, 2=Média, 3=Baixa)." />
              <Coluna nome="Prioridade_Descrição" obrig="Não" desc="Descrição da prioridade (Alta/Média/Baixa)." />
              <Coluna nome="Frequencia" obrig="Sim" desc="Diária, Semanal, Decendial, Mensal, Bimestral, Trimestral, Semestral, Anual, Ad Hoc." />
              <Coluna nome="Classificação" obrig="Não" desc="Tag adicional (ex: Fechamento, Apuração). Usa pra filtrar." />
              <Coluna nome="Dia Da Semana" obrig="Condicional" desc="Pra Semanal: dia da semana (Seg, Ter, Qua, Qui, Sex)." />
              <Coluna nome="Dia Útil" obrig="Condicional" desc="Pra Mensal/Trimestral/etc: o N-ésimo dia útil do mês. Ex: '5' = 5º dia útil." />
              <Coluna nome="Status" obrig="Não" desc='"Ativo" pra rotinas que devem gerar tarefas. Outros valores fazem a atividade existir mas não gerar.' />
            </tbody>
          </table>
        </div>

        <h3 className="text-base font-bold text-[#063955] dark:text-white mt-6">Aba <code>ListBox</code> — parâmetros</h3>
        <p>É a "memória" do sistema: dropdowns disponíveis na Lista. Colunas:</p>
        <ul>
          <li><strong>Setor</strong> — uma linha por setor.</li>
          <li><strong>Responsável</strong> + <strong>e-mail</strong> — uma linha por colaborador (e-mail é o login Supabase).</li>
          <li><strong>Prioridade</strong> + <strong>Prioridade_Descrição</strong> — níveis disponíveis (1=Alta, etc).</li>
          <li><strong>Frequencia</strong> — lista de frequências válidas.</li>
          <li><strong>Classificação</strong> — tags possíveis.</li>
          <li><strong>Feriado</strong> + <strong>Nome do Feriado</strong> — calendário de feriados (não geram tarefas nesses dias).</li>
        </ul>
        <Aviso>
          Cada coluna pode ter um número diferente de linhas — as células em branco são ignoradas.
          Ao importar, todos os <em>upserts</em> são feitos pela chave única (Setor → nome, Responsável → e-mail, etc.),
          então rodar o mesmo arquivo duas vezes não cria duplicatas.
        </Aviso>
      </Section>

      {/* 4. FREQUÊNCIAS */}
      <Section
        id="frequencias"
        title="Frequências & Cálculo de Prazos"
        subtitle="Como o sistema decide as datas de vencimento."
      >
        <div className="not-prose grid sm:grid-cols-2 gap-3 my-4">
          <FreqCard nome="Diária" regra="Todo dia útil do mês (segunda a sexta, exceto feriados)." />
          <FreqCard nome="Semanal" regra="No dia da semana definido em 'Dia Da Semana'. Se cair em feriado, vai pro próximo dia útil." />
          <FreqCard nome="Decendial" regra="3x por mês: dias 1, 11 e 21. Cada um cai pro próximo dia útil se feriado/fim-de-semana." badge="NOVO" />
          <FreqCard nome="Mensal" regra="No N-ésimo dia útil do mês definido em 'Dia Útil'." />
          <FreqCard nome="Bimestral" regra="Igual Mensal mas só nos meses pares (Jan/Mar/Mai/Jul/Set/Nov)." />
          <FreqCard nome="Trimestral" regra="Igual Mensal mas só Jan/Abr/Jul/Out." />
          <FreqCard nome="Semestral" regra="Igual Mensal mas só Janeiro e Julho." />
          <FreqCard nome="Anual" regra="Igual Mensal mas só em Janeiro." />
          <FreqCard nome="Ad Hoc" regra="Não gera automaticamente. Criada manualmente pelo botão '+ Nova Ad Hoc' em Tarefas." />
        </div>

        <h3 className="text-base font-bold text-[#063955] dark:text-white mt-6">🛡️ Proteção Anti-Atraso</h3>
        <p>
          Quando você executa a Sincronização do mês atual, o sistema <strong>não cria tarefas com data anterior a hoje</strong>.
          Isso evita que rotinas que cairiam dia 1, 2, 3... apareçam já em atraso quando você roda a sincronização no dia 15.
        </p>

        <h3 className="text-base font-bold text-[#063955] dark:text-white mt-6">🎄 Feriados</h3>
        <p>
          Os feriados vêm da ListBox (coluna <code>Feriado</code>). Qualquer regra que cair num feriado é
          empurrada pro próximo dia útil — exceto Diária, que simplesmente pula.
        </p>
      </Section>

      {/* 5. CICLO MENSAL */}
      <Section
        id="ciclo-mensal"
        title="Ciclo Mensal (Sincronização)"
        subtitle="O ritual de virar o mês — em 3 cliques."
      >
        <ol>
          <li>
            Acesse <Link href="/" className="text-[#0f88a8] dark:text-[#38bdf8] font-semibold">Início (Sincronizar)</Link>.
          </li>
          <li>Selecione o <strong>mês</strong> e <strong>ano</strong> alvo (default = mês atual).</li>
          <li>
            Clique em <Inline icon={<Play size={14} />}>Executar Sincronização Mensal</Inline>. O sistema lê
            todas as atividades ativas, calcula as datas de vencimento conforme a frequência, e cria os
            cartões no Kanban.
          </li>
        </ol>
        <Aviso>
          A sincronização é <strong>idempotente</strong>: pode rodar 2x, 10x, não cria duplicatas. Ela usa um
          <code> upsert on conflict(atividade_id, data_vencimento)</code> — se já existe, mantém o status atual.
        </Aviso>

        <h3 className="text-base font-bold text-[#063955] dark:text-white mt-6">Zona de Perigo</h3>
        <p>Na mesma página tem 3 botões destrutivos:</p>
        <ul>
          <li><strong>Limpar Ad Hocs</strong> — apaga todas as tarefas Ad Hoc.</li>
          <li><strong>Apagar por Responsável</strong> — apaga tudo de uma pessoa (Ad Hoc, Base, ou ambos).</li>
          <li><strong>Apagar Base Sincronizada</strong> — apaga as rotinas matrizes (não toca Ad Hoc).</li>
        </ul>
        <p className="text-xs text-slate-500 dark:text-slate-400 italic">
          Todas as exclusões fazem cascade: tarefas diárias → comentários → atividade matriz.
        </p>
      </Section>

      {/* 6. PÁGINAS */}
      <Section
        id="paginas"
        title="Páginas do Sistema"
        subtitle="Pra que serve cada item do menu lateral."
      >
        <div className="not-prose space-y-3 my-4">
          <PaginaItem icone={<LayoutDashboard size={18} />} titulo="Dashboard" admin={false}
            desc="KPIs e gráficos do período. Tem aba Resumo (limpa) e Detalhes (todos os 12 charts). Admin vê visão global; membro vê só as próprias tarefas." />
          <PaginaItem icone={<Briefcase size={18} />} titulo="Gestão de Projetos" admin={false}
            desc="Cria/lista projetos. Tarefas podem ser linkadas a um projeto (na criação Ad Hoc ou via drawer de detalhes)." />
          <PaginaItem icone={<CheckSquare size={18} />} titulo="Controle de Tarefas" admin={false}
            desc="O Kanban principal. 4 vistas: Lista, Status (por workflow), Dias (por bucket de tempo), Mês (calendário). Drag-and-drop pra mover status." />
          <PaginaItem icone={<Users size={18} />} titulo="Monitor da Equipe" admin={true}
            desc="Tabela com cada colaborador: último acesso, tarefas no mês, % conclusão, % no prazo, atrasadas, dias ativos, score 0-100. Topo tem pódio Top 3 e ranking visual." />
          <PaginaItem icone={<LayoutDashboard size={18} />} titulo="Início (Sincronizar)" admin={true}
            desc="Importação/exportação de Excel, execução da sincronização mensal, zona de perigo." />
          <PaginaItem icone={<Sparkles size={18} />} titulo="Workflows" admin={true}
            desc="Define statuses customizados por Planner. Ex: Planner 'Fiscal' pode ter [Pendente → Em Revisão → Validado → Concluído]." />
          <PaginaItem icone={<Key size={18} />} titulo="Gestão de Acessos" admin={true}
            desc="Lista todos os usuários cadastrados e permite promover/rebaixar entre 'membro' e 'admin'." />
          <PaginaItem icone={<Shield size={18} />} titulo="Auditoria" admin={true}
            desc="Trilha de exclusões e edições críticas. Export CSV." />
          <PaginaItem icone={<Info size={18} />} titulo="Meu Perfil" admin={false}
            desc="Edita nome, avatar, senha. Admin também consegue trocar a logo da empresa aqui." />
        </div>
      </Section>

      {/* 7. MONITOR & SCORE */}
      <Section
        id="monitor-score"
        title="Monitor da Equipe & Score 0-100"
        subtitle="Como o score é calculado e como interpretar."
      >
        <p>
          Cada colaborador recebe um <strong>score de desempenho de 0 a 100</strong>, calculado a partir
          de 4 dimensões com pesos configuráveis pelo admin:
        </p>
        <div className="not-prose grid sm:grid-cols-2 gap-3 my-4">
          <DimensaoCard nome="Conclusão" formula="concluídas / atribuídas" peso="default 60%" />
          <DimensaoCard nome="Pontualidade" formula="concluídas no prazo / concluídas" peso="default 20%" />
          <DimensaoCard nome="Aderência" formula="(atribuídas − atrasadas) / atribuídas" peso="default 10%" />
          <DimensaoCard nome="Uso do App" formula="dias úteis ativos / total no mês" peso="default 10%" />
        </div>

        <p className="text-sm">
          A soma dos 4 pesos sempre dá 100. Pra alterar: vai em
          <Link href="/equipe" className="text-[#0f88a8] dark:text-[#38bdf8] font-semibold"> Monitor da Equipe</Link>,
          abre o painel <strong>Configuração do Score</strong> no topo, mexe nos sliders, clica em
          <Inline icon={<BarChart3 size={14} />}>Normalizar pra 100</Inline> se precisar e salva.
        </p>

        <h3 className="text-base font-bold text-[#063955] dark:text-white mt-6">Faixas</h3>
        <ul>
          <li><strong className="text-emerald-600 dark:text-emerald-400">85+</strong> Excelente</li>
          <li><strong className="text-[#0f88a8] dark:text-[#38bdf8]">70-84</strong> Bom</li>
          <li><strong className="text-amber-700 dark:text-amber-400">50-69</strong> Regular</li>
          <li><strong className="text-[#b43a3d] dark:text-[#f87171]">0-49</strong> Atenção</li>
        </ul>

        <h3 className="text-base font-bold text-[#063955] dark:text-white mt-6">Bolinha de presença</h3>
        <ul>
          <li><span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse mr-1" /> &lt;1h → ativo agora</li>
          <li><span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 mr-1" /> hoje</li>
          <li><span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500 mr-1" /> última semana</li>
          <li><span className="inline-block w-2.5 h-2.5 rounded-full bg-[#b43a3d] mr-1" /> inativo há mais</li>
        </ul>
      </Section>

      {/* 8. PERMISSÕES */}
      <Section id="permissoes" title="Permissões" subtitle="Membro × Admin">
        <div className="not-prose overflow-x-auto my-4">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <tr>
                <th className="text-left p-2 border border-slate-200 dark:border-slate-700">Ação</th>
                <th className="text-center p-2 border border-slate-200 dark:border-slate-700">Membro</th>
                <th className="text-center p-2 border border-slate-200 dark:border-slate-700">Admin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200">
              <Permissao acao="Ver suas próprias tarefas no Kanban" m={true} a={true} />
              <Permissao acao="Concluir / atualizar status / comentar" m={true} a={true} />
              <Permissao acao="Criar tarefa Ad Hoc" m={true} a={true} />
              <Permissao acao="Ver TODAS as tarefas (visão global)" m={false} a={true} />
              <Permissao acao="Importar/exportar planilha" m={false} a={true} />
              <Permissao acao="Executar Sincronização Mensal" m={false} a={true} />
              <Permissao acao="Apagar atividades (zona de perigo)" m={false} a={true} />
              <Permissao acao="Acessar Monitor da Equipe" m={false} a={true} />
              <Permissao acao="Configurar workflows / acessos / auditoria" m={false} a={true} />
            </tbody>
          </table>
        </div>
      </Section>

      {/* 9. FAQ */}
      <Section id="faq" title="Perguntas Frequentes">
        <details className="border border-slate-100 dark:border-slate-800 rounded-xl p-4 mb-3 group">
          <summary className="font-semibold cursor-pointer text-[#063955] dark:text-white">
            Importei a planilha mas as tarefas não aparecem no Kanban.
          </summary>
          <p className="mt-3 text-sm">
            Importar a planilha só cadastra as <strong>atividades-mãe</strong>. Pra gerar os cartões do
            Kanban, você precisa rodar a <strong>Sincronização Mensal</strong> em Início → "Executar Sincronização".
          </p>
        </details>

        <details className="border border-slate-100 dark:border-slate-800 rounded-xl p-4 mb-3 group">
          <summary className="font-semibold cursor-pointer text-[#063955] dark:text-white">
            Erro "Aba ListBox não encontrada" ao importar.
          </summary>
          <p className="mt-3 text-sm">
            Sua planilha está sem a aba de parâmetros. Solução: vai em "Início" → clica em
            <Inline icon={<Download size={14} />}>Exportar</Inline>, edita esse arquivo (que já tem as
            duas abas certas), e importa de volta.
          </p>
        </details>

        <details className="border border-slate-100 dark:border-slate-800 rounded-xl p-4 mb-3 group">
          <summary className="font-semibold cursor-pointer text-[#063955] dark:text-white">
            Como adicionar uma frequência nova (ex: Quinzenal)?
          </summary>
          <p className="mt-3 text-sm">
            Hoje as frequências são fixas no código (<code>app/page.tsx</code>, função <code>calcularDatasVencimento</code>).
            Pra adicionar uma nova, precisa: 1) editar essa função pra calcular as datas, 2) adicionar
            o nome em <code>mesesParaFrequencia</code>, 3) adicionar o valor na ListBox da planilha.
          </p>
        </details>

        <details className="border border-slate-100 dark:border-slate-800 rounded-xl p-4 mb-3 group">
          <summary className="font-semibold cursor-pointer text-[#063955] dark:text-white">
            O "Dias ativos" do colaborador no Monitor está zerado.
          </summary>
          <p className="mt-3 text-sm">
            A tabela <code>user_activity</code> precisa estar criada no Supabase (rode
            <code> docs/user-activity-schema.sql</code>). O tracking começa a registrar a partir do
            momento em que a tabela existe.
          </p>
        </details>

        <details className="border border-slate-100 dark:border-slate-800 rounded-xl p-4 mb-3 group">
          <summary className="font-semibold cursor-pointer text-[#063955] dark:text-white">
            Como mudar quem é admin?
          </summary>
          <p className="mt-3 text-sm">
            Acessa <Link href="/acessos" className="text-[#0f88a8] dark:text-[#38bdf8] font-semibold">Gestão de Acessos</Link>
            {' '}(só admin atual vê), e troca o nível no select. Não dá pra mudar seu próprio nível.
          </p>
        </details>
      </Section>

    </div>
  )
}

// ─── Componentes auxiliares ─────────────────────────────────────────────────

function ConceitoCard({ icone, termo, desc }: { icone: React.ReactNode; termo: string; desc: string }) {
  return (
    <div className="p-4 border border-slate-100 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/50">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[#0f88a8] dark:text-[#38bdf8]">{icone}</span>
        <span className="font-bold text-[#063955] dark:text-white">{termo}</span>
      </div>
      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{desc}</p>
    </div>
  )
}

function Coluna({ nome, obrig, desc }: { nome: string; obrig: string; desc: string }) {
  const corObrig =
    obrig === 'Sim' ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300' :
    obrig === 'Não' ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300' :
    'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300'
  return (
    <tr>
      <td className="p-2 border border-slate-200 dark:border-slate-700 font-mono text-xs">{nome}</td>
      <td className="p-2 border border-slate-200 dark:border-slate-700"><span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${corObrig}`}>{obrig}</span></td>
      <td className="p-2 border border-slate-200 dark:border-slate-700 text-xs leading-relaxed">{desc}</td>
    </tr>
  )
}

function FreqCard({ nome, regra, badge }: { nome: string; regra: string; badge?: string }) {
  return (
    <div className="p-3 border border-slate-100 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900">
      <div className="flex items-center gap-2 mb-1">
        <span className="font-bold text-sm text-[#063955] dark:text-white">{nome}</span>
        {badge && (
          <span className="text-[9px] font-bold uppercase tracking-widest bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded">
            {badge}
          </span>
        )}
      </div>
      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{regra}</p>
    </div>
  )
}

function DimensaoCard({ nome, formula, peso }: { nome: string; formula: string; peso: string }) {
  return (
    <div className="p-3 border border-slate-100 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900">
      <div className="font-bold text-sm text-[#063955] dark:text-white">{nome}</div>
      <code className="text-[11px] text-slate-500 dark:text-slate-400 block mt-1">{formula}</code>
      <span className="text-[10px] uppercase font-bold tracking-wider text-[#C7A77B] mt-1.5 block">{peso}</span>
    </div>
  )
}

function PaginaItem({ icone, titulo, desc, admin }: { icone: React.ReactNode; titulo: string; desc: string; admin: boolean }) {
  return (
    <div className="flex items-start gap-3 p-3 border border-slate-100 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900">
      <div className="text-[#0f88a8] dark:text-[#38bdf8] mt-0.5">{icone}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm text-[#063955] dark:text-white">{titulo}</span>
          {admin && (
            <span className="text-[9px] font-bold uppercase tracking-widest bg-[#C7A77B]/20 text-[#C7A77B] px-1.5 py-0.5 rounded">
              Admin
            </span>
          )}
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mt-0.5">{desc}</p>
      </div>
    </div>
  )
}

function Permissao({ acao, m, a }: { acao: string; m: boolean; a: boolean }) {
  const Marker = ({ ok }: { ok: boolean }) =>
    ok
      ? <span className="text-emerald-600 dark:text-emerald-400 font-bold">✓</span>
      : <span className="text-slate-300 dark:text-slate-600">—</span>
  return (
    <tr>
      <td className="p-2 border border-slate-200 dark:border-slate-700 text-xs">{acao}</td>
      <td className="p-2 border border-slate-200 dark:border-slate-700 text-center"><Marker ok={m} /></td>
      <td className="p-2 border border-slate-200 dark:border-slate-700 text-center"><Marker ok={a} /></td>
    </tr>
  )
}

function Inline({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[12px] font-semibold text-slate-700 dark:text-slate-200 mx-0.5">
      {icon}{children}
    </span>
  )
}

function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-4 p-3 border-l-4 border-l-[#C7A77B] bg-[#C7A77B]/5 dark:bg-[#C7A77B]/10 rounded-r-xl text-sm text-slate-700 dark:text-slate-300 not-prose">
      <div className="flex items-start gap-2">
        <AlertTriangle size={16} className="text-[#C7A77B] mt-0.5 shrink-0" />
        <div>{children}</div>
      </div>
    </div>
  )
}
