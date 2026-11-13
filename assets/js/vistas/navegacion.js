// Navegación entre CONTROL y MONITOREO dentro del mismo documento (sin recargar).
// Rutas con hash (#/control, #/monitoreo): funcionan en la subruta de GitHub Pages y permiten «atrás».
import { $, $$ } from '../utilidades/dom.js';

const VISTAS = ['control', 'monitoreo'];
const oyentes = new Set();
let actual = null;

const desdeHash = () => { const v = location.hash.replace(/^#\/?/, ''); return VISTAS.includes(v) ? v : 'control'; };
export const vistaActual = () => actual;

function mostrar(vista) {
  if (vista === actual) return;
  const anterior = actual; actual = vista;
  document.body.dataset.vista = vista;
  $$('[data-ir]').forEach((a) => {
    const activa = a.dataset.ir === vista;
    a.classList.toggle('activa', activa);
    if (activa) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  document.title = vista === 'monitoreo' ? 'Monitoreo · Excavadora IoT' : 'Control Excavadora IoT';
  oyentes.forEach((f) => { try { f(vista, anterior); } catch (e) { console.error(e); } });
  if (anterior) { window.scrollTo(0, 0); if (vista === 'monitoreo') $('#pantalla-monitoreo')?.focus({ preventScroll: true }); }
}

export function ir(vista) {
  if (`#/${vista}` !== location.hash) location.hash = `#/${vista}`; else mostrar(vista);
}

/** f(vistaNueva, vistaAnterior) */
export function alCambiarVista(f) { oyentes.add(f); return () => oyentes.delete(f); }

export function iniciarNavegacion() {
  addEventListener('hashchange', () => mostrar(desdeHash()));
  // La cabecera (indicadores + navegación) es fija: su alto real se pasa al CSS para que nada quede debajo
  const cab = $('#cabecera');
  if (cab && 'ResizeObserver' in window) {
    new ResizeObserver(() => document.documentElement.style.setProperty('--alto-cab', `${cab.offsetHeight}px`)).observe(cab);
  }
  mostrar(desdeHash());
}
