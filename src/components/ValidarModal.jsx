import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { ScanLine, Keyboard, FileUp, Loader2, ChevronLeft, CloudUpload } from 'lucide-react';
import { Modal } from './ui';
import { supabase } from '../lib/supabase';

const MSG = {
  codigo_invalido: 'Código inválido ou expirado. Confira o código mostrado pelo organizador.',
  fora_da_janela: 'Este desafio não está aberto agora.',
  ja_validado: 'Você já validou este desafio.',
  ja_enviado: 'Você já enviou um certificado para este desafio.',
  muitas_tentativas: 'Muitas tentativas erradas. Aguarde alguns minutos.',
  desafio_invalido: 'Desafio indisponível.',
};

// Lê QR Code com a câmera (jsQR funciona em Android e iPhone; exige HTTPS)
function Scanner({ onCode, onErro }) {
  const video = useRef(null);

  useEffect(() => {
    let parar = false, stream, raf;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const tick = () => {
      const v = video.current;
      if (!parar && v && v.readyState === v.HAVE_ENOUGH_DATA) {
        const k = Math.min(1, 640 / v.videoWidth); // reduz a imagem para ficar leve
        canvas.width = v.videoWidth * k;
        canvas.height = v.videoHeight * k;
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const r = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
        if (r && r.data) { parar = true; onCode(r.data); return; }
      }
      raf = requestAnimationFrame(tick);
    };

    if (!navigator.mediaDevices?.getUserMedia) {
      onErro('A câmera só funciona em conexão segura (HTTPS). Digite o código.');
    } else {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
        .then((s) => {
          if (parar) return s.getTracks().forEach((t) => t.stop());
          stream = s;
          video.current.srcObject = s;
          video.current.play();
          tick();
        })
        .catch(() => onErro('Não foi possível acessar a câmera. Permita o acesso ou digite o código.'));
    }
    return () => { parar = true; cancelAnimationFrame(raf); stream && stream.getTracks().forEach((t) => t.stop()); };
  }, []);

  return (
    <div className="scanner-box">
      <video ref={video} playsInline muted className="scanner" />
      <div className="scanner-frame" />
    </div>
  );
}

export default function ValidarModal({ item, uid, onClose, onResult }) {
  const [modo, setModo] = useState(item.validacao === 'certificado' ? 'certificado' : 'menu'); // menu | scan | codigo | certificado
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const input = useRef(null);

  const voltar = (msg = '') => { setErro(msg); setModo(item.validacao === 'certificado' ? 'certificado' : 'menu'); };

  const enviarCodigo = async (cod, metodo) => {
    setEnviando(true);
    setErro('');
    const { data, error } = await supabase.rpc('validar_presenca', { p_desafio: item.id, p_codigo: cod, p_metodo: metodo });
    setEnviando(false);
    if (error) return voltar('Erro ao validar. Tente novamente.');
    if (data.ok) return onResult(data);
    voltar(MSG[data.motivo] || 'Não foi possível validar.');
  };

  // Conteúdo do QR: conquista:<id do desafio>:<código de 6 dígitos>
  const aoLerQR = (txt) => {
    const m = /^conquista:([0-9a-f-]{36}):(\d{6})$/i.exec(txt.trim());
    if (!m) return voltar('Este QR Code não é do Conquista+.');
    if (m[1].toLowerCase() !== item.id) return voltar('Este QR Code é de outro desafio.');
    enviarCodigo(m[2], 'qr');
  };

  const enviarPDF = async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    if (f.type !== 'application/pdf') return setErro('Envie o certificado em PDF.');
    if (f.size > 5 * 1024 * 1024) return setErro('O PDF deve ter no máximo 5 MB.');
    setEnviando(true);
    setErro('');
    const path = `${uid}/${item.id}-${Date.now()}.pdf`;
    const { error: e1 } = await supabase.storage.from('certificados').upload(path, f, { contentType: 'application/pdf' });
    if (e1) { setEnviando(false); return setErro('Não foi possível enviar o arquivo. Tente novamente.'); }
    const { data, error: e2 } = await supabase.rpc('enviar_certificado', { p_desafio: item.id, p_path: path });
    setEnviando(false);
    if (e2) return setErro('Erro ao registrar o certificado. Tente novamente.');
    if (data.ok) return onResult(data);
    setErro(MSG[data.motivo] || 'Não foi possível enviar.');
  };

  return (
    <Modal onClose={enviando ? () => {} : onClose}>
      <h3 className="modal-title">{item.title}</h3>
      <span className="pts-pill">+{item.points} pts</span>
      {erro && <div className="form-error" style={{ marginTop: 14, alignSelf: 'stretch' }}>{erro}</div>}

      {modo === 'menu' && (
        <div className="opts">
          <button className="opt" onClick={() => { setErro(''); setModo('scan'); }}>
            <span className="opt-icon"><ScanLine size={22} color="var(--blue)" /></span>
            <span className="grow"><b>Ler QR Code</b><small>Aponte a câmera para o QR do evento</small></span>
          </button>
          <button className="opt" onClick={() => { setErro(''); setModo('codigo'); }}>
            <span className="opt-icon"><Keyboard size={22} color="var(--blue)" /></span>
            <span className="grow"><b>Digitar código</b><small>Use o código de 6 dígitos mostrado no telão</small></span>
          </button>
        </div>
      )}

      {modo === 'scan' && (
        <>
          {enviando ? <Loader2 size={34} className="spin" color="var(--blue)" style={{ margin: '28px 0' }} /> : (
            <Scanner onCode={aoLerQR} onErro={voltar} />
          )}
          <p className="modal-text small">Aponte para o QR Code exibido pelo organizador</p>
        </>
      )}

      {modo === 'codigo' && (
        <form className="opts" onSubmit={(e) => { e.preventDefault(); enviarCodigo(codigo, 'codigo'); }}>
          <label className="input-row">
            <Keyboard size={18} color="var(--graphite-soft)" />
            <input inputMode="numeric" maxLength={6} placeholder="000000" autoFocus value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))} style={{ letterSpacing: 6, fontWeight: 800, fontSize: 20 }} />
          </label>
          <button type="submit" className="btn primary full" disabled={codigo.length !== 6 || enviando}>
            {enviando ? <Loader2 size={18} className="spin" /> : 'Validar'}
          </button>
        </form>
      )}

      {modo === 'certificado' && (
        <div className="opts">
          <p className="modal-text small" style={{ marginTop: 0 }}>{item.desc}<br />A equipe confere o PDF e os pontos entram após a aprovação.</p>
          <input ref={input} type="file" accept="application/pdf" hidden onChange={enviarPDF} />
          <button className="btn primary full" disabled={enviando} onClick={() => input.current.click()}>
            {enviando ? <Loader2 size={18} className="spin" /> : <><CloudUpload size={20} /> Enviar certificado (PDF)</>}
          </button>
        </div>
      )}

      <div className="modal-btns">
        {(modo === 'scan' || modo === 'codigo') && !enviando && (
          <button className="btn ghost" onClick={() => voltar()}><ChevronLeft size={18} /> Voltar</button>
        )}
        <button className="btn ghost" disabled={enviando} onClick={onClose}>Fechar</button>
      </div>
    </Modal>
  );
}
