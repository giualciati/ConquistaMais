// Importa os alunos fornecidos pelo Senac.
// Uso:  node --env-file=.env.admin scripts/importar-alunos.mjs alunos.csv
// CSV (com cabeçalho): usuario,nome,matricula,curso,turma,senha_inicial[,papel]  (papel = equipe para a equipe do Senac)
// Se senha_inicial estiver vazia, uma senha provisória é gerada e salva em credenciais-geradas.csv
import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) throw new Error('Defina SUPABASE_URL e SUPABASE_SECRET_KEY em .env.admin');

const admin = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const emailDe = (u) => `${u.trim().toLowerCase()}@aluno.conquistamais.app`; // igual ao do app (src/lib/supabase.js)

// Aceita CSV com vírgula (Google Planilhas) ou ponto e vírgula (Excel em português) e ignora o BOM do Excel
const texto = readFileSync(process.argv[2], 'utf8').replace(/^\uFEFF/, '');
const [cab, ...linhas] = texto.split(/\r?\n/).filter((l) => l.trim());
const sep = cab.includes(';') ? ';' : ',';
const cols = cab.split(sep).map((c) => c.trim());
const geradas = ['usuario,senha_provisoria'];
let ok = 0;

for (const linha of linhas) {
  const r = Object.fromEntries(linha.split(sep).map((v, i) => [cols[i], v.trim()]));
  const usuario = r.usuario.toLowerCase();
  const senha = r.senha_inicial || randomBytes(5).toString('hex');

  const { data, error } = await admin.auth.admin.createUser({ email: emailDe(usuario), password: senha, email_confirm: true });
  if (error) { console.error(`✗ ${usuario}: ${error.message}`); continue; }

  const { error: e2 } = await admin.from('perfis').insert({
    id: data.user.id, usuario, nome: r.nome, matricula: r.matricula || null, curso: r.curso || null, turma: r.turma || null, papel: r.papel === 'equipe' ? 'equipe' : 'aluno',
  });
  if (e2) { console.error(`✗ ${usuario}: ${e2.message}`); await admin.auth.admin.deleteUser(data.user.id); continue; }

  if (!r.senha_inicial) geradas.push(`${usuario},${senha}`);
  ok++;
}

if (geradas.length > 1) writeFileSync('credenciais-geradas.csv', geradas.join('\n'));
console.log(`Importados: ${ok}/${linhas.length}`);
