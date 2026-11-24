// Vista ADMINISTRACIÓN (práctica 4.3): una sola pantalla cuyo contenido depende del rol que CONFIRMA el servidor.
//  ADMIN    -> Dashboard · Unidades · Modelos · Clientes · DEMO de fábrica · Auditoría
//  USUARIO  -> Mis vehículos (control, monitoreo y soporte) · Mis DEMO (editor)
//  INVITADO / sin sesión -> Catálogo público y prueba temporal
// Todo dato viene de la API real (AWS/RDS). Si algo no se puede verificar se muestra «Sin datos» / «Sin verificar».
// Ocultar pestañas no protege nada: cada petición la autoriza FastAPI (401/403/404/409).
import { get, post, put, del, rutas } from '../servicios/api.js';
import * as sesion from '../servicios/sesion.js';
import { vehiculos, elegir, cargarVehiculos, SinVehiculos } from '../estado/vehiculo.js';
import { ir, alCambiarVista, vistaActual } from './navegacion.js';
import { iniciarEditorDemos } from './editor-demos.js';
import { $, $$, esc, bonito, aviso } from '../utilidades/dom.js';
import { aFecha, horaCorta } from '../utilidades/fechas.js';

const ESTADOS = ['DISPONIBLE', 'EXHIBICION', 'VENDIDA', 'INACTIVA'];
const NOMBRE_ESTADO = { DISPONIBLE: 'Disponible', EXHIBICION: 'Exhibición', VENDIDA: 'Vendida / asignada', INACTIVA: 'Inactiva' };
const PESTANAS = {
  ADMIN: [['dashboard', 'Dashboard'], ['unidades', 'Unidades'], ['modelos', 'Modelos'], ['clientes', 'Clientes'], ['demos', 'DEMO de fábrica'], ['auditoria', 'Auditoría']],
  USUARIO: [['mis', 'Mis vehículos'], ['demos', 'Mis DEMO']],
  INVITADO: [['catalogo', 'Catálogo']],
  PUBLICO: [['catalogo', 'Catálogo']],
};

const fecha = (iso) => { if (!iso) return '—'; const d = aFecha(iso); return d ? `${d.toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City' })} ${horaCorta(d)}` : '—'; };
const estadoC = (e) => `<span class="estado-c ${esc(e)}">${esc(NOMBRE_ESTADO[e] || e)}</span>`;
const vacio = (t) => `<div class="adm-vacio">${esc(t)}</div>`;
const cargando = () => '<div class="adm-vacio" aria-busy="true">Cargando datos reales de AWS…</div>';
const errorHtml = (e) => `<div class="adm-vacio">No se pudieron cargar los datos: ${esc(e.message)}${e.status ? ` (HTTP ${e.status})` : ''}</div>`;

export function iniciarAdministracion() {
  const raiz = $('#adm-contenido');
  const st = { pestana: null, unidades: { desde: 0 }, clientes: { desde: 0 }, auditoria: { desde: 0 }, modelos: [] };
  const editor = iniciarEditorDemos();
  const rol = () => sesion.rol() || 'PUBLICO';

  // ---------------- Pestañas ----------------
  function pintarPestanas() {
    const lista = PESTANAS[rol()] || PESTANAS.PUBLICO;
    if (!lista.some(([k]) => k === st.pestana)) st.pestana = lista[0][0];
    $('#adm-tabs').innerHTML = lista.map(([k, t]) =>
      `<button type="button" class="adm-tab" role="tab" data-tab="${k}" aria-selected="${k === st.pestana}">${esc(t)}</button>`).join('');
    $('#adm-tabs').hidden = lista.length < 2;
    const r = rol();
    $('#adm-eyebrow').textContent = r === 'ADMIN' ? 'Empresa · Administrador' : r === 'USUARIO' ? 'Comprador' : 'Prueba nuestros vehículos IoT';
    $('#adm-titulo').textContent = r === 'ADMIN' ? 'Administración' : r === 'USUARIO' ? 'Mis vehículos' : 'Catálogo';
  }
  $('#adm-tabs').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-tab]'); if (!b) return;
    st.pestana = b.dataset.tab; pintarPestanas(); mostrar();
  });

  async function mostrar() {
    if (vistaActual() !== 'admin') return;
    const p = st.pestana;
    raiz.innerHTML = cargando();
    $('#adm-meta').textContent = '';
    try {
      if (p === 'dashboard') await dashboard();
      else if (p === 'unidades') await unidades();
      else if (p === 'modelos') await modelos();
      else if (p === 'clientes') await clientes();
      else if (p === 'auditoria') await auditoria();
      else if (p === 'demos') await editor.mostrar(raiz);
      else if (p === 'mis') await misVehiculos();
      else await catalogo();
    } catch (e) { if (e.status !== 401) raiz.innerHTML = errorHtml(e); }
  }

  // ---------------- Dashboard (métricas reales) ----------------
  async function dashboard() {
    const [r, aud] = await Promise.all([get(rutas.admin('resumen')), get(`${rutas.admin('auditoria')}?limite=8`)]);
    $('#adm-meta').textContent = `Datos de Amazon RDS · ${fecha(r.generado)}`;
    const m = (n, t, acento = false) => `<div class="adm-metrica ${acento ? 'acento' : ''}"><b>${n}</b><span>${esc(t)}</span></div>`;
    raiz.innerHTML = `
      <div class="row g-3 g-lg-4">
        <div class="col-12"><article class="mon-card"><header class="mon-card-cab"><h2>Inventario y ventas</h2><span class="fuente rest">GET /admin/resumen</span></header>
          <div class="adm-metricas">
            ${m(r.modelos, 'Modelos activos')}${m(r.unidades, 'Unidades', true)}${m(r.disponibles, 'Disponibles')}
            ${m(r.vendidas, 'Vendidas / asignadas', true)}${m(r.exhibicion, 'En exhibición')}${m(r.inactivas, 'Inactivas')}
            ${m(r.clientes, 'Clientes activos', true)}${m(r.demos_fabrica, 'DEMO de fábrica')}${m(r.demos_privadas, 'DEMO privadas')}
            ${m(r.pruebas_activas, 'Pruebas de invitado activas')}${m(r.canales_wss_abiertos, 'Canales WSS abiertos')}${m(r.movimientos_historicos, 'Movimientos en historial')}
          </div>
          <p class="mon-meta mt-3 mb-0">«Canales WSS» cuenta navegadores y dispositivos conectados al servidor; no confirma que un vehículo físico esté en línea.</p>
        </article></div>
        <div class="col-12 col-lg-5"><article class="mon-card h-100"><header class="mon-card-cab"><h2>Accesos rápidos</h2></header>
          <div class="d-grid gap-2">
            <button type="button" class="btn-azul" data-acc="nueva-unidad">Registrar unidad</button>
            <button type="button" class="btn-contorno" data-acc="nuevo-cliente">Dar de alta cliente</button>
            <button type="button" class="btn-contorno" data-acc="nuevo-modelo">Registrar modelo</button>
            <button type="button" class="btn-contorno" data-ir-tab="unidades">Asignar unidades</button>
          </div></article></div>
        <div class="col-12 col-lg-7"><article class="mon-card h-100"><header class="mon-card-cab"><h2>Actividad reciente</h2><button type="button" class="btn-contorno btn-chico" data-ir-tab="auditoria">Ver bitácora</button></header>
          ${tablaAuditoria(aud.registros)}</article></div>
      </div>`;
  }

  // ---------------- Unidades ----------------
  async function unidades() {
    if (!st.modelos.length) st.modelos = await get(rutas.admin('modelos'));
    const f = st.unidades;
    const qs = new URLSearchParams({ limite: 20, desde: f.desde });
    if (f.estado) qs.set('estado', f.estado); if (f.id_modelo) qs.set('id_modelo', f.id_modelo); if (f.q) qs.set('q', f.q);
    const r = await get(`${rutas.admin('unidades')}?${qs}`);
    $('#adm-meta').textContent = `${r.total} unidades en inventario`;
    raiz.innerHTML = `<article class="mon-card">
      <form class="adm-barra" data-filtro="unidades">
        <label>Buscar<input class="form-control" name="q" value="${esc(f.q || '')}" maxlength="40" placeholder="Nombre, serie o cliente"></label>
        <label>Estado<select class="form-select" name="estado"><option value="">Todos</option>${ESTADOS.map((e) => `<option value="${e}" ${f.estado === e ? 'selected' : ''}>${NOMBRE_ESTADO[e]}</option>`).join('')}</select></label>
        <label>Modelo<select class="form-select" name="id_modelo"><option value="">Todos</option>${st.modelos.map((m) => `<option value="${m.id_modelo}" ${String(f.id_modelo) === String(m.id_modelo) ? 'selected' : ''}>${esc(m.nombre)}</option>`).join('')}</select></label>
        <div class="acciones"><button class="btn-contorno" type="submit">Filtrar</button><button class="btn-azul" type="button" data-acc="nueva-unidad">Nueva unidad</button></div>
      </form>
      ${r.unidades.length ? `<div class="table-responsive"><table class="table adm-tabla">
        <caption class="visually-hidden">Inventario de unidades</caption>
        <thead><tr><th scope="col">Serie</th><th scope="col">Unidad</th><th scope="col">Modelo</th><th scope="col">Estado</th><th scope="col">Propietario</th><th scope="col">Conectividad</th><th scope="col"><span class="visually-hidden">Acciones</span></th></tr></thead>
        <tbody>${r.unidades.map((u) => `<tr>
          <td class="mono">${esc(u.numero_serie)}</td><td>${esc(u.nombre)}<br><small class="text-secondary">ID ${u.id_vehiculo}</small></td>
          <td>${esc(u.modelo)}</td><td>${estadoC(u.estado_comercial)}</td>
          <td>${u.propietario ? `${esc(u.propietario)}<br><small class="text-secondary">${esc(u.correo_propietario)}</small>` : '—'}</td>
          <td><small>Dispositivo: <b>Sin verificar</b><br>WSS: ${u.wss_clientes} canal(es)${u.controlando ? ` · controla ${esc(u.controlando)}` : ''}</small></td>
          <td><div class="acciones">
            <button class="btn-contorno btn-chico" data-acc="editar-unidad" data-id="${u.id_vehiculo}">Editar</button>
            ${u.estado_comercial === 'INACTIVA' ? '' : u.id_propietario
              ? `<button class="btn-contorno btn-chico" data-acc="asignar" data-id="${u.id_vehiculo}">Reasignar</button><button class="btn-contorno btn-chico" data-acc="liberar" data-id="${u.id_vehiculo}">Liberar</button>`
              : `<button class="btn-contorno btn-chico" data-acc="asignar" data-id="${u.id_vehiculo}">Asignar</button>`}
            ${u.estado_comercial === 'INACTIVA' ? '' : `<button class="btn-contorno btn-chico btn-peligro" data-acc="baja-unidad" data-id="${u.id_vehiculo}">Baja</button>`}
          </div></td></tr>`).join('')}</tbody></table></div>` : vacio('No hay unidades con esos filtros.')}
      ${paginas(r, 'unidades')}</article>`;
    st.ultimaPagina = r.unidades;
  }

  // ---------------- Modelos ----------------
  async function modelos() {
    st.modelos = await get(rutas.admin('modelos'));
    $('#adm-meta').textContent = `${st.modelos.length} modelos comerciales`;
    raiz.innerHTML = `<div class="adm-barra"><div class="acciones"><button class="btn-azul" type="button" data-acc="nuevo-modelo">Nuevo modelo</button></div></div>
      ${st.modelos.length ? `<div class="adm-tarjetas">${st.modelos.map((m) => `<article class="mon-card adm-tarjeta">
        <h3>${esc(m.nombre)}</h3><p>${esc(m.descripcion || 'Sin descripción')}</p>
        <div><span class="etiqueta">${m.unidades} unidad(es)</span><span class="etiqueta si">${m.en_exhibicion} en exhibición</span>
          <span class="etiqueta">${m.publico ? 'En catálogo público' : 'Privado'}</span>${m.activo ? '' : '<span class="etiqueta">Inactivo</span>'}</div>
        <div class="pie"><button class="btn-contorno btn-chico" data-acc="editar-modelo" data-id="${m.id_modelo}">Editar</button>
          <button class="btn-contorno btn-chico" data-acc="capacidades" data-id="${m.id_modelo}">Capacidades</button></div>
      </article>`).join('')}</div>` : vacio('Todavía no hay modelos.')}`;
  }

  // ---------------- Clientes ----------------
  async function clientes() {
    const f = st.clientes;
    const qs = new URLSearchParams({ limite: 20, desde: f.desde });
    if (f.q) qs.set('q', f.q); if (f.rol) qs.set('rol', f.rol);
    const r = await get(`${rutas.admin('clientes')}?${qs}`);
    $('#adm-meta').textContent = `${r.total} cuentas`;
    raiz.innerHTML = `<article class="mon-card">
      <form class="adm-barra" data-filtro="clientes">
        <label>Buscar<input class="form-control" name="q" value="${esc(f.q || '')}" maxlength="40" placeholder="Nombre o correo"></label>
        <label>Rol<select class="form-select" name="rol"><option value="">Todos</option><option value="USUARIO" ${f.rol === 'USUARIO' ? 'selected' : ''}>Comprador</option><option value="ADMIN" ${f.rol === 'ADMIN' ? 'selected' : ''}>Administrador</option></select></label>
        <div class="acciones"><button class="btn-contorno" type="submit">Filtrar</button><button class="btn-azul" type="button" data-acc="nuevo-cliente">Nuevo cliente</button></div>
      </form>
      ${r.clientes.length ? `<div class="table-responsive"><table class="table adm-tabla">
        <caption class="visually-hidden">Clientes y cuentas</caption>
        <thead><tr><th scope="col">Nombre</th><th scope="col">Correo</th><th scope="col">Rol</th><th scope="col">Unidades</th><th scope="col">Estado</th><th scope="col"><span class="visually-hidden">Acciones</span></th></tr></thead>
        <tbody>${r.clientes.map((c) => `<tr>
          <td>${esc(c.nombre)}</td><td class="mono">${esc(c.correo)}</td><td>${c.rol === 'ADMIN' ? 'Administrador' : 'Comprador'}</td>
          <td>${c.unidades}</td><td>${c.activo ? '<span class="estado-c DISPONIBLE">Activa</span>' : '<span class="estado-c INACTIVA">Baja</span>'}</td>
          <td><div class="acciones">
            <button class="btn-contorno btn-chico" data-acc="editar-cliente" data-id="${c.id_usuario}">Editar</button>
            <button class="btn-contorno btn-chico" data-acc="password" data-id="${c.id_usuario}">Nueva contraseña</button>
            ${c.rol === 'USUARIO' && c.activo ? `<button class="btn-contorno btn-chico" data-acc="ver-unidades" data-id="${c.id_usuario}">Unidades</button>` : ''}
          </div></td></tr>`).join('')}</tbody></table></div>` : vacio('No hay cuentas con esos filtros.')}
      ${paginas(r, 'clientes')}</article>`;
    st.clientesPagina = r.clientes;
  }

  // ---------------- Auditoría ----------------
  function tablaAuditoria(regs) {
    if (!regs.length) return vacio('Sin registros todavía.');
    return `<div class="table-responsive"><table class="table adm-tabla"><caption class="visually-hidden">Bitácora</caption>
      <thead><tr><th scope="col">Fecha</th><th scope="col">Actor</th><th scope="col">Acción</th><th scope="col">Recurso</th><th scope="col">Resultado</th><th scope="col">Detalle</th></tr></thead>
      <tbody>${regs.map((a) => `<tr><td class="mono">${fecha(a.fecha)}</td><td>${esc(a.actor || (a.id_actor ? `#${a.id_actor}` : '—'))}<br><small class="text-secondary">${esc(a.rol)}</small></td>
        <td class="mono">${esc(a.accion)}</td><td class="mono">${esc(a.recurso || '—')}</td>
        <td>${a.resultado === 'OK' ? '<span class="estado-c DISPONIBLE">OK</span>' : `<span class="estado-c INACTIVA">${esc(a.resultado)}</span>`}</td>
        <td><small>${esc(a.detalle || '')}</small></td></tr>`).join('')}</tbody></table></div>`;
  }
  async function auditoria() {
    const f = st.auditoria;
    const qs = new URLSearchParams({ limite: 25, desde: f.desde }); if (f.accion) qs.set('accion', f.accion);
    const r = await get(`${rutas.admin('auditoria')}?${qs}`);
    $('#adm-meta').textContent = `${r.total} registros · sin contraseñas ni tokens`;
    const acciones = ['LOGIN', 'LOGOUT', 'UNIDAD_ALTA', 'UNIDAD_CAMBIO', 'UNIDAD_BAJA', 'ASIGNACION', 'LIBERACION', 'CLIENTE_ALTA', 'CLIENTE_CAMBIO', 'CLIENTE_BAJA',
      'PASSWORD_RESET', 'MODELO_ALTA', 'CAPACIDADES', 'DEMO_ALTA', 'DEMO_PASOS', 'DEMO_EJECUCION', 'SOPORTE', 'INVITADO_INICIO', 'INVITADO_FIN'];
    raiz.innerHTML = `<article class="mon-card">
      <form class="adm-barra" data-filtro="auditoria"><label>Acción<select class="form-select" name="accion"><option value="">Todas</option>
        ${acciones.map((a) => `<option ${f.accion === a ? 'selected' : ''}>${a}</option>`).join('')}</select></label>
        <div class="acciones"><button class="btn-contorno" type="submit">Filtrar</button></div></form>
      ${tablaAuditoria(r.registros)}${paginas(r, 'auditoria')}</article>`;
  }

  function paginas(r, cual) {
    const lim = r.limite, fin = Math.min(r.desde + lim, r.total);
    if (r.total <= lim) return '';
    return `<nav class="adm-paginas" aria-label="Páginas"><span>${r.desde + 1}–${fin} de ${r.total}</span><span class="d-flex gap-2">
      <button class="btn-contorno btn-chico" data-pagina="${cual}" data-desde="${Math.max(0, r.desde - lim)}" ${r.desde ? '' : 'disabled'}>Anterior</button>
      <button class="btn-contorno btn-chico" data-pagina="${cual}" data-desde="${r.desde + lim}" ${fin < r.total ? '' : 'disabled'}>Siguiente</button></span></nav>`;
  }

  // ---------------- Mis vehículos (comprador) ----------------
  async function misVehiculos() {
    const lista = vehiculos().length ? vehiculos()
      : await cargarVehiculos().catch((e) => { if (e instanceof SinVehiculos) return []; throw e; });
    $('#adm-meta').textContent = `${lista.length} unidad(es) a tu nombre`;
    if (!lista.length) { raiz.innerHTML = vacio('Tu cuenta todavía no tiene vehículos asignados. La empresa debe asignarte una unidad.'); return; }
    raiz.innerHTML = `<div class="adm-tarjetas">${lista.map((v) => `<article class="mon-card adm-tarjeta">
      <h3>${esc(v.nombre)}</h3>
      <p>${esc(v.unidad?.modelo || v.modelo || '')}</p>
      <div><span class="etiqueta">Serie ${esc(v.unidad?.numero_serie || '—')}</span>${v.unidad ? estadoC(v.unidad.estado_comercial) : ''}</div>
      <p class="dato">Dispositivo físico: Sin verificar (WSS solo confirma tu navegador)</p>
      <div class="pie">
        <button class="btn-azul btn-chico" data-acc="ir-control" data-id="${v.id_vehiculo}">Controlar</button>
        <button class="btn-contorno btn-chico" data-acc="ir-monitoreo" data-id="${v.id_vehiculo}">Monitorear</button>
        <button class="btn-contorno btn-chico" data-acc="soporte" data-id="${v.id_vehiculo}" data-horas="2">Autorizar soporte 2 h</button>
        <button class="btn-contorno btn-chico" data-acc="soporte" data-id="${v.id_vehiculo}" data-horas="0">Retirar soporte</button>
      </div></article>`).join('')}</div>`;
  }

  // ---------------- Catálogo (público / invitado) ----------------
  async function catalogo() {
    const cat = await get(rutas.catalogo(), { sinSesion: true });
    const s = sesion.sesion();
    const enPrueba = s?.usuario?.rol === 'INVITADO';
    $('#adm-meta').textContent = enPrueba ? 'Tienes una prueba activa: ve a Control para manejar la unidad.' : 'Elige un modelo y pruébalo 5 minutos en una unidad de exhibición.';
    raiz.innerHTML = `${enPrueba ? `<article class="mon-card mb-3"><header class="mon-card-cab"><h2>Tu prueba</h2></header>
        <p class="mon-meta">Unidad ${esc(s.prueba?.vehiculo || '')} · comandos habilitados: ${(s.prueba?.comandos || []).map((c) => `<span class="etiqueta si">${esc(bonito(c))}</span>`).join('')}</p>
        <div class="pie d-flex gap-2 flex-wrap"><button class="btn-azul" data-acc="ir-control">Ir al control</button><button class="btn-contorno btn-peligro" data-accion="terminar-prueba">Terminar prueba</button></div></article>` : ''}
      ${cat.length ? `<div class="adm-tarjetas">${cat.map((m) => `<article class="mon-card adm-tarjeta">
        ${m.imagen_url ? `<img src="${esc(m.imagen_url)}" alt="${esc(m.nombre)}" class="img-fluid rounded-3">` : ''}
        <h3>${esc(m.nombre)}</h3><p>${esc(m.descripcion || '')}</p>
        <div>${m.capacidades.map((c) => `<span class="etiqueta ${m.comandos_invitado.includes(c) ? 'si' : ''}">${esc(bonito(c))}</span>`).join('')}</div>
        <p class="dato">Resaltados: comandos disponibles en la prueba · ${m.minutos_prueba} min</p>
        <div class="pie"><span class="dato">${m.disponibles_para_prueba} de ${m.unidades_exhibicion} unidad(es) libres</span>
          <button class="btn-azul btn-chico" data-acc="probar" data-id="${m.id_modelo}" ${m.disponibles_para_prueba && !sesion.token() ? '' : 'disabled'}>
            ${!m.unidades_exhibicion ? 'Sin unidades de exhibición' : m.disponibles_para_prueba ? 'Probar 5 min' : 'Ocupado: intenta en unos minutos'}</button></div>
      </article>`).join('')}</div>` : vacio('No hay modelos en el catálogo público.')}
      ${sesion.token() && !enPrueba ? '<p class="mon-meta mt-3">Para probar como invitado, cierra tu sesión.</p>' : ''}`;
  }

  // ---------------- Diálogo de formularios ----------------
  const dlg = $('#adm-dialogo');
  let alGuardar = null;
  function dialogo(titulo, cuerpo, guardar, textoOk = 'Guardar') {
    $('#adm-dialogo-titulo').textContent = titulo;
    $('#adm-dialogo-cuerpo').innerHTML = cuerpo;
    $('#adm-dialogo-error').textContent = '';
    $('#adm-dialogo-ok').textContent = textoOk; $('#adm-dialogo-ok').hidden = !guardar;
    alGuardar = guardar;
    dlg.showModal();
    dlg.querySelector('input, select, textarea')?.focus();
  }
  $$('[data-cerrar-dialogo]').forEach((b) => b.addEventListener('click', () => dlg.close()));
  $('#adm-dialogo-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (!alGuardar) { dlg.close(); return; }
    const f = ev.currentTarget;
    if (!f.reportValidity()) return;
    const ok = $('#adm-dialogo-ok'); ok.disabled = true; $('#adm-dialogo-error').textContent = '';
    try {
      const datos = Object.fromEntries(new FormData(f).entries());
      const siguiente = await alGuardar(datos, f);
      if (siguiente !== 'mantener') dlg.close();
      mostrar();
    } catch (e) { $('#adm-dialogo-error').textContent = e.message; } finally { ok.disabled = false; }
  });

  const campo = (etq, nombre, valor = '', extra = '') => `<label>${etq}<input class="form-control" name="${nombre}" value="${esc(valor ?? '')}" ${extra}></label>`;
  const selector = (etq, nombre, opciones, valor) => `<label>${etq}<select class="form-select" name="${nombre}" required>${opciones.map(([v, t]) =>
    `<option value="${esc(v)}" ${String(v) === String(valor) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
  const casilla = (etq, nombre, marcado) => `<label class="check"><input type="checkbox" name="${nombre}" value="1" ${marcado ? 'checked' : ''}>${etq}</label>`;

  async function formUnidad(u) {
    if (!st.modelos.length) st.modelos = await get(rutas.admin('modelos'));
    const estados = ESTADOS.filter((e) => e !== 'VENDIDA' || u?.estado_comercial === 'VENDIDA').map((e) => [e, NOMBRE_ESTADO[e]]);
    dialogo(u ? `Editar unidad ${u.numero_serie}` : 'Registrar unidad física', `
      ${selector('Modelo comercial', 'id_modelo', st.modelos.filter((m) => m.activo || m.id_modelo === u?.id_modelo).map((m) => [m.id_modelo, m.nombre]), u?.id_modelo)}
      <div class="fila">${campo('Número de serie (único)', 'numero_serie', u?.numero_serie, 'required minlength="3" maxlength="40" pattern="[A-Z0-9\\-]+" title="Mayúsculas, números y guiones" placeholder="EXC-2026-002"')}
      ${campo('Nombre de la unidad', 'nombre', u?.nombre, 'required maxlength="80"')}</div>
      <div class="fila">${campo('Microcontrolador', 'microcontrolador', u?.microcontrolador ?? 'ESP32', 'maxlength="50"')}
      ${selector('Estado comercial', 'estado_comercial', estados, u?.estado_comercial || 'DISPONIBLE')}</div>
      ${campo('Descripción', 'descripcion', u?.descripcion, 'maxlength="255"')}
      <p class="nota">${u ? 'Para vender usa «Asignar». La baja es lógica: el historial se conserva.' : 'Se crearán sus comandos según las capacidades del modelo. El ID de control lo asigna RDS.'}</p>`,
    async (d) => {
      const cuerpo = { id_modelo: Number(d.id_modelo), numero_serie: d.numero_serie.trim().toUpperCase(), nombre: d.nombre.trim(),
        descripcion: d.descripcion || null, microcontrolador: d.microcontrolador || null, estado_comercial: d.estado_comercial };
      if (u) await put(rutas.admin(`unidades/${u.id_vehiculo}`), cuerpo);
      else { const r = await post(rutas.admin('unidades'), cuerpo); aviso(`Unidad registrada (ID ${r.id})`); }
    });
  }

  async function formAsignar(id) {
    const r = await get(`${rutas.admin('clientes')}?rol=USUARIO&activos=true&limite=100`);
    if (!r.clientes.length) { aviso('Primero da de alta un cliente', true); return; }
    dialogo('Asignar unidad a un comprador', `${selector('Comprador', 'id_usuario', r.clientes.map((c) => [c.id_usuario, `${c.nombre} · ${c.correo}`]))}
      <p class="nota">El propietario anterior pierde el acceso de inmediato (REST y WSS) y la operación queda en auditoría.</p>`,
    async (d) => { await put(rutas.admin(`unidades/${id}/asignacion`), { id_usuario: Number(d.id_usuario) }); aviso('Unidad asignada'); }, 'Asignar');
  }

  function formModelo(m) {
    dialogo(m ? `Editar ${m.nombre}` : 'Registrar modelo comercial', `
      ${campo('Nombre', 'nombre', m?.nombre, 'required minlength="2" maxlength="80" placeholder="Vehículo Batman IoT"')}
      ${campo('Descripción', 'descripcion', m?.descripcion, 'maxlength="255"')}
      ${campo('Imagen (URL https o assets/…)', 'imagen_url', m?.imagen_url, 'maxlength="255" pattern="(https://|/|assets/).*"')}
      ${casilla('Visible en el catálogo público', 'publico', m ? m.publico : true)}
      ${m ? casilla('Activo', 'activo', m.activo) : '<p class="nota">Después define sus capacidades (comandos reales del hardware).</p>'}`,
    async (d) => {
      const cuerpo = { nombre: d.nombre.trim(), descripcion: d.descripcion || null, imagen_url: d.imagen_url || null, publico: !!d.publico };
      if (m) await put(rutas.admin(`modelos/${m.id_modelo}`), { ...cuerpo, activo: !!d.activo });
      else await post(rutas.admin('modelos'), cuerpo);
      st.modelos = [];
    });
  }

  async function formCapacidades(id) {
    const m = await get(rutas.admin(`modelos/${id}`));
    const filas = (m.capacidades.length ? m.capacidades : [{ nombre_comando: 'DETENER', codigo: 9, apto_invitado: 1, duracion_max_ms: 5000 }]);
    const fila = (c, i) => `<tr><td><input class="form-control" name="n${i}" value="${esc(c.nombre_comando)}" pattern="[A-Z0-9_]+" maxlength="60" required aria-label="Comando"></td>
      <td><input class="form-control" type="number" name="c${i}" value="${c.codigo}" min="0" max="9999" required aria-label="Código"></td>
      <td><input class="form-control" type="number" name="d${i}" value="${c.duracion_max_ms}" min="100" max="60000" step="100" required aria-label="Duración máxima ms"></td>
      <td class="text-center"><input type="checkbox" name="i${i}" value="1" ${c.apto_invitado ? 'checked' : ''} aria-label="Apto invitado"></td></tr>`;
    dialogo(`Capacidades · ${m.nombre}`, `<p class="nota">Comandos que el hardware realmente soporta. Las unidades nuevas se crean con ellos; los invitados solo usan los marcados.</p>
      <div class="table-responsive"><table class="table adm-tabla caps-tabla"><thead><tr><th>Comando</th><th>Código</th><th>Máx. ms</th><th>Invitado</th></tr></thead>
      <tbody id="caps-filas">${filas.map(fila).join('')}</tbody></table></div>
      <button type="button" class="btn-contorno btn-chico" id="caps-agregar">Agregar comando</button>`,
    async (d) => {
      const n = $$('#caps-filas tr').length;
      const lista = [...Array(n).keys()].filter((i) => d[`n${i}`]).map((i) => ({
        nombre_comando: d[`n${i}`].trim().toUpperCase(), codigo: Number(d[`c${i}`]), duracion_max_ms: Number(d[`d${i}`]), apto_invitado: !!d[`i${i}`] }));
      await put(rutas.admin(`modelos/${id}/capacidades`), lista); aviso('Capacidades guardadas');
    });
    $('#caps-agregar').addEventListener('click', () => {
      const tb = $('#caps-filas'); tb.insertAdjacentHTML('beforeend', fila({ nombre_comando: '', codigo: '', duracion_max_ms: 3000, apto_invitado: 0 }, tb.rows.length));
      tb.lastElementChild.querySelector('input').focus();
    });
  }

  function formCliente(c) {
    dialogo(c ? `Editar ${c.nombre}` : 'Alta de cliente', `
      ${campo('Nombre completo', 'nombre', c?.nombre, 'required minlength="2" maxlength="100"')}
      ${campo('Correo', 'correo', c?.correo, 'type="email" required maxlength="120"')}
      ${c ? casilla('Cuenta activa (desmarcar = baja lógica: cierra sus sesiones al instante)', 'activo', c.activo)
        : `${selector('Rol', 'rol', [['USUARIO', 'Comprador (Usuario)'], ['ADMIN', 'Administrador']], 'USUARIO')}
           <p class="nota">Se generará una contraseña temporal que se muestra una sola vez.</p>`}`,
    async (d) => {
      if (c) { await put(rutas.admin(`clientes/${c.id_usuario}`), { nombre: d.nombre.trim(), correo: d.correo.trim(), activo: !!d.activo }); return; }
      const r = await post(rutas.admin('clientes'), { nombre: d.nombre.trim(), correo: d.correo.trim(), rol: d.rol });
      mostrarSecreto('Cuenta creada', d.correo.trim(), r.password_temporal);
      return 'mantener';
    });
  }

  function mostrarSecreto(titulo, correo, pw) {
    dialogo(titulo, `<p class="nota">Entrega estos datos al cliente. La contraseña no se vuelve a mostrar ni se guarda en texto claro.</p>
      <label>Correo<div class="secreto">${esc(correo)}</div></label><label>Contraseña temporal<div class="secreto">${esc(pw)}</div></label>`, null);
  }

  // ---------------- Acciones (delegación) ----------------
  $('#pantalla-admin').addEventListener('submit', (ev) => {
    const f = ev.target.closest('[data-filtro]'); if (!f) return;
    ev.preventDefault();
    const d = Object.fromEntries(new FormData(f).entries());
    st[f.dataset.filtro] = { ...d, desde: 0 };
    mostrar();
  });
  $('#pantalla-admin').addEventListener('click', async (ev) => {
    const pag = ev.target.closest('[data-pagina]');
    if (pag) { st[pag.dataset.pagina].desde = Number(pag.dataset.desde); mostrar(); return; }
    const tab = ev.target.closest('[data-ir-tab]');
    if (tab) { st.pestana = tab.dataset.irTab; pintarPestanas(); mostrar(); return; }
    const b = ev.target.closest('[data-acc]'); if (!b) return;
    const id = Number(b.dataset.id);
    try {
      switch (b.dataset.acc) {
        case 'nueva-unidad': await formUnidad(null); break;
        case 'editar-unidad': await formUnidad(await get(rutas.admin(`unidades/${id}`))); break;
        case 'asignar': await formAsignar(id); break;
        case 'liberar':
          if (confirm('¿Liberar la unidad? El comprador perderá el acceso de inmediato.')) { await del(rutas.admin(`unidades/${id}/asignacion`)); aviso('Unidad liberada'); mostrar(); }
          break;
        case 'baja-unidad':
          if (confirm('¿Dar de baja la unidad? Quedará INACTIVA; su historial se conserva.')) { await del(rutas.admin(`unidades/${id}`)); aviso('Unidad dada de baja'); mostrar(); }
          break;
        case 'nuevo-modelo': formModelo(null); break;
        case 'editar-modelo': formModelo(st.modelos.find((m) => m.id_modelo === id)); break;
        case 'capacidades': await formCapacidades(id); break;
        case 'nuevo-cliente': formCliente(null); break;
        case 'editar-cliente': formCliente(st.clientesPagina.find((c) => c.id_usuario === id)); break;
        case 'password':
          if (confirm('¿Generar una contraseña nueva? Se cerrarán sus sesiones abiertas.')) {
            const r = await post(rutas.admin(`clientes/${id}/password`));
            const c = st.clientesPagina.find((x) => x.id_usuario === id);
            mostrarSecreto('Contraseña restablecida', c?.correo || '', r.password_temporal);
          }
          break;
        case 'ver-unidades': st.unidades = { desde: 0, q: st.clientesPagina.find((x) => x.id_usuario === id)?.nombre }; st.pestana = 'unidades'; pintarPestanas(); mostrar(); break;
        case 'ir-control': if (id) elegir(id); ir('control'); break;
        case 'ir-monitoreo': elegir(id); ir('monitoreo'); break;
        case 'soporte': {
          const h = Number(b.dataset.horas);
          await put(rutas.soporte(id), { horas: h });
          aviso(h ? `La empresa puede dar soporte a esta unidad durante ${h} h` : 'Soporte retirado');
          break;
        }
        case 'probar': await iniciarPrueba(id, b); break;
      }
    } catch (e) { if (e.status !== 401) aviso(e.message, true); }
  });

  async function iniciarPrueba(idModelo, b) {
    b.disabled = true;
    try {
      const r = await post(rutas.prueba(), { id_modelo: idModelo }, { sinSesion: true });
      sesion.abrir({ token: r.token, expira_en_s: r.expira_en_s, usuario: { rol: 'INVITADO', nombre: 'Invitado' },
        prueba: { id_vehiculo: r.id_vehiculo, vehiculo: r.vehiculo, comandos: r.comandos } });
      aviso(`Prueba iniciada: ${r.vehiculo} es tuya por ${Math.round(r.expira_en_s / 60)} min`);
      ir('control');
    } catch (e) {
      aviso(e.status === 409 ? 'Esa unidad está ocupada: espera a que termine la prueba actual' : e.message, true);
      b.disabled = false;
    }
  }

  alCambiarVista((v) => { if (v === 'admin') { pintarPestanas(); mostrar(); } });

  return {
    /** Se llama al iniciar o cerrar sesión. */
    refrescar() { st.pestana = null; st.modelos = []; pintarPestanas(); mostrar(); },
  };
}
