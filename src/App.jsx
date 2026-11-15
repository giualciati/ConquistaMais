import { useEffect, useRef, useState, useCallback } from 'react';
import { CheckCircle2, CircleAlert } from 'lucide-react';
import Login from './screens/Login';
import TrocarSenha from './screens/TrocarSenha';
import Home from './screens/Home';
import Certs from './screens/Certs';
import Ranking from './screens/Ranking';
import Store from './screens/Store';
import Equipe from './screens/Equipe';
import TabBar from './components/TabBar';
import ValidarModal from './components/ValidarModal';
import FotoModal from './components/FotoModal';
import { GpsModal, VoucherModal } from './components/Modals';
import { supabase, hojeSP } from './lib/supabase';

const MSG_RESGATE = {
  esgotado: 'Esta recompensa esgotou.',
  indisponivel: 'Esta recompensa não está mais disponível.',
};

export default function App() {
  const [perfil, setPerfil] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [points, setPoints] = useState(0); // saldo REAL: soma dos lançamentos no banco
  const [tab, setTab] = useState('home');
  const [delta, setDelta] = useState(null);
  const [challenges, setChallenges] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [checkedIn, setCheckedIn] = useState(false);
  const [gps, setGps] = useState(false);
  const [validar, setValidar] = useState(null);
  const [voucherView, setVoucherView] = useState(null);
  const [toast, setToast] = useState(null);
  const [fotoUrl, setFotoUrl] = useState(null);
  const [fotoModal, setFotoModal] = useState(false);

  const user = perfil && !perfil.trocar_senha ? perfil.nome.split(' ')[0] : null;
  const checkinRef = useRef(0);
  const toastTimer = useRef(null);
  const flashVisto = useRef(null);

  const showToast = useCallback((title, sub, type = 'success') => {
    clearTimeout(toastTimer.current);
    setToast({ title, sub, type, key: Date.now() });
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const ganhou = (valor) => setDelta({ key: Date.now(), value: valor });

  /* ---- Dados do servidor ---- */
  const atualizarSaldo = useCallback(async () => {
    const { data } = await supabase.rpc('meu_saldo');
    if (typeof data === 'number') setPoints(data);
  }, []);

  const carregarDesafios = useCallback(async () => {
    const [{ data: ds }, { data: ps }] = await Promise.all([
      supabase.from('desafios').select('*').eq('ativo', true).order('fecha_em'),
      supabase.from('participacoes').select('desafio_id, status'),
    ]);
    const meus = Object.fromEntries((ps || []).map((p) => [p.desafio_id, p.status]));
    const agora = Date.now();
    setChallenges((ds || []).map((d) => ({
      ...d, title: d.titulo, desc: d.descricao, points: d.pontos, icon: d.icone,
      status: meus[d.id] || (agora < new Date(d.abre_em) ? 'breve' : agora > new Date(d.fecha_em) ? 'encerrado' : 'disponivel'),
    })));
  }, []);

  const carregarLoja = useCallback(async () => {
    const [{ data: rs }, { data: vs }] = await Promise.all([
      supabase.from('recompensas').select('*').eq('ativo', true).order('custo'),
      supabase.from('resgates').select('id, codigo, status, criado_em, recompensas:recompensa_id(titulo)').order('criado_em', { ascending: false }),
    ]);
    setRewards(rs || []);
    setVouchers(vs || []);
  }, []);

  const carregarPerfil = useCallback(async (uid) => {
    const { data } = await supabase.from('perfis').select('*').eq('id', uid).single();
    setPerfil(data);
    if (data && !data.trocar_senha) {
      const { data: c } = await supabase.from('checkins').select('id').eq('dia', hojeSP());
      setCheckedIn(!!(c && c.length));
      atualizarSaldo();
      carregarDesafios();
    }
  }, [atualizarSaldo, carregarDesafios]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) return setCarregando(false);
      carregarPerfil(data.session.user.id).finally(() => setCarregando(false));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((evento, session) => {
      if (evento === 'SIGNED_OUT') setPerfil(null);
      // setTimeout evita travar o cliente do Supabase ao fazer chamadas dentro do callback
      else if (evento === 'SIGNED_IN' && session) setTimeout(() => carregarPerfil(session.user.id), 0);
    });
    return () => sub.subscription.unsubscribe();
  }, [carregarPerfil]);

  // Foto do perfil: link temporário gerado a partir do arquivo privado
  const fotoPath = perfil ? perfil.foto_path : null;
  useEffect(() => {
    if (!fotoPath) return setFotoUrl(null);
    supabase.storage.from('avatares').createSignedUrl(fotoPath, 3600).then(({ data }) => setFotoUrl(data ? data.signedUrl : null));
  }, [fotoPath]);

  // Ao trocar de aba, o saldo é reconfirmado no servidor (e a loja é recarregada)
  useEffect(() => {
    if (!user) return;
    atualizarSaldo();
    if (tab === 'store') carregarLoja();
  }, [user, tab, atualizarSaldo, carregarLoja]);

  // Desafios (inclusive os relâmpago) são atualizados a cada 30 s
  useEffect(() => {
    if (!user) return;
    const id = setInterval(carregarDesafios, 30000);
    return () => clearInterval(id);
  }, [user, carregarDesafios]);

  // Desafio relâmpago aberto agora (lançado pela equipe)
  const flash = challenges.find((c) => c.categoria === 'relampago' && c.status === 'disponivel') || null;
  const flashId = flash ? flash.id : null;
  useEffect(() => {
    if (flash && flashVisto.current !== flash.id) {
      flashVisto.current = flash.id;
      showToast('⚡ Desafio relâmpago!', `${flash.title} · +${flash.points} pts`);
    }
  }, [flashId]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- Check-in real: o app envia a posição e o BANCO decide se está dentro do raio ---- */
  const openCheckin = () => {
    const id = ++checkinRef.current;
    const ativo = () => checkinRef.current === id;
    const falhar = (t, sub) => { if (ativo()) { setGps(false); showToast(t, sub, 'error'); } };
    setGps(true);
    if (!window.isSecureContext) return falhar('Conexão não segura', 'Abra o app por um endereço que comece com https://');
    if (!navigator.geolocation) return falhar('GPS indisponível', 'Este navegador não oferece localização');

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        if (!ativo()) return;
        const { data, error } = await supabase.rpc('fazer_checkin', {
          p_lat: coords.latitude, p_lng: coords.longitude, p_precisao: Math.round(coords.accuracy),
        });
        if (!ativo()) return;
        setGps(false);
        if (error) return showToast('Erro no check-in', 'Tente novamente em instantes', 'error');
        if (data.ok) {
          setCheckedIn(true);
          setPoints(data.saldo);
          ganhou(data.pontos);
          showToast('Pontos resgatados!', `+${data.pontos} pts · Check-in no Senac`);
        } else if (data.motivo === 'ja_fez') {
          setCheckedIn(true);
          showToast('Check-in já realizado', 'Volte amanhã para ganhar de novo', 'error');
        } else if (data.motivo === 'precisao') {
          showToast('Sinal de GPS fraco', `Precisão de ${Math.round(coords.accuracy)} m. Vá para um local aberto e tente de novo`, 'error');
        } else {
          showToast('Você está longe do campus', `Distância: ${data.distancia} m (limite: ${data.raio} m)`, 'error');
        }
      },
      (err) => {
        if (err.code === 1) return falhar('Localização bloqueada', 'Libere a localização do site e do navegador nas configurações do celular');
        if (err.code === 3) return falhar('Demorou para achar sua posição', 'Vá para um local aberto e tente de novo');
        falhar('Localização indisponível', 'Ative a localização do aparelho');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  /* ---- Desafios: pontos entram no saldo ---- */
  const aposValidar = (r) => {
    setValidar(null);
    carregarDesafios();
    if (r.pendente) return showToast('Certificado enviado!', 'Os pontos entram após a aprovação da equipe');
    setPoints(r.saldo);
    ganhou(r.pontos);
    showToast('Pontos resgatados!', `+${r.pontos} pts · ${r.titulo}`);
  };

  /* ---- Loja: resgate DIMINUI o saldo ---- */
  const redeem = async (r) => {
    if (r.estoque !== null && r.estoque <= 0) return showToast('Recompensa esgotada', r.titulo, 'error');
    if (points < r.custo) return showToast('Saldo insuficiente', `Faltam ${r.custo - points} pts para resgatar`, 'error');
    if (!window.confirm(`Resgatar "${r.titulo}" por ${r.custo} pts?`)) return;

    const { data, error } = await supabase.rpc('resgatar_recompensa', { p_recompensa: r.id });
    if (error) return showToast('Erro no resgate', 'Tente novamente em instantes', 'error');
    if (!data.ok) {
      atualizarSaldo(); carregarLoja();
      return showToast(data.motivo === 'saldo_insuficiente' ? 'Saldo insuficiente' : 'Não foi possível resgatar',
        data.motivo === 'saldo_insuficiente' ? `Faltam ${data.faltam} pts` : MSG_RESGATE[data.motivo] || 'Tente novamente', 'error');
    }
    setPoints(data.saldo);
    ganhou(-data.custo);
    carregarLoja();
    setVoucherView({ codigo: data.codigo, titulo: data.titulo, usado: false });
  };

  const logout = async () => {
    await supabase.auth.signOut();
    checkinRef.current += 1;
    flashVisto.current = null;
    setPerfil(null); setFotoUrl(null); setFotoModal(false); setValidar(null); setVoucherView(null); setGps(false); setTab('home');
    setPoints(0); setDelta(null); setChallenges([]); setRewards([]); setVouchers([]); setCheckedIn(false);
  };

  const homeActive = user && tab === 'home';

  return (
    <div className="app">
      {homeActive && <div className="header-bg" />}

      <main className="screen" key={user ? tab : 'login'}>
        {carregando && <div className="login-wrap"><p className="tagline" style={{ margin: 0 }}>Carregando…</p></div>}
        {!carregando && !perfil && <Login />}
        {!carregando && perfil && perfil.trocar_senha && (
          <TrocarSenha nome={perfil.nome.split(' ')[0]} onDone={() => carregarPerfil(perfil.id)} onSair={logout} />
        )}
        {homeActive && (
          <Home name={user} foto={fotoUrl} onFoto={() => setFotoModal(true)} points={points} delta={delta} challenges={challenges} flash={flash} checkedIn={checkedIn}
            onCheckin={openCheckin} onChallenge={setValidar} onFlash={setValidar} onLogout={logout} />
        )}
        {user && tab === 'certs' && <Certs challenges={challenges} onPress={setValidar} />}
        {user && tab === 'ranking' && <Ranking curso={perfil.curso} points={points} foto={fotoUrl} />}
        {user && tab === 'store' && (
          <Store points={points} delta={delta} rewards={rewards} vouchers={vouchers} onRedeem={redeem} onOpenVoucher={setVoucherView} />
        )}
        {user && tab === 'equipe' && perfil.papel === 'equipe' && <Equipe />}
      </main>

      {user && <TabBar tab={tab} onChange={setTab} equipe={perfil.papel === 'equipe'} />}

      {toast && (
        <div key={toast.key} className={`toast ${user ? 'with-tabs' : ''}`}>
          {toast.type === 'error' ? <CircleAlert size={26} color="var(--orange)" /> : <CheckCircle2 size={26} color="#4ADE80" />}
          <div className="grow">
            <div className="toast-title">{toast.title}</div>
            <div className="toast-text">{toast.sub}</div>
          </div>
        </div>
      )}

      <GpsModal open={gps} onCancel={() => { checkinRef.current += 1; setGps(false); }} />
      {validar && <ValidarModal item={validar} uid={perfil.id} onClose={() => setValidar(null)} onResult={aposValidar} />}
      {fotoModal && (
        <FotoModal perfil={perfil} fotoUrl={fotoUrl} onClose={() => setFotoModal(false)} onRefresh={() => carregarPerfil(perfil.id)}
          onSaved={() => { setFotoModal(false); carregarPerfil(perfil.id); showToast('Foto atualizada!', 'Seu perfil foi salvo'); }} />
      )}
      <VoucherModal voucher={voucherView} onClose={() => setVoucherView(null)} />
    </div>
  );
}
