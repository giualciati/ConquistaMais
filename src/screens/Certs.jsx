import { Award } from 'lucide-react';
import { ChallengeCard } from './Home';

// Certificados reais: lista os desafios que pedem PDF, com o status de cada envio
export default function Certs({ challenges, onPress }) {
  const itens = challenges.filter((c) => c.validacao === 'certificado');
  const ganhos = itens.filter((c) => c.status === 'aprovado').reduce((a, c) => a + c.points, 0);

  return (
    <>
      <div className="tab-header">
        <h1>Certificados</h1>
        <p>Envie o PDF e ganhe pontos após a aprovação da equipe</p>
      </div>
      <div className="section-header" style={{ marginTop: 0 }}>
        <h2>Meus envios</h2>
        <span>{ganhos > 0 ? `${ganhos} pts conquistados` : `${itens.length} desafio(s)`}</span>
      </div>
      <div className="pad stack">
        {itens.length === 0 && (
          <div className="empty-box"><Award size={26} color="var(--graphite-soft)" /><span>Nenhum desafio de certificado aberto.</span></div>
        )}
        {itens.map((c) => <ChallengeCard key={c.id} item={c} onPress={onPress} />)}
      </div>
    </>
  );
}
