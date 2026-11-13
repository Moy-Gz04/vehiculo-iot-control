// Vehículo seleccionado: estado compartido por CONTROL y MONITOREO.
// Al elegir un vehículo se (re)abre el único WebSocket y se avisa a las vistas.
import { get, rutas } from '../servicios/api.js';
import * as socket from '../servicios/socket.js';
import { $$, esc, guardado } from '../utilidades/dom.js';

const oyentes = new Set();
let lista = [];
let id = Number(guardado('ctl.vehiculo')) || null;

export const idVehiculo = () => id;
export const datosVehiculo = () => lista.find((v) => v.id_vehiculo === id) || null;
export const nombreVehiculo = () => datosVehiculo()?.nombre || (id ? `Vehículo ${id}` : '—');

/** GET /vehiculos y llena todos los selectores [data-selector-vehiculo]. */
export async function cargarVehiculos() {
  const r = await get(rutas.vehiculos());
  if (!Array.isArray(r) || !r.length) throw new Error('No hay vehículos registrados');
  lista = r.filter((v) => Number.isInteger(v?.id_vehiculo));
  const elegido = lista.some((v) => v.id_vehiculo === id) ? id : lista[0].id_vehiculo;
  pintarSelectores(elegido);
  elegir(elegido);
  return lista;
}

function pintarSelectores(elegido) {
  const html = lista.map((v) => `<option value="${v.id_vehiculo}" ${v.id_vehiculo === elegido ? 'selected' : ''}>${esc(v.nombre)}</option>`).join('');
  $$('[data-selector-vehiculo]').forEach((s) => { s.innerHTML = html; });
}

/** Cambia el vehículo de toda la aplicación (un solo WebSocket, ahora hacia el nuevo vehículo). */
export function elegir(nuevo) {
  if (!Number.isInteger(nuevo)) return;
  const cambio = nuevo !== id;
  id = nuevo; guardado('ctl.vehiculo', String(nuevo));
  $$('[data-selector-vehiculo]').forEach((s) => { s.value = String(nuevo); });
  socket.conectar(nuevo);
  oyentes.forEach((f) => { try { f(nuevo, cambio); } catch (e) { console.error(e); } });
}

export function alCambiarVehiculo(f) { oyentes.add(f); return () => oyentes.delete(f); }

// Cualquier selector de vehículo (CONTROL o MONITOREO) cambia el vehículo de toda la app
document.addEventListener('change', (ev) => {
  const s = ev.target.closest?.('[data-selector-vehiculo]');
  if (s) elegir(Number(s.value));
});
