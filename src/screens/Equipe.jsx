import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  ExternalLink,
  Check,
  X,
  Ticket,
  User,
  KeyRound,
  RefreshCw,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { Avatar } from "../components/ui";

// QR rotativo: o código muda a cada 60 s, então print/foto do QR deixa de valer rapidamente
function QRRotativo({ desafio }) {
  const [codigo, setCodigo] = useState("");
  const [img, setImg] = useState("");
  const [resta, setResta] = useState(null);

  const carregar = useCallback(async () => {
    const { data } = await supabase.rpc("gerar_codigo", {
      p_desafio: desafio.id,
    });
    if (!data) return;
    setCodigo(data.codigo);
    setResta(data.segundos);
    QRCode.toDataURL(`conquista:${desafio.id}:${data.codigo}`, {
      margin: 1,
      width: 280,
    }).then(setImg);
  }, [desafio.id]);

  useEffect(() => {
    setImg("");
    setResta(null);
    carregar();
  }, [carregar]);
  useEffect(() => {
    const id = setInterval(
      () => setResta((r) => (r === null ? r : Math.max(0, r - 1))),
      1000,
    );
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (resta === 0) carregar();
  }, [resta, carregar]);

  return (
    <div className="card qr-panel">
      <div className="challenge-title" style={{ textAlign: "center" }}>
        {desafio.titulo}
      </div>
      {img ? (
        <img src={img} alt="QR Code do desafio" className="qr-big" />
      ) : (
        <div className="qr-big" />
      )}
      <div className="qr-code">{codigo.replace(/(\d{3})(\d{3})/, "$1 $2")}</div>
      <div className="card-sub">
        Código muda em {resta ?? "–"} s · exiba no telão do evento
      </div>
    </div>
  );
}

function Pendentes() {
  const [lista, setLista] = useState([]);
  const [busy, setBusy] = useState(null);
  const [fotos, setFotos] = useState({});

  const carregar = useCallback(async () => {
    const { data } = await supabase
      .from("participacoes")
      .select(
        "id, arquivo_path, criado_em, desafios:desafio_id(titulo, pontos), perfis:aluno_id(nome, matricula, turma, foto_path, foto_visivel)",
      )
      .eq("status", "pendente")
      .order("criado_em");
    setLista(data || []);
    const paths = (data || [])
      .map((p) => p.perfis && p.perfis.foto_visivel && p.perfis.foto_path)
      .filter(Boolean);
    if (paths.length) {
      const { data: urls } = await supabase.storage
        .from("avatares")
        .createSignedUrls(paths, 3600);
      setFotos(
        Object.fromEntries(
          (urls || [])
            .filter((u) => u.signedUrl)
            .map((u) => [u.path, u.signedUrl]),
        ),
      );
    }
  }, []);
  useEffect(() => {
    carregar();
  }, [carregar]);

  const abrirPDF = async (path) => {
    const { data } = await supabase.storage
      .from("certificados")
      .createSignedUrl(path, 120);
    if (data) window.open(data.signedUrl, "_blank");
  };
  const decidir = async (id, aprovar) => {
    const motivo = aprovar
      ? null
      : window.prompt("Motivo da recusa (o aluno poderá reenviar):") ||
        "Certificado não aceito";
    setBusy(id);
    await supabase.rpc("aprovar_participacao", {
      p_id: id,
      p_aprovar: aprovar,
      p_motivo: motivo,
    });
    setBusy(null);
    carregar();
  };

  if (!lista.length)
    return (
      <div className="empty-box">Nenhum certificado aguardando aprovação.</div>
    );
  return lista.map((p) => (
    <div key={p.id} className="card pending">
      <Avatar
        name={p.perfis?.nome || "?"}
        color="var(--blue)"
        size={48}
        src={fotos[p.perfis?.foto_path]}
      />
      <div className="grow">
        <div className="challenge-title">{p.perfis?.nome}</div>
        <div className="challenge-desc">
          {p.perfis?.matricula} · {p.perfis?.turma}
        </div>
        <div className="challenge-desc">
          <b>{p.desafios?.titulo}</b> · +{p.desafios?.pontos} pts
        </div>
        <button
          className="link-btn"
          style={{ textAlign: "left", padding: 0 }}
          onClick={() => abrirPDF(p.arquivo_path)}
        >
          <ExternalLink size={13} /> Ver PDF
        </button>
      </div>
      <div className="pending-actions">
        <button
          className="redeem"
          disabled={busy === p.id}
          onClick={() => decidir(p.id, true)}
        >
          <Check size={14} /> Aprovar
        </button>
        <button
          className="redeem off"
          disabled={busy === p.id}
          onClick={() => decidir(p.id, false)}
        >
          <X size={14} /> Recusar
        </button>
      </div>
    </div>
  ));
}

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

// Senha provisória aleatória (sem letras que se confundem, como 0/O e 1/l)
const gerarSenha = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  return Array.from(
    crypto.getRandomValues(new Uint32Array(10)),
    (n) => chars[n % chars.length],
  ).join("");
};

function RedefinirSenha() {
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

export default function Equipe() {
  const [qrs, setQrs] = useState([]);
  const [sel, setSel] = useState(null);

  useEffect(() => {
    supabase
      .from("desafios")
      .select("id, titulo")
      .eq("validacao", "qr")
      .eq("ativo", true)
      .order("titulo")
      .then(({ data }) => {
        setQrs(data || []);
        if (data && data[0]) setSel(data[0]);
      });
  }, []);

  return (
    <>
      <div className="tab-header">
        <h1>Equipe</h1>
        <p>QR Code dos eventos e aprovação de certificados</p>
      </div>

      <div className="section-header" style={{ marginTop: 0 }}>
        <h2>QR Code do evento</h2>
      </div>
      <div className="pad stack">
        <div className="chips">
          {qrs.map((d) => (
            <button
              key={d.id}
              className={`chip ${sel && sel.id === d.id ? "on" : ""}`}
              onClick={() => setSel(d)}
            >
              {d.titulo}
            </button>
          ))}
        </div>
        {sel && <QRRotativo desafio={sel} />}
      </div>

      <div className="section-header">
        <h2>Validar voucher</h2>
      </div>
      <div className="pad">
        <ValidarVoucher />
      </div>

      <div className="section-header">
        <h2>Redefinir senha de aluno</h2>
      </div>
      <div className="pad">
        <RedefinirSenha />
      </div>

      <div className="section-header">
        <h2>Certificados pendentes</h2>
      </div>
      <div className="pad stack">
        <Pendentes />
      </div>
    </>
  );
}
