import {
  House,
  FileText,
  ChartNoAxesColumn,
  Gift,
  ClipboardList,
  QrCode,
  FileCheck,
  Settings,
} from "lucide-react";

const TABS = [
  { key: "home", label: "Início", Icon: House },
  { key: "certs", label: "Certif.", Icon: FileText },
  { key: "ranking", label: "Ranking", Icon: ChartNoAxesColumn },
  { key: "store", label: "Loja", Icon: Gift },
];

// Abas da equipe do Senac (painel próprio, separado do app do aluno)
export const TABS_EQUIPE = [
  { key: "desafios", label: "Desafios", Icon: ClipboardList },
  { key: "qr", label: "QR Code", Icon: QrCode },
  { key: "certs", label: "Certificados", Icon: FileCheck },
  { key: "mais", label: "Mais", Icon: Settings },
];

export default function TabBar({ tab, onChange, tabs = TABS }) {
  return (
    <nav className="tabbar">
      {tabs.map(({ key, label, Icon }) => {
        const on = tab === key;
        return (
          <button
            key={key}
            className={`tab-item ${on ? "on" : ""}`}
            onClick={() => onChange(key)}
          >
            <span className="tab-pill">
              <Icon size={22} strokeWidth={on ? 2.6 : 1.9} />
            </span>
            <span className="tab-label">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
