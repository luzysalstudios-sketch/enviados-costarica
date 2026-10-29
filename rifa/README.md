# Rifa con causa · Enviados Costa Rica

Página de una sola vista con los 100 boletos de la rifa, para mandarla como captura a quien quiera comprar.

- Página: `https://luzysalstudios-sketch.github.io/enviados-costarica/rifa/`
- Registro de ventas: hoja de Google "Rifa con causa · Enviados Costa Rica" (pestaña Boletos).

La página solo muestra el título, el precio, la fecha del sorteo, la cuadrícula y los premios.
Los boletos vendidos se ven en negro y tachados.

## Actualizar los boletos vendidos

1. En la hoja de Google, revisa qué números tienen Estado = Vendido.
2. Copia esos números en la lista `VENDIDOS` al inicio de `rifa/rifa.js`:

   ```js
   const VENDIDOS = [7, 8, 11, 12];
   ```

3. Publica:

   ```bash
   git add rifa
   git commit -m "Rifa: boletos vendidos al día"
   git push
   ```

En uno o dos minutos la página publicada muestra los cambios.

## Archivos

| Archivo | Qué es |
|---|---|
| `index.html` | La página |
| `rifa.js` | Lista `VENDIDOS` y la cuadrícula |
| `rifa.css` | Estilos con la identidad de Enviados |
| `Enviados_Logo_RS.png` | Logo del globo |
