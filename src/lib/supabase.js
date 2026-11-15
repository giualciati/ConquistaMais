import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);

// O aluno digita só o usuário; por baixo, o Supabase Auth usa um e-mail interno (nunca recebe mensagens).
export const emailDe = (usuario) => `${usuario.trim().toLowerCase()}@aluno.conquistamais.app`;

// Data de hoje no fuso de São Paulo (mesma regra usada no banco)
export const hojeSP = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
