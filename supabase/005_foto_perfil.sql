-- Conquista+ · foto do perfil do aluno
-- Rode no SQL Editor (depois dos arquivos anteriores).

alter table perfis add column if not exists foto_path text;

-- Bucket PRIVADO: a foto só é lida por quem é dono dela (máx. 2 MB, só imagem)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatares', 'avatares', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "aluno envia a propria foto" on storage.objects;
create policy "aluno envia a propria foto" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatares' and (storage.foldername(name))[1] = auth.uid()::text and public.senha_ok());
drop policy if exists "aluno le a propria foto" on storage.objects;
create policy "aluno le a propria foto" on storage.objects for select to authenticated
  using (bucket_id = 'avatares' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "aluno apaga a propria foto" on storage.objects;
create policy "aluno apaga a propria foto" on storage.objects for delete to authenticated
  using (bucket_id = 'avatares' and (storage.foldername(name))[1] = auth.uid()::text);

-- Registra (ou remove, com null) o arquivo da foto no perfil. O perfil não pode ser editado direto pelo app.
create or replace function salvar_foto(p_path text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not senha_ok() then raise exception 'senha_pendente'; end if;
  if p_path is not null and p_path not like auth.uid()::text || '/%' then raise exception 'caminho_invalido'; end if;
  update perfis set foto_path = p_path where id = auth.uid();
end $$;

revoke all on function salvar_foto(text) from public, anon, authenticated;
grant execute on function salvar_foto(text) to authenticated;
