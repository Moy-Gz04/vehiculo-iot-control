// Cliente REST único (Fetch + async/await) para CONTROL y MONITOREO.
// Centraliza URL base, encabezados, X-API-Key, parseo JSON, errores y tiempo límite (AbortController).
import { CONFIG } from '../config.js';

export const API = (CONFIG.API_BASE || location.origin).replace(/\/+$/, '');

/** Rutas reales de la API (Swagger /docs). Un solo lugar para no repetir cadenas. */
export const rutas = {
  vehiculos: () => '/vehiculos',
  detalle: (id) => `/vehiculos/${id}/detalle`,
  estado: (id) => `/vehiculos/${id}/estado`,
  historial: (id) => `/vehiculos/${id}/historial`,
  movimientos: (id) => `/vehiculos/${id}/movimientos`,
  aviso: (id, accion) => `/vehiculos/${id}/${accion}`,          // mantener | soltar
  comandos: (id) => `/vehiculos/${id}/comandos`,
  movsDemo: (id, demo) => `/vehiculos/${id}/demos/${demo}/movimientos`,
  iniciarDemo: (id, demo) => `/vehiculos/${id}/demos/${demo}/iniciar`,
  cancelarDemo: (id) => `/vehiculos/${id}/demos/cancelar`,
  voz: () => '/voz/interpretar',
  ws: (id) => `${API.replace(/^http/, 'ws')}/ws/vehiculos/${id}`,
};

export class ErrorApi extends Error {
  /** tipo: 'http' (respondió con error), 'red' (sin respuesta), 'tiempo' (timeout), 'cancelada' (la abortó quien la pidió) */
  constructor(mensaje, { status = 0, tipo = 'http' } = {}) { super(mensaje); this.status = status; this.tipo = tipo; }
}

/**
 * Petición genérica. Lanza ErrorApi si la respuesta no es 2xx, si no hay red o si vence el tiempo.
 * @param {string} ruta   ruta relativa a la API
 * @param {object} op     { metodo, cuerpo, conClave, tiempo, signal, keepalive }
 */
export async function pedir(ruta, { metodo = 'GET', cuerpo, conClave = false, tiempo = CONFIG.TIEMPO_LIMITE_MS, signal, keepalive = false } = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort('tiempo'), tiempo);
  const alAbortar = () => ctl.abort('cancelada');
  signal?.addEventListener('abort', alAbortar, { once: true });
  const headers = { Accept: 'application/json' };
  if (cuerpo !== undefined) headers['Content-Type'] = 'application/json';
  if (conClave) headers['X-API-Key'] = CONFIG.API_KEY || '';
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
    const msg = Array.isArray(d) ? d.map((x) => x.msg).join('; ') : (typeof d === 'string' ? d : `Error HTTP ${r.status}`);
    throw new ErrorApi(msg, { status: r.status });
  }
  return datos;
}

export const get = (ruta, op = {}) => pedir(ruta, op);
/** POST de control: lleva X-API-Key y keepalive (la orden sale aunque se cierre la pestaña). */
export const post = (ruta, cuerpo, op = {}) => pedir(ruta, { ...op, metodo: 'POST', cuerpo, conClave: true, keepalive: true });

/** Para los indicadores: nunca lanza por HTTP, solo devuelve { status, cuerpo } (o lanza si no hay respuesta). */
export async function comprobar(ruta, tiempo) {
  try {
    return { status: 200, cuerpo: await pedir(ruta, { tiempo }) };
  } catch (e) {
    if (e.tipo === 'http') return { status: e.status, cuerpo: null };
    throw e;
  }
}
