import { useCallback, useEffect, useState } from "react";
import {
  Plus,
  Zap,
  QrCode,
  Square,
  Loader2,
  Users,
  Hourglass,
  Pencil,
} from "lucide-react";
import { Modal, DataIcon } from "../../components/ui";
import { supabase } from "../../lib/supabase";

const CATEGORIAS = [
  ["palestra", "Palestra"],
  ["acao", "Ação no campus"],
  ["relampago", "Desafio relâmpago"],
  ["curso", "Curso (certificado de conclusão)"],
  ["certificado", "Certificado de participação"],
];
const ROTULO = Object.fromEntries(CATEGORIAS);
const ICONES = [
  ["sparkles", "Brilho (IA)"],
  ["code", "Código"],
  ["database", "Banco de dados"],
  ["cloud", "Nuvem"],
  ["shield", "Segurança"],
  ["users", "Pessoas"],
  ["heart", "Solidariedade"],
  ["award", "Prêmio"],
  ["help", "Quiz"],
  ["library", "Biblioteca"],
  ["megaphone", "Anúncio"],
  ["chat", "Conversa"],
];
const ICONE_PADRAO = {
  palestra: "sparkles",
  acao: "users",
  relampago: "help",
  curso: "code",
  certificado: "award",
};

const pad = (n) => String(n).padStart(2, "0");
const paraInput = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const fmt = (iso) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
const padroes = (cat) => {
  const a = new Date();
  const dur =
    cat === "relampago"
      ? 30 * 60e3
      : cat === "palestra" || cat === "acao"
        ? 3 * 3600e3
        : 60 * 86400e3;
  return [paraInput(a), paraInput(new Date(a.getTime() + dur))];
};
const situacao = (d) => {
  const t = Date.now();
  if (t < +new Date(d.abre_em)) return ["Agendado", "orange"];
  if (t >= +new Date(d.fecha_em)) return ["Encerrado", "gray"];
  return ["Aberto", "green"];
};
const ERROS = {
  titulo_invalido: "Informe um título (mínimo 3 letras).",
  pontos_invalidos: "Os pontos precisam estar entre 1 e 1000.",
  datas_invalidas: "O encerramento precisa ser depois da abertura.",
  pontos_bloqueados:
    "Este desafio já tem participações: os pontos não podem mais ser alterados.",
};

// Serve para criar (categoriaInicial) e para editar (desafio)
function FormDesafio({ categoriaInicial, desafio, onClose, onCriado }) {
  const edit = !!desafio;
  const [categoria, setCategoria] = useState(
    desafio ? desafio.categoria : categoriaInicial,
  );
  const [titulo, setTitulo] = useState(desafio ? desafio.titulo : "");
  const [descricao, setDescricao] = useState(desafio ? desafio.descricao : "");
  const [pontos, setPontos] = useState(desafio ? desafio.pontos : 50);
  const [icone, setIcone] = useState(
    desafio ? desafio.icone : ICONE_PADRAO[categoriaInicial],
  );
  const [[abre, fecha], setDatas] = useState(
    desafio
      ? [
          paraInput(new Date(desafio.abre_em)),
          paraInput(new Date(desafio.fecha_em)),
        ]
      : padroes(categoriaInicial),
  );
  const [duracao, setDuracao] = useState(30);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");

  const rel = !edit && categoria === "relampago";
  const porPDF = categoria === "curso" || categoria === "certificado";

  const mudarCategoria = (c) => {
    setCategoria(c);
    setIcone(ICONE_PADRAO[c]);
    setDatas(padroes(c));
  };

  const criar = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErro("");
    const abreD = rel ? new Date() : new Date(abre);
    const fechaD = rel
      ? new Date(Date.now() + Number(duracao) * 60000)
      : new Date(fecha);
    const datas = {
      p_abre_em: abreD.toISOString(),
      p_fecha_em: fechaD.toISOString(),
    };
    const { error } = edit
      ? await supabase.rpc("editar_desafio", {
          p_id: desafio.id,
          p_titulo: titulo,
          p_descricao: descricao,
          p_pontos: Number(pontos),
          p_icone: icone,
          ...datas,
        })
      : await supabase.rpc("criar_desafio", {
          p_titulo: titulo,
          p_descricao: descricao,
          p_pontos: Number(pontos),
          p_icone: icone,
          p_categoria: categoria,
          ...datas,
        });
    setBusy(false);
    if (error) {
      const chave = Object.keys(ERROS).find((k) =>
        String(error.message).includes(k),
      );
      return setErro(
        chave ? ERROS[chave] : "Não foi possível salvar o desafio.",
      );
    }
    onCriado();
  };

  return (
    <Modal wide onClose={busy ? () => {} : onClose}>
      <h3 className="modal-title" style={{ marginBottom: 14 }}>
        {edit
          ? "Editar desafio"
          : rel
            ? "Lançar desafio relâmpago"
            : "Novo desafio"}
      </h3>
      <form
        className="stack"
        style={{ alignSelf: "stretch", gap: 12 }}
        onSubmit={criar}
      >
        <div className="field">
          <label>Tipo</label>
          <select
            value={categoria}
            disabled={edit}
            onChange={(e) => mudarCategoria(e.target.value)}
          >
            {CATEGORIAS.map(([k, n]) => (
              <option key={k} value={k}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Título</label>
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex.: Palestra: Carreira em Dados"
          />
        </div>
        <div className="field">
          <label>Descrição</label>
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Local, horário, o que o aluno precisa fazer"
          />
        </div>
        <div className="form-grid">
          <div className="field">
            <label>Pontos</label>
            <input
              type="number"
              inputMode="numeric"
              min="1"
              max="1000"
              value={pontos}
              onChange={(e) => setPontos(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Ícone</label>
            <select value={icone} onChange={(e) => setIcone(e.target.value)}>
              {ICONES.map(([k, n]) => (
                <option key={k} value={k}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>
        {rel ? (
          <div className="field">
            <label>Duração (minutos) — abre agora</label>
            <input
              type="number"
              inputMode="numeric"
              min="1"
              max="720"
              value={duracao}
              onChange={(e) => setDuracao(e.target.value)}
            />
          </div>
        ) : (
          <div className="form-grid">
            <div className="field">
              <label>Abre em</label>
              <input
                type="datetime-local"
                value={abre}
                onChange={(e) => setDatas([e.target.value, fecha])}
              />
            </div>
            <div className="field">
              <label>Encerra em</label>
              <input
                type="datetime-local"
                value={fecha}
                onChange={(e) => setDatas([abre, e.target.value])}
              />
            </div>
          </div>
        )}
        {edit && (
          <div className="mini">
            O tipo não pode ser alterado. Para reabrir um desafio encerrado,
            defina uma nova data de encerramento.
          </div>
        )}
        <div className="mini">
          {porPDF
            ? "Validação: o aluno envia o certificado em PDF e a equipe aprova."
            : "Validação: QR Code ou código exibido no evento (aba QR Code)."}
        </div>
        {erro && <div className="form-error">{erro}</div>}
        <div className="modal-btns" style={{ marginTop: 4 }}>
          <button
            type="button"
            className="btn ghost"
            disabled={busy}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? (
              <Loader2 size={18} className="spin" />
            ) : edit ? (
              "Salvar"
            ) : rel ? (
              "Lançar agora"
            ) : (
              "Criar"
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function Desafios({ onVerQR }) {
  const [lista, setLista] = useState(null);
  const [resumo, setResumo] = useState({});
  const [form, setForm] = useState(null); // 'palestra' | 'relampago' (novo) ou { desafio } (editar)

  const carregar = useCallback(async () => {
    const [{ data: ds }, { data: rs }] = await Promise.all([
      supabase
        .from("desafios")
        .select("*")
        .eq("ativo", true)
        .order("abre_em", { ascending: false }),
      supabase.rpc("resumo_desafios"),
    ]);
    setLista(ds || []);
    setResumo(Object.fromEntries((rs || []).map((r) => [r.desafio_id, r])));
  }, []);
  useEffect(() => {
    carregar();
  }, [carregar]);

  const encerrar = async (d) => {
    const agendado = Date.now() < +new Date(d.abre_em);
    if (
      !window.confirm(
        `${agendado ? "Cancelar" : "Encerrar"} "${d.titulo}"? Quem já pontuou não perde os pontos.`,
      )
    )
      return;
    await supabase.rpc("encerrar_desafio", { p_id: d.id });
    carregar();
  };

  return (
    <>
      <div className="tab-header">
        <h1>Desafios</h1>
        <p>Crie e lance desafios para os alunos</p>
      </div>
      <div
        className="pad"
        style={{ display: "flex", gap: 10, marginBottom: 18 }}
      >
        <button
          className="btn primary grow"
          onClick={() => setForm("palestra")}
        >
          <Plus size={18} /> Novo desafio
        </button>
        <button
          className="btn ghost grow"
          style={{ color: "var(--orange)" }}
          onClick={() => setForm("relampago")}
        >
          <Zap size={18} /> Relâmpago
        </button>
      </div>

      <div className="pad stack">
        {lista === null && <div className="empty-box">Carregando…</div>}
        {lista && lista.length === 0 && (
          <div className="empty-box">Nenhum desafio criado ainda.</div>
        )}
        {lista &&
          lista.map((d) => {
            const [rot, tom] = situacao(d);
            const r = resumo[d.id] || { aprovadas: 0, pendentes: 0 };
            const aberto = rot === "Aberto";
            return (
              <div key={d.id} className="card staff-card">
                <div className="staff-row">
                  <div
                    className="challenge-icon"
                    style={{ width: 44, height: 44, borderRadius: 14 }}
                  >
                    <DataIcon name={d.icone} color="var(--blue)" size={22} />
                  </div>
                  <div className="grow">
                    <div className="challenge-title ellipsis">{d.titulo}</div>
                    <div className="mini">
                      {ROTULO[d.categoria]} · +{d.pontos} pts
                    </div>
                  </div>
                  <span className={`badge ${tom}`}>{rot}</span>
                </div>
                <div className="mini">
                  {fmt(d.abre_em)} → {fmt(d.fecha_em)}
                </div>
                <div className="mini" style={{ display: "flex", gap: 14 }}>
                  <span>
                    <Users size={12} style={{ verticalAlign: -2 }} />{" "}
                    {r.aprovadas} confirmado(s)
                  </span>
                  {d.validacao === "certificado" && (
                    <span>
                      <Hourglass size={12} style={{ verticalAlign: -2 }} />{" "}
                      {r.pendentes} pendente(s)
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {rot !== "Encerrado" && d.validacao === "qr" && (
                    <button className="redeem" onClick={() => onVerQR(d.id)}>
                      <QrCode size={14} /> Abrir QR Code
                    </button>
                  )}
                  <button
                    className="redeem off"
                    onClick={() => setForm({ desafio: d })}
                  >
                    <Pencil size={12} /> Editar
                  </button>
                  {rot !== "Encerrado" && (
                    <button className="redeem off" onClick={() => encerrar(d)}>
                      <Square size={12} /> {aberto ? "Encerrar" : "Cancelar"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
      </div>

      {form && (
        <FormDesafio
          categoriaInicial={
            typeof form === "string" ? form : form.desafio.categoria
          }
          desafio={typeof form === "string" ? undefined : form.desafio}
          onClose={() => setForm(null)}
          onCriado={() => {
            setForm(null);
            carregar();
          }}
        />
      )}
    </>
  );
}
