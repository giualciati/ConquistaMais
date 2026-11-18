import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Check, X, Loader2 } from 'lucide-react';
import { Avatar, Modal } from '../../components/ui';
import { supabase } from '../../lib/supabase';

const MOTIVOS = ['PDF ilegível', 'Certificado de outro evento', 'Nome não confere', 'Carga horária insuficiente', 'Certificado já utilizado'];
const fmt = (iso) => iso && new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const SELECT = 'id, status, motivo, arquivo_path, criado_em, validado_em, desafios:desafio_id(titulo, pontos), perfis:aluno_id(nome, matricula, turma, foto_path, foto_visivel), validadores:validado_por(nome)';

async function abrirPDF(path) {
  const w = window.open('', '_blank'); // abre antes do await para o celular não bloquear
  const { data } = await supabase.storage.from('certificados').createSignedUrl(path, 120);
  if (data && w) w.location.href = data.signedUrl; else if (w) w.close();
}

function Recusa({ item, onClose, onFeito }) {
  const [motivo, setMotivo] = useState('');
  const [busy, setBusy] = useState(false);
  const enviar = async () => {
    setBusy(true);
    await supabase.rpc('aprovar_participacao', { p_id: item.id, p_aprovar: false, p_motivo: motivo.trim() || 'Certificado não aceito' });
    setBusy(false);
    onFeito();
  };
  return (
    <Modal wide onClose={busy ? () => {} : onClose}>
      <h3 className="modal-title">Recusar certificado</h3>
      <p className="modal-text small">{item.perfis?.nome} · {item.desafios?.titulo}</p>
      <div className="chips" style={{ flexWrap: 'wrap', margin: '14px 0 10px', alignSelf: 'stretch' }}>
        {MOTIVOS.map((m) => <button key={m} type="button" className={`chip ${motivo === m ? 'on' : ''}`} style={{ maxWidth: 'none' }} onClick={() => setMotivo(m)}>{m}</button>)}
      </div>
      <div className="field"><label>Motivo (o aluno verá esta mensagem e poderá reenviar)</label>
        <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Escreva ou escolha um motivo acima" />
      </div>
      <div className="modal-btns">
        <button className="btn ghost" disabled={busy} onClick={onClose}>Cancelar</button>
        <button className="btn primary" disabled={busy} onClick={enviar}>{busy ? <Loader2 size={18} className="spin" /> : 'Recusar'}</button>
      </div>
    </Modal>
  );
}

export default function Certificados() {
  const [aba, setAba] = useState('pendentes');
  const [pend, setPend] = useState(null);
  const [hist, setHist] = useState(null);
  const [fotos, setFotos] = useState({});
  const [busy, setBusy] = useState(null);
  const [recusando, setRecusando] = useState(null);

  const carregar = useCallback(async () => {
    const [{ data: p }, { data: h }] = await Promise.all([
      supabase.from('participacoes').select(SELECT).eq('metodo', 'certificado').eq('status', 'pendente').order('criado_em'),
      supabase.from('participacoes').select(SELECT).eq('metodo', 'certificado').in('status', ['aprovado', 'recusado']).order('validado_em', { ascending: false }).limit(30),
    ]);
    setPend(p || []);
    setHist(h || []);
    const paths = (p || []).map((x) => x.perfis && x.perfis.foto_visivel && x.perfis.foto_path).filter(Boolean);
    if (paths.length) {
      const { data: urls } = await supabase.storage.from('avatares').createSignedUrls(paths, 3600);
      setFotos(Object.fromEntries((urls || []).filter((u) => u.signedUrl).map((u) => [u.path, u.signedUrl])));
    }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const aprovar = async (p) => {
    if (!window.confirm(`Aprovar o certificado de ${p.perfis?.nome}? Serão creditados +${p.desafios?.pontos} pts.`)) return;
    setBusy(p.id);
    await supabase.rpc('aprovar_participacao', { p_id: p.id, p_aprovar: true });
    setBusy(null);
    carregar();
  };

  return (
    <>
      <div className="tab-header">
        <h1>Certificados</h1>
        <p>Analise os PDFs enviados pelos alunos</p>
      </div>
      <div className="seg">
        <button className={aba === 'pendentes' ? 'on' : ''} onClick={() => setAba('pendentes')}>Pendentes{pend ? ` (${pend.length})` : ''}</button>
        <button className={aba === 'historico' ? 'on' : ''} onClick={() => setAba('historico')}>Histórico</button>
      </div>

      <div className="pad stack">
        {aba === 'pendentes' && pend && pend.length === 0 && <div className="empty-box">Nenhum certificado aguardando análise.</div>}
        {aba === 'pendentes' && pend && pend.map((p) => (
          <div key={p.id} className="card staff-card">
            <div className="staff-row">
              <Avatar name={p.perfis?.nome || '?'} color="var(--blue)" size={46} src={fotos[p.perfis?.foto_path]} />
              <div className="grow">
                <div className="challenge-title ellipsis">{p.perfis?.nome}</div>
                <div className="mini">{[p.perfis?.matricula, p.perfis?.turma].filter(Boolean).join(' · ')}</div>
              </div>
            </div>
            <div className="mini"><b>{p.desafios?.titulo}</b> · +{p.desafios?.pontos} pts · enviado em {fmt(p.criado_em)}</div>
            <button className="link-btn" style={{ textAlign: 'left', padding: 0, width: 'auto' }} onClick={() => abrirPDF(p.arquivo_path)}><ExternalLink size={13} /> Abrir PDF</button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="redeem" disabled={busy === p.id} onClick={() => aprovar(p)}><Check size={14} /> Aprovar</button>
              <button className="redeem off" disabled={busy === p.id} onClick={() => setRecusando(p)}><X size={14} /> Recusar</button>
            </div>
          </div>
        ))}

        {aba === 'historico' && hist && hist.length === 0 && <div className="empty-box">Nenhuma análise registrada ainda.</div>}
        {aba === 'historico' && hist && hist.map((p) => (
          <div key={p.id} className="card staff-card">
            <div className="staff-row">
              <div className="grow">
                <div className="challenge-title ellipsis">{p.perfis?.nome}</div>
                <div className="mini">{p.desafios?.titulo}</div>
              </div>
              <span className={`badge ${p.status === 'aprovado' ? 'green' : 'orange'}`}>{p.status === 'aprovado' ? 'Aprovado' : 'Recusado'}</span>
            </div>
            <div className="mini">{fmt(p.validado_em)}{p.validadores?.nome ? ` · por ${p.validadores.nome}` : ''}{p.motivo ? ` · Motivo: ${p.motivo}` : ''}</div>
            <button className="link-btn" style={{ textAlign: 'left', padding: 0, width: 'auto' }} onClick={() => abrirPDF(p.arquivo_path)}><ExternalLink size={13} /> Abrir PDF</button>
          </div>
        ))}
      </div>

      {recusando && <Recusa item={recusando} onClose={() => setRecusando(null)} onFeito={() => { setRecusando(null); carregar(); }} />}
    </>
  );
}
