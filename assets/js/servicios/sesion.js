// Sesión del navegador (4.3): token temporal + datos visibles del usuario. NUNCA se decide el rol aquí:
// el rol que se muestra viene de la respuesta del servidor y cada petición lo vuelve a validar FastAPI.
// Se guarda en sessionStorage (se borra al cerrar la pestaña) y no en el repositorio ni en localStorage.
const CLAVE = 'iot.sesion';
const oyentes = new Set();
let actual = leer();

function leer() {
  try {
    const s = JSON.parse(sessionStorage.getItem(CLAVE) || 'null');
    return s && s.token && s.expira > Date.now() ? s : null;
  } catch { return null; }
}

function emitir(motivo) { oyentes.forEach((f) => { try { f(actual, motivo); } catch (e) { console.error(e); } }); }

export const sesion = () => actual;
export const token = () => (actual && actual.expira > Date.now() ? actual.token : null);
export const rol = () => actual?.usuario?.rol || '';

/** Guarda la sesión que devolvió POST /auth/login o POST /publico/prueba. */
export function abrir({ token: t, expira_en_s, usuario, prueba = null }) {
  actual = { token: t, expira: Date.now() + expira_en_s * 1000, usuario, prueba };
  try { sessionStorage.setItem(CLAVE, JSON.stringify(actual)); } catch { /* sin almacenamiento */ }
  emitir('inicio');
}

/** Borra la sesión local (logout, expiración o revocación detectada por un 401). */
export function cerrar(motivo = 'cierre') {
  if (!actual) return;
  actual = null;
  try { sessionStorage.removeItem(CLAVE); } catch { /* nada */ }
  emitir(motivo);
}

/** f(sesion|null, motivo) — motivo: inicio · cierre · expirada · revocada */
export function alCambiarSesion(f) { oyentes.add(f); return () => oyentes.delete(f); }
