// Tarjeta «Último movimiento»: muestra el último movimiento o estado REPORTADO por el backend.
// Reglas:
//  - Solo datos reales (REST /estado o eventos WSS); sin fecha/hora inventadas.
//  - Una respuesta REST que se pidió ANTES de un evento WSS no puede sobrescribirlo (versión WSS),
//    y nunca se reemplaza un dato por otro más antiguo (marca temporal).
//  - «Reportado» ≠ «ejecutado físicamente»: lo dice la propia tarjeta.
import { bonito, esc } from '../utilidades/dom.js';
import { fecha, hace, hora, zona } from '../utilidades/fechas.js';

const ICONOS = {
  AVANZAR: '<path d="M12 4l7 8h-4.5v8h-5v-8H5z"/>',
  RETROCEDER: '<path d="M12 20l-7-8h4.5V4h5v8H19z"/>',
  GIRAR_IZQUIERDA: '<path d="M4 12l8-7v4.5h8v5h-8V19z"/>',
  GIRAR_DERECHA: '<path d="M20 12l-8 7v-4.5H4v-5h8V5z"/>',
  DETENER: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  SUBIR_BRAZO: '<path d="M12 4l6 7h-4v9h-4v-9H6z" opacity=".9"/>',
  BAJAR_BRAZO: '<path d="M12 20l-6-7h4V4h4v9h4z" opacity=".9"/>',
  ROTAR_IZQUIERDA: '<path d="M6.5 8A7 7 0 1 1 5 12" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M3 3.5l1 7 6.5-2.5z"/>',
  ROTAR_DERECHA: '<g transform="matrix(-1 0 0 1 24 0)"><path d="M6.5 8A7 7 0 1 1 5 12" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M3 3.5l1 7 6.5-2.5z"/></g>',
};
const ICONO_OTRO = '<circle cx="12" cy="12" r="6"/>';

const FUENTES = {
  rest: { texto: 'REST · estado guardado en RDS', clase: 'rest' },
  'ws-estado': { texto: 'WSS · estado al conectar', clase: 'ws' },
  'ws-mov': { texto: 'WSS · evento «movimiento»', clase: 'ws' },
  'ws-demo': { texto: 'WSS · paso de DEMO', clase: 'demo' },
};

export class UltimoMovimiento {
  constructor(raiz) {
    this.raiz = raiz;
    this.cuerpo = raiz.querySelector('[data-ultimo="cuerpo"]');
    this.fuente = raiz.querySelector('[data-ultimo="fuente"]');
    this.aviso = raiz.querySelector('[data-ultimo="aviso"]');
    this.demoEl = raiz.querySelector('[data-ultimo="demo"]');
    this.vivoEl = raiz.querySelector('[data-ultimo="vivo"]');
    this.reiniciar();
    setInterval(() => this.actualizarEdad(), 10000);
  }

  reiniciar() {
    this.dato = null; this.marca = 0; this.versionWs = 0; this.sinLinea = false;
    this.demo(null); this.vivo(null); this.cargando();
  }

  // ---------- Estados sin dato ----------
  cargando() { this.fase('cargando', '<div class="ultimo-vacio"><span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Cargando último estado…</div>'); }
  vacio() { if (!this.dato) this.fase('vacio', '<div class="ultimo-vacio"><b>Sin movimientos</b><span>Este vehículo todavía no tiene un estado registrado.</span></div>'); }
  error(msg, reintentar = true) {
    if (this.dato) { this.pintarAviso(`No se pudo actualizar: ${msg}. Se muestra el último valor conocido.`); return; }
    this.fase('error', `<div class="ultimo-vacio error" role="alert"><b>Error al consultar el estado</b><span>${esc(msg)}</span>${reintentar ? '<button type="button" class="btn btn-sm btn-outline-light" data-accion="mon-sincronizar">Reintentar</button>' : ''}</div>`);
  }
  fase(f, html) {
    this.raiz.dataset.fase = f; this.raiz.setAttribute('aria-busy', String(f === 'cargando'));
    this.cuerpo.innerHTML = html; this.fuente.textContent = f === 'cargando' ? 'Cargando…' : '—'; this.fuente.className = 'fuente';
  }

  // ---------- Aplicar datos ----------
  /** Dato de REST (/estado). versionAlPedir = this.versionWs cuando se lanzó la petición. */
  aplicarRest(dato, versionAlPedir) {
    if (versionAlPedir !== this.versionWs) return 'descartado: llegó un evento WSS mientras se consultaba';
    return this.aplicar(dato, 'rest');
  }
  /** Evento WSS (estado_actual, movimiento o paso de DEMO). */
  aplicarWs(dato, tipo) {
    const r = this.aplicar(dato, tipo);
    if (r === true) this.versionWs++;
    return r;
  }
  aplicar(dato, tipo) {
    const marca = dato.fecha ? dato.fecha.getTime() : 0;
    if (this.dato && marca && marca < this.marca) return 'descartado: es más antiguo que el mostrado';
    if (this.dato && marca === this.marca && this.dato.comando === dato.comando && tipo !== 'ws-mov') return 'sin cambios';
    this.dato = { ...dato, tipo }; this.marca = marca || this.marca;
    this.pintar();
    return true;
  }

  /** Estado del registro en el historial: 'verificando' | 'confirmado' | 'no-encontrado'. */
  registro(clave, estado, idHistorial) {
    if (!this.dato || this.dato.clave !== clave) return;
    this.dato.registro = { estado, id: idHistorial }; this.pintar();
  }

  pintar() {
    const d = this.dato; if (!d) return;
    this.raiz.dataset.fase = 'dato'; this.raiz.setAttribute('aria-busy', 'false');
    const f = FUENTES[d.tipo] || FUENTES.rest;
    this.fuente.textContent = d.tipo === 'ws-demo' && d.demo ? `${f.texto} ${d.demo.numero}/${d.demo.total}` : f.texto;
    this.fuente.className = `fuente ${f.clase}`;
    const icono = ICONOS[d.comando] || ICONO_OTRO;
    const meta = [
      d.codigo !== null && d.codigo !== undefined ? `<span><small>Código</small>${esc(d.codigo)}</span>` : '',
      d.idComando ? `<span><small>ID comando</small>${esc(d.idComando)}</span>` : '',
      d.origen ? `<span><small>Origen</small>${esc(d.origen)}</span>` : '',
      d.modo ? `<span><small>Modo</small>${esc(d.modo)}</span>` : '',
    ].join('');
    this.cuerpo.innerHTML = `
      <div class="ultimo-principal">
        <span class="ultimo-icono cmd-${esc(String(d.comando).toLowerCase())}" aria-hidden="true"><svg viewBox="0 0 24 24">${icono}</svg></span>
        <div class="ultimo-texto">
          <p class="ultimo-cmd">${esc(bonito(d.comando))}</p>
          <p class="ultimo-vehiculo">${esc(d.vehiculo || '')}</p>
        </div>
      </div>
      <dl class="ultimo-fecha">
        <div><dt>Fecha</dt><dd>${d.fecha ? fecha(d.fecha) : 'Sin dato'}</dd></div>
        <div><dt>Hora <small>(${esc(zona(d.fecha || undefined))})</small></dt><dd>${d.fecha ? hora(d.fecha) : 'Sin dato'}</dd></div>
      </dl>
      ${meta ? `<div class="ultimo-meta">${meta}</div>` : ''}
      <p class="ultimo-proceso">${this.textoProceso(d)}</p>
      <p class="ultimo-edad" data-ultimo="edad">${d.fecha ? `Reportado ${hace(d.fecha)}` : ''}</p>`;
    this.pintarAviso();
    this.raiz.classList.remove('pulso'); void this.raiz.offsetWidth; this.raiz.classList.add('pulso');
  }

  textoProceso(d) {
    if (d.tipo === 'ws-demo') return '<span class="estado-proc demo">◆ Paso interno de DEMO · no se guarda en el historial individual</span>';
    if (d.tipo === 'rest') return '<span class="estado-proc ok">✓ Último estado guardado en RDS (GET /estado)</span>';
    if (d.tipo === 'ws-estado') return '<span class="estado-proc ok">✓ Estado guardado en RDS, enviado por WSS al conectar</span>';
    const r = d.registro?.estado;
    if (r === 'confirmado') return `<span class="estado-proc ok">✓ Registrado en el historial de RDS · #${esc(d.registro.id)}</span>`;
    if (r === 'no-encontrado') return '<span class="estado-proc mal">! Evento recibido, pero aún no aparece en el historial</span>';
    return '<span class="estado-proc espera">… Evento recibido por WSS · verificando registro en el historial</span>';
  }

  actualizarEdad() {
    const e = this.cuerpo.querySelector('[data-ultimo="edad"]');
    if (e && this.dato?.fecha) e.textContent = `Reportado ${hace(this.dato.fecha)}`;
  }

  /** Sin conexión WSS: el valor se etiqueta como «último valor conocido». */
  desactualizado(sinLinea) { this.sinLinea = sinLinea; this.pintarAviso(); }
  pintarAviso(extra) {
    const t = extra || (this.sinLinea && this.dato ? 'Sin datos actualizados: WSS desconectado. Se muestra el último valor conocido.' : '');
    this.aviso.textContent = t; this.aviso.hidden = !t;
    this.raiz.classList.toggle('desactualizado', !!t && this.sinLinea);
  }

  /** Cinta de DEMO: { nombre, numero, total } en curso, o { fin: 'texto' } al terminar, o null. */
  demo(info) {
    if (!info) { this.demoEl.hidden = true; return; }
    this.demoEl.hidden = false;
    this.demoEl.classList.toggle('fin', !!info.fin);
    if (info.fin) { this.demoEl.textContent = info.fin; clearTimeout(this.demoT); this.demoT = setTimeout(() => { this.demoEl.hidden = true; }, 6000); return; }
    clearTimeout(this.demoT);
    const pct = info.total ? Math.round((info.numero / info.total) * 100) : 0;
    this.demoEl.innerHTML = `<span>DEMO «${esc(info.nombre || '')}» en curso${info.total ? ` · paso ${esc(info.numero)}/${esc(info.total)}` : ''}</span><i style="width:${pct}%"></i>`;
  }

  /** Avisos en vivo que no se guardan (p. ej. «soltar» del gamepad). */
  vivo(texto) { this.vivoEl.textContent = texto || ''; this.vivoEl.hidden = !texto; }
}
