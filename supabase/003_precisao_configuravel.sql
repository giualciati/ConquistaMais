-- Torna a precisão mínima do GPS configurável (antes fixa em 100 m).
-- Rode no SQL Editor. Depois você ajusta com:  update campus set precisao_max_m = 100 where id = 1;
alter table campus add column if not exists precisao_max_m int not null default 100;

create or replace function fazer_checkin(p_lat double precision, p_lng double precision, p_precisao int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  c campus%rowtype;
  d int;
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  pts constant int := 25;
begin
  if not senha_ok() then raise exception 'senha_pendente'; end if;
  if p_lat not between -90 and 90 or p_lng not between -180 and 180 then raise exception 'coordenada_invalida'; end if;
  select * into c from campus where id = 1;

  if exists (select 1 from checkins where aluno_id = auth.uid() and dia = hoje) then
    return jsonb_build_object('ok', false, 'motivo', 'ja_fez');
  end if;
  if p_precisao > c.precisao_max_m then
    return jsonb_build_object('ok', false, 'motivo', 'precisao');
  end if;

  d := round(6371000 * 2 * asin(least(1, sqrt(
        power(sin(radians(p_lat - c.lat) / 2), 2) +
        cos(radians(c.lat)) * cos(radians(p_lat)) * power(sin(radians(p_lng - c.lng) / 2), 2)))));

  if d > c.raio_m then
    return jsonb_build_object('ok', false, 'motivo', 'longe', 'distancia', d, 'raio', c.raio_m);
  end if;

  insert into checkins (aluno_id, dia, distancia_m, precisao_m) values (auth.uid(), hoje, d, p_precisao);
  insert into lancamentos (aluno_id, pontos, tipo, descricao) values (auth.uid(), pts, 'checkin', 'Check-in no campus');

  return jsonb_build_object('ok', true, 'pontos', pts, 'distancia', d,
    'saldo', (select sum(pontos) from lancamentos where aluno_id = auth.uid()));
end $$;
