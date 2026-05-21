-- =============================================================================
-- TaskManager v2 / Portal da Controladoria
-- MIGRAÇÃO: score_config v1 (2 dimensões) → v2 (4 dimensões)
-- =============================================================================
--
-- O QUE FAZ:
--   • Adiciona 2 colunas novas: peso_pontualidade, peso_aderencia
--   • Atualiza o CHECK constraint pra somar 4 colunas = 100
--   • Migra a linha existente (id=1) pros defaults novos: 60/20/10/10
--
-- IDEMPOTENTE: pode rodar quantas vezes quiser. Se a primeira execução
-- já promoveu as colunas, as próximas só revalidam.
--
-- ROLLBACK:
--   alter table public.score_config drop column peso_pontualidade;
--   alter table public.score_config drop column peso_aderencia;
--   alter table public.score_config drop constraint score_config_sum_100;
--   alter table public.score_config
--     add constraint score_config_sum_100 check (peso_conclusao + peso_uso = 100);
-- =============================================================================


-- 1. Tira o CHECK ANTIGO PRIMEIRO. Ele exigia peso_conclusao + peso_uso = 100,
--    o que ia bloquear o UPDATE pros novos defaults (60+10 = 70).
alter table public.score_config drop constraint if exists score_config_sum_100;
alter table public.score_config drop constraint if exists score_config_non_negative;


-- 2. Adiciona as colunas novas (default 0)
alter table public.score_config
  add column if not exists peso_pontualidade smallint not null default 0,
  add column if not exists peso_aderencia    smallint not null default 0;


-- 3. Migra o registro existente pra distribuição padrão (60/20/10/10)
update public.score_config
set
  peso_conclusao    = 60,
  peso_pontualidade = 20,
  peso_aderencia    = 10,
  peso_uso          = 10,
  updated_at        = now()
where id = 1;


-- 4. Recria os CHECKs com a regra nova (4 colunas)
alter table public.score_config
  add constraint score_config_sum_100
  check (peso_conclusao + peso_pontualidade + peso_aderencia + peso_uso = 100);

alter table public.score_config
  add constraint score_config_non_negative
  check (peso_conclusao >= 0 and peso_pontualidade >= 0 and peso_aderencia >= 0 and peso_uso >= 0);


-- 4. Comentários atualizados
comment on column public.score_config.peso_conclusao    is 'Peso de "Conclusão" — % concluídas/atribuídas.';
comment on column public.score_config.peso_pontualidade is 'Peso de "Pontualidade" — % das concluídas que saíram no prazo.';
comment on column public.score_config.peso_aderencia    is 'Peso de "Aderência" — % de atribuídas sem cair em atraso.';
comment on column public.score_config.peso_uso          is 'Peso de "Uso" — % de dias úteis ativos no app.';


-- 5. SANITY CHECK
-- select id, peso_conclusao, peso_pontualidade, peso_aderencia, peso_uso,
--        peso_conclusao + peso_pontualidade + peso_aderencia + peso_uso as total
-- from public.score_config;
