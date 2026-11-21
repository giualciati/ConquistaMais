import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);

export const emailDe = (usuario) =>
  `${usuario.trim().toLowerCase().split("@")[0]}@aluno.conquistamais.app`;

// Data de hoje no fuso de São Paulo (mesma regra usada no banco)
export const hojeSP = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
