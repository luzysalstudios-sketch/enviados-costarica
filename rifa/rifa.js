/* =========================================================
   Rifa con causa · Enviados Costa Rica
   Lógica compartida de la página pública y del panel de administración.
   ========================================================= */

/* ---------------------------------------------------------
   CONFIGURACIÓN: lo único que hay que cambiar
   --------------------------------------------------------- */

// Link de pago de Mercado Pago de Chema
const MP_LINK = "PEGAR_LINK_AQUI";

// URL de la aplicación web de Google Apps Script (termina en /exec)
const SCRIPT_URL = "PEGAR_URL_SCRIPT_AQUI";

// SHA-256 de la contraseña de administrador (nunca la contraseña en texto plano).
// Para cambiarla, sigue el README: genera el hash nuevo y cambia también ADMIN_TOKEN en Apps Script.
const ADMIN_HASH = "a71bb9ca2dc6a69afcf4a7d69daf737eeae50222d47568dfeb19530461b63c74";

const PRECIO = 180;            // MXN por boleto
const TOTAL_BOLETOS = 100;
const META = 18000;            // meta de recaudación en MXN
const REFRESCO_MS = 30000;     // la página se actualiza sola cada 30 segundos
const ESPERA_MAX_MS = 15000;   // tiempo máximo de espera al script


/* ---------------------------------------------------------
   Estado
   --------------------------------------------------------- */
const esAdmin = document.body.dataset.modo === "admin";
const CLAVE_SESION = "rifa-enviados-admin";

// numero -> { estado, nombre, telefono, fecha }
let boletos = new Map();
let cargado = false;
let cargando = false;
let elegido = null; // boleto elegido en la página pública

const $ = (selector) => document.querySelector(selector);
const dosDigitos = (n) => String(n).padStart(2, "0");
const pesos = (n) => "$" + n.toLocaleString("es-MX") + " MXN";


/* ---------------------------------------------------------
   Comunicación con Google Apps Script
   --------------------------------------------------------- */
async function llamarScript(opciones = {}) {
  if (!SCRIPT_URL.startsWith("http")) throw new Error("Falta configurar SCRIPT_URL");

  const control = new AbortController();
  const temporizador = setTimeout(() => control.abort(), ESPERA_MAX_MS);
  try {
    // El cuerpo va como texto plano para evitar la verificación previa de CORS
    const respuesta = await fetch(SCRIPT_URL, { ...opciones, signal: control.signal, redirect: "follow" });
    if (!respuesta.ok) throw new Error("HTTP " + respuesta.status);
    return await respuesta.json();
  } finally {
    clearTimeout(temporizador);
  }
}

function enviarAccion(accion, datos = {}) {
  return llamarScript({
    method: "POST",
    body: JSON.stringify({ token: tokenGuardado(), accion, ...datos })
  });
}

function guardarBoletos(lista) {
  const nuevo = new Map();
  for (let n = 1; n <= TOTAL_BOLETOS; n++) nuevo.set(n, { estado: "disponible", nombre: "", telefono: "", fecha: "" });
  for (const b of lista || []) {
    const n = Number(b.numero);
    if (!nuevo.has(n)) continue;
    nuevo.set(n, {
      estado: b.estado === "vendido" ? "vendido" : "disponible",
      nombre: b.nombre || "",
      telefono: b.telefono || "",
      fecha: b.fecha || ""
    });
  }
  boletos = nuevo;
}

async function cargar() {
  if (cargando) return;
  cargando = true;
  $("#cuadricula").setAttribute("aria-busy", "true");
  try {
    const datos = esAdmin ? await enviarAccion("listar") : await llamarScript();
    if (!datos.ok) {
      if (datos.noAutorizado) return cerrarSesion("La contraseña ya no es válida. Entra de nuevo.");
      throw new Error(datos.error || "Respuesta inválida");
    }
    guardarBoletos(datos.boletos);
    cargado = true;
    ocultarAviso();
    pintar();
  } catch (err) {
    console.warn("No se pudieron cargar los boletos:", err);
    mostrarAviso(cargado
      ? "No pudimos actualizar los boletos, intenta de nuevo. Mostramos el último estado conocido."
      : "No pudimos cargar los boletos, intenta de nuevo");
  } finally {
    cargando = false;
    $("#cuadricula").setAttribute("aria-busy", "false");
    actualizarBloqueo();
  }
}


/* ---------------------------------------------------------
   Cuadrícula, contador y barra
   --------------------------------------------------------- */
function construirCuadricula() {
  const cuadricula = $("#cuadricula");
  const fragmento = document.createDocumentFragment();
  for (let n = 1; n <= TOTAL_BOLETOS; n++) {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "boleto";
    boton.dataset.numero = n;
    boton.innerHTML = "<span>" + dosDigitos(n) + "</span>";
    boton.setAttribute("aria-label", "Boleto " + dosDigitos(n));
    fragmento.appendChild(boton);
  }
  cuadricula.appendChild(fragmento);
  cuadricula.addEventListener("click", (e) => {
    const boton = e.target.closest(".boleto");
    if (!boton || boton.disabled) return;
    const n = Number(boton.dataset.numero);
    esAdmin ? abrirVentana(n) : elegirBoleto(n);
  });
  actualizarBloqueo();
}

// Mientras no haya datos confirmados no se puede elegir boleto
function actualizarBloqueo() {
  document.querySelectorAll(".boleto").forEach((boton) => {
    const vendido = boletos.get(Number(boton.dataset.numero))?.estado === "vendido";
    boton.disabled = !cargado || (vendido && !esAdmin);
  });
}

function pintar() {
  let vendidos = 0;
  document.querySelectorAll(".boleto").forEach((boton) => {
    const n = Number(boton.dataset.numero);
    const vendido = boletos.get(n).estado === "vendido";
    if (vendido) vendidos++;
    boton.classList.toggle("boleto--vendido", vendido);
    boton.classList.toggle("boleto--elegido", !esAdmin && elegido === n && !vendido);
    boton.setAttribute("aria-label", "Boleto " + dosDigitos(n) + (vendido ? ", vendido" : ", disponible"));
  });

  const disponibles = TOTAL_BOLETOS - vendidos;
  const recaudado = vendidos * PRECIO;
  const porcentaje = Math.min(100, (recaudado / META) * 100);

  $("#vendidos").textContent = vendidos;
  $("#disponibles").textContent = disponibles;
  $("#recaudado").textContent = pesos(recaudado);
  $("#porcentaje").textContent = (Number.isInteger(porcentaje) ? porcentaje : porcentaje.toFixed(1)) + "%";
  $("#relleno").style.width = porcentaje + "%";
  $("#barra").setAttribute("aria-valuenow", Math.round(porcentaje));

  if (esAdmin) pintarCompradores();
  else if (elegido && boletos.get(elegido).estado === "vendido") {
    cerrarSeleccion();
    mostrarAviso("El boleto que elegiste se acaba de vender. Elige otro, por favor.", true);
  }
}

function mostrarAviso(texto, esInfo = false) {
  $("#aviso-texto").textContent = texto;
  $("#aviso").classList.toggle("aviso--ok", esInfo);
  $("#aviso-reintentar").hidden = esInfo;
  $("#aviso").hidden = false;
}

function ocultarAviso() { $("#aviso").hidden = true; }


/* ---------------------------------------------------------
   Página pública: elegir boleto y pagar
   --------------------------------------------------------- */
function elegirBoleto(n) {
  elegido = n;
  ocultarAviso();
  $("#seleccion-texto").textContent = "Boleto " + dosDigitos(n) + " · " + pesos(PRECIO);
  $("#seleccion").classList.add("abierta");
  $("#seleccion").setAttribute("aria-hidden", "false");
  pintar();
}

function cerrarSeleccion() {
  elegido = null;
  $("#seleccion").classList.remove("abierta");
  $("#seleccion").setAttribute("aria-hidden", "true");
  document.querySelectorAll(".boleto--elegido").forEach((b) => b.classList.remove("boleto--elegido"));
}

function iniciarPublica() {
  const pagar = $("#pagar");
  if (MP_LINK.startsWith("http")) pagar.href = MP_LINK;
  pagar.addEventListener("click", (e) => {
    if (!MP_LINK.startsWith("http")) {
      e.preventDefault();
      alert("El link de pago todavía no está listo. Intenta más tarde.");
    }
  });
  $("#seleccion-cerrar").addEventListener("click", cerrarSeleccion);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") cerrarSeleccion(); });
}


/* ---------------------------------------------------------
   Administración: acceso
   --------------------------------------------------------- */
async function sha256(texto) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function tokenGuardado() {
  try { return sessionStorage.getItem(CLAVE_SESION) || ""; } catch { return ""; }
}

function cerrarSesion(mensaje = "") {
  try { sessionStorage.removeItem(CLAVE_SESION); } catch { /* sin almacenamiento */ }
  $("#panel").hidden = true;
  $("#login").hidden = false;
  $("#login-error").textContent = mensaje;
  cargado = false;
}

function entrarPanel() {
  $("#login").hidden = true;
  $("#panel").hidden = false;
  cargar();
}

function iniciarAdmin() {
  $("#login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const clave = $("#login-clave").value;
    if ((await sha256(clave)) !== ADMIN_HASH) {
      $("#login-error").textContent = "Contraseña incorrecta.";
      return;
    }
    try { sessionStorage.setItem(CLAVE_SESION, clave); } catch { /* sin almacenamiento */ }
    $("#login-clave").value = "";
    $("#login-error").textContent = "";
    entrarPanel();
  });

  $("#salir").addEventListener("click", () => cerrarSesion());
  $("#form-boleto").addEventListener("submit", guardarVentana);
  $("#ventana-liberar").addEventListener("click", liberarVentana);
  $("#ventana-cancelar").addEventListener("click", () => $("#ventana").close());

  $("#lista-compradores").addEventListener("click", (e) => {
    const fila = e.target.closest("tr[data-numero]");
    if (fila) abrirVentana(Number(fila.dataset.numero));
  });

  if (tokenGuardado()) entrarPanel();
  else $("#login").hidden = false;
}


/* ---------------------------------------------------------
   Administración: vender, editar y liberar
   --------------------------------------------------------- */
let numeroEnVentana = null;

function abrirVentana(n) {
  const b = boletos.get(n);
  const vendido = b.estado === "vendido";
  numeroEnVentana = n;

  $("#ventana-titulo").textContent = "Boleto " + dosDigitos(n);
  $("#ventana-info").textContent = vendido
    ? "Vendido" + (b.fecha ? " el " + formatearFecha(b.fecha) : "") + " · Puedes editar el nombre o liberarlo."
    : "Disponible. Escribe quién lo compró para marcarlo como vendido.";
  $("#campo-nombre").value = b.nombre;
  $("#campo-telefono").value = b.telefono;
  $("#ventana-guardar").textContent = vendido ? "Guardar cambios" : "Marcar vendido";
  $("#ventana-liberar").hidden = !vendido;
  $("#ventana-error").textContent = "";
  $("#ventana").showModal();
  $("#campo-nombre").focus();
}

async function ejecutarEnVentana(accion, datos) {
  const botones = document.querySelectorAll("#ventana button");
  botones.forEach((b) => (b.disabled = true));
  $("#ventana-error").textContent = "";
  try {
    const respuesta = await enviarAccion(accion, { numero: numeroEnVentana, ...datos });
    if (!respuesta.ok) {
      if (respuesta.noAutorizado) {
        $("#ventana").close();
        return cerrarSesion("La contraseña ya no es válida. Entra de nuevo.");
      }
      throw new Error(respuesta.error);
    }
    guardarBoletos(respuesta.boletos);
    cargado = true;
    pintar();
    actualizarBloqueo();
    $("#ventana").close();
  } catch (err) {
    $("#ventana-error").textContent = "No se guardó: " + (err.message || "error de conexión") + ". Intenta de nuevo.";
  } finally {
    botones.forEach((b) => (b.disabled = false));
  }
}

function guardarVentana(e) {
  e.preventDefault();
  const nombre = $("#campo-nombre").value.trim();
  if (!nombre) {
    $("#ventana-error").textContent = "Escribe el nombre de la persona.";
    return;
  }
  const accion = boletos.get(numeroEnVentana).estado === "vendido" ? "editar" : "vender";
  ejecutarEnVentana(accion, { nombre, telefono: $("#campo-telefono").value.trim() });
}

function liberarVentana() {
  const n = dosDigitos(numeroEnVentana);
  if (confirm("¿Liberar el boleto " + n + "? Se borrará el nombre y volverá a estar disponible.")) {
    ejecutarEnVentana("liberar", {});
  }
}

function formatearFecha(iso) {
  const fecha = new Date(iso);
  if (isNaN(fecha)) return iso;
  return fecha.toLocaleString("es-MX", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function pintarCompradores() {
  const cuerpo = $("#lista-compradores");
  const vendidos = [...boletos.entries()].filter(([, b]) => b.estado === "vendido");
  cuerpo.replaceChildren();

  if (!vendidos.length) {
    cuerpo.innerHTML = '<tr><td colspan="3" class="tabla__vacia">Todavía no hay boletos vendidos.</td></tr>';
    return;
  }

  for (const [n, b] of vendidos) {
    const fila = document.createElement("tr");
    fila.dataset.numero = n;
    fila.style.cursor = "pointer";

    const celdaNumero = document.createElement("td");
    celdaNumero.textContent = dosDigitos(n);

    // textContent para que un nombre nunca se interprete como HTML
    const celdaNombre = document.createElement("td");
    celdaNombre.textContent = b.nombre;
    if (b.telefono) {
      const tel = document.createElement("span");
      tel.className = "tabla__tel";
      tel.textContent = b.telefono;
      celdaNombre.appendChild(tel);
    }

    const celdaFecha = document.createElement("td");
    celdaFecha.textContent = b.fecha ? formatearFecha(b.fecha) : "—";

    fila.append(celdaNumero, celdaNombre, celdaFecha);
    cuerpo.appendChild(fila);
  }
}


/* ---------------------------------------------------------
   Arranque
   --------------------------------------------------------- */
construirCuadricula();
$("#meta").textContent = pesos(META);
$("#aviso-reintentar").addEventListener("click", cargar);

if (esAdmin) {
  iniciarAdmin();
} else {
  iniciarPublica();
  cargar();
}

// Actualización automática cada 30 s (sin interrumpir una edición abierta)
setInterval(() => {
  if (document.hidden) return;
  if (esAdmin && (!tokenGuardado() || $("#ventana").open)) return;
  cargar();
}, REFRESCO_MS);

// Al volver a la pestaña se actualiza de inmediato
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && (!esAdmin || tokenGuardado())) cargar();
});
