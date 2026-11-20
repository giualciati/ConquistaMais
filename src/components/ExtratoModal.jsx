import { useCallback, useEffect, useState } from "react";
import {
  MapPin,
  Trophy,
  FileCheck,
  Gift,
  Sparkles,
  Loader2,
} from "lucide-react";
import { Modal } from "./ui";
import { supabase } from "../lib/supabase";

const TIPOS = {
  checkin: ["Check-in", MapPin],
  desafio: ["Desafio", Trophy],
  certificado: ["Certificado", FileCheck],
  resgate: ["Loja", Gift],
  ajuste: ["Ajuste da equipe", Sparkles],
};
const PAGINA = 30;
const fmt = (iso) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

// De onde vieram (e para onde foram) os pontos do aluno
export default function ExtratoModal({ points, resumo, onClose }) {
  const [itens, setItens] = useState(null);
  const [mais, setMais] = useState(false);
  const [busy, setBusy] = useState(false);

  const carregar = useCallback(async (de) => {
    setBusy(true);
    const { data } = await supabase
      .from("lancamentos")
      .select("id, pontos, tipo, descricao, criado_em")
      .order("criado_em", { ascending: false })
      .order("id", { ascending: false })
      .range(de, de + PAGINA - 1);
    setBusy(false);
    setItens((atual) =>
      de === 0 ? data || [] : [...(atual || []), ...(data || [])],
    );
    setMais((data || []).length === PAGINA);
  }, []);
  useEffect(() => {
    carregar(0);
  }, [carregar]);

  return (
    <Modal wide onClose={onClose}>
      <h3 className="modal-title">Extrato de pontos</h3>

      <div className="sumario">
        <div>
          <b>{points}</b>
          <small>Saldo atual</small>
        </div>
        <div>
          <b style={{ color: "var(--success)" }}>+{resumo.ganhos_mes}</b>
          <small>Ganhos no mês</small>
        </div>
        <div>
          <b style={{ color: "var(--orange)" }}>-{resumo.gastos}</b>
          <small>Gastos na loja</small>
        </div>
      </div>

      <div style={{ alignSelf: "stretch" }}>
        {itens === null && <div className="empty-box">Carregando…</div>}
        {itens && itens.length === 0 && (
          <div className="empty-box">
            Você ainda não tem movimentações. Faça o check-in e valide um
            desafio!
          </div>
        )}
        {itens &&
          itens.map((l) => {
            const [rot, Icone] = TIPOS[l.tipo] || ["Pontos", Sparkles];
            const ganho = l.pontos > 0;
            return (
              <div key={l.id} className="ext-row">
                <div
                  className={`ext-icon ${ganho ? "soft-green" : "soft-orange"}`}
                >
                  <Icone
                    size={18}
                    color={ganho ? "var(--success)" : "var(--orange)"}
                  />
                </div>
                <div className="grow">
                  <div className="ext-title ellipsis">{l.descricao || rot}</div>
                  <div className="mini">
                    {rot} · {fmt(l.criado_em)}
                  </div>
                </div>
                <div
                  className="ext-pts"
                  style={{ color: ganho ? "var(--success)" : "var(--orange)" }}
                >
                  {ganho ? "+" : ""}
                  {l.pontos}
                </div>
              </div>
            );
          })}
        {mais && (
          <button
            className="link-btn"
            disabled={busy}
            onClick={() => carregar(itens.length)}
          >
            {busy ? <Loader2 size={14} className="spin" /> : "Mostrar mais"}
          </button>
        )}
      </div>

      <button
        className="btn ghost full"
        style={{ marginTop: 16 }}
        onClick={onClose}
      >
        Fechar
      </button>
    </Modal>
  );
}
