import { useEffect, useMemo, useRef, useState } from "react";
import {
  Sparkles,
  Heart,
  Users,
  CircleHelp,
  Library,
  Megaphone,
  MessagesSquare,
  CodeXml,
  UtensilsCrossed,
  Ticket,
  Shirt,
  GraduationCap,
  Award,
  ShieldCheck,
  Cloud,
  Database,
} from "lucide-react";
import { hash, initials } from "../data";

const ICONS = {
  sparkles: Sparkles,
  heart: Heart,
  users: Users,
  help: CircleHelp,
  library: Library,
  megaphone: Megaphone,
  chat: MessagesSquare,
  code: CodeXml,
  food: UtensilsCrossed,
  ticket: Ticket,
  shirt: Shirt,
  school: GraduationCap,
  award: Award,
  shield: ShieldCheck,
  cloud: Cloud,
  database: Database,
};

// Renderiza um ícone a partir do nome salvo nos dados (ex.: 'sparkles')
export function DataIcon({ name, size = 26, color }) {
  const I = ICONS[name] || Sparkles;
  return <I size={size} color={color} strokeWidth={1.9} />;
}

// Número que "rola" até o novo valor e dá um pulinho
export function AnimatedNumber({ value, className }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);

  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let raf;
    const tick = (t) => {
      const p = Math.min(1, (t - start) / 900);
      const v = Math.round(a + (value - a) * (1 - Math.pow(1 - p, 3)));
      setShown(v);
      from.current = v;
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return (
    <span key={value} className={`${className} pop`}>
      {shown}
    </span>
  );
}

// Selo "+50" / "-100" que sobe e some
export function DeltaBadge({ delta }) {
  if (!delta) return null;
  const gain = delta.value > 0;
  return (
    <span key={delta.key} className={`delta ${gain ? "gain" : "loss"}`}>
      {gain ? "+" : ""}
      {delta.value}
    </span>
  );
}

export function Avatar({ name, color, size = 44, src }) {
  const box = { width: size, height: size, borderRadius: size * 0.36 };
  if (src)
    return (
      <img
        className="avatar"
        src={src}
        alt=""
        style={{ ...box, objectFit: "cover" }}
      />
    );
  return (
    <div
      className="avatar"
      style={{ ...box, background: color, fontSize: size * 0.36 }}
    >
      {initials(name)}
    </div>
  );
}

// QR "de mentirinha" gerado a partir do código do voucher
export function QRMock({ code, size = 21, cell = 8 }) {
  const grid = useMemo(() => {
    let seed = hash(code);
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const g = Array.from({ length: size }, () =>
      Array.from({ length: size }, () => rnd() > 0.5),
    );
    const finder = (ox, oy) => {
      for (let dy = -1; dy <= 7; dy++)
        for (let dx = -1; dx <= 7; dx++) {
          const x = ox + dx,
            y = oy + dy;
          if (x < 0 || y < 0 || x >= size || y >= size) continue;
          const inside = dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6;
          const border = dx === 0 || dx === 6 || dy === 0 || dy === 6;
          const core = dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4;
          g[y][x] = inside && (border || core);
        }
    };
    finder(0, 0);
    finder(size - 7, 0);
    finder(0, size - 7);
    return g;
  }, [code, size]);

  const full = size * cell + 24;
  return (
    <svg
      className="qr"
      width={full}
      height={full}
      viewBox={`0 0 ${full} ${full}`}
    >
      {grid.map((row, y) =>
        row.map(
          (on, x) =>
            on && (
              <rect
                key={`${x}-${y}`}
                x={12 + x * cell}
                y={12 + y * cell}
                width={cell}
                height={cell}
                fill="#1F2937"
              />
            ),
        ),
      )}
    </svg>
  );
}

export function Modal({ children, onClose, wide }) {
  return (
    <div className="backdrop" onClick={onClose}>
      <div
        className={`modal-card ${wide ? "wide" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
