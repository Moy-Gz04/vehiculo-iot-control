// Utilidades de DOM compartidas (sin estado de negocio).
export const $ = (s, raiz = document) => raiz.querySelector(s);
export const $$ = (s, raiz = document) => raiz.querySelectorAll(s);

/** Escapa texto que viene de la API o del WebSocket antes de insertarlo como HTML. */
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** AVANZAR -> "Avanzar", GIRAR_IZQUIERDA -> "Girar izquierda". */
export const bonito = (n) => String(n || '').replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase());

/** localStorage tolerante (modo privado de Safari, cuota llena…). v === null borra. */
export function guardado(k, v) {
  try {
    if (v === undefined) return localStorage.getItem(k);
    if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
  } catch { /* sin almacenamiento */ }
  return null;
}

export const esMovil = () => matchMedia('(pointer: coarse)').matches;
export const vibrar = (ms) => { try { navigator.vibrate && navigator.vibrate(ms); } catch { /* sin vibración */ } };
export const dormir = (ms) => new Promise((ok) => setTimeout(ok, ms));

let avisoT;
/** Mensaje flotante breve (role="status"). */
export function aviso(t, mal = false) {
  const a = $('#aviso'); if (!a) return;
  a.textContent = t; a.classList.toggle('mal', mal); a.classList.add('ver');
  clearTimeout(avisoT); avisoT = setTimeout(() => a.classList.remove('ver'), 2600);
}
