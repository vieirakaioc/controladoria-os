-- =============================================================================
-- TaskManager v2 / Portal da Controladoria
-- VALIDAÇÃO FISCAL — tabelas, índices e RLS
-- =============================================================================
--
-- O QUE É:
--   O time de controladoria exporta dois relatórios do Sênior:
--     • relatorio_cte_divergencias  (XML x Sênior: ICMS / ISS Retido)
--     • SITUAÇÕES_LOGISTICA         (2 abas: Situações_Divergentes e
--                                    Autorizado_Cancelado)
--   Cada linha vira uma tarefa de correção fiscal com prazo de resposta de
--   3 dias úteis. A matriz em /validacao-fiscal mostra a linha da planilha
--   fielmente e o responsável dá o "ok" com uma observação.
--
-- POR QUE TABELAS PRÓPRIAS (e não `atividades` / `tarefas_diarias`):
--   Uma importação gera dezenas de itens e eles precisam carregar as colunas
--   originais da planilha. Jogar isso no Painel de Execução afogaria as rotinas
--   do mês e perderia o formato de matriz.
--
-- IDEMPOTENTE: pode rodar de novo sem dar erro.
-- =============================================================================


-- ─── 1. LOTES DE IMPORTAÇÃO ─────────────────────────────────────────────────
create table if not exists public.validacao_fiscal_lotes (
  id            uuid primary key default gen_random_uuid(),
  origem        text        not null,
  arquivo       text        not null,
  importado_por text,
  importado_em  timestamptz not null default now(),
  total_linhas  integer     not null default 0,
  novas         integer     not null default 0,
  duplicadas    integer     not null default 0,
  prazo         date        not null
);


-- ─── 2. TAREFAS DE CORREÇÃO ─────────────────────────────────────────────────
create table if not exists public.validacao_fiscal_tarefas (
  id                  uuid primary key default gen_random_uuid(),
  lote_id             uuid        references public.validacao_fiscal_lotes (id) on delete set null,
  origem              text        not null,
  aba                 text        not null default '',
  -- Chave natural da linha. É o que impede a reimportação semanal do mesmo
  -- relatório de duplicar tarefa ou apagar correção já respondida pelo time.
  chave               text        not null unique,
  documento           text        not null default '',
  tipo_divergencia    text        not null default '',
  emitente            text        not null default '',
  filial              text        not null default '',
  valor               numeric(18, 2),
  emissao             date,
  -- Linha original completa, para a matriz exibir a planilha fielmente.
  dados               jsonb       not null default '{}'::jsonb,
  -- concluida = corrigida; sem_correcao = conferida e já estava certa. Os dois
  -- encerram a tarefa, e separá-los mostra quanto do relatório era divergência
  -- de verdade.
  status              text        not null default 'pendente'
                        check (status in ('pendente', 'em_andamento', 'concluida', 'sem_correcao')),
  -- Por que está parada: com quem está, o que falta.
  motivo_andamento    text,
  -- bigint, não uuid: é o tipo de responsaveis.id neste banco.
  responsavel_id      bigint      references public.responsaveis (id) on delete set null,
  responsavel_nome    text,
  observacao_correcao text,
  prazo               date        not null,
  concluido_em        timestamptz,
  concluido_por       text,
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now()
);

-- ─── 2.1 Ajustes em banco já criado ─────────────────────────────────────────
-- "create table if not exists" não altera tabela existente, então quem rodou a
-- versão anterior deste arquivo precisa destes dois passos. Ambos são
-- idempotentes: rodar em banco novo não faz nada.

alter table public.validacao_fiscal_tarefas
  add column if not exists motivo_andamento text;

-- ─── Número da atividade ────────────────────────────────────────────────────
-- Identidade estável e citável ("resolve a 47"). Vem de uma sequência, não da
-- posição na tela: a ordem muda com filtro e com o que já foi respondido.
--
-- Reimportar não mexe no número de quem já existe — a gravação só insere as
-- chaves novas. O índice único é a garantia de que dois lugares diferentes do
-- código nunca vão produzir o mesmo número.

alter table public.validacao_fiscal_tarefas
  add column if not exists numero bigint;

create sequence if not exists public.validacao_fiscal_tarefas_numero_seq
  owned by public.validacao_fiscal_tarefas.numero;

alter table public.validacao_fiscal_tarefas
  alter column numero set default nextval('public.validacao_fiscal_tarefas_numero_seq');

-- Numera o que já existe, na ordem em que foi criado, começando depois do
-- maior número já usado (se o script rodar duas vezes, não colide).
update public.validacao_fiscal_tarefas alvo
   set numero = base.maior + ordenadas.posicao
  from (select coalesce(max(numero), 0) as maior from public.validacao_fiscal_tarefas) base,
       (select id, row_number() over (order by criado_em, id) as posicao
          from public.validacao_fiscal_tarefas
         where numero is null) ordenadas
 where alvo.id = ordenadas.id
   and alvo.numero is null;

-- Dentro de um bloco para o script não terminar cuspindo o número da
-- sequência como se fosse resultado — parece erro e não é.
do $$
begin
  perform setval(
    'public.validacao_fiscal_tarefas_numero_seq',
    coalesce((select max(numero) from public.validacao_fiscal_tarefas), 0) + 1,
    false
  );
end $$;

create unique index if not exists vf_tarefas_numero_idx
  on public.validacao_fiscal_tarefas (numero);

alter table public.validacao_fiscal_tarefas
  alter column numero set not null;

alter table public.validacao_fiscal_tarefas
  drop constraint if exists validacao_fiscal_tarefas_status_check;

alter table public.validacao_fiscal_tarefas
  add constraint validacao_fiscal_tarefas_status_check
  check (status in ('pendente', 'em_andamento', 'concluida', 'sem_correcao'));


-- ─── Fluxo do documento ─────────────────────────────────────────────────────
-- entrada = nota recebida (escrita fiscal); saida = documento emitido.
--
-- Não é um detalhe estético: o fluxo decide quem fica responsável pela tarefa
-- e para qual lista o resumo diário vai. Misturar os dois faria a controladoria
-- de entrada cobrar nota de saída e vice-versa.
alter table public.validacao_fiscal_tarefas
  add column if not exists fluxo text not null default '';

-- Retroativo: o que veio das planilhas de nota de entrada é entrada; o resto
-- do que já está gravado é saída.
update public.validacao_fiscal_tarefas
   set fluxo = case when origem = 'notas_entrada' then 'entrada' else 'saida' end
 where fluxo = '';

create index if not exists vf_tarefas_fluxo_idx on public.validacao_fiscal_tarefas (fluxo);


create index if not exists vf_tarefas_status_idx      on public.validacao_fiscal_tarefas (status);
create index if not exists vf_tarefas_prazo_idx       on public.validacao_fiscal_tarefas (prazo);
create index if not exists vf_tarefas_origem_idx      on public.validacao_fiscal_tarefas (origem, aba);
create index if not exists vf_tarefas_responsavel_idx on public.validacao_fiscal_tarefas (responsavel_id);
create index if not exists vf_tarefas_lote_idx        on public.validacao_fiscal_tarefas (lote_id);


-- ─── 2.2 CONTROLE DO RESUMO DIÁRIO ──────────────────────────────────────────
-- Uma linha por dia em que o resumo já foi enviado.
--
-- A trava precisa ser compartilhada: o disparo acontece no navegador de quem
-- abre o app, e o e-mail vai para a equipe inteira. Com trava em localStorage,
-- três pessoas abrindo de manhã mandariam três cópias para todo mundo. A
-- chave primária na data resolve — o segundo insert do dia falha, e quem
-- falhou simplesmente não envia.
create table if not exists public.validacao_fiscal_envios (
  data           date        not null,
  -- 'entrada' ou 'saida': são dois resumos por dia, para listas diferentes,
  -- e cada um precisa da sua própria reserva.
  escopo         text        not null default 'saida',
  enviado_em     timestamptz not null default now(),
  enviado_por    text,
  destinatarios  text,
  primary key (data, escopo)
);

-- Quem rodou a versão anterior tem a tabela com chave só na data.
alter table public.validacao_fiscal_envios
  add column if not exists escopo text not null default 'saida';

do $$
begin
  if exists (
    select 1 from pg_constraint
     where conname = 'validacao_fiscal_envios_pkey'
       and (select count(*) from unnest(conkey)) = 1
  ) then
    alter table public.validacao_fiscal_envios drop constraint validacao_fiscal_envios_pkey;
    alter table public.validacao_fiscal_envios add primary key (data, escopo);
  end if;
end $$;

alter table public.validacao_fiscal_envios enable row level security;

drop policy if exists "vf_envios_select" on public.validacao_fiscal_envios;
create policy "vf_envios_select"
  on public.validacao_fiscal_envios for select
  to authenticated
  using (true);

-- Insert liberado: é o que reserva o dia. Delete também, porque quem reservou
-- e não conseguiu enviar precisa liberar para a próxima pessoa tentar.
drop policy if exists "vf_envios_insert" on public.validacao_fiscal_envios;
create policy "vf_envios_insert"
  on public.validacao_fiscal_envios for insert
  to authenticated
  with check (true);

drop policy if exists "vf_envios_delete" on public.validacao_fiscal_envios;
create policy "vf_envios_delete"
  on public.validacao_fiscal_envios for delete
  to authenticated
  using (true);


-- ─── 3. atualizado_em automático ────────────────────────────────────────────
create or replace function public.vf_touch_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

drop trigger if exists vf_tarefas_touch on public.validacao_fiscal_tarefas;
create trigger vf_tarefas_touch
  before update on public.validacao_fiscal_tarefas
  for each row execute function public.vf_touch_atualizado_em();


-- ─── 4. RLS ─────────────────────────────────────────────────────────────────
-- Depende de public.current_user_is_admin() (criada em rls-reset-v2.sql).
--
-- Regra: qualquer pessoa logada LÊ, RESPONDE, EDITA e APAGA uma tarefa — o
-- acompanhamento é do time inteiro. Só admin IMPORTA planilha e apaga um lote
-- inteiro, que são as ações que mexem em dezenas de itens de uma vez.

alter table public.validacao_fiscal_lotes   enable row level security;
alter table public.validacao_fiscal_tarefas enable row level security;

-- Lotes: leitura para autenticados, escrita só admin.
drop policy if exists "vf_lotes_select" on public.validacao_fiscal_lotes;
create policy "vf_lotes_select"
  on public.validacao_fiscal_lotes for select
  to authenticated
  using (true);

-- Registrar a importação: qualquer autenticado. O insert cria o lote e o
-- update grava o placar (novas / já existiam) logo depois.
drop policy if exists "vf_lotes_write_admin" on public.validacao_fiscal_lotes;
drop policy if exists "vf_lotes_insert" on public.validacao_fiscal_lotes;
create policy "vf_lotes_insert"
  on public.validacao_fiscal_lotes for insert
  to authenticated
  with check (true);

drop policy if exists "vf_lotes_update" on public.validacao_fiscal_lotes;
create policy "vf_lotes_update"
  on public.validacao_fiscal_lotes for update
  to authenticated
  using (true)
  with check (true);

-- Apagar um lote continua sendo do admin: leva junto dezenas de tarefas e as
-- respostas que o time já tinha dado nelas.
drop policy if exists "vf_lotes_delete_admin" on public.validacao_fiscal_lotes;
create policy "vf_lotes_delete_admin"
  on public.validacao_fiscal_lotes for delete
  to authenticated
  using (public.current_user_is_admin());

-- Tarefas: leitura para qualquer autenticado.
drop policy if exists "vf_tarefas_select" on public.validacao_fiscal_tarefas;
create policy "vf_tarefas_select"
  on public.validacao_fiscal_tarefas for select
  to authenticated
  using (true);

-- Criação (importação): só admin.
drop policy if exists "vf_tarefas_insert_admin" on public.validacao_fiscal_tarefas;
drop policy if exists "vf_tarefas_insert" on public.validacao_fiscal_tarefas;
create policy "vf_tarefas_insert"
  on public.validacao_fiscal_tarefas for insert
  to authenticated
  with check (true);

-- Resposta e edição: qualquer autenticado.
drop policy if exists "vf_tarefas_update" on public.validacao_fiscal_tarefas;
create policy "vf_tarefas_update"
  on public.validacao_fiscal_tarefas for update
  to authenticated
  using (true)
  with check (true);

-- Exclusão de uma tarefa: liberada. Apagar um lote inteiro continua sendo do
-- admin — quem apaga uma linha errada perde uma; quem apaga um lote perde
-- dezenas de respostas do time.
drop policy if exists "vf_tarefas_delete_admin" on public.validacao_fiscal_tarefas;
drop policy if exists "vf_tarefas_delete" on public.validacao_fiscal_tarefas;
create policy "vf_tarefas_delete"
  on public.validacao_fiscal_tarefas for delete
  to authenticated
  using (true);

-- A restrição por e-mail deixou de existir; a função sai junto para não ficar
-- um helper órfão sugerindo uma regra que não vale mais.
drop function if exists public.vf_pode_ver();


-- ─── 5. Sanity check ────────────────────────────────────────────────────────
-- select policyname, cmd from pg_policies
--  where schemaname = 'public'
--    and tablename in ('validacao_fiscal_lotes', 'validacao_fiscal_tarefas')
--  order by tablename, policyname;
