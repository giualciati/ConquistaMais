import { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Maximize2, X, Users, TriangleAlert } from 'lucide-react';
import { supabase } from '../../lib/supabase';

// Código rotativo de 6 dígitos (muda a cada 60 s) + imagem do QR
function useCodigo(id) {
  const [codigo, setCodigo] = useState('');
  const [img, setImg] = useState('');
  const [resta, setResta] = useState(null);

  const carregar = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase.rpc('gerar_codigo', { p_desafio: id });
    if (!data) return;
    setCodigo(data.codigo);
    setResta(data.segundos);
    QRCode.toDataURL(`conquista:${id}:${data.codigo}`, { margin: 1, width: 560 }).then(setImg);
  }, [id]);

  useEffect(() => { setCodigo(''); setImg(''); setResta(null); carregar(); }, [carregar]);
  useEffect(() => {
    const t = setInterval(() => setResta((r) => (r === null ? r : Math.max(0, r - 1))), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => { if (resta === 0) carregar(); }, [resta, carregar]);

  return { codigo: codigo.replace(/(\d{3})(\d{3})/, '$1 $2'), img, resta };
}

export default function QrEvento({ selId, onSel }) {
  const [lista, setLista] = useState(null);
  const [confirmados, setConfirmados] = useState(0);
  const [cheia, setCheia] = useState(false);

  useEffect(() => {
    supabase.from('desafios').select('id, titulo, pontos, abre_em, fecha_em').eq('validacao', 'qr').eq('ativo', true)
      .gt('fecha_em', new Date().toISOString()).order('abre_em')
      .then(({ data }) => { setLista(data || []); if (data && data.length && !data.some((d) => d.id === selId)) onSel(data[0].id); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const d = lista && lista.find((x) => x.id === selId);
  const { codigo, img, resta } = useCodigo(d ? d.id : null);

  // contador de presenças confirmadas, atualizado a cada 5 s
  useEffect(() => {
    if (!d) return;
    const buscar = () => supabase.rpc('resumo_desafios').then(({ data }) => {
      const r = (data || []).find((x) => x.desafio_id === d.id);
      setConfirmados(r ? Number(r.aprovadas) : 0);
    });
    buscar();
    const t = setInterval(buscar, 5000);
    return () => clearInterval(t);
  }, [d && d.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const t = Date.now();
  const aviso = d && (t < +new Date(d.abre_em) ? 'Este desafio ainda não abriu: as validações só são aceitas depois da abertura.' : t >= +new Date(d.fecha_em) ? 'Este desafio já encerrou.' : '');

  return (
    <>
      <div className="tab-header">
        <h1>QR Code</h1>
        <p>Exiba no telão do evento para os alunos validarem</p>
      </div>

      <div className="pad stack">
        {lista === null && <div className="empty-box">Carregando…</div>}
        {lista && lista.length === 0 && <div className="empty-box">Nenhum desafio de presença aberto ou agendado. Crie uma palestra, ação ou relâmpago na aba Desafios.</div>}
        {lista && lista.length > 0 && (
          <div className="chips">
            {lista.map((x) => <button key={x.id} className={`chip ${x.id === selId ? 'on' : ''}`} onClick={() => onSel(x.id)}>{x.titulo}</button>)}
          </div>
        )}

        {d && (
          <div className="card qr-panel">
            <div className="challenge-title" style={{ textAlign: 'center' }}>{d.titulo}</div>
            {img ? <img src={img} alt="QR Code do desafio" className="qr-big" /> : <div className="qr-big" />}
            <div className="qr-code">{codigo}</div>
            <div className="card-sub">O código muda em {resta ?? '–'} s</div>
            <div className="pill green" style={{ marginBottom: 0 }}><Users size={14} /> {confirmados} presença(s) confirmada(s)</div>
            {aviso && <div className="form-error" style={{ display: 'flex', gap: 8 }}><TriangleAlert size={16} /> {aviso}</div>}
            <button className="btn primary full" onClick={() => setCheia(true)}><Maximize2 size={18} /> Tela cheia (projetar)</button>
          </div>
        )}
      </div>

      {cheia && d && (
        <div className="fullscreen-qr">
          <button className="logout-btn" style={{ position: 'absolute', top: 16, right: 16, background: 'var(--bg)', color: 'var(--graphite)' }} onClick={() => setCheia(false)} aria-label="Fechar"><X size={22} /></button>
          <h2 style={{ margin: 0, fontSize: 'clamp(20px, 4vw, 32px)' }}>{d.titulo}</h2>
          {img && <img src={img} alt="QR Code" />}
          <div className="code">{codigo}</div>
          <div className="mini">Abra o Conquista+ → Validar → Ler QR Code · muda em {resta ?? '–'} s · {confirmados} presença(s)</div>
        </div>
      )}
    </>
  );
}
