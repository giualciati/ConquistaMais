import { useEffect, useState } from 'react';
import { LogOut, MapPin, CheckCircle2, Hourglass, Zap, Clock, ArrowRight, ScanLine, FileUp, Camera } from 'lucide-react';
import { Avatar, AnimatedNumber, DeltaBadge, DataIcon } from '../components/ui';
import { fmtTime } from '../data';

const STATUS = {
  disponivel: ['Disponível', 'blue'], pendente: ['Em análise', 'orange'], aprovado: ['Concluído', 'green'],
  recusado: ['Recusado', 'orange'], encerrado: ['Encerrado', 'gray'], breve: ['Em breve', 'gray'],
};
const GRUPOS = [['palestra', 'Palestras'], ['curso', 'Cursos'], ['certificado', 'Certificados de participação'], ['acao', 'Ações no campus']];
const fmtData = (iso) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

export function ChallengeCard({ item, onPress }) {
  const [label, tone] = STATUS[item.status] || STATUS.disponivel;
  const aberto = item.status === 'disponivel' || item.status === 'recusado';
  return (
    <button className={`challenge card ${aberto ? '' : 'done'}`} disabled={!aberto} onClick={() => onPress(item)}>
      <div className={`challenge-icon ${item.status === 'aprovado' ? 'soft-green' : ''}`}>
        {item.status === 'aprovado' ? <CheckCircle2 size={26} color="var(--success)" /> : <DataIcon name={item.icon} color="var(--blue)" />}
      </div>
      <div className="grow">
        <div className="challenge-title">{item.title}</div>
        <div className="challenge-desc">{item.desc}</div>
        <div className="challenge-meta">
          {item.validacao === 'qr' ? <ScanLine size={12} /> : <FileUp size={12} />}
          {item.validacao === 'qr' ? 'QR Code ou código' : 'Certificado em PDF'} · até {fmtData(item.fecha_em)}
        </div>
        <div className="challenge-footer">
          <span className="challenge-pts">+{item.points} pts</span>
          {aberto
            ? <span className="validate-btn">{item.status === 'recusado' ? 'Reenviar' : 'Validar'}</span>
            : <span className={`badge ${tone}`}>{label}</span>}
        </div>
      </div>
    </button>
  );
}

function FlashCard({ flash, onPress }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!flash) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [flash && flash.id]);

  const left = flash ? new Date(flash.fecha_em) - now : 0;
  if (!flash || left <= 0) {
    return (
      <div className="flash-empty">
        <Hourglass size={22} color="var(--graphite-soft)" />
        <span>Nenhum desafio relâmpago agora. Fique de olho!</span>
      </div>
    );
  }

  const pct = Math.min(1, left / (new Date(flash.fecha_em) - new Date(flash.abre_em)));

  return (
    <div className="flash card">
      <div className="flash-top">
        <span className="flash-bolt"><Zap size={18} color="var(--orange)" fill="var(--orange)" /></span>
        <span className="flash-tag">DESAFIO RELÂMPAGO</span>
        <span className="flash-timer"><Clock size={14} /> {fmtTime(left)}</span>
      </div>
      <div className="flash-title">{flash.title}</div>
      <div className="flash-desc">{flash.desc}</div>
      <div className="flash-track"><div className="flash-fill" style={{ width: `${pct * 100}%` }} /></div>
      <div className="flash-bottom">
        <span className="flash-pts">+{flash.points} pts</span>
        <button className="flash-btn" onClick={() => onPress(flash)}>Validar <ArrowRight size={14} /></button>
      </div>
    </div>
  );
}

export default function Home({ name, foto, onFoto, points, delta, challenges, flash, checkedIn, onCheckin, onChallenge, onFlash, onLogout }) {
  const done = challenges.filter((c) => c.status === 'aprovado').length;

  return (
    <>
      <header className="header">
        <div>
          <div className="hello">Olá,</div>
          <div className="header-name">{name}</div>
        </div>
        <button className="logout-btn" onClick={onLogout} aria-label="Sair"><LogOut size={20} /></button>
      </header>

      <section className="points-card card">
        <div className="points-top">
          <button className="avatar-btn" onClick={onFoto} aria-label="Alterar foto do perfil">
            <Avatar name={name} color="var(--blue)" size={46} src={foto} />
            <span className="cam"><Camera size={11} /></span>
          </button>
          <div className="grow">
            <div className="card-name">{name}</div>
            <div className="card-sub">{done}/{challenges.length} desafios concluídos</div>
          </div>
        </div>

        <div className="label">SALDO DE PONTOS</div>
        <div className="points-row">
          <AnimatedNumber value={points} className="points-value" />
          <span className="points-unit">pts</span>
          <DeltaBadge delta={delta} />
        </div>

        <button className={`btn primary full scan ${checkedIn ? 'done' : ''}`} disabled={checkedIn} onClick={onCheckin}>
          {checkedIn ? <CheckCircle2 size={20} /> : <MapPin size={20} fill="currentColor" />}
          {checkedIn ? 'Check-in realizado hoje' : 'Check-in por localização'}
        </button>
        {!checkedIn && <div className="scan-hint">Válido dentro de 200 m do campus Senac</div>}
      </section>

      <div className="pad" style={{ marginTop: 22 }}><FlashCard flash={flash} onPress={onFlash} /></div>

      <div className="section-header">
        <h2>Desafios</h2>
        <span>Toque para registrar</span>
      </div>
      {challenges.length === 0 && <div className="pad"><div className="empty-box">Nenhum desafio disponível no momento.</div></div>}
      {GRUPOS.map(([cat, titulo]) => {
        const itens = challenges.filter((c) => c.categoria === cat);
        return itens.length > 0 && (
          <div key={cat} className="pad" style={{ marginBottom: 22 }}>
            <h3 className="group-title">{titulo}</h3>
            <div className="stack">{itens.map((c) => <ChallengeCard key={c.id} item={c} onPress={onChallenge} />)}</div>
          </div>
        );
      })}
    </>
  );
}
