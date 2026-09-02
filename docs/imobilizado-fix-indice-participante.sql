-- Corrige o índice único de profile_id em imobilizado_participantes.
--
-- Ele foi criado como índice PARCIAL (where profile_id is not null), e o
-- Postgres não aceita índice parcial na inferência do ON CONFLICT — que é
-- exatamente o que a tela usa para incluir alguém no processo. O erro que
-- aparecia era "there is no unique or exclusion constraint matching the ON
-- CONFLICT specification".
--
-- Sem o WHERE o comportamento continua correto: num índice único, nulo não
-- conflita com nulo, então linhas antigas sem profile_id convivem sem colidir.

set local lock_timeout = '5s';

drop index if exists public.imob_participantes_profile_idx;

create unique index imob_participantes_profile_idx
  on public.imobilizado_participantes (profile_id);

notify pgrst, 'reload schema';
