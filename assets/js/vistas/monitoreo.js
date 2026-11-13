// Vista MONITOREO: une la tarjeta del último movimiento, la tabla de 10 registros, la sincronización REST
// y los eventos del WebSocket compartido.
//  - REST: carga inicial, recuperación tras reconectar WSS, al volver a la vista y para confirmar el historial.
//  - WSS: dispara la actualización en tiempo real (sin polling del historial).
import * as socket from '../servicios/socket.js';
import { rutas } from '../servicios/api.js';
import { idVehiculo, nombreVehiculo, datosVehiculo, alCambiarVehiculo, cargarVehiculos } from '../estado/vehiculo.js';
import { alCambiarVista, vistaActual } from './navegacion.js';
import { validarEvento, normalizarEstado } from '../utilidades/validacion.js';
import { $, esc } from '../utilidades/dom.js';
import { horaMs } from '../utilidades/fechas.js';
import { UltimoMovimiento } from '../monitoreo/ultimo-movimiento.js';
import { TablaHistorial } from '../monitoreo/historial.js';
import { Bitacora } from '../monitoreo/bitacora.js';
import { Sincronizador } from '../monitoreo/sincronizacion.js';

const VENTANA_CORRELACION_MS = 5000;   // diferencia máxima entre el evento WSS y fecha_hora del registro en RDS
const REINTENTO_CONFIRMACION_MS = 1500; // una sola consulta extra si el registro aún no aparece

export function iniciarMonitoreo() {
  const ultimo = new UltimoMovimiento($('#ultimo'));
  const tabla = new TablaHistorial($('#historial'));
  const bitacora = new Bitacora($('#bitacora'));
  let visible = vistaActual() === 'monitoreo';
  let historialViejo = true;              // hubo eventos mientras MONITOREO estaba oculto
  let pendientes = [];                    // movimientos WSS que esperan confirmación en el historial
  let idsAntesDemo = null;
  const vistos = new Set();               // deduplicación de eventos WSS (evento|timestamp|comando)
  let ignorados = 0;

  const sync = new Sincronizador({ ultimo, tabla, bitacora, alTerminar: conciliar });

  // ---------- Correlación evento WSS ↔ registro de RDS ----------
  function conciliar({ filas, motivo }) {
    historialViejo = false;
    const usados = new Set();
    const siguen = [];
    for (const p of pendientes) {
      const fila = filas
        .filter((f) => !usados.has(f.id) && f.comando === p.comando && (!p.origen || f.origen === p.origen)
          && Math.abs(f.fecha - p.marca) <= VENTANA_CORRELACION_MS)
        .sort((a, b) => Math.abs(a.fecha - p.marca) - Math.abs(b.fecha - p.marca))[0];
      if (fila) {
        usados.add(fila.id);
        ultimo.registro(p.clave, 'confirmado', fila.id);
        bitacora.agregar('TABLA', `Evento ${p.comando} (${horaMs(new Date(p.marca))}) ↔ registro #${fila.id} en RDS`);
      } else if (!p.reintentado) {
        p.reintentado = true; siguen.push(p);
      } else {
        ultimo.registro(p.clave, 'no-encontrado');
        bitacora.agregar('AVISO', `Evento ${p.comando} sin registro correspondiente en los 10 más recientes`);
      }
    }
    pendientes = siguen;
    if (siguen.length) sync.programar('confirmar registro pendiente', REINTENTO_CONFIRMACION_MS);
    if (idsAntesDemo && /DEMO/.test(motivo)) {
      const iguales = idsAntesDemo.join() === filas.map((f) => f.id).join();
      bitacora.agregar('DEMO', iguales ? 'Historial sin cambios tras la DEMO: sus pasos no se registran como movimientos individuales'
        : 'El historial cambió durante la DEMO (hubo movimientos individuales en ese lapso)');
      idsAntesDemo = null;
    }
  }

  // ---------- Eventos del WebSocket compartido ----------
  function alEvento(m) {
    const id = idVehiculo();
    const v = validarEvento(m, id);
    if (!v.ok) {
      if (m?.evento !== 'pong') { ignorados++; bitacora.agregar('AVISO', `Evento WSS ignorado: ${v.motivo}`); }
      return;
    }
    if (m.evento === 'pong' || m.evento === 'mantener') return;
    const clave = `${m.evento}|${m.timestamp}|${m.id_comando ?? ''}`;
    if (vistos.has(clave)) { bitacora.agregar('AVISO', `Evento duplicado ignorado (${m.evento})`); return; }
    vistos.add(clave); if (vistos.size > 200) vistos.delete(vistos.values().next().value);
    const marca = v.marca;

    switch (m.evento) {
      case 'estado_actual': {
        const e = normalizarEstado({ ...m, vehiculo: nombreVehiculo() }, id);
        if (e) {
          const r = ultimo.aplicarWs({ ...e, clave }, 'ws-estado');
          bitacora.agregar('WSS', `estado_actual · ${e.comando} · ${m.fecha_actualizacion}${r === true ? '' : ` · ${r}`}`);
        } else bitacora.agregar('WSS', 'estado_actual · sin estado registrado');
        if (m.demo_en_curso) ultimo.demo({ nombre: 'en curso', numero: 0, total: 0 });
        break;
      }
      case 'movimiento': {
        if (typeof m.comando !== 'string' || !m.comando) return;
        const dato = { comando: m.comando, codigo: Number.isInteger(m.codigo) ? m.codigo : null, idComando: Number.isInteger(m.id_comando) ? m.id_comando : null,
          origen: typeof m.origen === 'string' ? m.origen.slice(0, 30) : '', modo: typeof m.modo === 'string' ? m.modo.slice(0, 12) : '',
          fecha: marca, vehiculo: nombreVehiculo(), clave };
        const r = ultimo.aplicarWs(dato, 'ws-mov');
        bitacora.agregar('WSS', `movimiento · ${m.comando} · id_comando ${m.id_comando} · ${m.origen} · ts ${horaMs(marca)}${r === true ? '' : ` · ${r}`}`);
        pendientes.push({ clave, comando: m.comando, origen: dato.origen, marca: marca.getTime() });
        if (pendientes.length > 30) pendientes.shift();
        ultimo.vivo(null);
        // El evento DISPARA la sincronización; la tabla solo muestra lo que confirme la API (RDS).
        if (visible) sync.programar('evento WSS movimiento'); else historialViejo = true;
        break;
      }
      case 'soltar':
        ultimo.vivo(`Aviso en vivo «soltar» a las ${horaMs(marca)} · detiene el movimiento del gamepad, no se guarda en el historial`);
        bitacora.agregar('WSS', 'soltar · aviso en vivo (no se registra)');
        break;
      case 'demo_inicio':
        idsAntesDemo = tabla.ids();
        ultimo.demo({ nombre: m.demo, numero: 0, total: m.total_movimientos });
        bitacora.agregar('DEMO', `demo_inicio · «${m.demo}» · ${m.total_movimientos} pasos`);
        break;
      case 'demo_movimiento': {
        if (typeof m.comando !== 'string' || !m.comando) return;
        const demo = { nombre: m.demo, numero: m.numero, total: m.total_movimientos };
        ultimo.aplicarWs({ comando: m.comando, codigo: Number.isInteger(m.codigo) ? m.codigo : null, idComando: Number.isInteger(m.id_comando) ? m.id_comando : null,
          origen: 'DEMO', modo: m.duracion_ms ? `${m.duracion_ms} ms` : '', fecha: marca, vehiculo: nombreVehiculo(), demo, clave }, 'ws-demo');
        ultimo.demo(demo);
        bitacora.agregar('DEMO', `demo_movimiento ${m.numero}/${m.total_movimientos} · ${m.comando} (no se agrega a la tabla)`);
        break;
      }
      case 'demo_fin': case 'demo_cancelada': case 'demo_error': {
        const txt = { demo_fin: 'DEMO terminada', demo_cancelada: 'DEMO cancelada', demo_error: 'DEMO detenida por un error' }[m.evento];
        ultimo.demo({ fin: `${txt} · ${m.movimientos_enviados ?? 0} pasos enviados · el historial individual no cambia` });
        bitacora.agregar('DEMO', `${m.evento} · «${m.demo}» · ${m.movimientos_enviados ?? 0} pasos`);
        if (visible) sync.sincronizar('comprobación tras DEMO'); else historialViejo = true;
        break;
      }
      case 'error':
        bitacora.agregar('AVISO', `error del servidor: ${m.detalle || ''}`);
        break;
    }
  }

  // ---------- Encabezado con el vehículo ----------
  function pintarVehiculo() {
    const v = datosVehiculo();
    $('#mon-vehiculo').textContent = nombreVehiculo();
    $('#mon-vehiculo-meta').innerHTML = v
      ? `ID ${esc(v.id_vehiculo)} · ${esc(v.modelo || '')} · ${esc(v.microcontrolador || '')} <span class="badge text-bg-${v.activo ? 'success' : 'secondary'} ms-1">${v.activo ? 'Activo' : 'Inactivo'}</span>`
      : 'Cargando vehículo…';
  }

  // ---------- Enlaces con el resto de la app ----------
  socket.alMensaje(alEvento);
  socket.alAbrir(({ reconexion }) => {
    bitacora.agregar('WSS', reconexion ? 'Reconectado: se vuelve a consultar estado e historial por REST' : `Conectado a ${rutas.ws(idVehiculo())}`);
    if (reconexion) sync.sincronizar('reconexión WSS');
  });
  socket.alCambiarEstado(({ fase }) => {
    ultimo.desactualizado(fase !== 'en_linea');
    if (fase === 'desconectado' && ultimo.dato) bitacora.agregar('WSS', 'Conexión WSS perdida: se conserva el último valor conocido');
  });
  alCambiarVehiculo((id, cambio) => {
    if (cambio || !ultimo.dato) { sync.cancelar(); ultimo.reiniciar(); tabla.reiniciar(); pendientes = []; vistos.clear(); }
    pintarVehiculo();
    bitacora.agregar('REST', `Carga inicial del vehículo ${id} (${nombreVehiculo()})`);
    sync.sincronizar('carga inicial');
  });
  alCambiarVista((vista) => {
    visible = vista === 'monitoreo';
    if (visible && idVehiculo()) sync.sincronizar(historialViejo ? 'entrada a MONITOREO (hubo eventos)' : 'entrada a MONITOREO');
  });

  document.addEventListener('click', (ev) => {
    const a = ev.target.closest('[data-accion]'); if (!a) return;
    if (a.dataset.accion === 'mon-sincronizar') {
      if (!idVehiculo()) cargarVehiculos().catch((e) => { ultimo.error(e.message); tabla.error(e.message); });
      else sync.sincronizar('actualización manual');
    } else if (a.dataset.accion === 'mon-reconectar') {
      bitacora.agregar('WSS', 'Prueba D: se corta la conexión WSS a propósito');
      socket.forzarReconexion();
    }
  });

  pintarVehiculo();
  return { ignorados: () => ignorados };
}
