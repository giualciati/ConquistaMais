import { useRef, useState } from 'react';
import { Camera, Loader2, Trash2 } from 'lucide-react';
import { Modal, Avatar } from './ui';
import { supabase } from '../lib/supabase';

// Recorta no centro (quadrado), reduz para 512 px e salva como JPEG.
// Ao redesenhar no canvas, os metadados da foto (inclusive GPS) são descartados.
function quadrada(file, lado = 512) {
  return new Promise((ok, falha) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const s = Math.min(img.naturalWidth, img.naturalHeight);
      const c = document.createElement('canvas');
      c.width = c.height = lado;
      c.getContext('2d').drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, lado, lado);
      URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? ok(b) : falha(new Error('blob'))), 'image/jpeg', 0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(url); falha(new Error('img')); };
    img.src = url;
  });
}

export default function FotoModal({ perfil, fotoUrl, onClose, onSaved, onRefresh }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');
  const [visivel, setVisivel] = useState(!!perfil.foto_visivel);

  const escolher = async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    if (!f.type.startsWith('image/')) return setErro('Escolha uma imagem (JPG, PNG ou WebP).');
    setBusy(true);
    setErro('');
    try {
      const blob = await quadrada(f);
      const path = `${perfil.id}/avatar-${Date.now()}.jpg`;
      const { error: e1 } = await supabase.storage.from('avatares').upload(path, blob, { contentType: 'image/jpeg' });
      if (e1) throw e1;
      const { error: e2 } = await supabase.rpc('salvar_foto', { p_path: path });
      if (e2) throw e2;
      if (perfil.foto_path) await supabase.storage.from('avatares').remove([perfil.foto_path]); // apaga a foto antiga
      onSaved();
    } catch {
      setBusy(false);
      setErro('Não foi possível salvar a foto. Tente outra imagem.');
    }
  };

  const mudarVisivel = async (e) => {
    const v = e.target.checked;
    setVisivel(v);
    setErro('');
    const { error } = await supabase.rpc('definir_visibilidade_foto', { p_visivel: v });
    if (error) { setVisivel(!v); return setErro('Não foi possível alterar a visibilidade.'); }
    onRefresh();
  };

  const remover = async () => {
    setBusy(true);
    setErro('');
    const { error } = await supabase.rpc('salvar_foto', { p_path: null });
    if (error) { setBusy(false); return setErro('Não foi possível remover a foto.'); }
    await supabase.storage.from('avatares').remove([perfil.foto_path]);
    onSaved();
  };

  return (
    <Modal onClose={busy ? () => {} : onClose}>
      <h3 className="modal-title" style={{ marginBottom: 16 }}>Foto do perfil</h3>
      <Avatar name={perfil.nome} color="var(--blue)" size={110} src={fotoUrl} />
      {fotoUrl && (
        <label className="toggle-row">
          <span className="grow">
            <b>Mostrar para colegas e equipe</b>
            <small>Colegas do seu curso e a equipe do Senac veem sua foto no ranking e nas validações. Você pode desligar quando quiser.</small>
          </span>
          <input type="checkbox" role="switch" className="switch" checked={visivel} disabled={busy} onChange={mudarVisivel} />
        </label>
      )}
      {!fotoUrl && <p className="modal-text small">Depois de enviar, você escolhe quem pode ver sua foto.</p>}
      {erro && <div className="form-error" style={{ marginTop: 12, alignSelf: 'stretch' }}>{erro}</div>}

      <div className="opts">
        <input ref={input} type="file" accept="image/*" hidden onChange={escolher} />
        <button className="btn primary full" disabled={busy} onClick={() => input.current.click()}>
          {busy ? <Loader2 size={18} className="spin" /> : <><Camera size={20} /> {fotoUrl ? 'Trocar foto' : 'Tirar ou escolher foto'}</>}
        </button>
        {fotoUrl && <button className="btn ghost full" disabled={busy} onClick={remover}><Trash2 size={18} /> Remover foto</button>}
        <button className="btn ghost full" disabled={busy} onClick={onClose}>Fechar</button>
      </div>
    </Modal>
  );
}
