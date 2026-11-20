import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

const PERIODOS = [
  ["7d", "7 dias"],
  ["mes", "Este mês"],
  ["tudo", "Tudo"],
];
const CAT = {
  palestra: "Palestra",
  curso: "Curso",
  certificado: "Certificado",
  acao: "Ação",
  relampago: "Relâmpago",
};

const Metrica = ({ valor, rotulo, sub, destaque }) => (
  <div
    className="metric"
    style={destaque ? { border: "2px solid var(--orange)" } : undefined}
  >
    <b>{valor}</b>
    <span>{rotulo}</span>
    {sub && <small>{sub}</small>}
  </div>
);

export default function Relatorio() {
  const [periodo, setPeriodo] = useState("mes");
  const [d, setD] = useState(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let ativo = true;
    setD(null);
    supabase
      .rpc("relatorio_equipe", { p_periodo: periodo })
      .then(({ data, error }) => {
        if (!ativo) return;
        if (error) return setErro(true);
        setErro(false);
        setD(data);
      });
    return () => {
      ativo = false;
    };
  }, [periodo]);

  const pct =
    d && d.alunos_total
      ? Math.round((d.alunos_ativos / d.alunos_total) * 100)
      : 0;
  const maxCheck = d ? Math.max(1, ...d.checkins_7d.map((x) => x.total)) : 1;

  return (
    <>
      <div className="tab-header">
        <h1>Relatório</h1>
        <p>Como os alunos estão usando o Conquista+</p>
      </div>
      <div className="seg">
        {PERIODOS.map(([k, n]) => (
          <button
            key={k}
            className={periodo === k ? "on" : ""}
            onClick={() => setPeriodo(k)}
          >
            {n}
          </button>
        ))}
      </div>

      <div className="pad stack">
        {erro && (
          <div className="empty-box">
            Não foi possível carregar o relatório.
          </div>
        )}
        {!erro && !d && <div className="empty-box">Carregando…</div>}
        {d && (
          <>
            <div className="metric-grid">
              <Metrica
                valor={d.alunos_ativos}
                rotulo="Alunos ativos"
                sub={`${pct}% dos ${d.alunos_total} alunos`}
              />
              <Metrica valor={d.pontos_ganhos} rotulo="Pontos distribuídos" />
              <Metrica
                valor={d.pontos_gastos}
                rotulo="Pontos trocados na loja"
              />
              <Metrica valor={d.checkins} rotulo="Check-ins" />
              <Metrica valor={d.presencas} rotulo="Presenças em eventos" />
              <Metrica
                valor={d.certificados_aprovados}
                rotulo="Certificados aprovados"
              />
              <Metrica
                valor={d.certificados_pendentes}
                rotulo="Certificados pendentes"
                sub="aguardando análise"
                destaque={d.certificados_pendentes > 0}
              />
              <Metrica
                valor={d.vouchers_emitidos}
                rotulo="Vouchers emitidos"
                sub={`${d.vouchers_ativos} ainda não retirados`}
              />
            </div>

            <div className="card staff-card">
              <div className="challenge-title">
                Check-ins nos últimos 7 dias
              </div>
              <div className="bars">
                {d.checkins_7d.map((x) => (
                  <div key={x.dia} className="bar">
                    <small>{x.total}</small>
                    <div style={{ height: `${(x.total / maxCheck) * 100}%` }} />
                    <small>{x.dia.slice(0, 5)}</small>
                  </div>
                ))}
              </div>
            </div>

            <div className="card staff-card">
              <div className="challenge-title">Desafios mais concluídos</div>
              {d.top_desafios.length === 0 && (
                <div className="mini">Sem participações no período.</div>
              )}
              {d.top_desafios.map((t, i) => (
                <div key={i} className="list-row">
                  <span className="grow ellipsis">
                    {t.titulo}{" "}
                    <span className="mini">· {CAT[t.categoria]}</span>
                  </span>
                  <b>{t.total}</b>
                </div>
              ))}
            </div>

            <div className="card staff-card">
              <div className="challenge-title">Por curso</div>
              {d.por_curso.length === 0 && (
                <div className="mini">Nenhum aluno cadastrado.</div>
              )}
              {d.por_curso.map((c, i) => (
                <div key={i} className="list-row">
                  <span className="grow ellipsis">
                    {c.curso}{" "}
                    <span className="mini">
                      · {c.ativos}/{c.alunos} ativos
                    </span>
                  </span>
                  <b>{c.pontos} pts</b>
                </div>
              ))}
            </div>

            <div className="card staff-card">
              <div className="challenge-title">Recompensas mais resgatadas</div>
              {d.top_recompensas.length === 0 && (
                <div className="mini">Nenhum resgate no período.</div>
              )}
              {d.top_recompensas.map((t, i) => (
                <div key={i} className="list-row">
                  <span className="grow ellipsis">{t.titulo}</span>
                  <b>{t.total}</b>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
