import { useEffect, useState } from "react";
import { Medal } from "lucide-react";
import { Avatar } from "../components/ui";
import { supabase } from "../lib/supabase";

const MEDAL = ["#F5B301", "#9CA3AF", "#C98B5B"];
const CORES = [
  "#7C3AED",
  "#0EA5E9",
  "#F59E0B",
  "#10B981",
  "#EC4899",
  "#EF4444",
];
const MES = new Date().toLocaleDateString("pt-BR", {
  month: "long",
  timeZone: "America/Sao_Paulo",
});

function Row({ p, src }) {
  const pos = Number(p.posicao);
  return (
    <div className={`rank-row card ${p.eu ? "me" : ""}`}>
      <div className="rank-pos">
        {pos <= 3 ? <Medal size={24} color={MEDAL[pos - 1]} /> : pos}
      </div>
      <Avatar
        name={p.nome}
        color={p.eu ? "var(--orange)" : CORES[(pos - 1) % CORES.length]}
        src={src}
      />
      <div className="grow">
        <div className="rank-name ellipsis">{p.nome}</div>
        {p.eu && <div className="rank-you">Você</div>}
      </div>
      <div className="rank-pts">
        {Number(p.pontos)} <small>pts</small>
      </div>
    </div>
  );
}

export default function Ranking({ curso, points, foto }) {
  const [periodo, setPeriodo] = useState("mes"); // 'mes' | 'geral'
  const [linhas, setLinhas] = useState(null);
  const [erro, setErro] = useState(false);
  const [fotos, setFotos] = useState({});

  const trocar = (p) => {
    if (p !== periodo) {
      setLinhas(null);
      setPeriodo(p);
    }
  };

  useEffect(() => {
    let ativo = true;
    supabase
      .rpc("ranking_curso", { p_periodo: periodo })
      .then(({ data, error }) => {
        if (!ativo) return;
        if (error) return setErro(true);
        setErro(false);
        setLinhas(data || []);
        // fotos liberadas: gera links temporários (1 h) dos arquivos privados
        const paths = (data || []).map((l) => l.foto).filter(Boolean);
        if (!paths.length) return setFotos({});
        supabase.storage
          .from("avatares")
          .createSignedUrls(paths, 3600)
          .then(
            ({ data: urls }) =>
              ativo &&
              setFotos(
                Object.fromEntries(
                  (urls || [])
                    .filter((u) => u.signedUrl)
                    .map((u) => [u.path, u.signedUrl]),
                ),
              ),
          );
      });
    return () => {
      ativo = false;
    };
  }, [periodo, points]);

  const eu = linhas && linhas.find((l) => l.eu);

  return (
    <>
      <div className="tab-header">
        <h1>Ranking</h1>
        <p>
          Top 5 de {curso || "seu curso"} ·{" "}
          {periodo === "mes"
            ? `pontos ganhos em ${MES}`
            : "pontos ganhos desde o início"}
        </p>
      </div>

      <div className="seg">
        <button
          className={periodo === "mes" ? "on" : ""}
          onClick={() => trocar("mes")}
        >
          Este mês
        </button>
        <button
          className={periodo === "geral" ? "on" : ""}
          onClick={() => trocar("geral")}
        >
          Geral
        </button>
      </div>

      <div className="pad stack">
        {erro && (
          <div className="empty-box">
            Não foi possível carregar o ranking. Tente novamente.
          </div>
        )}
        {!erro && linhas === null && (
          <div className="empty-box">Carregando…</div>
        )}
        {linhas && linhas.length === 0 && (
          <div className="empty-box">Ainda não há alunos neste curso.</div>
        )}
        {linhas &&
          linhas
            .filter((l) => Number(l.posicao) <= 5)
            .map((p) => (
              <Row key={p.posicao} p={p} src={p.eu ? foto : fotos[p.foto]} />
            ))}
        {eu && Number(eu.posicao) > 5 && (
          <>
            <div className="rank-dots">• • •</div>
            <Row p={eu} src={foto} />
          </>
        )}
        <p className="mini" style={{ textAlign: "center" }}>
          O ranking conta só os pontos ganhos: trocar pontos na loja não tira
          você da disputa.
        </p>
      </div>
    </>
  );
}
