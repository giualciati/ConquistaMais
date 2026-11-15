-- Conquista+ · desafios reais, validação por QR/código e certificados
-- Rode DEPOIS do schema.sql, no SQL Editor do Supabase.

/* ========== TABELAS ========== */
create table desafios (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descricao text not null,
  pontos int not null check (pontos > 0),
  icone text not null default 'sparkles',
  categoria text not null check (categoria in ('palestra', 'curso', 'certificado', 'acao')),
  validacao text not null check (validacao in ('qr', 'certificado')), -- qr = presença; certificado = PDF aprovado pela equipe
  abre_em timestamptz not null,
  fecha_em timestamptz not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

-- Segredo de cada desafio (usado para gerar os códigos do QR). Fica fora de "desafios" para o aluno nunca conseguir ler.
create table desafio_segredos (
  desafio_id uuid primary key references desafios(id) on delete cascade,
  segredo text not null
);
create function criar_segredo() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into desafio_segredos values (new.id, encode(extensions.gen_random_bytes(16), 'hex'));
  return new;
end $$;
create trigger trg_segredo after insert on desafios for each row execute function criar_segredo();

create table participacoes (
  id bigint generated always as identity primary key,
  aluno_id uuid not null references perfis(id),
  desafio_id uuid not null references desafios(id),
  status text not null check (status in ('pendente', 'aprovado', 'recusado')),
  metodo text not null check (metodo in ('qr', 'codigo', 'certificado')),
  arquivo_path text,
  motivo text,
  validado_por uuid references perfis(id),
  validado_em timestamptz,
  criado_em timestamptz not null default now(),
  unique (aluno_id, desafio_id) -- cada aluno pontua uma vez por desafio
);

-- Tentativas erradas de código (limite contra "chute")
create table tentativas (
  id bigint generated always as identity primary key,
  aluno_id uuid not null references perfis(id),
  desafio_id uuid not null,
  criado_em timestamptz not null default now()
);
create index on tentativas (aluno_id, criado_em);

/* ========== SEGURANÇA (RLS) ========== */
alter table desafios enable row level security;
alter table desafio_segredos enable row level security; -- sem policies
alter table participacoes enable row level security;
alter table tentativas enable row level security;       -- sem policies

create function sou_equipe() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfis where id = auth.uid() and papel = 'equipe' and not trocar_senha)
$$;

create policy "ver desafios ativos" on desafios for select using (ativo and senha_ok());
create policy "ver as proprias participacoes" on participacoes for select using ((aluno_id = auth.uid() and senha_ok()) or sou_equipe());
create policy "equipe ve perfis" on perfis for select using (sou_equipe());

-- Certificados em PDF (bucket privado, 5 MB, cada aluno só mexe na própria pasta)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('certificados', 'certificados', false, 5242880, array['application/pdf'])
on conflict (id) do nothing;
create policy "aluno envia o proprio certificado" on storage.objects for insert to authenticated
  with check (bucket_id = 'certificados' and (storage.foldername(name))[1] = auth.uid()::text and public.senha_ok());
create policy "aluno e equipe leem certificados" on storage.objects for select to authenticated
  using (bucket_id = 'certificados' and ((storage.foldername(name))[1] = auth.uid()::text or public.sou_equipe()));

/* ========== CÓDIGO ROTATIVO ========== */
-- Código de 6 dígitos que muda a cada 60 s (HMAC do desafio + janela de tempo). Uso interno.
create function codigo_atual(p_desafio uuid, p_janela bigint) returns text
language sql stable security definer set search_path = public as $$
  select lpad((((('x' || substr(encode(extensions.hmac(p_desafio::text || ':' || p_janela::text, s.segredo, 'sha256'), 'hex'), 1, 8))::bit(32)::bigint) % 1000000))::text, 6, '0')
  from desafio_segredos s where s.desafio_id = p_desafio
$$;

-- Equipe: pega o código atual para mostrar no QR (a tela atualiza quando os segundos acabam)
create function gerar_codigo(p_desafio uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare t bigint := extract(epoch from now())::bigint;
begin
  if not sou_equipe() then raise exception 'sem_permissao'; end if;
  return jsonb_build_object('codigo', codigo_atual(p_desafio, t / 60), 'segundos', 60 - (t % 60));
end $$;

/* ========== AÇÕES DO ALUNO ========== */
-- QR lido ou código digitado: os dois caminhos chegam aqui
create function validar_presenca(p_desafio uuid, p_codigo text, p_metodo text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  d desafios%rowtype;
  j bigint := extract(epoch from now())::bigint / 60;
  cod text := regexp_replace(coalesce(p_codigo, ''), '\D', '', 'g');
begin
  if not senha_ok() then raise exception 'senha_pendente'; end if;
  if p_metodo not in ('qr', 'codigo') then raise exception 'metodo_invalido'; end if;

  select * into d from desafios where id = p_desafio and ativo and validacao = 'qr';
  if not found then return jsonb_build_object('ok', false, 'motivo', 'desafio_invalido'); end if;
  if now() < d.abre_em or now() > d.fecha_em then return jsonb_build_object('ok', false, 'motivo', 'fora_da_janela'); end if;
  if exists (select 1 from participacoes where aluno_id = auth.uid() and desafio_id = d.id) then
    return jsonb_build_object('ok', false, 'motivo', 'ja_validado');
  end if;
  if (select count(*) from tentativas where aluno_id = auth.uid() and criado_em > now() - interval '10 minutes') >= 5 then
    return jsonb_build_object('ok', false, 'motivo', 'muitas_tentativas');
  end if;

  -- aceita o código da janela atual e da anterior (tolerância de até 60 s)
  if cod not in (codigo_atual(d.id, j), codigo_atual(d.id, j - 1)) then
    insert into tentativas (aluno_id, desafio_id) values (auth.uid(), d.id);
    return jsonb_build_object('ok', false, 'motivo', 'codigo_invalido');
  end if;

  insert into participacoes (aluno_id, desafio_id, status, metodo, validado_em)
  values (auth.uid(), d.id, 'aprovado', p_metodo, now()) on conflict do nothing;
  if not found then return jsonb_build_object('ok', false, 'motivo', 'ja_validado'); end if;

  insert into lancamentos (aluno_id, pontos, tipo, referencia, descricao)
  values (auth.uid(), d.pontos, 'desafio', d.id::text, d.titulo);

  return jsonb_build_object('ok', true, 'pontos', d.pontos, 'titulo', d.titulo,
    'saldo', (select sum(pontos) from lancamentos where aluno_id = auth.uid()));
end $$;

-- Certificado em PDF: o arquivo já foi enviado ao Storage; aqui registramos o pedido (fica pendente)
create function enviar_certificado(p_desafio uuid, p_path text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare d desafios%rowtype;
begin
  if not senha_ok() then raise exception 'senha_pendente'; end if;
  if p_path not like auth.uid()::text || '/%' then raise exception 'caminho_invalido'; end if;

  select * into d from desafios where id = p_desafio and ativo and validacao = 'certificado';
  if not found then return jsonb_build_object('ok', false, 'motivo', 'desafio_invalido'); end if;
  if now() < d.abre_em or now() > d.fecha_em then return jsonb_build_object('ok', false, 'motivo', 'fora_da_janela'); end if;

  insert into participacoes (aluno_id, desafio_id, status, metodo, arquivo_path)
  values (auth.uid(), d.id, 'pendente', 'certificado', p_path)
  on conflict (aluno_id, desafio_id) do update
    set status = 'pendente', arquivo_path = excluded.arquivo_path, motivo = null, criado_em = now()
    where participacoes.status = 'recusado'; -- só reenvia se foi recusado
  if not found then return jsonb_build_object('ok', false, 'motivo', 'ja_enviado'); end if;

  return jsonb_build_object('ok', true, 'pendente', true, 'titulo', d.titulo);
end $$;

/* ========== AÇÕES DA EQUIPE ========== */
create function aprovar_participacao(p_id bigint, p_aprovar boolean, p_motivo text default null) returns void
language plpgsql security definer set search_path = public as $$
declare pt participacoes%rowtype; d desafios%rowtype;
begin
  if not sou_equipe() then raise exception 'sem_permissao'; end if;
  select * into pt from participacoes where id = p_id and status = 'pendente' for update;
  if not found then raise exception 'nao_encontrada'; end if;
  select * into d from desafios where id = pt.desafio_id;

  if p_aprovar then
    update participacoes set status = 'aprovado', validado_por = auth.uid(), validado_em = now() where id = pt.id;
    insert into lancamentos (aluno_id, pontos, tipo, referencia, descricao)
    values (pt.aluno_id, d.pontos, 'certificado', d.id::text, d.titulo);
  else
    update participacoes set status = 'recusado', validado_por = auth.uid(), validado_em = now(), motivo = p_motivo where id = pt.id;
  end if;
end $$;

revoke all on function codigo_atual(uuid, bigint), gerar_codigo(uuid), validar_presenca(uuid, text, text),
  enviar_certificado(uuid, text), aprovar_participacao(bigint, boolean, text) from public, anon, authenticated;
grant execute on function gerar_codigo(uuid), validar_presenca(uuid, text, text),
  enviar_certificado(uuid, text), aprovar_participacao(bigint, boolean, text) to authenticated;
-- (codigo_atual fica só para uso interno das outras funções)

/* ========== DESAFIOS DE EXEMPLO (ajuste datas e textos) ========== */
insert into desafios (titulo, descricao, pontos, icone, categoria, validacao, abre_em, fecha_em) values
 ('Palestra: IA Generativa no Desenvolvimento de Software', 'Como copilotos de código e LLMs mudam o dia a dia de quem programa. Auditório principal.', 50, 'sparkles', 'palestra', 'qr', now() - interval '1 day', now() + interval '30 days'),
 ('Palestra: Carreira em Dados, do estágio ao mercado internacional', 'Trilhas de estudo, portfólio e como conseguir vagas remotas.', 50, 'database', 'palestra', 'qr', now() - interval '1 day', now() + interval '30 days'),
 ('Palestra: Segurança da Informação e LGPD na Prática', 'Boas práticas para proteger dados nos sistemas que você desenvolve.', 60, 'shield', 'palestra', 'qr', now() - interval '1 day', now() + interval '30 days'),
 ('Palestra: DevOps e Cloud para Iniciantes', 'Do commit ao deploy: CI/CD, containers e nuvem.', 50, 'cloud', 'palestra', 'qr', now() - interval '1 day', now() + interval '30 days'),
 ('Mesa-redonda: Mulheres na Tecnologia', 'Trajetórias, desafios e conselhos de profissionais de TI.', 60, 'users', 'palestra', 'qr', now() - interval '1 day', now() + interval '30 days'),
 ('Curso: Desenvolvimento Web com React (20h)', 'Conclua o curso livre de ADS e envie o certificado de conclusão em PDF.', 100, 'code', 'curso', 'certificado', now() - interval '1 day', now() + interval '60 days'),
 ('Curso: Banco de Dados e SQL (30h)', 'Modelagem relacional, consultas e otimização. Envie o certificado de conclusão.', 150, 'database', 'curso', 'certificado', now() - interval '1 day', now() + interval '60 days'),
 ('Curso: Lógica de Programação e Python (40h)', 'Base para quem está começando em ADS. Envie o certificado de conclusão.', 200, 'code', 'curso', 'certificado', now() - interval '1 day', now() + interval '60 days'),
 ('Certificado de participação: Senac Tech Day', 'Participou do Senac Tech Day? Envie seu certificado de participação.', 80, 'award', 'certificado', 'certificado', now() - interval '1 day', now() + interval '60 days'),
 ('Certificado de participação: Hackathon Senac', 'Envie o certificado de participação do hackathon.', 120, 'award', 'certificado', 'certificado', now() - interval '1 day', now() + interval '60 days'),
 ('Doação de Sangue', 'Faça uma doação na campanha do campus.', 200, 'heart', 'acao', 'qr', now() - interval '1 day', now() + interval '30 days'),
 ('Mutirão Solidário', 'Ajude na arrecadação de alimentos.', 120, 'users', 'acao', 'qr', now() - interval '1 day', now() + interval '30 days');

/* ========== PERMISSÕES (obrigatórias em projetos novos do Supabase) ========== */
grant select on desafios, participacoes to authenticated;
grant execute on function sou_equipe() to authenticated; -- as policies usam esta função
-- desafio_segredos e tentativas ficam fechadas: só as funções do banco mexem nelas.
