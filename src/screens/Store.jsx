import { Wallet, Lock, QrCode, ChevronRight, Target } from "lucide-react";
import { AnimatedNumber, DeltaBadge, DataIcon } from "../components/ui";

export default function Store({
  points,
  delta,
  rewards,
  vouchers,
  onRedeem,
  onOpenVoucher,
  onExtrato,
}) {
  // Próxima recompensa ainda fora do alcance (as recompensas vêm ordenadas do menor para o maior custo)
  const proximo = rewards.find(
    (r) => r.custo > points && !(r.estoque !== null && r.estoque <= 0),
  );
  const podeTudo = rewards.length > 0 && !proximo;

  return (
    <>
      <div className="tab-header">
        <h1>Loja de Recompensas</h1>
        <p>Troque seus pontos por benefícios</p>
      </div>

      <div className="balance-chip card">
        <div className="balance-icon">
          <Wallet size={22} color="var(--blue)" />
        </div>
        <div className="grow">
          <div className="label">SEU SALDO</div>
          <div className="balance-row">
            <AnimatedNumber value={points} className="balance-value" />
            <span className="balance-unit">pts</span>
          </div>
        </div>
        <DeltaBadge delta={delta} />
        <button
          className="link-btn"
          style={{ width: "auto", margin: 0, padding: 4 }}
          onClick={onExtrato}
        >
          Extrato
        </button>
      </div>

      {(proximo || podeTudo) && (
        <div className="goal card">
          <div className="goal-top">
            <Target size={18} color="var(--orange)" />
            <span className="grow">
              {proximo ? (
                <>
                  Próximo prêmio: <b>{proximo.titulo}</b>
                </>
              ) : (
                <b>Você já pode resgatar qualquer recompensa! 🎉</b>
              )}
            </span>
          </div>
          {proximo && (
            <>
              <div className="progress">
                <div
                  style={{
                    width: `${Math.min(100, (points / proximo.custo) * 100)}%`,
                  }}
                />
              </div>
              <div className="mini">
                {points} de {proximo.custo} pts · faltam{" "}
                <b>{proximo.custo - points}</b>
              </div>
            </>
          )}
        </div>
      )}

      <div className="pad stack" style={{ marginTop: 18 }}>
        {rewards.length === 0 && (
          <div className="empty-box">
            Nenhuma recompensa disponível no momento.
          </div>
        )}
        {rewards.map((r) => {
          const esgotado = r.estoque !== null && r.estoque <= 0;
          const can = points >= r.custo && !esgotado;
          return (
            <div key={r.id} className="challenge card">
              <div className="challenge-icon soft-orange">
                <DataIcon name={r.icone} color="var(--orange)" />
              </div>
              <div className="grow">
                <div className="challenge-title">{r.titulo}</div>
                <div className="challenge-desc">{r.descricao}</div>
                {r.estoque !== null && (
                  <div className="challenge-meta">
                    {esgotado ? "Esgotado" : `Restam ${r.estoque}`}
                  </div>
                )}
                <div className="challenge-footer">
                  <span className="challenge-pts">{r.custo} pts</span>
                  <button
                    className={`redeem ${can ? "" : "off"}`}
                    onClick={() => onRedeem(r)}
                  >
                    {!can && <Lock size={12} />}{" "}
                    {esgotado ? "Esgotado" : "Resgatar"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {vouchers.length > 0 && (
        <>
          <div className="section-header">
            <h2>Meus vouchers</h2>
            <span>
              {vouchers.filter((v) => v.status === "ativo").length} ativo(s)
            </span>
          </div>
          <div className="pad stack" style={{ gap: 10 }}>
            {vouchers.map((v) => (
              <button
                key={v.id}
                className="voucher-row card"
                onClick={() =>
                  onOpenVoucher({
                    codigo: v.codigo,
                    titulo: v.recompensas?.titulo,
                    usado: v.status === "usado",
                  })
                }
              >
                <QrCode size={22} color="var(--blue)" />
                <div className="grow">
                  <div className="voucher-title">{v.recompensas?.titulo}</div>
                  <div className="voucher-code">{v.codigo}</div>
                </div>
                <span
                  className={`badge ${v.status === "ativo" ? "green" : "gray"}`}
                >
                  {v.status === "ativo" ? "Ativo" : "Usado"}
                </span>
                <ChevronRight size={18} color="var(--graphite-soft)" />
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}
