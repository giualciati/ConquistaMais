import { useCallback, useEffect, useState } from "react";
import { User, KeyRound, RefreshCw } from "lucide-react";
import { supabase } from "../../lib/supabase";

// Senha provisória aleatória (sem letras que se confundem, como 0/O e 1/l)
const gerarSenha = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  return Array.from(
    crypto.getRandomValues(new Uint32Array(10)),
    (n) => chars[n % chars.length],
  ).join("");
};

const quando = (iso) =>
  new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

function RedefinirSenha({ onFeito }) {
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    if (
      !window.confirm(
        `Redefinir a senha de "${usuario.trim()}"? O aluno será desconectado e precisará criar uma nova senha no próximo acesso.`,
      )
    )
      return;
    setBusy(true);
    setRes(null);
    const { data, error } = await supabase.rpc("redefinir_senha", {
      p_usuario: usuario,
      p_senha: senha,
    });
    setBusy(false);
    if (error)
      return setRes({ ok: false, texto: "Erro ao redefinir. Tente de novo." });
    if (data.ok) {
      setRes({
        ok: true,
        texto: `Senha de ${data.nome} redefinida. Informe a senha provisória ao aluno: ${senha}`,
      });
      setUsuario("");
      setSenha("");
      onFeito();
    } else {
      setRes({
        ok: false,
        texto:
          data.motivo === "senha_curta"
            ? "A senha provisória precisa ter pelo menos 8 caracteres."
            : "Aluno não encontrado. Confira o usuário.",
      });
    }
  };

  return (
    <form
      className="card pending"
      style={{ flexDirection: "column", alignItems: "stretch" }}
      onSubmit={enviar}
    >
      <label className="input-row">
        <User size={18} color="var(--graphite-soft)" />
        <input
          placeholder="Usuário do aluno"
          autoCapitalize="none"
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
        />
      </label>
      <label className="input-row">
        <KeyRound size={18} color="var(--graphite-soft)" />
        <input
          placeholder="Senha provisória"
          autoCapitalize="none"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />
        <button
          type="button"
          className="eye"
          aria-label="Gerar senha"
          onClick={() => setSenha(gerarSenha())}
        >
          <RefreshCw size={18} />
        </button>
      </label>
      <button
        type="submit"
        className="btn primary full"
        disabled={!usuario.trim() || senha.length < 8 || busy}
      >
        Redefinir senha
      </button>
      {res && (
        <div
          className={res.ok ? "pill green" : "form-error"}
          style={{ marginBottom: 0 }}
        >
          {res.texto}
        </div>
      )}
    </form>
  );
}

function UltimasRedefinicoes({ recarregar }) {
  const [linhas, setLinhas] = useState(null);

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.rpc("ultimas_redefinicoes");
    setLinhas(error ? [] : data || []);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar, recarregar]);

  if (!linhas) return <div className="empty-box">Carregando…</div>;
  if (!linhas.length)
    return <div className="empty-box">Nenhuma redefinição até agora.</div>;
  return (
    <div
      className="card"
      style={{ flexDirection: "column", alignItems: "stretch" }}
    >
      {linhas.map((l, i) => (
        <div key={i} className="list-row">
          <span className="grow">
            <b>{l.aluno}</b>
            {l.matricula ? ` · ${l.matricula}` : ""}
            <br />
            <small>
              por {l.feito_por} · {quando(l.quando)}
            </small>
          </span>
        </div>
      ))}
    </div>
  );
}

export default function Senhas() {
  const [versao, setVersao] = useState(0);

  return (
    <>
      <div className="tab-header">
        <h1>Senhas</h1>
        <p>Redefina a senha de um aluno que esqueceu o acesso</p>
      </div>

      <div className="pad">
        <RedefinirSenha onFeito={() => setVersao((v) => v + 1)} />
      </div>

      <div className="section-header">
        <h2>Últimas redefinições</h2>
      </div>
      <div className="pad stack">
        <UltimasRedefinicoes recarregar={versao} />
      </div>
    </>
  );
}
