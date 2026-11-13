// Punto de entrada (ES module): arma la aplicación CONTROL + MONITOREO en un solo documento.
// Orden: navegación -> indicadores -> MONITOREO (escucha antes de que se abra el WebSocket) -> CONTROL (carga vehículos y conecta).
import { iniciarNavegacion } from './vistas/navegacion.js';
import { iniciarConectividad } from './servicios/conectividad.js';
import { iniciarMonitoreo } from './vistas/monitoreo.js';
import { iniciarControl } from './vistas/control.js';

iniciarNavegacion();
iniciarConectividad();
iniciarMonitoreo();
iniciarControl();
