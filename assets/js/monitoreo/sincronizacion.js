// Sincronización REST de MONITOREO (carga inicial, después de un evento WSS, al reconectar o al volver a la vista).
// Control de concurrencia:
//  - Nunca hay dos sincronizaciones a la vez: si llega otra petición mientras una corre, se agenda UNA más al terminar
//    (varios eventos seguidos —p. ej. el joystick— se agrupan en una sola consulta).
//  - Cada ciclo lleva un número de generación; si cambia el vehículo, la respuesta vieja se descarta y se aborta el fetch.
//  - La tarjeta recibe la «versión WSS» del momento de la petición para que un estado REST viejo no pise un evento más nuevo.
import { get, rutas, ErrorApi } from '../servicios/api.js';
import { idVehiculo } from '../estado/vehiculo.js';
import { normalizarEstado, normalizarHistorial } from '../utilidades/validacion.js';

export class Sincronizador {
  /** @param {{ ultimo, tabla, bitacora, alTerminar: (resultado) => void }} deps */
  constructor(deps) {
    Object.assign(this, deps);
    this.gen = 0; this.corriendo = null; this.pendiente = null; this.timer = null; this.ctl = null;
  }

  /** Agrupa disparos cercanos (eventos en ráfaga) en una sola sincronización. */
  programar(motivo, ms = 300) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.sincronizar(motivo), ms);
  }

  /** Cancela lo que esté en curso (cambio de vehículo). */
  cancelar() {
    clearTimeout(this.timer); this.gen++; this.pendiente = null;
    this.ctl?.abort();
  }

  async sincronizar(motivo) {
    clearTimeout(this.timer);
    if (this.corriendo) { this.pendiente = motivo; return this.corriendo; }
    this.corriendo = (async () => {
      let m = motivo;
      while (m) { this.pendiente = null; await this.ciclo(m); m = this.pendiente; }
    })();
    try { await this.corriendo; } finally { this.corriendo = null; }
  }

  async ciclo(motivo) {
    const id = idVehiculo(); if (!id) return;
    const gen = ++this.gen;
    const ctl = new AbortController(); this.ctl = ctl;
    const versionWs = this.ultimo.versionWs;
    this.tabla.cargando();
    const t0 = performance.now();
    const [re, rh] = await Promise.allSettled([
      get(rutas.estado(id), { signal: ctl.signal }),
      get(rutas.historial(id), { signal: ctl.signal }),
    ]);
    const ms = Math.round(performance.now() - t0);
    if (gen !== this.gen || id !== idVehiculo()) { this.bitacora.agregar('REST', `Respuesta descartada (vehículo o solicitud más reciente) · ${motivo}`); return; }

    // ---- Último estado ----
    if (re.status === 'fulfilled') {
      const e = normalizarEstado(re.value, id);
      if (!e) this.ultimo.vacio();
      else {
        const r = this.ultimo.aplicarRest({ ...e, clave: `rest-${e.fecha?.getTime()}` }, versionWs);
        this.bitacora.agregar('REST', `GET ${rutas.estado(id)} → 200 · ${e.comando} · ${re.value.fecha_actualizacion}${r === true ? '' : ` · ${r}`}`);
      }
    } else if (re.reason instanceof ErrorApi && re.reason.status === 404) {
      this.ultimo.vacio();
      this.bitacora.agregar('REST', `GET ${rutas.estado(id)} → 404 · ${re.reason.message}`);
    } else if (re.reason?.tipo !== 'cancelada') {
      this.ultimo.error(re.reason?.message || 'Error desconocido');
      this.bitacora.agregar('AVISO', `GET ${rutas.estado(id)} falló · ${re.reason?.message}`);
    }

    // ---- Historial (10 movimientos individuales persistidos) ----
    let resultado = null;
    if (rh.status === 'fulfilled') {
      try {
        const { filas, descartadas } = normalizarHistorial(rh.value, id);
        const nuevos = this.tabla.pintar(filas, { ms, cuando: new Date() });
        const rango = filas.length ? ` · ids #${filas[filas.length - 1].id}–#${filas[0].id}` : '';
        this.bitacora.agregar('REST', `GET ${rutas.historial(id)} → 200 · ${filas.length} registros${rango} · ${ms} ms · ${motivo}${descartadas ? ` · ${descartadas} fila(s) inválida(s) descartada(s)` : ''}`);
        resultado = { filas, nuevos, motivo };
      } catch (e) {
        this.tabla.error(e.message);
        this.bitacora.agregar('AVISO', `Historial con formato inesperado: ${e.message}`);
      }
    } else if (rh.reason?.tipo !== 'cancelada') {
      this.tabla.error(rh.reason?.message || 'Error desconocido');
      this.bitacora.agregar('AVISO', `GET ${rutas.historial(id)} falló · ${rh.reason?.message}`);
    }
    if (resultado) this.alTerminar?.(resultado);
  }
}
