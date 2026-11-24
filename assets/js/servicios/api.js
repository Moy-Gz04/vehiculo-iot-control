// Cliente REST único (Fetch + async/await) para CONTROL, MONITOREO y ADMINISTRACIÓN.
// Centraliza URL base, encabezados, token de sesión (Authorization: Bearer), parseo JSON, errores y tiempo límite.
// 4.3: ya no envía X-API-Key. Un 401 cierra la sesión local (token vencido o revocado en el servidor).
import { CONFIG } from '../config.js';
import * as sesion from './sesion.js';

// Si la plataforma la sirve la propia API (EC2 /plataforma/), se usa el mismo origen.
export const API = (location.pathname.startsWith('/plataforma') ? location.origin : (CONFIG.API_BASE || location.origin)).replace(/\/+$/, '');

/** Rutas reales de la API (Swagger /docs). Un solo lugar para no repetir cadenas. */
export const rutas = {
  vehiculos: () => '/vehiculos',
  detalle: (id) => `/vehiculos/${id}/detalle`,
  estado: (id) => `/vehiculos/${id}/estado`,
  historial: (id) => `/vehiculos/${id}/historial`,
  movimientos: (id) => `/vehiculos/${id}/movimientos`,
  aviso: (id, accion) => `/vehiculos/${id}/${accion}`,          // mantener | soltar
  comandos: (id) => `/vehiculos/${id}/comandos`,
  demos: (id) => `/vehiculos/${id}/demos`,
  demo: (id, demo, accion) => `/vehiculos/${id}/demos/${demo}/${accion}`,   // actualizar | eliminar
  pasos: (id, demo) => `/vehiculos/${id}/demos/${demo}/pasos`,
  movsDemo: (id, demo) => `/vehiculos/${id}/demos/${demo}/movimientos`,
  iniciarDemo: (id, demo) => `/vehiculos/${id}/demos/${demo}/iniciar`,
  cancelarDemo: (id) => `/vehiculos/${id}/demos/cancelar`,
  voz: () => '/voz/interpretar',
  // 4.3
  login: () => '/auth/login',
  logout: () => '/auth/logout',
  yo: () => '/auth/yo',
  catalogo: () => '/publico/catalogo',
  prueba: () => '/publico/prueba',
  soporte: (id) => `/mis/vehiculos/${id}/soporte`,
  admin: (r) => `/admin/${r}`,
  ws: (id) => `${API.replace(/^http/, 'ws')}/ws/vehiculos/${id}?token=${encodeURIComponent(sesion.token() || '')}`,
};

export class ErrorApi extends Error {
  /** tipo: 'http' (respondió con error), 'red' (sin respuesta), 'tiempo' (timeout), 'cancelada' (la abortó quien la pidió) */
  constructor(mensaje, { status = 0, tipo = 'http' } = {}) { super(mensaje); this.status = status; this.tipo = tipo; }
}

/**
 * Petición genérica. Lanza ErrorApi si la respuesta no es 2xx, si no hay red o si vence el tiempo.
 * @param {string} ruta   ruta relativa a la API
 * @param {object} op     { metodo, cuerpo, tiempo, signal, keepalive, sinSesion }
 */
export async function pedir(ruta, { metodo = 'GET', cuerpo, tiempo = CONFIG.TIEMPO_LIMITE_MS, signal, keepalive = false, sinSesion = false } = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort('tiempo'), tiempo);
  const alAbortar = () => ctl.abort('cancelada');
  signal?.addEventListener('abort', alAbortar, { once: true });
  const headers = { Accept: 'application/json' };
  if (cuerpo !== undefined) headers['Content-Type'] = 'application/json';
  const tk = sinSesion ? null : sesion.token();
  if (tk) headers.Authorization = `Bearer ${tk}`;
  let r;
  try {
    r = await fetch(API + ruta, {
      method: metodo, headers, keepalive, cache: 'no-store', signal: ctl.signal,
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
    });
  } catch {
    if (ctl.signal.aborted && ctl.signal.reason === 'cancelada') throw new ErrorApi('Solicitud cancelada', { tipo: 'cancelada' });
    if (ctl.signal.aborted) throw new ErrorApi('El servidor tardó demasiado en responder', { tipo: 'tiempo' });
    throw new ErrorApi('Sin respuesta del servidor (red o CORS)', { tipo: 'red' });
  } finally {
    clearTimeout(t); signal?.removeEventListener('abort', alAbortar);
  }
  let datos = null;
  try { datos = await r.json(); } catch { /* sin cuerpo JSON */ }
  if (!r.ok) {
    const d = datos && datos.detail;
    const msg = Array.isArray(d) ? d.map((x) => `${x.loc?.slice(-1)[0] ?? ''}: ${x.msg}`).join('; ') : (typeof d === 'string' ? d : `Error HTTP ${r.status}`);
    if (r.status === 401 && tk && sesion.token() === tk) sesion.cerrar('expirada');
    throw new ErrorApi(msg, { status: r.status });
  }
  return datos;
}

export const get = (ruta, op = {}) => pedir(ruta, op);
/** POST de control: keepalive (la orden sale aunque se cierre la pestaña). */
export const post = (ruta, cuerpo, op = {}) => pedir(ruta, { ...op, metodo: 'POST', cuerpo, keepalive: true });
export const put = (ruta, cuerpo, op = {}) => pedir(ruta, { ...op, metodo: 'PUT', cuerpo });
export const del = (ruta, op = {}) => pedir(ruta, { ...op, metodo: 'DELETE' });

/** Para los indicadores: nunca lanza por HTTP, solo devuelve { status, cuerpo } (o lanza si no hay respuesta). */
export async function comprobar(ruta, tiempo) {
  try {
    return { status: 200, cuerpo: await pedir(ruta, { tiempo, sinSesion: true }) };
  } catch (e) {
    if (e.tipo === 'http') return { status: e.status, cuerpo: null };
    throw e;
  }
}
