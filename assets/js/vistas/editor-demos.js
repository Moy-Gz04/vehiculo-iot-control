// Editor visual de DEMO (4.3), compartido por el Administrador (DEMO de FÁBRICA) y el comprador (DEMO PRIVADAS).
// - Agregar, quitar, reordenar (botones ↑ ↓, aptos para pantalla táctil) y editar pasos: comando, duración y pausa.
// - Muestra duración total; «Guardar» envía la secuencia COMPLETA (PUT …/pasos) y el servidor la valida en una
//   transacción: comando del vehículo, duración máxima segura del modelo y total ≤ 180 s. «Cancelar» descarta cambios.
// - La ejecución se hace desde CONTROL (hoja DEMO), donde DETENER conserva la prioridad.
import { get, post, put, rutas } from '../servicios/api.js';
import { vehiculos, cargarVehiculos, elegir, SinVehiculos } from '../estado/vehiculo.js';
import { ir } from './navegacion.js';
import { $, esc, bonito, aviso } from '../utilidades/dom.js';

const TOTAL_MAX_MS = 180000;

export function iniciarEditorDemos() {
  const st = { raiz: null, idV: null, comandos: [], demos: [], demo: null, pasos: [], sucio: false };

  async function mostrar(raiz) {
    st.raiz = raiz;
    const lista = vehiculos().length ? vehiculos()
      : await cargarVehiculos().catch((e) => { if (e instanceof SinVehiculos) return []; throw e; });
    if (!lista.length) { raiz.innerHTML = '<div class="adm-vacio">No tienes unidades disponibles para diseñar DEMO.</div>'; return; }
    if (!lista.some((v) => v.id_vehiculo === st.idV)) st.idV = lista[0].id_vehiculo;
    await cargarUnidad();
  }

  async function cargarUnidad() {
    const [cmds, demos] = await Promise.all([get(rutas.comandos(st.idV)), get(rutas.demos(st.idV))]);
    st.comandos = cmds.filter((c) => c.activo && c.nombre !== 'RESET_WIFI');
    st.demos = demos;
    if (st.demo && !demos.some((d) => d.id_demo === st.demo.id_demo)) st.demo = null;
    if (st.demo) await abrirDemo(st.demo.id_demo, false); else pintar();
  }

  async function abrirDemo(id, confirmar = true) {
    if (confirmar && st.sucio && !confirm('Hay cambios sin guardar. ¿Descartarlos?')) return;
    st.demo = st.demos.find((d) => d.id_demo === id) || null;
    st.pasos = st.demo ? (await get(rutas.movsDemo(st.idV, id))).map((m) => ({ id_comando: m.id_comando, duracion_ms: m.duracion_ms, pausa_ms: m.pausa_ms })) : [];
    st.sucio = false;
    pintar();
  }

  const total = () => st.pasos.reduce((s, p) => s + Number(p.duracion_ms || 0) + Number(p.pausa_ms || 0), 0);

  function pintar() {
    const lista = vehiculos();
    const d = st.demo;
    const editable = !!d?.editable;
    st.raiz.innerHTML = `<div class="adm-dos">
      <article class="mon-card mb-3 mb-lg-0">
        <header class="mon-card-cab"><h2>DEMO</h2></header>
        <label class="mon-select w-100 mb-3" for="ed-unidad"><span>Unidad</span>
          <select id="ed-unidad" class="form-select">${lista.map((v) => `<option value="${v.id_vehiculo}" ${v.id_vehiculo === st.idV ? 'selected' : ''}>${esc(v.nombre)}${v.unidad ? ` · ${esc(v.unidad.numero_serie)}` : ''}</option>`).join('')}</select></label>
        ${st.demos.length ? `<ul class="lista-demos">${st.demos.map((x) => `<li><button type="button" class="btn-contorno" data-ed="abrir" data-id="${x.id_demo}" aria-current="${x.id_demo === d?.id_demo}">
          <span>${esc(x.nombre)}</span><span class="demo-tipo">${x.tipo === 'PRIVADA' ? 'Mía' : 'Fábrica'}${x.editable ? '' : ' · solo lectura'}</span></button></li>`).join('')}</ul>`
          : '<p class="mon-meta">Esta unidad no tiene DEMO todavía.</p>'}
        <button type="button" class="btn-azul w-100 mt-3" data-ed="nueva">Nueva DEMO</button>
      </article>
      <article class="mon-card editor" aria-live="polite">
        ${!d ? '<div class="adm-vacio">Elige una DEMO o crea una nueva.</div>' : `
        <header class="mon-card-cab"><h2>${esc(d.nombre)}</h2><span class="fuente ${d.tipo === 'PRIVADA' ? 'rest' : 'demo'}">${d.tipo === 'PRIVADA' ? 'Privada' : 'De fábrica'}</span></header>
        ${editable ? '' : '<p class="mon-meta">Solo lectura: las DEMO de fábrica las edita la empresa.</p>'}
        <ol class="editor-pasos">${st.pasos.map((p, i) => `<li class="paso">
          <span class="num" aria-hidden="true">${i + 1}</span>
          <div class="campos">
            <label>Comando<select class="form-select" data-paso="${i}" data-campo="id_comando" ${editable ? '' : 'disabled'} aria-label="Comando del paso ${i + 1}">
              ${st.comandos.map((c) => `<option value="${c.id_comando}" ${c.id_comando === p.id_comando ? 'selected' : ''}>${esc(bonito(c.nombre))}</option>`).join('')}</select></label>
            <label>Duración ms<input class="form-control" type="number" min="100" max="60000" step="100" value="${p.duracion_ms}" data-paso="${i}" data-campo="duracion_ms" ${editable ? '' : 'disabled'}></label>
            <label>Pausa ms<input class="form-control" type="number" min="0" max="60000" step="100" value="${p.pausa_ms}" data-paso="${i}" data-campo="pausa_ms" ${editable ? '' : 'disabled'}></label>
          </div>
          ${editable ? `<div class="mover">
            <button type="button" class="btn-contorno btn-chico" data-ed="subir" data-i="${i}" ${i ? '' : 'disabled'} aria-label="Subir paso ${i + 1}">↑</button>
            <button type="button" class="btn-contorno btn-chico" data-ed="bajar" data-i="${i}" ${i < st.pasos.length - 1 ? '' : 'disabled'} aria-label="Bajar paso ${i + 1}">↓</button>
            <button type="button" class="btn-contorno btn-chico btn-peligro" data-ed="quitar" data-i="${i}" aria-label="Quitar paso ${i + 1}">✕</button></div>` : ''}
        </li>`).join('') || '<li class="adm-vacio">Sin pasos. Agrega el primero.</li>'}</ol>
        <div class="editor-total">Pasos <b>${st.pasos.length}</b> · Duración total <b class="${total() > TOTAL_MAX_MS ? 'mal' : ''}">${(total() / 1000).toFixed(1)} s</b>
          <span>(máx. ${TOTAL_MAX_MS / 1000} s; cada comando tiene su límite seguro por modelo)</span>${st.sucio ? '<span class="mal">Cambios sin guardar</span>' : ''}</div>
        <div class="editor-acciones">
          ${editable ? `<button type="button" class="btn-contorno" data-ed="agregar">Agregar paso</button>
            <button type="button" class="btn-contorno btn-peligro" data-ed="eliminar">Eliminar DEMO</button>
            <button type="button" class="btn-contorno" data-ed="cancelar" ${st.sucio ? '' : 'disabled'}>Cancelar</button>
            <button type="button" class="btn-azul" data-ed="guardar" ${st.sucio && st.pasos.length ? '' : 'disabled'}>Guardar</button>` : ''}
          <button type="button" class="btn-azul" data-ed="probar" ${st.sucio || !st.pasos.length ? 'disabled' : ''}>Ejecutar desde Control</button>
        </div>`}
      </article></div>`;
  }

  // ---------------- Eventos ----------------
  document.addEventListener('change', async (ev) => {
    if (!st.raiz?.contains(ev.target)) return;
    if (ev.target.id === 'ed-unidad') {
      if (st.sucio && !confirm('Hay cambios sin guardar. ¿Descartarlos?')) { ev.target.value = st.idV; return; }
      st.idV = Number(ev.target.value); st.demo = null; st.sucio = false;
      try { await cargarUnidad(); } catch (e) { aviso(e.message, true); }
      return;
    }
    const i = ev.target.dataset.paso;
    if (i === undefined) return;
    st.pasos[Number(i)][ev.target.dataset.campo] = Number(ev.target.value);
    st.sucio = true; pintar();
  });

  document.addEventListener('click', async (ev) => {
    const b = ev.target.closest('[data-ed]');
    if (!b || !st.raiz?.contains(b)) return;
    const i = Number(b.dataset.i);
    try {
      switch (b.dataset.ed) {
        case 'abrir': await abrirDemo(Number(b.dataset.id)); break;
        case 'nueva': {
          const nombre = prompt('Nombre de la nueva DEMO (máx. 80 caracteres):')?.trim();
          if (!nombre) return;
          const r = await post(rutas.demos(st.idV), { nombre: nombre.slice(0, 80), descripcion: null });
          aviso(r.mensaje); st.demos = await get(rutas.demos(st.idV)); await abrirDemo(r.id, false);
          if (!st.pasos.length && st.comandos.length) { st.pasos.push({ id_comando: st.comandos[0].id_comando, duracion_ms: 1000, pausa_ms: 0 }); st.sucio = true; pintar(); }
          break;
        }
        case 'agregar': st.pasos.push({ id_comando: st.comandos[0]?.id_comando, duracion_ms: 1000, pausa_ms: 0 }); st.sucio = true; pintar(); break;
        case 'quitar': st.pasos.splice(i, 1); st.sucio = true; pintar(); break;
        case 'subir': [st.pasos[i - 1], st.pasos[i]] = [st.pasos[i], st.pasos[i - 1]]; st.sucio = true; pintar(); break;
        case 'bajar': [st.pasos[i + 1], st.pasos[i]] = [st.pasos[i], st.pasos[i + 1]]; st.sucio = true; pintar(); break;
        case 'cancelar': await abrirDemo(st.demo.id_demo, false); break;
        case 'guardar': {
          b.disabled = true;
          const r = await put(rutas.pasos(st.idV, st.demo.id_demo), { pasos: st.pasos });
          aviso(r.mensaje); await abrirDemo(st.demo.id_demo, false);
          break;
        }
        case 'eliminar':
          if (!confirm(`¿Eliminar la DEMO «${st.demo.nombre}» y sus pasos?`)) return;
          await post(rutas.demo(st.idV, st.demo.id_demo, 'eliminar'));
          aviso('DEMO eliminada'); st.demo = null; await cargarUnidad();
          break;
        case 'probar': elegir(st.idV); ir('control'); aviso('Abre «DEMO» en el control para ejecutarla'); break;
      }
    } catch (e) { if (e.status !== 401) { aviso(e.message, true); if (b.dataset.ed === 'guardar') b.disabled = false; } }
  });

  return { mostrar };
}
