import { useEffect, useState } from 'react';
import { Medal } from 'lucide-react';
import { Avatar } from '../components/ui';
import { supabase } from '../lib/supabase';

const MEDAL = ['#F5B301', '#9CA3AF', '#C98B5B'];
const CORES = ['#7C3AED', '#0EA5E9', '#F59E0B', '#10B981', '#EC4899', '#EF4444'];

function Row({ p, src }) {
  const pos = Number(p.posicao);
  return (
    <div className={`rank-row card ${p.eu ? 'me' : ''}`}>
      <div className="rank-pos">{pos <= 3 ? <Medal size={24} color={MEDAL[pos - 1]} /> : pos}</div>
      <Avatar name={p.nome} color={p.eu ? 'var(--orange)' : CORES[(pos - 1) % CORES.length]} src={src} />
      <div className="grow">
        <div className="rank-name ellipsis">{p.nome}</div>
        {p.eu && <div className="rank-you">Você</div>}
      </div>
      <div className="rank-pts">{Number(p.pontos)} <small>pts</small></div>
    </div>
  );
}

export default function Ranking({ curso, points, foto }) {
  const [linhas, setLinhas] = useState(null);
  const [erro, setErro] = useState(false);
  const [fotos, setFotos] = useState({});

  useEffect(() => {
    supabase.rpc('ranking_curso').then(({ data, error }) => {
      if (error) return setErro(true);
      setErro(false);
      setLinhas(data || []);
      // fotos liberadas: gera links temporários (1 h) dos arquivos privados
      const paths = (data || []).map((l) => l.foto).filter(Boolean);
      if (!paths.length) return setFotos({});
      supabase.storage.from('avatares').createSignedUrls(paths, 3600).then(({ data: urls }) =>
        setFotos(Object.fromEntries((urls || []).filter((u) => u.signedUrl).map((u) => [u.path, u.signedUrl]))));
    });
  }, [points]);

  const eu = linhas && linhas.find((l) => l.eu);

  return (
    <>
      <div className="tab-header">
        <h1>Ranking</h1>
        <p>Top 5 alunos de {curso || 'seu curso'}</p>
      </div>
      <div className="pad stack">
        {erro && <div className="empty-box">Não foi possível carregar o ranking. Tente novamente.</div>}
        {!erro && linhas === null && <div className="empty-box">Carregando…</div>}
        {linhas && linhas.length === 0 && <div className="empty-box">Ainda não há alunos neste curso.</div>}
        {linhas && linhas.filter((l) => Number(l.posicao) <= 5).map((p) => <Row key={p.posicao} p={p} src={p.eu ? foto : fotos[p.foto]} />)}
        {eu && Number(eu.posicao) > 5 && (<><div className="rank-dots">• • •</div><Row p={eu} src={foto} /></>)}
      </div>
    </>
  );
}
