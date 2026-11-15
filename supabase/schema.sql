-- Conquista+ · esquema inicial (rode no SQL Editor do Supabase)

/* ========== TABELAS ========== */
create table campus (
  id int primary key default 1 check (id = 1),
  nome text not null,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  raio_m int not null default 200
);
-- ATENÇÃO: troque pelas coordenadas reais do campus. Com 0,0 nenhum check-in é aceito.
insert into campus (nome, lat, lng) values ('Senac', 0, 0);

create table perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  usuario text unique not null,
  nome text not null,
  matricula text unique,
  curso text,
  turma text,
  papel text not null default 'aluno' check (papel in ('aluno', 'equipe')),
  trocar_senha boolean not null default true,
  criado_em timestamptz not null default now()
);

-- Cada ganho/gasto é uma linha; o saldo é a soma (nunca guardamos só o número)
create table lancamentos (
  id bigint generated always as identity primary key,
  aluno_id uuid not null references perfis(id),
  pontos int not null check (pontos <> 0),
  tipo text not null check (tipo in ('checkin', 'desafio', 'certificado', 'resgate', 'ajuste')),
  referencia text,
  descricao text,
  criado_em timestamptz not null default now()
);
create index on lancamentos (aluno_id);

create table checkins (
  id bigint generated always as identity primary key,
  aluno_id uuid not null references perfis(id),
  dia date not null,
  distancia_m int,
  precisao_m int,
  criado_em timestamptz not null default now(),
  unique (aluno_id, dia) -- 1 check-in por dia
);

-- Hash da senha provisória, para provar que o aluno realmente trocou de senha
create table senhas_iniciais (
  aluno_id uuid primary key references auth.users(id) on delete cascade,
  hash text not null
);

create function guardar_senha_inicial() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into senhas_iniciais values (new.id, new.encrypted_password);
  return new;
end $$;
create trigger trg_senha_inicial after insert on auth.users
  for each row execute function guardar_senha_inicial();

/* ========== SEGURANÇA (RLS) ========== */
alter table campus enable row level security;
alter table perfis enable row level security;
alter table lancamentos enable row level security;
alter table checkins enable row level security;
alter table senhas_iniciais enable row level security; -- sem policies: ninguém lê pelo app

-- Só quem já trocou a senha acessa dados
create function senha_ok() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfis where id = auth.uid() and not trocar_senha)
$$;

create policy "ler o proprio perfil" on perfis for select using (id = auth.uid());
create policy "ler os proprios lancamentos" on lancamentos for select using (aluno_id = auth.uid() and senha_ok());
create policy "ler os proprios checkins" on checkins for select using (aluno_id = auth.uid() and senha_ok());
-- Não há policy de insert/update: pontos e check-ins só mudam pelas funções abaixo.

/* ========== FUNÇÕES (chamadas pelo app) ========== */
create function concluir_troca_senha() returns void
language plpgsql security definer set search_path = public as $$
declare atual text; inicial text;
begin
  select encrypted_password into atual from auth.users where id = auth.uid();
  select hash into inicial from senhas_iniciais where aluno_id = auth.uid();
  if atual is null or atual = inicial then raise exception 'senha_nao_alterada'; end if;
  update perfis set trocar_senha = false where id = auth.uid();
end $$;

create function meu_saldo() returns int
language plpgsql stable security definer set search_path = public as $$
begin
  if not senha_ok() then raise exception 'senha_pendente'; end if;
  return coalesce((select sum(pontos) from lancamentos where aluno_id = auth.uid()), 0);
end $$;

-- A distância é calculada AQUI, no servidor: o app não consegue "decidir" que está no campus.
create function fazer_checkin(p_lat double precision, p_lng double precision, p_precisao int)
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
  if p_precisao > 100 then
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

create function ranking_top() returns table (nome text, pontos bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not senha_ok() then raise exception 'senha_pendente'; end if;
  return query
    select p.nome, sum(l.pontos)::bigint from lancamentos l join perfis p on p.id = l.aluno_id
    where p.papel = 'aluno' group by p.nome order by 2 desc limit 5;
end $$;

-- Só usuários logados executam as funções
revoke all on function concluir_troca_senha(), meu_saldo(), fazer_checkin(double precision, double precision, int), ranking_top() from public, anon;
grant execute on function concluir_troca_senha(), meu_saldo(), fazer_checkin(double precision, double precision, int), ranking_top() to authenticated;

/* ========== PERMISSÕES (obrigatórias em projetos novos do Supabase) ==========
   Desde 2026, tabelas novas não ficam acessíveis ao app automaticamente.
   Aqui liberamos só a leitura; quem decide QUAIS linhas cada aluno vê são as policies (RLS) acima.
   Tabelas internas (senhas_iniciais, campus) ficam fechadas de propósito. */
grant usage on schema public to authenticated;
grant select on perfis, lancamentos, checkins to authenticated;
grant execute on function senha_ok() to authenticated; -- as policies usam esta função
