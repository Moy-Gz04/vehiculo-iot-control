// Vehículo seleccionado: estado compartido por CONTROL, MONITOREO y «Mis vehículos».
// Al elegir un vehículo se (re)abre el único WebSocket y se avisa a las vistas.
// 4.3: GET /vehiculos ya llega FILTRADO por el servidor (solo las unidades que la sesión puede ver);
// el selector nunca muestra unidades ajenas, y aunque alguien cambie el ID a mano, FastAPI responde 403.
import { get, rutas } from '../servicios/api.js';
import * as socket from '../servicios/socket.js';
import { $$, esc, guardado } from '../utilidades/dom.js';

const oyentes = new Set();
let lista = [];
let id = Number(guardado('ctl.vehiculo')) || null;

export const idVehiculo = () => id;
export const vehiculos = () => lista;
export const datosVehiculo = () => lista.find((v) => v.id_vehiculo === id) || null;
export const nombreVehiculo = () => datosVehiculo()?.nombre || (id ? `Vehículo ${id}` : '—');

export class SinVehiculos extends Error {}

/** GET /vehiculos y llena todos los selectores [data-selector-vehiculo]. */
export async function cargarVehiculos() {
  const r = await get(rutas.vehiculos());
  lista = (Array.isArray(r) ? r : []).filter((v) => Number.isInteger(v?.id_vehiculo));
  if (!lista.length) { olvidar('Sin unidades asignadas'); throw new SinVehiculos('Tu cuenta todavía no tiene vehículos asignados.'); }
  const elegido = lista.some((v) => v.id_vehiculo === id) ? id : lista[0].id_vehiculo;
  pintarSelectores(elegido);
  elegir(elegido, true);
  return lista;
}

const etiqueta = (v) => `${v.nombre}${v.unidad ? ` · ${v.unidad.numero_serie}` : ''}`;

function pintarSelectores(elegido) {
  const html = lista.map((v) => `<option value="${v.id_vehiculo}" ${v.id_vehiculo === elegido ? 'selected' : ''}>${esc(etiqueta(v))}</option>`).join('');
  $$('[data-selector-vehiculo]').forEach((s) => { s.innerHTML = html; });
}

/** Cambia el vehículo de toda la aplicación (un solo WebSocket, ahora hacia el nuevo vehículo). */
export function elegir(nuevo, forzar = false) {
  if (!Number.isInteger(nuevo)) return;
  const cambio = nuevo !== id || forzar;
  id = nuevo; guardado('ctl.vehiculo', String(nuevo));
  $$('[data-selector-vehiculo]').forEach((s) => { s.value = String(nuevo); });
  if (forzar) socket.desconectar('Cambiando de unidad');     // cancela la suscripción anterior (otro token o unidad)
  socket.conectar(nuevo);
  oyentes.forEach((f) => { try { f(nuevo, cambio); } catch (e) { console.error(e); } });
}

/** Al cerrar sesión: vacía la lista, los selectores y corta el WebSocket. */
export function olvidar(motivo = 'Sin sesión') {
  lista = [];
  $$('[data-selector-vehiculo]').forEach((s) => { s.innerHTML = ''; });
  socket.desconectar(motivo);
}

export function alCambiarVehiculo(f) { oyentes.add(f); return () => oyentes.delete(f); }

// Cualquier selector de vehículo (CONTROL o MONITOREO) cambia el vehículo de toda la app
document.addEventListener('change', (ev) => {
  const s = ev.target.closest?.('[data-selector-vehiculo]');
  if (s) elegir(Number(s.value));
});
