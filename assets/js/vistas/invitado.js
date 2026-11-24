// Aviso de la prueba de Invitado (4.3): tiempo restante, latido y cierre.
// El tiempo REAL lo controla el servidor (reserva en RDS). Aquí solo se muestra y se consulta GET /publico/prueba
// cada 10 s (eso también es la «señal» que mantiene viva la reserva). Al vencer, el servidor detiene la unidad,
// revoca el token y cierra el WSS; el navegador vuelve al catálogo.
import { get, del, rutas } from '../servicios/api.js';
import * as sesion from '../servicios/sesion.js';
import * as socket from '../servicios/socket.js';
import { ir } from './navegacion.js';
import { $, aviso } from '../utilidades/dom.js';

export function iniciarInvitado() {
  let fin = 0, reloj = null, latido = null;

  function pintar() {
    const s = Math.max(0, Math.round((fin - Date.now()) / 1000));
    $('#prueba-reloj').textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    if (s <= 30) $('#banner-prueba').dataset.poco = ''; else delete $('#banner-prueba').dataset.poco;
  }

  async function consultar() {
    try {
      const r = await get(rutas.prueba());
      if (!r.activa) { terminarLocal('Tu prueba terminó'); return; }
      fin = Date.now() + r.restantes_s * 1000; pintar();
    } catch { /* 401 lo maneja api.js (cierra la sesión) */ }
  }

  function terminarLocal(msg) {
    detener();
    if (sesion.rol() === 'INVITADO') { sesion.cerrar('finalizada'); aviso(msg, true); ir('admin'); }
  }

  function detener() {
    clearInterval(reloj); clearInterval(latido); reloj = latido = null;
    $('#banner-prueba').hidden = true;
  }

  function activar(s) {
    detener();
    if (s?.usuario?.rol !== 'INVITADO') return;
    fin = s.expira; $('#banner-prueba').hidden = false; pintar();
    reloj = setInterval(pintar, 1000);
    latido = setInterval(consultar, 10000);
    consultar();
  }

  // El servidor avisa por WSS cuando cierra la prueba (expiró, sin señal o retirada de exhibición)
  socket.alMensaje((m) => { if (m?.evento === 'prueba_finalizada') terminarLocal(`Prueba finalizada (${String(m.motivo || '').toLowerCase().replace('_', ' ')}). La unidad se detuvo.`); });

  document.addEventListener('click', async (ev) => {
    if (!ev.target.closest('[data-accion="terminar-prueba"]')) return;
    try { await del(rutas.prueba()); } catch { /* ya cerrada */ }
    terminarLocal('Prueba terminada: la unidad quedó libre y detenida');
  });

  sesion.alCambiarSesion((s) => activar(s));
  activar(sesion.sesion());
}
