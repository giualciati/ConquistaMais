import { useState } from "react";
import { Ticket, LogOut } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { Avatar } from "../../components/ui";

function ValidarVoucher() {
  const [cod, setCod] = useState("");
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [foto, setFoto] = useState(null);

  const validar = async (e) => {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.rpc("usar_voucher", {
      p_codigo: cod,
    });
    setBusy(false);
    setFoto(null);
    if (error)
      return setRes({ ok: false, texto: "Erro ao validar. Tente de novo." });
    if (data.ok && data.foto)
      supabase.storage
        .from("avatares")
        .createSignedUrl(data.foto, 300)
        .then(({ data: u }) => u && setFoto(u.signedUrl));
    if (data.ok) {
      setRes({
        ok: true,
        aluno: data.aluno,
        texto: `${data.titulo} · ${data.aluno}`,
      });
      setCod("");
    } else
      setRes({
        ok: false,
        texto:
          data.motivo === "ja_usado"
            ? `Voucher já utilizado (${data.titulo} · ${data.aluno})`
            : "Código não encontrado.",
      });
  };

  return (
    <form
      className="card pending"
      style={{ flexDirection: "column", alignItems: "stretch" }}
      onSubmit={validar}
    >
      <label className="input-row">
        <Ticket size={18} color="var(--graphite-soft)" />
        <input
          placeholder="SNC-XXXX-XXXX"
          autoCapitalize="characters"
          value={cod}
          onChange={(e) => setCod(e.target.value.toUpperCase())}
        />
      </label>
      <button
        type="submit"
        className="btn primary full"
        disabled={!cod.trim() || busy}
      >
        Validar voucher
      </button>
      {res && res.ok && foto && (
        <div style={{ alignSelf: "center" }}>
          <Avatar
            name={res.aluno || "?"}
            color="var(--blue)"
            size={96}
            src={foto}
          />
        </div>
      )}
      {res && (
        <div
          className={res.ok ? "pill green" : "form-error"}
          style={{ marginBottom: 0 }}
        >
          {res.ok ? "Entregar: " : ""}
          {res.texto}
        </div>
      )}
    </form>
  );
}

export default function Mais({ nome, onLogout }) {
  return (
    <>
      <div className="tab-header">
        <h1>Mais</h1>
        <p>Conectado como {nome}</p>
      </div>

      <div className="section-header" style={{ marginTop: 0 }}>
        <h2>Validar voucher</h2>
      </div>
      <div className="pad">
        <ValidarVoucher />
      </div>

      <div className="pad" style={{ marginTop: 28 }}>
        <button className="btn ghost full" onClick={onLogout}>
          <LogOut size={18} /> Sair
        </button>
      </div>
    </>
  );
}
