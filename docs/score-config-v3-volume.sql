-- =============================================================================
-- TaskManager v2 / Portal da Controladoria
-- MIGRAÇÃO: score_config v2 (4 dim) → v3 (5 dim, adiciona Volume)
-- =============================================================================
--
-- O QUE FAZ:
--   • Adiciona coluna peso_volume (smallint)
--   • Atualiza CHECK pra somar 5 colunas = 100
--   • Migra defaults: Concl 60→45 · Pont 20→15 · Vol 0→25 · Ader/Uso mantidos
--
-- ORDEM IMPORTANTE: drop check → add column → update → recreate check
-- (Aprendizado da migração v2: senão o check antigo bloqueia o UPDATE)
--
-- IDEMPOTENTE: pode rodar mais de uma vez sem dar erro.
-- =============================================================================


-- 1. Tira o CHECK antigo PRIMEIRO
alter table public.score_config drop constraint if exists score_config_sum_100;
alter table public.score_config drop constraint if exists score_config_non_negative;


-- 2. Adiciona a coluna nova (default 0 temporariamente)
alter table public.score_config
  add column if not exists peso_volume smallint not null default 0;


-- 3. Migra defaults pra incluir Volume
--    Mantém quem já personalizou (só toca quem ainda tem volume=0 E
--    está nos defaults antigos 60/20/10/10).
update public.score_config
set
  peso_conclusao    = 45,
  peso_volume       = 25,
  peso_pontualidade = 15,
  peso_aderencia    = 10,
  peso_uso          = 5,
  updated_at        = now()
where id = 1
  and peso_volume = 0
  and peso_conclusao = 60
  and peso_pontualidade = 20
  and peso_aderencia = 10
  and peso_uso = 10;


-- 4. Recria CHECKs com a regra nova (5 colunas)
alter table public.score_config
  add constraint score_config_sum_100
  check (peso_conclusao + peso_pontualidade + peso_aderencia + peso_uso + peso_volume = 100);

alter table public.score_config
  add constraint score_config_non_negative
  check (peso_conclusao >= 0 and peso_pontualidade >= 0 and peso_aderencia >= 0 and peso_uso >= 0 and peso_volume >= 0);


-- 5. Comentário pra documentação
comment on column public.score_config.peso_volume is 'Peso de "Volume" — concluídas em absoluto, normalizado pelo maior produtor do mês.';


-- 6. SANITY CHECK
-- select id, peso_conclusao, peso_volume, peso_pontualidade, peso_aderencia, peso_uso,
--        peso_conclusao + peso_volume + peso_pontualidade + peso_aderencia + peso_uso as total
-- from public.score_config;
