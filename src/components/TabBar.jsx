import { House, FileText, ChartNoAxesColumn, Gift, ShieldCheck } from 'lucide-react';

const TABS = [
  { key: 'home', label: 'Início', Icon: House },
  { key: 'certs', label: 'Certif.', Icon: FileText },
  { key: 'ranking', label: 'Ranking', Icon: ChartNoAxesColumn },
  { key: 'store', label: 'Loja', Icon: Gift },
];

const EQUIPE = { key: 'equipe', label: 'Equipe', Icon: ShieldCheck };

export default function TabBar({ tab, onChange, equipe }) {
  return (
    <nav className="tabbar">
      {(equipe ? [...TABS, EQUIPE] : TABS).map(({ key, label, Icon }) => {
        const on = tab === key;
        return (
          <button key={key} className={`tab-item ${on ? 'on' : ''}`} onClick={() => onChange(key)}>
            <span className="tab-pill"><Icon size={22} strokeWidth={on ? 2.6 : 1.9} /></span>
            <span className="tab-label">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
