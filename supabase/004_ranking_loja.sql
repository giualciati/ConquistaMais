-- Conquista+ · ranking por curso, loja de recompensas e vouchers reais
-- Rode DEPOIS do schema.sql e do 002_desafios.sql, no SQL Editor do Supabase.

/* ========== DESAFIO RELÂMPAGO REAL ========== */
-- Passa a existir a categoria 'relampago': desafio aberto por pouco tempo (abre_em → fecha_em), validado por QR/código
alter table desafios drop constraint if exists desafios_categoria_check;
alter table desafios add constraint desafios_categoria_check
  check (categoria in ('palestra', 'curso', 'certificado', 'acao', 'relampago'));

/* ========== LOJA ========== */
create table recompensas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descricao text not null,
  custo int not null check (custo > 0),
  icone text not null default 'ticket',
  estoque int check (estoque >= 0), -- null = ilimitado
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table resgates (
  id bigint generated always as identity primary key,
  aluno_id uuid not null references perfis(id),
  recompensa_id uuid not null references recompensas(id),
  codigo text not null unique,
  status text not null default 'ativo' check (status in ('ativo', 'usado')),
  criado_em timestamptz not null default now(),
  usado_em timestamptz,
  usado_por uuid references perfis(id)
);
create index on resgates (aluno_id);

alter table recompensas enable row level security;
alter table resgates enable row level security;
create policy "ver recompensas ativas" on recompensas for select using (ativo and senha_ok());
create policy "ver os proprios resgates" on resgates for select using ((aluno_id = auth.uid() and senha_ok()) or sou_equipe());
grant select on recompensas, resgates to authenticated;

/* ========== FUNÇÕES ========== */
-- Resgate: DEBITA o saldo (lançamento negativo), baixa o estoque e gera o voucher — tudo numa transação só.
create function resgatar_recompensa(p_recompensa uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare rec recompensas%rowtype; saldo int; cod text; rid bigint;
begin
  if not senha_ok() then raise exception 'senha_pendente'; end if;
  perform 1 from perfis where id = auth.uid() for update; -- impede gastar o mesmo saldo em dois cliques simultâneos

  select * into rec from recompensas where id = p_recompensa and ativo for update;
  if not found then return jsonb_build_object('ok', false, 'motivo', 'indisponivel'); end if;
  if rec.estoque is not null and rec.estoque <= 0 then return jsonb_build_object('ok', false, 'motivo', 'esgotado'); end if;

  select coalesce(sum(pontos), 0) into saldo from lancamentos where aluno_id = auth.uid();
  if saldo < rec.custo then
    return jsonb_build_object('ok', false, 'motivo', 'saldo_insuficiente', 'faltam', rec.custo - saldo);
  end if;

  cod := 'SNC-' || upper(encode(extensions.gen_random_bytes(2), 'hex')) || '-' || upper(encode(extensions.gen_random_bytes(2), 'hex'));
  insert into resgates (aluno_id, recompensa_id, codigo) values (auth.uid(), rec.id, cod) returning id into rid;
  insert into lancamentos (aluno_id, pontos, tipo, referencia, descricao) values (auth.uid(), -rec.custo, 'resgate', rid::text, rec.titulo);
  if rec.estoque is not null then update recompensas set estoque = estoque - 1 where id = rec.id; end if;

  return jsonb_build_object('ok', true, 'codigo', cod, 'titulo', rec.titulo, 'custo', rec.custo, 'saldo', saldo - rec.custo);
end $$;

-- Equipe: confere o código do voucher no balcão e marca como usado
create function usar_voucher(p_codigo text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r resgates%rowtype; titulo_rec text; nome_aluno text;
begin
  if not sou_equipe() then raise exception 'sem_permissao'; end if;
  select * into r from resgates where codigo = upper(trim(p_codigo)) for update;
  if not found then return jsonb_build_object('ok', false, 'motivo', 'nao_encontrado'); end if;
  select titulo into titulo_rec from recompensas where id = r.recompensa_id;
  select nome into nome_aluno from perfis where id = r.aluno_id;
  if r.status <> 'ativo' then
    return jsonb_build_object('ok', false, 'motivo', 'ja_usado', 'titulo', titulo_rec, 'aluno', nome_aluno);
  end if;
  update resgates set status = 'usado', usado_em = now(), usado_por = auth.uid() where id = r.id;
  return jsonb_build_object('ok', true, 'titulo', titulo_rec, 'aluno', nome_aluno);
end $$;

/* ========== RANKING POR CURSO ========== */
-- Top 5 do curso do aluno + a posição dele (se estiver fora do top 5). Empates: ordem alfabética.
-- Os nomes saem abreviados ("Maria S.") para proteger os colegas.
create function ranking_curso() returns table (posicao bigint, nome text, pontos bigint, eu boolean)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare meu_curso text;
begin
  if not senha_ok() then raise exception 'senha_pendente'; end if;
  select p0.curso into meu_curso from perfis p0 where p0.id = auth.uid();

  return query
    with t as (
      select p.id as aid, p.nome as anome, coalesce(sum(l.pontos), 0)::bigint as pts
      from perfis p left join lancamentos l on l.aluno_id = p.id
      where p.papel = 'aluno' and p.curso is not distinct from meu_curso
      group by p.id, p.nome
    ), r as (
      select t.aid, t.anome, t.pts, row_number() over (order by t.pts desc, t.anome) as pos from t
    )
    select r.pos,
           case when position(' ' in r.anome) > 0
                then split_part(r.anome, ' ', 1) || ' ' || left(regexp_replace(r.anome, '^.*\s', ''), 1) || '.'
                else r.anome end,
           r.pts,
           (r.aid = auth.uid())
    from r
    where r.pos <= 5 or r.aid = auth.uid()
    order by r.pos;
end $$;

drop function if exists ranking_top();

revoke all on function resgatar_recompensa(uuid), usar_voucher(text), ranking_curso() from public, anon, authenticated;
grant execute on function resgatar_recompensa(uuid), usar_voucher(text), ranking_curso() to authenticated;

/* ========== RECOMPENSAS DE EXEMPLO ========== */
insert into recompensas (titulo, descricao, custo, icone, estoque) values
 ('Desconto na Cantina', '15% de desconto na cantina do campus.', 100, 'food', null),
 ('Ingresso para Evento', 'Acesso ao Senac Tech Day.', 150, 'ticket', 50),
 ('Camiseta Senac', 'Edição exclusiva Conquista+.', 250, 'shirt', 30),
 ('Curso Extra', 'Curso livre de 20h à sua escolha.', 300, 'school', 10);

/* ========== EXEMPLO DE DESAFIO RELÂMPAGO (rode quando quiser lançar um; fica aberto 30 min) ==========
insert into desafios (titulo, descricao, pontos, icone, categoria, validacao, abre_em, fecha_em)
values ('Quiz Relâmpago: Lógica', 'Participe do quiz com a equipe no pátio.', 40, 'help', 'relampago', 'qr', now(), now() + interval '30 minutes');
*/
