import { useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import CampoSenha from "../components/CampoSenha";
import { supabase } from "../lib/supabase";

export default function TrocarSenha({ nome, onDone, onSair }) {
  const [nova, setNova] = useState("");
  const [conf, setConf] = useState("");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (nova.length < 8)
      return setErro("A nova senha precisa ter pelo menos 8 caracteres.");
    if (nova !== conf) return setErro("As senhas não conferem.");
    setLoading(true);
    setErro("");
    const { error } = await supabase.auth.updateUser({ password: nova });
    if (error) {
      setLoading(false);
      return setErro(
        "Não foi possível alterar a senha. Escolha uma senha diferente da atual.",
      );
    }
    // O banco confere se a senha realmente mudou antes de liberar o acesso.
    const { error: e2 } = await supabase.rpc("concluir_troca_senha");
    setLoading(false);
    if (e2)
      return setErro("Não foi possível concluir a troca. Tente novamente.");
    onDone();
  };

  return (
    <div className="login-wrap">
      <div className="logo">
        <KeyRound size={32} color="#fff" />
      </div>
      <h1 className="brand" style={{ fontSize: 24 }}>
        Crie sua senha
      </h1>
      <p className="tagline">
        Olá, {nome}! No primeiro acesso você precisa trocar a senha provisória.
      </p>

      <form className="form-card card" onSubmit={submit}>
        <CampoSenha
          placeholder="Nova senha (mín. 8 caracteres)"
          autoComplete="new-password"
          value={nova}
          onChange={(e) => setNova(e.target.value)}
        />
        <CampoSenha
          placeholder="Confirmar nova senha"
          autoComplete="new-password"
          value={conf}
          onChange={(e) => setConf(e.target.value)}
        />
        {erro && <div className="form-error">{erro}</div>}
        <button type="submit" className="btn primary full" disabled={loading}>
          {loading ? <Loader2 size={18} className="spin" /> : "Salvar e entrar"}
        </button>
        <button
          type="button"
          className="link-btn"
          style={{ marginTop: 0 }}
          onClick={onSair}
        >
          Sair
        </button>
      </form>
    </div>
  );
}
