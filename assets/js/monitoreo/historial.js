// Tabla «Últimos 10 movimientos»: SOLO registros persistidos en RDS y devueltos por GET /historial.
// El número de fila (#) es visual; retirar una fila de la pantalla nunca borra nada en la base de datos.
import { CONFIG } from '../config.js';
import { bonito, esc } from '../utilidades/dom.js';
import { fecha, hora, zona } from '../utilidades/fechas.js';

export class TablaHistorial {
  constructor(raiz) {
    this.raiz = raiz;
    this.tbody = raiz.querySelector('tbody');
    this.contador = raiz.querySelector('[data-historial="contador"]');
    this.pie = raiz.querySelector('[data-historial="pie"]');
    this.anuncio = raiz.querySelector('[data-historial="anuncio"]');
    this.zonaEl = raiz.querySelector('[data-historial="zona"]');
    this.filas = [];
    this.cargando();
  }

  /** Ids mostrados (para correlacionar y comprobar que una DEMO no agrega filas). */
  ids() { return this.filas.map((f) => f.id); }

  cargando() {
    this.raiz.setAttribute('aria-busy', 'true');
    if (this.filas.length) { this.pie.textContent = 'Sincronizando con la API…'; return; }
    this.tbody.innerHTML = `<tr class="fila-estado"><td colspan="5"><span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Cargando movimientos…</td></tr>`;
    this.contador.textContent = '…';
  }

  error(msg) {
    this.raiz.setAttribute('aria-busy', 'false');
    if (this.filas.length) { this.pie.textContent = `No se pudo actualizar (${msg}). Se muestran los últimos datos confirmados.`; this.pie.classList.add('mal'); return; }
    this.tbody.innerHTML = `<tr class="fila-estado error"><td colspan="5" role="alert"><b>Error al consultar el historial.</b> ${esc(msg)} <button type="button" class="btn btn-sm btn-outline-light ms-2" data-accion="mon-sincronizar">Reintentar</button></td></tr>`;
    this.contador.textContent = '—';
  }

  reiniciar() { this.filas = []; this.cargando(); }

  /** Pinta las filas confirmadas. Devuelve los ids nuevos respecto a la tabla anterior. */
  pintar(filas, { ms, cuando }) {
    this.raiz.setAttribute('aria-busy', 'false');
    this.pie.classList.remove('mal');
    const antes = new Set(this.ids());
    const hayAntes = antes.size > 0;
    this.filas = filas;
    this.zonaEl.textContent = zona();
    this.contador.textContent = `${filas.length} de ${CONFIG.HISTORIAL_MAX}`;
    if (!filas.length) {
      this.tbody.innerHTML = '<tr class="fila-estado"><td colspan="5"><b>Sin movimientos.</b> Este vehículo no tiene movimientos individuales registrados.</td></tr>';
    } else {
      this.tbody.innerHTML = filas.map((f, i) => `
        <tr class="${hayAntes && !antes.has(f.id) ? 'nueva' : ''}" data-id="${f.id}">
          <th scope="row">${i + 1}</th>
          <td class="col-mov"><span class="mov">${esc(bonito(f.comando))}</span>${f.origen ? `<span class="org d-md-none">${esc(f.origen)}</span>` : ''}</td>
          <td class="col-fecha">${fecha(f.fecha)}</td>
          <td class="col-hora">${hora(f.fecha)}</td>
          <td class="col-id d-none d-md-table-cell"><code>#${f.id}</code>${f.origen ? ` <span class="org">${esc(f.origen)}</span>` : ''}</td>
        </tr>`).join('');
    }
    const nuevos = filas.filter((f) => !antes.has(f.id)).map((f) => f.id);
    this.pie.textContent = `Confirmado por GET /historial · ${hora(cuando)} · ${ms} ms`;
    if (hayAntes && nuevos.length) this.anuncio.textContent = `${nuevos.length} movimiento(s) nuevo(s) en el historial. Más reciente: ${bonito(filas[0].comando)}.`;
    return nuevos;
  }
}
