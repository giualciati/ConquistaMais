import { useState } from 'react';
import { Trophy, User, Lock, ArrowRight, Loader2 } from 'lucide-react';
import { supabase, emailDe } from '../lib/supabase';

export default function Login() {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!user.trim() || !pass) return setErro('Informe usuário e senha.');
    setLoading(true);
    setErro('');
    const { error } = await supabase.auth.signInWithPassword({ email: emailDe(user), password: pass });
    setLoading(false);
    if (error) setErro('Usuário ou senha incorretos.');
    // Em caso de sucesso, o App detecta a sessão (onAuthStateChange) e muda de tela.
  };

  return (
    <div className="login-wrap">
      <div className="logo"><Trophy size={34} color="#fff" fill="#fff" /></div>
      <h1 className="brand">Conquista<span>+</span></h1>
      <p className="tagline">Participe, conquiste e acumule pontos.</p>

      <form className="form-card card" onSubmit={submit}>
        <label className="input-row">
          <User size={18} color="var(--graphite-soft)" />
          <input placeholder="Usuário" autoCapitalize="none" autoComplete="username" value={user} onChange={(e) => setUser(e.target.value)} />
        </label>
        <label className="input-row">
          <Lock size={18} color="var(--graphite-soft)" />
          <input type="password" placeholder="Senha" autoComplete="current-password" value={pass} onChange={(e) => setPass(e.target.value)} />
        </label>
        {erro && <div className="form-error">{erro}</div>}
        <button type="submit" className="btn primary full" disabled={loading}>
          {loading ? <Loader2 size={18} className="spin" /> : <>Entrar <ArrowRight size={18} /></>}
        </button>
      </form>
    </div>
  );
}
