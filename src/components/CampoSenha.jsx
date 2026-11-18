import { useState } from "react";
import { Lock, Eye, EyeOff } from "lucide-react";

// Campo de senha com botão de olho (mostrar/ocultar)
export default function CampoSenha({
  value,
  onChange,
  placeholder = "Senha",
  autoComplete,
}) {
  const [ver, setVer] = useState(false);
  return (
    <label className="input-row">
      <Lock size={18} color="var(--graphite-soft)" />
      <input
        type={ver ? "text" : "password"}
        placeholder={placeholder}
        autoComplete={autoComplete}
        value={value}
        onChange={onChange}
      />
      <button
        type="button"
        className="eye"
        onClick={() => setVer(!ver)}
        aria-label={ver ? "Ocultar senha" : "Mostrar senha"}
      >
        {ver ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </label>
  );
}
