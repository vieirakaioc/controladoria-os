-- =============================================================================
-- IMOBILIZADO — responsável da etapa passa a ser o login, não o cadastro
-- =============================================================================
--
-- O PROBLEMA:
--   O seletor de responsável da etapa lia `responsaveis`, que só é alimentada
--   pela sincronização da planilha na tela Início. Quem tem login no portal
--   mas não está naquela planilha não aparecia na lista — e era justamente
--   quem se queria colocar na etapa.
--
--   É o mesmo problema que a lista de participantes teve, e a solução é a
--   mesma: `profiles`, a tabela de quem faz login. Duas fontes de pessoa no
--   mesmo módulo garantiriam que uma das duas ficaria velha.
--
-- COMO A CONVERSÃO ACONTECE:
--   `responsavel_id` era bigint apontando para `responsaveis`. Não dá para
--   trocar o tipo no lugar (o USING de um ALTER não aceita subconsulta), então
--   é coluna nova, preenchida pelo casamento de e-mail, e depois a troca de
--   nome. Quem não tiver login fica sem responsável na etapa, e a tela mostra
--   "Sem responsável" — melhor do que apontar para uma pessoa que não entra no
--   sistema para trabalhar a etapa.
--
--   `responsavel_nome` não muda: é cópia do nome no momento da atribuição, e
--   serve para o histórico não se reescrever quando alguém troca de nome.
--
-- IDEMPOTENTE: a conversão só roda enquanto a coluna ainda é bigint.
--
-- SOBRE O DEADLOCK:
--   A primeira versão deste script tomava os locks na ordem em que precisava
--   deles: lia `profiles` e `responsaveis` no UPDATE e só depois pedia o lock
--   exclusivo para trocar a coluna. Com o portal aberto em outra aba, dava
--   impasse — o script segurava a leitura das pessoas e esperava as etapas; o
--   app segurava as etapas e esperava as pessoas.
--
--   Agora os locks exclusivos são tomados no começo, antes de qualquer
--   leitura. Assim não existe ciclo: o app espera o script terminar, e nada
--   mais espera o app. Com `lock_timeout`, se o app estiver no meio de uma
--   leitura o script desiste em 10s com erro limpo, em vez de travar — nesse
--   caso basta rodar de novo.
-- =============================================================================

set local lock_timeout = '10s';

-- Os locks primeiro, e na mesma ordem sempre: é isso que impede o impasse.
lock table public.imobilizado_etapas in access exclusive mode;
lock table public.imobilizado_modelo_etapas in access exclusive mode;

-- ─── 1. Etapas dos itens ────────────────────────────────────────────────────
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'imobilizado_etapas'
       and column_name = 'responsavel_id'
       and data_type = 'bigint'
  ) then
    alter table public.imobilizado_etapas
      add column responsavel_profile uuid references public.profiles (id) on delete set null;

    update public.imobilizado_etapas e
       set responsavel_profile = p.id
      from public.responsaveis r
      join public.profiles p on lower(p.email) = lower(r.email)
     where r.id = e.responsavel_id;

    alter table public.imobilizado_etapas drop column responsavel_id;
    alter table public.imobilizado_etapas
      rename column responsavel_profile to responsavel_id;
  end if;
end $$;


-- ─── 2. Modelo das etapas ───────────────────────────────────────────────────
-- Aqui fica o responsável padrão, herdado pela etapa quando o item é criado.
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'imobilizado_modelo_etapas'
       and column_name = 'responsavel_id'
       and data_type = 'bigint'
  ) then
    alter table public.imobilizado_modelo_etapas
      add column responsavel_profile uuid references public.profiles (id) on delete set null;

    update public.imobilizado_modelo_etapas m
       set responsavel_profile = p.id
      from public.responsaveis r
      join public.profiles p on lower(p.email) = lower(r.email)
     where r.id = m.responsavel_id;

    alter table public.imobilizado_modelo_etapas drop column responsavel_id;
    alter table public.imobilizado_modelo_etapas
      rename column responsavel_profile to responsavel_id;
  end if;
end $$;

notify pgrst, 'reload schema';

-- ─── Conferência ────────────────────────────────────────────────────────────
-- Deve dizer uuid nas duas linhas:
-- select table_name, data_type
--   from information_schema.columns
--  where table_schema = 'public'
--    and column_name = 'responsavel_id'
--    and table_name in ('imobilizado_etapas', 'imobilizado_modelo_etapas');
--
-- Etapas que perderam o responsável por não haver login com aquele e-mail:
-- select i.numero, e.titulo, e.responsavel_nome
--   from public.imobilizado_etapas e
--   join public.imobilizado_itens i on i.id = e.item_id
--  where e.responsavel_id is null and e.responsavel_nome is not null
--  order by i.numero, e.ordem;
--
-- Quem tem login e ainda está sem e-mail no perfil (não aparece em lista
-- nenhuma até preencher):
-- select count(*) from public.profiles where email is null;
