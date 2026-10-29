# Rifa con causa · Enviados Costa Rica

Página de la rifa para la misión Enviados (Tribu de los servidores, viaje a Costa Rica).

- Página pública: `https://luzysalstudios-sketch.github.io/enviados-costarica/rifa/`
- Panel de administración: `https://luzysalstudios-sketch.github.io/enviados-costarica/rifa/admin/`

Los boletos se guardan en una hoja de Google Sheets a través de un Google Apps Script
(GitHub Pages solo sirve archivos, no guarda datos).

## Archivos

| Archivo | Qué es |
|---|---|
| `index.html` | Página pública (premios, contador, cuadrícula y botón de pago) |
| `admin/index.html` | Panel para marcar, editar o liberar boletos |
| `rifa.js` | Lógica compartida. **Aquí van el link de Mercado Pago y la URL del script** |
| `rifa.css` | Estilos con la identidad de Enviados |
| `apps-script.gs` | Código del Google Apps Script (se pega en Google, no corre en GitHub) |
| `Enviados_Logo_RS.png` | Logo del globo |

---

## 1. Crear la hoja de Google Sheets

1. Entra a [sheets.new](https://sheets.new) con la cuenta de Google que va a administrar la rifa.
2. Ponle un nombre, por ejemplo **Rifa Enviados**.
3. No hace falta crear nada más: el script arma la hoja `boletos` con las columnas
   `numero`, `estado`, `nombre`, `fecha`, `telefono` y los 100 boletos.

## 2. Desplegar el Apps Script

1. En la hoja, menú **Extensiones > Apps Script**.
2. Borra el código que aparece y pega todo el contenido de `apps-script.gs`. Guarda (💾).
3. Arriba, en la lista de funciones, elige **configurar** y presiona **▶ Ejecutar**.
   - Google pedirá permisos: *Revisar permisos* > tu cuenta > *Configuración avanzada* >
     *Ir a (nombre del proyecto)* > *Permitir*.
   - Al terminar, la hoja tendrá la pestaña `boletos` con 100 filas en `disponible`.
4. Guarda la contraseña de administrador **en Google, no en el código**:
   - Engrane ⚙️ **Configuración del proyecto** > **Propiedades de la secuencia de comandos** >
     **Agregar propiedad**.
   - Propiedad: `ADMIN_TOKEN` · Valor: la contraseña de administrador (la misma que se escribe en `/rifa/admin`).
5. **Implementar > Nueva implementación**:
   - Tipo: ⚙️ **Aplicación web**.
   - Ejecutar como: **Yo**.
   - Quién tiene acceso: **Cualquier usuario**.
   - Presiona **Implementar** y copia la **URL de la aplicación web** (termina en `/exec`).
6. Prueba la URL en el navegador: debe mostrar algo como `{"ok":true,"boletos":[{"numero":1,"estado":"disponible"},...]}`.

> Si después cambias el código del script, usa **Implementar > Administrar implementaciones > ✏️ Editar >
> Versión: Nueva versión**. Así la URL `/exec` no cambia.

## 3. Pegar la URL del script y el link de Mercado Pago

Abre `rifa/rifa.js`. Al inicio están las constantes de configuración:

```js
const MP_LINK = "PEGAR_LINK_AQUI";          // link de pago de Mercado Pago de Chema
const SCRIPT_URL = "PEGAR_URL_SCRIPT_AQUI"; // URL /exec del paso 2
```

Reemplaza los textos entre comillas por los links reales y guarda.

Mientras `SCRIPT_URL` no esté configurada, la página muestra
"No pudimos cargar los boletos, intenta de nuevo" y no deja elegir boletos.
Mientras `MP_LINK` no esté configurado, el botón **Pagar boleto** avisa que el link aún no está listo.

## 4. Publicar en GitHub Pages

El repositorio `enviados-costarica` ya publica la rama `main` en GitHub Pages,
así que basta con subir la carpeta `rifa/`:

```bash
git add rifa
git commit -m "Rifa con causa"
git push
```

En uno o dos minutos la página queda en `https://luzysalstudios-sketch.github.io/enviados-costarica/rifa/`.
(Si el repositorio no tuviera Pages activado: *Settings > Pages > Deploy from a branch > main / root*.)

---

## Contraseña de administrador

- La página guarda solo el **hash SHA-256** de la contraseña (`ADMIN_HASH` en `rifa.js`), nunca la contraseña.
- El script de Google guarda la contraseña en la propiedad `ADMIN_TOKEN` (fuera del repositorio).
- Cada cambio que hace el panel se envía con la contraseña y el script la compara con `ADMIN_TOKEN`;
  aunque alguien editara el JavaScript de la página, no podría modificar boletos sin la contraseña real.
- Después de 10 intentos fallidos el script deja de aceptar contraseñas durante 10 minutos.

### Cambiar la contraseña

1. Abre cualquier página en el navegador, presiona F12 > pestaña **Consola** y pega
   (cambiando `nueva-contraseña`):

   ```js
   crypto.subtle.digest("SHA-256", new TextEncoder().encode("nueva-contraseña"))
     .then(b => console.log([...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("")))
   ```

2. Copia el resultado en `ADMIN_HASH` de `rifa.js` y publica.
3. En Apps Script cambia el valor de la propiedad `ADMIN_TOKEN` por la nueva contraseña
   (no hace falta volver a implementar).

Usa una contraseña larga (12 caracteres o más); el hash es público en la página.

## Cómo se usa el panel

1. Entra a `/rifa/admin/` y escribe la contraseña. La sesión dura mientras la pestaña esté abierta.
2. Cuando alguien pague, toca su boleto, escribe el nombre (y el teléfono si quieres) y presiona **Marcar vendido**.
   El boleto se pone negro en la página pública en máximo 30 segundos.
3. Para corregir un nombre o liberar un boleto, tócalo de nuevo (o toca su fila en la lista de compradores).
4. La lista de compradores y los teléfonos solo se ven en el panel; la página pública nunca recibe nombres.

## Datos de la rifa

Precio, meta y número de boletos están en `rifa.js` (`PRECIO`, `META`, `TOTAL_BOLETOS`).
Premios, fecha del sorteo y textos están en `index.html`.
