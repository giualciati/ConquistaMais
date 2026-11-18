import { useState } from 'react';
import { Ticket, User, KeyRound, RefreshCw, LogOut } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Avatar } from '../../components/ui';

function ValidarVoucher() {
  const [cod, setCod] = useState('');
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [foto, setFoto] = useState(null);

  const validar = async (e) => {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.rpc('usar_voucher', { p_codigo: cod });
    setBusy(false);
    setFoto(null);
    if (error) return setRes({ ok: false, texto: 'Erro ao validar. Tente de novo.' });
    if (data.ok && data.foto) supabase.storage.from('avatares').createSignedUrl(data.foto, 300).then(({ data: u }) => u && setFoto(u.signedUrl));
    if (data.ok) { setRes({ ok: true, aluno: data.aluno, texto: `${data.titulo} · ${data.aluno}` }); setCod(''); }
    else setRes({ ok: false, texto: data.motivo === 'ja_usado' ? `Voucher já utilizado (${data.titulo} · ${data.aluno})` : 'Código não encontrado.' });
  };

  return (
    <form className="card pending" style={{ flexDirection: 'column', alignItems: 'stretch' }} onSubmit={validar}>
      <label className="input-row">
        <Ticket size={18} color="var(--graphite-soft)" />
        <input placeholder="SNC-XXXX-XXXX" autoCapitalize="characters" value={cod} onChange={(e) => setCod(e.target.value.toUpperCase())} />
      </label>
      <button type="submit" className="btn primary full" disabled={!cod.trim() || busy}>Validar voucher</button>
      {res && res.ok && foto && <div style={{ alignSelf: 'center' }}><Avatar name={res.aluno || '?'} color="var(--blue)" size={96} src={foto} /></div>}
      {res && <div className={res.ok ? 'pill green' : 'form-error'} style={{ marginBottom: 0 }}>{res.ok ? 'Entregar: ' : ''}{res.texto}</div>}
    </form>
  );
}

// Senha provisória aleatória (sem letras que se confundem, como 0/O e 1/l)
const gerarSenha = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  return Array.from(crypto.getRandomValues(new Uint32Array(10)), (n) => chars[n % chars.length]).join('');
};

function RedefinirSenha() {
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    if (!window.confirm(`Redefinir a senha de "${usuario.trim()}"? O aluno será desconectado e precisará criar uma nova senha no próximo acesso.`)) return;
    setBusy(true);
    const { data, error } = await supabase.rpc('redefinir_senha', { p_usuario: usuario, p_senha: senha });
    setBusy(false);
    if (error) return setRes({ ok: false, texto: 'Erro ao redefinir. Tente de novo.' });
    if (data.ok) {
      setRes({ ok: true, texto: `Senha de ${data.nome} redefinida. Informe a senha provisória ao aluno: ${senha}` });
      setUsuario(''); setSenha('');
    } else {
      setRes({ ok: false, texto: data.motivo === 'senha_curta' ? 'A senha provisória precisa ter pelo menos 8 caracteres.' : 'Aluno não encontrado. Confira o usuário.' });
    }
  };

  return (
    <form className="card pending" style={{ flexDirection: 'column', alignItems: 'stretch' }} onSubmit={enviar}>
      <label className="input-row">
        <User size={18} color="var(--graphite-soft)" />
        <input placeholder="E-mail ou usuário do aluno" autoCapitalize="none" value={usuario} onChange={(e) => setUsuario(e.target.value)} />
      </label>
      <label className="input-row">
        <KeyRound size={18} color="var(--graphite-soft)" />
        <input placeholder="Senha provisória" autoCapitalize="none" value={senha} onChange={(e) => setSenha(e.target.value)} />
        <button type="button" className="eye" aria-label="Gerar senha" onClick={() => setSenha(gerarSenha())}><RefreshCw size={18} /></button>
      </label>
      <button type="submit" className="btn primary full" disabled={!usuario.trim() || senha.length < 8 || busy}>Redefinir senha</button>
      {res && <div className={res.ok ? 'pill green' : 'form-error'} style={{ marginBottom: 0 }}>{res.texto}</div>}
    </form>
  );
}


export default function Mais({ nome, onLogout }) {
  return (
    <>
      <div className="tab-header">
        <h1>Mais</h1>
        <p>Conectado como {nome}</p>
      </div>

      <div className="section-header" style={{ marginTop: 0 }}><h2>Validar voucher</h2></div>
      <div className="pad"><ValidarVoucher /></div>

      <div className="section-header"><h2>Redefinir senha de aluno</h2></div>
      <div className="pad"><RedefinirSenha /></div>

      <div className="pad" style={{ marginTop: 28 }}>
        <button className="btn ghost full" onClick={onLogout}><LogOut size={18} /> Sair</button>
      </div>
    </>
  );
}
