/* =========================================================
   Rifa con causa · Enviados Costa Rica
   Pinta la cuadrícula de 100 boletos.
   ========================================================= */

// Boletos vendidos o apartados. Se copian de la hoja de Google
// "Rifa con causa · Enviados Costa Rica" (pestaña Boletos, Estado = Vendido).
const VENDIDOS = [7, 8, 11, 12, 14, 17, 21, 24, 30, 33, 40, 43, 77];

const TOTAL_BOLETOS = 100;

const cuadricula = document.getElementById("cuadricula");
const vendidos = new Set(VENDIDOS);

for (let n = 1; n <= TOTAL_BOLETOS; n++) {
  const boleto = document.createElement("div");
  const numero = String(n).padStart(2, "0");
  const vendido = vendidos.has(n);
  boleto.className = "boleto" + (vendido ? " boleto--vendido" : "");
  boleto.textContent = numero;
  boleto.setAttribute("aria-label", "Boleto " + numero + (vendido ? ", vendido" : ", disponible"));
  cuadricula.appendChild(boleto);
}
