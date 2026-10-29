/**
 * =========================================================
 * Rifa con causa · Enviados Costa Rica
 * Google Apps Script que guarda los boletos en Google Sheets.
 * =========================================================
 *
 * CÓMO DESPLEGARLO (resumen; el README tiene el paso a paso):
 *  1. Crea una hoja de cálculo en Google Sheets.
 *  2. Menú Extensiones > Apps Script. Borra lo que haya y pega este archivo.
 *  3. Ejecuta una vez la función `configurar` (botón ▶ con `configurar` elegida).
 *     Crea la hoja "boletos" con los 100 boletos disponibles.
 *  4. Engrane (Configuración del proyecto) > Propiedades de la secuencia de comandos >
 *     agrega la propiedad ADMIN_TOKEN con la contraseña de administrador.
 *     Es la MISMA contraseña que Chema y tú escriben en /rifa/admin.
 *     Nunca la escribas en este archivo ni en el repositorio.
 *  5. Implementar > Nueva implementación > tipo "Aplicación web".
 *     Ejecutar como: Yo. Quién tiene acceso: Cualquier usuario.
 *  6. Copia la URL que termina en /exec y pégala en SCRIPT_URL de rifa/rifa.js.
 *
 * QUÉ EXPONE:
 *  GET  → { ok, boletos: [{ numero, estado }] }   (público, sin nombres)
 *  POST → cuerpo JSON { token, accion, numero, nombre, telefono }
 *         accion: "listar"  → todos los boletos con nombre, teléfono y fecha
 *                 "vender"  → marca un boleto disponible como vendido
 *                 "editar"  → cambia nombre/teléfono de un boleto vendido
 *                 "liberar" → regresa un boleto vendido a disponible
 */

const NOMBRE_HOJA = 'boletos';
const TOTAL_BOLETOS = 100;
// Columnas de la hoja (en este orden)
const ENCABEZADOS = ['numero', 'estado', 'nombre', 'fecha', 'telefono'];
// Límite de intentos con contraseña equivocada antes de bloquear 10 minutos
const MAX_INTENTOS_FALLIDOS = 10;


/* ---------------------------------------------------------
   Configuración inicial: ejecútala una sola vez desde el editor
   --------------------------------------------------------- */
function configurar() {
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  let hoja = libro.getSheetByName(NOMBRE_HOJA);
  if (!hoja) hoja = libro.insertSheet(NOMBRE_HOJA);

  // Si ya hay boletos registrados no se borra nada
  if (hoja.getLastRow() > 1) {
    Logger.log('La hoja "boletos" ya tiene datos; no se modificó.');
    return;
  }

  hoja.clear();
  hoja.getRange(1, 1, 1, ENCABEZADOS.length).setValues([ENCABEZADOS]).setFontWeight('bold');
  hoja.setFrozenRows(1);

  // Nombre, fecha y teléfono como texto plano para que Sheets no los convierta
  hoja.getRange(2, 3, TOTAL_BOLETOS, 3).setNumberFormat('@');

  const filas = [];
  for (let n = 1; n <= TOTAL_BOLETOS; n++) filas.push([n, 'disponible', '', '', '']);
  hoja.getRange(2, 1, TOTAL_BOLETOS, ENCABEZADOS.length).setValues(filas);

  Logger.log('Listo: 100 boletos creados en la hoja "boletos".');
}


/* ---------------------------------------------------------
   GET: estado público de los boletos (sin nombres ni teléfonos)
   --------------------------------------------------------- */
function doGet() {
  try {
    const boletos = leerBoletos().map(function (b) {
      return { numero: b.numero, estado: b.estado };
    });
    return responder({ ok: true, boletos: boletos });
  } catch (err) {
    return responder({ ok: false, error: 'No se pudo leer la hoja: ' + err.message });
  }
}


/* ---------------------------------------------------------
   POST: acciones de administración, protegidas con token
   La página manda el cuerpo como texto plano (sin preflight CORS).
   --------------------------------------------------------- */
function doPost(e) {
  let datos;
  try {
    datos = JSON.parse(e.postData.contents);
  } catch (err) {
    return responder({ ok: false, error: 'Solicitud inválida' });
  }

  if (!tokenValido(datos.token)) {
    return responder({ ok: false, error: 'Contraseña incorrecta', noAutorizado: true });
  }

  // Un solo cambio a la vez, para que dos administradores no choquen
  const candado = LockService.getScriptLock();
  if (!candado.tryLock(10000)) {
    return responder({ ok: false, error: 'La hoja está ocupada, intenta de nuevo' });
  }

  try {
    switch (datos.accion) {
      case 'listar':
        return responder({ ok: true, boletos: leerBoletos() });
      case 'vender':
        return responder(vender(datos));
      case 'editar':
        return responder(editar(datos));
      case 'liberar':
        return responder(liberar(datos));
      default:
        return responder({ ok: false, error: 'Acción desconocida' });
    }
  } catch (err) {
    return responder({ ok: false, error: err.message });
  } finally {
    candado.releaseLock();
  }
}


/* ---------------------------------------------------------
   Acciones
   --------------------------------------------------------- */
function vender(datos) {
  const fila = filaDeBoleto(datos.numero);
  const nombre = limpiarTexto(datos.nombre, 80);
  if (!nombre) return { ok: false, error: 'Falta el nombre' };

  const hoja = obtenerHoja();
  const estado = hoja.getRange(fila, 2).getValue();
  if (estado === 'vendido') return { ok: false, error: 'Ese boleto ya está vendido' };

  const fecha = new Date().toISOString();
  hoja.getRange(fila, 2, 1, 4).setValues([[
    'vendido', protegerCelda(nombre), fecha, protegerCelda(limpiarTexto(datos.telefono, 25))
  ]]);
  return { ok: true, boletos: leerBoletos() };
}

function editar(datos) {
  const fila = filaDeBoleto(datos.numero);
  const nombre = limpiarTexto(datos.nombre, 80);
  if (!nombre) return { ok: false, error: 'Falta el nombre' };

  const hoja = obtenerHoja();
  if (hoja.getRange(fila, 2).getValue() !== 'vendido') {
    return { ok: false, error: 'Ese boleto no está vendido' };
  }
  // Se conserva la fecha original de la venta
  hoja.getRange(fila, 3).setValue(protegerCelda(nombre));
  hoja.getRange(fila, 5).setValue(protegerCelda(limpiarTexto(datos.telefono, 25)));
  return { ok: true, boletos: leerBoletos() };
}

function liberar(datos) {
  const fila = filaDeBoleto(datos.numero);
  obtenerHoja().getRange(fila, 2, 1, 4).setValues([['disponible', '', '', '']]);
  return { ok: true, boletos: leerBoletos() };
}


/* ---------------------------------------------------------
   Utilidades
   --------------------------------------------------------- */
function obtenerHoja() {
  const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NOMBRE_HOJA);
  if (!hoja) throw new Error('No existe la hoja "boletos". Ejecuta configurar().');
  return hoja;
}

function leerBoletos() {
  const valores = obtenerHoja().getRange(2, 1, TOTAL_BOLETOS, ENCABEZADOS.length).getValues();
  return valores.map(function (f) {
    return {
      numero: Number(f[0]),
      estado: f[1] === 'vendido' ? 'vendido' : 'disponible',
      nombre: String(f[2] || ''),
      fecha: f[3] instanceof Date ? f[3].toISOString() : String(f[3] || ''),
      telefono: String(f[4] || '')
    };
  });
}

// El boleto 1 está en la fila 2 (la fila 1 son los encabezados)
function filaDeBoleto(numero) {
  const n = Number(numero);
  if (!Number.isInteger(n) || n < 1 || n > TOTAL_BOLETOS) throw new Error('Número de boleto inválido');
  return n + 1;
}

function limpiarTexto(valor, largoMax) {
  return String(valor || '').replace(/\s+/g, ' ').trim().slice(0, largoMax);
}

// Evita que un nombre que empiece con = + - @ se interprete como fórmula
function protegerCelda(texto) {
  return /^[=+\-@]/.test(texto) ? "'" + texto : texto;
}

function tokenValido(token) {
  const cache = CacheService.getScriptCache();
  const fallidos = Number(cache.get('intentos_fallidos') || 0);
  if (fallidos >= MAX_INTENTOS_FALLIDOS) return false;

  const real = PropertiesService.getScriptProperties().getProperty('ADMIN_TOKEN');
  if (!real || real === 'PEGAR_TOKEN_AQUI') return false;

  if (typeof token === 'string' && token === real) return true;
  cache.put('intentos_fallidos', String(fallidos + 1), 600); // 10 minutos
  return false;
}

function responder(objeto) {
  return ContentService.createTextOutput(JSON.stringify(objeto))
    .setMimeType(ContentService.MimeType.JSON);
}
