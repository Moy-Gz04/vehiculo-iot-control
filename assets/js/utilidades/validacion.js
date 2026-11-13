// Validación de datos NO confiables (respuestas REST y eventos WSS) según el contrato real de la API.
// Contratos (Swagger /docs):
//   GET /vehiculos/{id}/estado     -> { id_vehiculo, vehiculo, id_comando, comando, codigo, conectado, fecha_actualizacion }
//   GET /vehiculos/{id}/historial  -> { id_vehiculo, limite, total_devueltos, movimientos: [{ id_historial, id_vehiculo, comando, codigo, fecha_hora, origen }] }
//   WSS /ws/vehiculos/{id}         -> { evento, id_vehiculo, ...datos, timestamp }
import { CONFIG } from '../config.js';
import { aFecha } from './fechas.js';

const entero = (n) => Number.isInteger(n) && n > 0;
const texto = (s, max = 60) => (typeof s === 'string' && s.trim() ? s.trim().slice(0, max) : null);
const enteroONulo = (n) => (Number.isInteger(n) ? n : null);

/** Tipos de evento que publica el backend (rutas/ws.py, rutas/estado.py, servicios/demos.py). */
export const EVENTOS = new Set(['estado_actual', 'movimiento', 'mantener', 'soltar', 'pong', 'error',
  'demo_inicio', 'demo_movimiento', 'demo_fin', 'demo_cancelada', 'demo_error']);

/** Evento WSS válido y del vehículo seleccionado; si no, devuelve { ok:false, motivo }. */
export function validarEvento(m, idVehiculo) {
  if (!m || typeof m !== 'object' || Array.isArray(m)) return { ok: false, motivo: 'no es un objeto JSON' };
  if (!EVENTOS.has(m.evento)) return { ok: false, motivo: `evento desconocido «${String(m.evento).slice(0, 20)}»` };
  if (m.id_vehiculo !== idVehiculo) return { ok: false, motivo: `es del vehículo ${m.id_vehiculo}`, otroVehiculo: true };
  const marca = aFecha(m.timestamp);
  if (!marca) return { ok: false, motivo: 'sin timestamp válido' };
  return { ok: true, marca };
}

/** Normaliza el último estado (REST o evento estado_actual). null si no trae datos útiles. */
export function normalizarEstado(e, idVehiculo) {
  if (!e || typeof e !== 'object' || e.id_vehiculo !== idVehiculo) return null;
  const comando = texto(e.comando);
  if (!comando) return null;
  return {
    comando, idComando: enteroONulo(e.id_comando), codigo: enteroONulo(e.codigo),
    fecha: aFecha(e.fecha_actualizacion), vehiculo: texto(e.vehiculo),
  };
}

/** Historial: filtra filas inválidas o de otro vehículo, quita duplicados por id_historial,
 *  ordena del más reciente al más antiguo (fecha_hora y, a igual segundo, id_historial) y limita a 10. */
export function normalizarHistorial(h, idVehiculo) {
  if (!h || typeof h !== 'object' || !Array.isArray(h.movimientos)) throw new Error('Respuesta de historial con formato inesperado');
  if (h.id_vehiculo !== idVehiculo) throw new Error('El historial recibido es de otro vehículo');
  const vistos = new Set(); const filas = []; let descartadas = 0;
  for (const m of h.movimientos) {
    const fechaHora = m && aFecha(m.fecha_hora);
    if (!m || !entero(m.id_historial) || m.id_vehiculo !== idVehiculo || !fechaHora || vistos.has(m.id_historial)) { descartadas++; continue; }
    vistos.add(m.id_historial);
    filas.push({ id: m.id_historial, comando: texto(m.comando) || '(sin nombre)', codigo: enteroONulo(m.codigo), fecha: fechaHora, origen: texto(m.origen, 30) || '' });
  }
  filas.sort((a, b) => (b.fecha - a.fecha) || (b.id - a.id));
  return { filas: filas.slice(0, CONFIG.HISTORIAL_MAX), descartadas, limite: h.limite };
}
