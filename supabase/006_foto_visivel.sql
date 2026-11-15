-- Conquista+ · foto visível para colegas do curso e equipe (só com a permissão do aluno)
-- Rode no SQL Editor, depois do 005_foto_perfil.sql.

alter table perfis add column if not exists foto_visivel boolean not null default false;

-- O aluno liga/desliga a visibilidade da própria foto
create or replace function definir_visibilidade_foto(p_visivel boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not senha_ok() then raise exception 'senha_pendente'; end if;
  update perfis set foto_visivel = p_visivel where id = auth.uid();
end $$;

-- Remover a foto também desfaz a permissão
create or replace function salvar_foto(p_path text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not senha_ok() then raise exception 'senha_pendente'; end if;
  if p_path is not null and p_path not like auth.uid()::text || '/%' then raise exception 'caminho_invalido'; end if;
  update perfis set foto_path = p_path, foto_visivel = case when p_path is null then false else foto_visivel end
  where id = auth.uid();
end $$;

-- Quem pode abrir a foto de outra pessoa: a equipe, ou alunos do MESMO curso — e só se o dono liberou
create or replace function pode_ver_foto(p_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select senha_ok() and exists (
    select 1 from perfis dono
    where dono.foto_path = p_name and dono.foto_visivel
      and (sou_equipe() or dono.curso is not distinct from (select me.curso from perfis me where me.id = auth.uid()))
  )
$$;
drop policy if exists "ver fotos liberadas" on storage.objects;
create policy "ver fotos liberadas" on storage.objects for select to authenticated
  using (bucket_id = 'avatares' and public.pode_ver_foto(name));

-- Ranking agora devolve também o caminho da foto (só se o aluno liberou, ou se for a própria)
drop function if exists ranking_curso();
create or replace function ranking_curso() returns table (posicao bigint, nome text, pontos bigint, eu boolean, foto text)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare meu_curso text;
begin
  if not senha_ok() then raise exception 'senha_pendente'; end if;
  select p0.curso into meu_curso from perfis p0 where p0.id = auth.uid();

  return query
    with t as (
      select p.id as aid, p.nome as anome, p.foto_path as afoto, p.foto_visivel as avis,
             coalesce(sum(l.pontos), 0)::bigint as pts
      from perfis p left join lancamentos l on l.aluno_id = p.id
      where p.papel = 'aluno' and p.curso is not distinct from meu_curso
      group by p.id, p.nome, p.foto_path, p.foto_visivel
    ), r as (
      select t.*, row_number() over (order by t.pts desc, t.anome) as pos from t
    )
    select r.pos,
           case when position(' ' in r.anome) > 0
                then split_part(r.anome, ' ', 1) || ' ' || left(regexp_replace(r.anome, '^.*\s', ''), 1) || '.'
                else r.anome end,
           r.pts,
           (r.aid = auth.uid()),
           case when r.aid = auth.uid() or r.avis then r.afoto end
    from r
    where r.pos <= 5 or r.aid = auth.uid()
    order by r.pos;
end $$;

-- Na entrega do voucher, a equipe vê a foto do aluno (se liberada) para conferir quem retira
create or replace function usar_voucher(p_codigo text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r resgates%rowtype; titulo_rec text; nome_aluno text; foto text;
begin
  if not sou_equipe() then raise exception 'sem_permissao'; end if;
  select * into r from resgates where codigo = upper(trim(p_codigo)) for update;
  if not found then return jsonb_build_object('ok', false, 'motivo', 'nao_encontrado'); end if;
  select titulo into titulo_rec from recompensas where id = r.recompensa_id;
  select nome, case when foto_visivel then foto_path end into nome_aluno, foto from perfis where id = r.aluno_id;
  if r.status <> 'ativo' then
    return jsonb_build_object('ok', false, 'motivo', 'ja_usado', 'titulo', titulo_rec, 'aluno', nome_aluno);
  end if;
  update resgates set status = 'usado', usado_em = now(), usado_por = auth.uid() where id = r.id;
  return jsonb_build_object('ok', true, 'titulo', titulo_rec, 'aluno', nome_aluno, 'foto', foto);
end $$;

revoke all on function definir_visibilidade_foto(boolean), ranking_curso(), usar_voucher(text) from public, anon, authenticated;
grant execute on function definir_visibilidade_foto(boolean), ranking_curso(), usar_voucher(text) to authenticated;
grant execute on function pode_ver_foto(text) to authenticated; -- a policy do Storage usa esta função
