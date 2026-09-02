-- =============================================================================
-- TaskManager v2 / Portal da Controladoria
-- IMOBILIZADO — fluxo de patrimônio: tabelas, RLS e o desenho das etapas
-- =============================================================================
--
-- O QUE É:
--   Cada nota de patrimônio vira um item que percorre 8 etapas de trabalho e é
--   finalizado quando todas terminam. Duas etapas só existem quando o item é
--   frota, e o cadastro da placa corre em paralelo — não bloqueia o fluxo.
--
-- POR QUE AS ETAPAS SÃO DADO, E NÃO CÓDIGO:
--   Prazo, dono e obrigatoriedade de anexo mudam com o uso. Na Validação Fiscal
--   isso vive no código e cada ajuste vira deploy; aqui é uma linha de update.
--
-- IDEMPOTENTE: pode rodar de novo sem dar erro e sem apagar item nem anexo.
-- =============================================================================


-- ─── 0. EMPRESAS E FILIAIS ──────────────────────────────────────────────────
-- Cadastro de referência, não do módulo: o nome é `filiais` porque outros
-- lugares do portal vão precisar da mesma lista. Uma linha por filial, com o
-- código da empresa e o código da filial como eles aparecem no Sênior — é por
-- esses códigos que as planilhas chegam.
create table if not exists public.filiais (
  id          bigserial primary key,
  cod_empresa text        not null,
  empresa     text        not null,
  cod_filial  text        not null,
  filial      text        not null,
  cnpj        text,
  ativo       boolean     not null default true,
  criado_em   timestamptz not null default now(),
  unique (cod_empresa, cod_filial)
);

alter table public.filiais enable row level security;

-- Lista de referência: qualquer pessoa logada lê, porque vai virar seletor em
-- várias telas. Só admin mantém o cadastro.
drop policy if exists "filiais_select" on public.filiais;
create policy "filiais_select"
  on public.filiais for select
  to authenticated using (true);

drop policy if exists "filiais_write_admin" on public.filiais;
create policy "filiais_write_admin"
  on public.filiais for all
  to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());


-- ─── 0.1 AS FILIAIS DO GRUPO ────────────────────────────────────────────────
-- Cadastro do Sênior, importado da planilha de empresas. "do nothing" no
-- conflito: se alguém corrigir um nome pela tela, rodar o script de novo não
-- desfaz a correção.
insert into public.filiais (cod_empresa, empresa, cod_filial, filial) values
  ('1', 'COMBER LOGISTICA LTDA', '1', 'COMBER LOGISTICA RVD'),
  ('1', 'COMBER LOGISTICA LTDA', '2', 'COMBER LOGISTICA UDI'),
  ('1', 'COMBER LOGISTICA LTDA', '3', 'COMBER LOGISTICA TJL'),
  ('1', 'COMBER LOGISTICA LTDA', '4', 'COMBER LOGISTICA ALT ARAG'),
  ('1', 'COMBER LOGISTICA LTDA', '5', 'COMBER LOGISTICA CHP'),
  ('1', 'COMBER LOGISTICA LTDA', '6', 'COMBER LOGISTICA ROO'),
  ('1', 'COMBER LOGISTICA LTDA', '7', 'COMBER LOGISTICA LTDA'),
  ('1', 'COMBER LOGISTICA LTDA', '8', 'COMBER LOGISTICA CTD'),
  ('1', 'COMBER LOGISTICA LTDA', '9', 'COMBER LOGISTICA TO'),
  ('2', 'RODO SUINOS LTDA', '1', 'COMELLI E OLIVEIRA TRANSPORTES'),
  ('3', 'COMBER INDUSTRIA LTDA', '1', 'COMBER RVD'),
  ('4', 'DIP.LOG LTDA', '1', 'DIP.LOG'),
  ('5', 'COMBER BIOMASSA LTDA', '1', 'COMBER BIOMASSA RVD'),
  ('5', 'COMBER BIOMASSA LTDA', '2', 'COMBER BIOMASSA AGU'),
  ('5', 'COMBER BIOMASSA LTDA', '3', 'COMBER BIOMASSA MS'),
  ('5', 'COMBER BIOMASSA LTDA', '4', 'COMBER BIOMASSA MG'),
  ('5', 'COMBER BIOMASSA LTDA', '5', 'COMBER BIOMASSA SRA'),
  ('5', 'COMBER BIOMASSA LTDA', '6', 'COMBER BIOMASSA MS'),
  ('5', 'COMBER BIOMASSA LTDA', '7', 'COMBER BIOMASSA ITI'),
  ('5', 'COMBER BIOMASSA LTDA', '8', 'COMBER BIOMASSA TO'),
  ('5', 'COMBER BIOMASSA LTDA', '9', 'COMBER BIOMASSA MT'),
  ('5', 'COMBER BIOMASSA LTDA', '10', 'COMBER BIOMASSA FAZ STA VERGIN'),
  ('5', 'COMBER BIOMASSA LTDA', '11', 'COMBER BIOMASSA FAZ TARUMA'),
  ('5', 'COMBER BIOMASSA LTDA', '12', 'COMBER BIOMASSA SETE ESTRELAS'),
  ('5', 'COMBER BIOMASSA LTDA', '13', 'COMBER BIOMASSA BOA ESPERANÇA'),
  ('6', 'COMBER SEMINOVOS LTDA', '1', 'COMBER SEMINOVOS'),
  ('7', 'COMPANHIA BRASILEIRA DE ENERGIA RENOVÁVEL SA', '1', 'COMBER FLORESTAL RVD'),
  ('7', 'COMPANHIA BRASILEIRA DE ENERGIA RENOVÁVEL SA', '2', 'FAZENDA GRACIOSA'),
  ('7', 'COMPANHIA BRASILEIRA DE ENERGIA RENOVÁVEL SA', '3', 'FAZENDA ARUANDA'),
  ('7', 'COMPANHIA BRASILEIRA DE ENERGIA RENOVÁVEL SA', '4', 'FAZENDA AGUA BRANCA'),
  ('7', 'COMPANHIA BRASILEIRA DE ENERGIA RENOVÁVEL SA', '5', 'FAZENDA SANTO ANTONIO'),
  ('7', 'COMPANHIA BRASILEIRA DE ENERGIA RENOVÁVEL SA', '6', 'FAZENDA BURITI DO PRATA'),
  ('7', 'COMPANHIA BRASILEIRA DE ENERGIA RENOVÁVEL SA', '7', 'FAZENDA SANTA ANNA'),
  ('7', 'COMPANHIA BRASILEIRA DE ENERGIA RENOVÁVEL SA', '8', 'FAZENDA SANTA MAE'),
  ('8', 'COMBER CAMINHOES LTDA', '1', 'COMBER CAMINHOES'),
  ('9', 'IJC PARTICIPACOES LTDA', '1', 'IJC PARTICIPACOES'),
  ('10', 'COMBER FLORESTAL TO LTDA', '1', 'COMBER FLORESTAL TO'),
  ('10', 'COMBER FLORESTAL TO LTDA', '2', 'COMBER FLORESTAL TO'),
  ('10', 'COMBER FLORESTAL TO LTDA', '3', 'COMBER FLORESTAL TO'),
  ('10', 'COMBER FLORESTAL TO LTDA', '4', 'COMBER FLORESTAL TO'),
  ('11', 'IFL COMELLI PARTICIPACOES LTDA', '1', 'IFL COMELLI PARTICIPACOES'),
  ('12', 'IFL COMELLI PATRIMONIAL LTDA', '1', 'IFL COMELLI PATRIMONIAL'),
  ('13', 'FT4 COMELLI HOLDING LTDA', '1', 'FT4 COMELLI HOLDING'),
  ('14', 'COMBER INDUSTRIA SUL', '1', 'COMBER INDUSTRIA SUL'),
  ('15', 'LC COMELLI HOLDING LTDA', '1', 'LC COMELLI HOLDING'),
  ('16', 'COMBER LOCAÇÕES LTDA', '1', 'COMBER LOCAÇÕES'),
  ('17', 'MSO HOLDING LTDA', '1', 'MSO HOLDING'),
  ('18', 'GRUNE GOLDFARM LTDA', '1', 'GRUNE GOLDFARM LTDA'),
  ('19', 'EUCAFIL PARTICIPACOES LTDA', '1', 'EUCAFIL PARTICIPACOES')
on conflict (cod_empresa, cod_filial) do nothing;


-- ─── 1. O DESENHO DO PROCESSO ───────────────────────────────────────────────
create table if not exists public.imobilizado_modelo_etapas (
  chave             text primary key,
  ordem             integer     not null unique,
  titulo            text        not null,
  descricao         text        not null default '',
  -- Área dona da etapa. Texto, e não um id de pessoa, porque o processo é da
  -- área: quem responde pode mudar sem o desenho mudar.
  area              text        not null default '',
  -- Etapa condicional: quando true, não é criada para item que não é frota.
  -- Não criar é diferente de criar e pular — pulada sujaria a contagem de
  -- pendências e o item pareceria ter etapa aberta para sempre.
  so_frota          boolean     not null default false,
  -- Paralela não bloqueia a etapa seguinte nem impede finalizar o item.
  paralela          boolean     not null default false,
  exige_anexo       boolean     not null default false,
  -- Campo do item que precisa estar preenchido para concluir (ex.: oc_numero).
  exige_campo       text,
  prazo_dias_uteis  integer     not null default 1,
  -- De onde o prazo conta. Null = de quando a própria etapa abre, que é o
  -- normal. Com uma chave aqui, a contagem começa na CONCLUSÃO daquela outra
  -- etapa — o ATPV é cobrado a partir do centro de custo, não de quando chega
  -- a vez dele na fila, e a placa a partir do ATPV.
  prazo_a_partir_de text,
  responsavel_id    bigint      references public.responsaveis (id) on delete set null,
  ativo             boolean     not null default true
);

alter table public.imobilizado_modelo_etapas
  add column if not exists prazo_a_partir_de text;

-- Para quem rodou uma versão anterior deste arquivo.
alter table public.imobilizado_modelo_etapas
  add column if not exists area text not null default '';


-- ─── 2. OS ITENS ────────────────────────────────────────────────────────────
create table if not exists public.imobilizado_itens (
  id             uuid primary key default gen_random_uuid(),
  numero         bigint      not null unique,
  nf_numero      text        not null default '',
  nf_chave       text,
  fornecedor     text        not null default '',
  descricao      text        not null default '',
  valor          numeric(18, 2),
  -- filial_id é a escolha no seletor; `filial` e `empresa` guardam o nome no
  -- momento do cadastro. Se a filial for renomeada depois, o item continua
  -- mostrando o que valia quando ele nasceu.
  filial_id      bigint      references public.filiais (id) on delete set null,
  empresa        text        not null default '',
  filial         text        not null default '',
  eh_frota       boolean     not null default false,
  centro_custo   text,
  placa          text,
  oc_numero      text,
  -- Prefixo da pasta no Storage. Gravado no cadastro: a pasta existe desde o
  -- início e cada etapa deposita o documento dela ali.
  pasta          text        not null,
  -- Extremos dos dois agings: processo (criado_em → baixa_em) e placa
  -- (atpv_em → placa_em).
  atpv_em        date,
  placa_em       date,
  baixa_em       date,
  status         text        not null default 'em_andamento'
                   check (status in ('em_andamento', 'finalizado', 'cancelado')),
  criado_por     text,
  criado_em      timestamptz not null default now(),
  finalizado_em  timestamptz,
  atualizado_em  timestamptz not null default now()
);

create sequence if not exists public.imobilizado_itens_numero_seq
  owned by public.imobilizado_itens.numero;

alter table public.imobilizado_itens
  alter column numero set default nextval('public.imobilizado_itens_numero_seq');

alter table public.imobilizado_itens
  add column if not exists filial_id bigint references public.filiais (id) on delete set null;

alter table public.imobilizado_itens
  add column if not exists empresa text not null default '';

create index if not exists imob_itens_status_idx on public.imobilizado_itens (status);
create index if not exists imob_itens_filial_idx on public.imobilizado_itens (filial_id);
create index if not exists imob_itens_frota_idx  on public.imobilizado_itens (eh_frota);


-- ─── 3. AS ETAPAS DE CADA ITEM ──────────────────────────────────────────────
create table if not exists public.imobilizado_etapas (
  id               uuid primary key default gen_random_uuid(),
  item_id          uuid        not null references public.imobilizado_itens (id) on delete cascade,
  chave            text        not null references public.imobilizado_modelo_etapas (chave),
  ordem            integer     not null,
  titulo           text        not null,
  area             text        not null default '',
  paralela         boolean     not null default false,
  exige_anexo      boolean     not null default false,
  exige_campo      text,
  prazo_a_partir_de text,
  -- bloqueada = a anterior ainda não terminou. Só a aberta aceita conclusão.
  status           text        not null default 'bloqueada'
                     check (status in ('bloqueada', 'aberta', 'concluida', 'dispensada')),
  responsavel_id   bigint      references public.responsaveis (id) on delete set null,
  responsavel_nome text,
  prazo            date,
  aberta_em        timestamptz,
  concluida_em     timestamptz,
  concluida_por    text,
  observacao       text,
  unique (item_id, chave)
);

alter table public.imobilizado_etapas
  add column if not exists area text not null default '';

alter table public.imobilizado_etapas
  add column if not exists prazo_a_partir_de text;

create index if not exists imob_etapas_item_idx   on public.imobilizado_etapas (item_id);
create index if not exists imob_etapas_status_idx on public.imobilizado_etapas (status);
create index if not exists imob_etapas_prazo_idx  on public.imobilizado_etapas (prazo);


-- ─── 4. A PASTA ─────────────────────────────────────────────────────────────
-- Os arquivos ficam no bucket 'evidencias', que o app já usa. Esta tabela é o
-- índice deles, para a ficha mostrar uma pasta e não uma lista solta de links.
create table if not exists public.imobilizado_anexos (
  id           uuid primary key default gen_random_uuid(),
  item_id      uuid        not null references public.imobilizado_itens (id) on delete cascade,
  etapa_id     uuid        references public.imobilizado_etapas (id) on delete set null,
  etapa_chave  text,
  nome         text        not null,
  caminho      text        not null,
  url          text        not null,
  tipo         text,
  tamanho      bigint,
  enviado_por  text,
  enviado_em   timestamptz not null default now()
);

create index if not exists imob_anexos_item_idx on public.imobilizado_anexos (item_id);


-- ─── 4.1 O HISTÓRICO ────────────────────────────────────────────────────────
-- Tudo o que acontece com o item — etapa concluída, flag mudada, anexo,
-- reabertura — vira uma linha aqui, presa ao MESMO item. Inclusive a atividade
-- paralela da placa: ela é uma etapa do item, não um item à parte, e o seu
-- rastro tem que aparecer na mesma linha do tempo.
create table if not exists public.imobilizado_movimentos (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid        not null references public.imobilizado_itens (id) on delete cascade,
  etapa_id    uuid        references public.imobilizado_etapas (id) on delete set null,
  tipo        text        not null,
  descricao   text        not null,
  autor       text,
  criado_em   timestamptz not null default now()
);

create index if not exists imob_movs_item_idx on public.imobilizado_movimentos (item_id, criado_em);


-- ─── 5. QUEM PARTICIPA ──────────────────────────────────────────────────────
-- O módulo é restrito: participante responde etapa e anexa; observador só
-- acompanha. Quem não está aqui não vê nada — nem que as tabelas existem.
create table if not exists public.imobilizado_participantes (
  id             bigserial primary key,
  responsavel_id bigint      not null references public.responsaveis (id) on delete cascade,
  papel          text        not null default '',
  tipo           text        not null default 'participante'
                   check (tipo in ('participante', 'observador')),
  ativo          boolean     not null default true,
  criado_em      timestamptz not null default now(),
  unique (responsavel_id)
);


-- ─── 6. atualizado_em automático ────────────────────────────────────────────
create or replace function public.imob_touch_atualizado_em()
returns trigger
language plpgsql
as $fn$
begin
  new.atualizado_em = now();
  return new;
end;
$fn$;

drop trigger if exists imob_itens_touch on public.imobilizado_itens;
create trigger imob_itens_touch
  before update on public.imobilizado_itens
  for each row execute function public.imob_touch_atualizado_em();


-- ─── 7. AS ETAPAS DO PROCESSO ───────────────────────────────────────────────
-- Semeadas uma vez. O "do update" mantém título, descrição e as regras
-- estruturais alinhados a este arquivo, mas NÃO toca em prazo, responsável nem
-- ativo: esses são ajustados pela tela de configuração, e rodar o script de
-- novo não pode desfazer o ajuste de quem usa.
insert into public.imobilizado_modelo_etapas
  (chave, ordem, titulo, descricao, area, so_frota, paralela, exige_anexo, exige_campo,
   prazo_dias_uteis, prazo_a_partir_de)
values
  ('cadastro_item', 1, 'Anexar a nota fiscal',
   'O item já foi criado no formulário; aqui a NF é anexada à pasta e o cadastro é conferido.',
   'Patrimônio', false, false, true, null, 1, null),

  -- Só frota: o conteúdo desta etapa é criar o centro de custo do veículo.
  -- Para item que não é frota ela não tem o que fazer, e uma etapa sem
  -- conteúdo vira clique vazio — quem preenche aprende a clicar sem ler.
  ('cadastro', 2, 'Cadastro',
   'Cria o centro de custo do veículo e informa o código aqui.',
   'Patrimônio', true, false, false, 'centro_custo', 1, null),

  ('ordem_compra', 3, 'Ordem de compra',
   'Se já existe OC, informa o número. Se não existe, cria a OC e informa o número gerado.',
   'Patrimônio', false, false, false, 'oc_numero', 1, null),

  ('lancar_nf', 4, 'Lançar NF',
   'Patrimônio lança a nota no Sênior.',
   'Patrimônio', false, false, false, null, 1, null),

  ('seguro', 5, 'Seguro',
   'Depois do lançamento: anexa a apólice e os demais documentos do bem.',
   'Seguros', false, false, true, null, 1, null),

  ('dossie', 6, 'Pasta dossiê',
   'Confere a pasta do item: se faltar documento de alguma etapa, a tela aponta qual.',
   'Patrimônio', false, false, false, null, 1, null),

  ('atpv', 7, 'Frota · ATPV',
   'Anexa ATPV e demais documentos da frota. A data do ATPV abre o aging da placa.',
   'Frota', true, false, true, null, 10, 'cadastro'),

  ('baixa', 8, 'Baixa',
   'Dar baixa antes de encerrar. Fecha o aging do processo.',
   'Cadastro', false, false, false, null, 1, null),

  -- Paralela: nasce junto da etapa 2 e não bloqueia ninguém. Fecha o aging da
  -- placa quando concluída, mesmo que o item já esteja finalizado.
  ('placa', 9, 'Cadastrar placa',
   'Atividade paralela: cadastra a placa do veículo e avisa o responsável por e-mail.',
   'Frota', true, true, false, 'placa', 1, 'atpv')
on conflict (chave) do update
  set ordem       = excluded.ordem,
      titulo      = excluded.titulo,
      descricao   = excluded.descricao,
      area        = excluded.area,
      so_frota    = excluded.so_frota,
      paralela    = excluded.paralela,
      exige_anexo = excluded.exige_anexo,
      exige_campo = excluded.exige_campo,
      prazo_a_partir_de = excluded.prazo_a_partir_de;

-- O prazo é ajustado pela tela e o "do update" acima não o toca de propósito.
-- Estas duas linhas corrigem quem rodou o arquivo antes de a contagem passar
-- a sair de outra etapa. Cada uma só age se o valor ainda for o antigo — quem
-- já ajustou pela tela não é sobrescrito.
update public.imobilizado_modelo_etapas
   set prazo_dias_uteis = 10
 where chave = 'atpv' and prazo_dias_uteis = 1;

update public.imobilizado_modelo_etapas
   set prazo_dias_uteis = 1
 where chave = 'placa' and prazo_dias_uteis = 10;


-- ─── 7.1 CORREÇÃO DE ITENS JÁ CRIADOS ───────────────────────────────────────
-- A etapa 'cadastro' passou a ser só de frota. Itens não-frota criados antes
-- disso ficaram com ela em aberto, sem nada para fazer. Some com essas — e só
-- com essas: etapa já concluída é histórico e não se apaga.
delete from public.imobilizado_etapas e
 using public.imobilizado_itens i
 where e.item_id = i.id
   and e.chave = 'cadastro'
   and i.eh_frota = false
   and e.status <> 'concluida';

-- Se a etapa apagada era a que estava aberta, o item ficaria travado sem
-- nenhuma etapa ativa. Abre a próxima bloqueada de cada item nessa situação.
update public.imobilizado_etapas alvo
   set status = 'aberta', aberta_em = now()
  from (
    select distinct on (e.item_id) e.id
      from public.imobilizado_etapas e
      join public.imobilizado_itens i on i.id = e.item_id
     where i.status = 'em_andamento'
       and e.status = 'bloqueada'
       and not e.paralela
       and not exists (
         select 1 from public.imobilizado_etapas a
          where a.item_id = e.item_id and a.status = 'aberta' and not a.paralela
       )
     order by e.item_id, e.ordem
  ) proxima
 where alvo.id = proxima.id;


-- ─── 8. RLS ─────────────────────────────────────────────────────────────────
-- Depende de public.current_user_is_admin() (criada em rls-reset-v2.sql).
--
-- Regra: só quem está no cadastro de participantes enxerga o módulo.
-- Participante responde etapa e anexa; observador lê e não escreve. Admin faz
-- tudo, inclusive gerir o cadastro e o desenho das etapas.

alter table public.imobilizado_modelo_etapas  enable row level security;
alter table public.imobilizado_itens          enable row level security;
alter table public.imobilizado_etapas         enable row level security;
alter table public.imobilizado_anexos         enable row level security;
alter table public.imobilizado_movimentos    enable row level security;
alter table public.imobilizado_participantes  enable row level security;

-- O vínculo entre o login e o cadastro é o e-mail: responsaveis guarda o
-- e-mail e é ele que vem no JWT. Security definer para a função ler as duas
-- tabelas sem esbarrar na própria RLS.
create or replace function public.imob_meu_tipo()
returns text
language sql
security definer
stable
set search_path = public
as $fn$
  select case
    when public.current_user_is_admin() then 'admin'
    else (
      select p.tipo
        from public.imobilizado_participantes p
        join public.responsaveis r on r.id = p.responsavel_id
       where p.ativo
         and lower(r.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
       limit 1
    )
  end;
$fn$;
grant execute on function public.imob_meu_tipo() to authenticated;

create or replace function public.imob_pode_ver()
returns boolean
language sql
security definer
stable
set search_path = public
as $fn$
  select public.imob_meu_tipo() is not null;
$fn$;
grant execute on function public.imob_pode_ver() to authenticated;

create or replace function public.imob_pode_agir()
returns boolean
language sql
security definer
stable
set search_path = public
as $fn$
  select public.imob_meu_tipo() in ('admin', 'participante');
$fn$;
grant execute on function public.imob_pode_agir() to authenticated;


-- Modelo das etapas: quem está no processo lê; só admin muda o desenho.
drop policy if exists "imob_modelo_select" on public.imobilizado_modelo_etapas;
create policy "imob_modelo_select"
  on public.imobilizado_modelo_etapas for select
  to authenticated using (public.imob_pode_ver());

drop policy if exists "imob_modelo_write_admin" on public.imobilizado_modelo_etapas;
create policy "imob_modelo_write_admin"
  on public.imobilizado_modelo_etapas for all
  to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

-- Itens, etapas e anexos: leitura para o processo, escrita para participante.
drop policy if exists "imob_itens_select" on public.imobilizado_itens;
create policy "imob_itens_select"
  on public.imobilizado_itens for select
  to authenticated using (public.imob_pode_ver());

drop policy if exists "imob_itens_write" on public.imobilizado_itens;
create policy "imob_itens_write"
  on public.imobilizado_itens for all
  to authenticated
  using (public.imob_pode_agir())
  with check (public.imob_pode_agir());

drop policy if exists "imob_etapas_select" on public.imobilizado_etapas;
create policy "imob_etapas_select"
  on public.imobilizado_etapas for select
  to authenticated using (public.imob_pode_ver());

drop policy if exists "imob_etapas_write" on public.imobilizado_etapas;
create policy "imob_etapas_write"
  on public.imobilizado_etapas for all
  to authenticated
  using (public.imob_pode_agir())
  with check (public.imob_pode_agir());

drop policy if exists "imob_anexos_select" on public.imobilizado_anexos;
create policy "imob_anexos_select"
  on public.imobilizado_anexos for select
  to authenticated using (public.imob_pode_ver());

drop policy if exists "imob_anexos_write" on public.imobilizado_anexos;
create policy "imob_anexos_write"
  on public.imobilizado_anexos for all
  to authenticated
  using (public.imob_pode_agir())
  with check (public.imob_pode_agir());

drop policy if exists "imob_movs_select" on public.imobilizado_movimentos;
create policy "imob_movs_select"
  on public.imobilizado_movimentos for select
  to authenticated using (public.imob_pode_ver());

-- Histórico não se edita nem se apaga: registro que muda depois não é registro.
drop policy if exists "imob_movs_insert" on public.imobilizado_movimentos;
create policy "imob_movs_insert"
  on public.imobilizado_movimentos for insert
  to authenticated with check (public.imob_pode_agir());

-- Cadastro de pessoas: quem está no processo vê a lista; só admin edita.
drop policy if exists "imob_participantes_select" on public.imobilizado_participantes;
create policy "imob_participantes_select"
  on public.imobilizado_participantes for select
  to authenticated using (public.imob_pode_ver());

drop policy if exists "imob_participantes_write_admin" on public.imobilizado_participantes;
create policy "imob_participantes_write_admin"
  on public.imobilizado_participantes for all
  to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());


-- ─── 9. PRIMEIRO ACESSO ─────────────────────────────────────────────────────
-- Sem ninguém no cadastro, só admin enxerga o módulo. Este insert coloca você
-- como participante para poder testar; os demais entram pela tela.
insert into public.imobilizado_participantes (responsavel_id, papel, tipo)
select id, 'Controladoria', 'participante'
  from public.responsaveis
 where lower(email) = 'kaio.vieira@comber.com.br'
on conflict (responsavel_id) do nothing;


-- ─── 10. Conferência ────────────────────────────────────────────────────────
-- select ordem, chave, titulo, area, so_frota, paralela, prazo_dias_uteis
--   from public.imobilizado_modelo_etapas order by ordem;
--
-- select public.imob_meu_tipo();   -- deve devolver 'admin' ou 'participante'
--
-- Cadastro de filiais (uma linha por filial, códigos como no Sênior):
-- insert into public.filiais (cod_empresa, empresa, cod_filial, filial, cnpj) values
--   ('1', 'COMBER LOGISTICA LTDA', '1', 'Matriz',       '05.094.194/0001-55'),
--   ('1', 'COMBER LOGISTICA LTDA', '4', 'Filial 4',     '05.094.194/0004-06'),
--   ('1', 'COMBER LOGISTICA LTDA', '6', 'Filial 6',     '05.094.194/0006-60')
-- on conflict (cod_empresa, cod_filial) do nothing;
