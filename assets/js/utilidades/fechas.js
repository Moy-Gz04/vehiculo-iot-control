// Fecha y hora: normaliza lo que llega de RDS y del WebSocket sin inventar marcas temporales.
//  - RDS (vía FastAPI) devuelve DATETIME sin zona: "2026-11-11T18:43:32"  -> se interpreta en CONFIG.ZONA_BD (UTC).
//  - Los eventos WSS traen ISO 8601 con zona: "2026-11-13T15:08:55.822400+00:00".
// Se muestran en CONFIG.ZONA_VISTA (centro de México). Si el dato falta o no es válido -> null (se muestra «—»).
import { CONFIG } from '../config.js';

const CON_ZONA = /([zZ]|[+-]\d{2}:?\d{2})$/;

/** Convierte un valor del backend a Date; null si no existe o no es una fecha válida. */
export function aFecha(valor) {
  if (typeof valor !== 'string' || !valor.trim()) return null;
  let v = valor.trim();
  // Python manda microsegundos (6 dígitos); se recortan a milisegundos para todos los navegadores
  v = v.replace(/(\.\d{3})\d+/, '$1');
  if (!CON_ZONA.test(v)) v += CONFIG.ZONA_BD === 'UTC' ? 'Z' : '';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

const opciones = { timeZone: CONFIG.ZONA_VISTA };
const fFecha = new Intl.DateTimeFormat('es-MX', { ...opciones, day: '2-digit', month: '2-digit', year: 'numeric' });
const fHora = new Intl.DateTimeFormat('es-MX', { ...opciones, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
const fHoraCorta = new Intl.DateTimeFormat('es-MX', { ...opciones, hour: '2-digit', minute: '2-digit', hour12: false });
const fZona = new Intl.DateTimeFormat('es-MX', { ...opciones, timeZoneName: 'short' });

export const fecha = (d) => (d ? fFecha.format(d) : '—');
export const hora = (d) => (d ? fHora.format(d) : '—');
export const horaCorta = (d) => (d ? fHoraCorta.format(d) : '--:--');
/** Hora con milisegundos (para la bitácora de sincronización y la correlación de evidencias). */
export const horaMs = (d) => (d ? `${fHora.format(d)}.${String(d.getUTCMilliseconds()).padStart(3, '0')}` : '—');

/** Abreviatura de la zona mostrada (p. ej. «GMT-6»). */
export function zona(d = new Date()) {
  const p = fZona.formatToParts(d).find((x) => x.type === 'timeZoneName');
  return p ? p.value : CONFIG.ZONA_VISTA;
}

/** «hace 5 s», «hace 3 min»… para etiquetar el último valor conocido. */
export function hace(d, ahora = Date.now()) {
  if (!d) return '';
  const s = Math.max(0, Math.round((ahora - d.getTime()) / 1000));
  if (s < 60) return `hace ${s} s`;
  const m = Math.round(s / 60); if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60); if (h < 48) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} días`;
}
