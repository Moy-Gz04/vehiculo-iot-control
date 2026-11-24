// Punto de entrada (ES module): una sola plataforma CONTROL + MONITOREO + ADMINISTRACIÓN.
// Orden: navegación -> indicadores -> MONITOREO (escucha antes de que se abra el WebSocket) -> CONTROL
//        -> ADMINISTRACIÓN -> aviso de invitado -> sesión (decide qué se muestra según el rol que da el servidor).
import { iniciarNavegacion, menuPorRol, alCambiarVista, ir } from './vistas/navegacion.js';
import { iniciarConectividad } from './servicios/conectividad.js';
import { iniciarMonitoreo } from './vistas/monitoreo.js';
import { iniciarControl } from './vistas/control.js';
import { iniciarAdministracion } from './vistas/administracion.js';
import { iniciarInvitado } from './vistas/invitado.js';
import * as sesion from './servicios/sesion.js';
import { post, rutas } from './servicios/api.js';
import { olvidar } from './estado/vehiculo.js';
import { $ } from './utilidades/dom.js';

iniciarNavegacion();
iniciarConectividad();
iniciarMonitoreo();
const control = iniciarControl();
const admin = iniciarAdministracion();
iniciarInvitado();

const ROL = { ADMIN: 'Administrador', USUARIO: 'Comprador', INVITADO: 'Invitado' };

function aplicarSesion(s, motivo) {
  const r = s?.usuario?.rol || '';
  menuPorRol(r);
  $('#sesion-chip').hidden = !s || r === 'INVITADO';
  $('#sesion-nombre').textContent = s?.usuario?.nombre || '—';
  $('#sesion-rol').textContent = ROL[r] || '';
  if (s) {
    control.entrar();
  } else {
    olvidar(motivo === 'expirada' ? 'Sesión vencida' : 'Sin sesión');
    control.mostrarLogin(motivo === 'expirada' ? 'Tu sesión terminó o fue revocada. Vuelve a iniciar sesión.' : '');
    if (motivo !== 'finalizada' && location.hash === '#/monitoreo') ir('control');
  }
  admin.refrescar();
}

sesion.alCambiarSesion(aplicarSesion);
aplicarSesion(sesion.sesion(), 'carga');

// Sin sesión no hay MONITOREO (no hay unidad autorizada): se vuelve al login
alCambiarVista((v) => { if (v === 'monitoreo' && !sesion.token()) ir('control'); });

document.addEventListener('click', async (ev) => {
  if (!ev.target.closest('[data-accion="salir"]')) return;
  try { await post(rutas.logout()); } catch { /* aunque falle la red, se borra localmente */ }
  sesion.cerrar('cierre');
});
