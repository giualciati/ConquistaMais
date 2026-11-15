/* Funções auxiliares usadas pelo app */
export const initials = (name) => name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
export const hash = (str) => { let h = 7; for (const ch of str) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
export const fmtTime = (ms) => {
  const t = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};
