# Lógicamente

**Desafíos de lógica para pensar, probar y resolver.**

Lógicamente es una colección de juegos breves basados en problemas clásicos de razonamiento. La idea es que cada desafío invite a modelar una situación, explorar estrategias, equivocarse sin costo y llegar a una solución propia.

El proyecto nace como una forma de acercar el pensamiento computacional a través del juego: antes de escribir código, hay que entender un problema, identificar restricciones y construir un camino posible.

## Probarlo

El sitio puede publicarse en GitHub Pages y Vercel siguiendo las instrucciones de la sección [Publicación](#publicación).

## Desafíos

### Disponibles

- **Torres de Hanoi** — Mové los discos entre tres torres sin colocar uno grande sobre otro más chico. Incluye contador de movimientos, validación de reglas y reconocimiento de la solución óptima en 7 pasos.
- **Las ocho reinas** — Ubicá las reinas en el tablero sin que ninguna ataque a otra. Tres niveles (4×4, 6×6 y el clásico 8×8), con los conflictos marcados en vivo y los niveles resueltos guardados en el navegador.
- **El cruce del río** — Llevá a todos a la otra orilla sin dejar juntos a los que no pueden quedarse solos. Dos niveles: el granjero con el lobo, la cabra y el repollo (7 viajes), y tres ovejas con tres lobos (11 viajes). Los errores se muestran y se pueden deshacer.
- **Las jarras de agua** — Medí una cantidad exacta llenando, vaciando y pasando agua entre jarras de distinta capacidad. Tres niveles: 3 y 5 litros para medir 4 (6 movimientos), repartir 8 litros en dos mitades sin canilla (7) y 4 y 9 litros para medir 6 (8).
- **Luces fuera** — Apagá todas las luces sabiendo que cada toque cambia también a sus vecinas. Tres niveles (3×3, 4×4 y 5×5) con tableros al azar que siempre tienen solución y un mínimo fijo de toques (4, 6 y 8). Reiniciar vuelve al mismo tablero, *Otro tablero* genera uno nuevo y, si cuesta, aparece una pista.
- **Clave secreta** — Descubrí una combinación oculta de figuras (la versión de Mastermind). Cada intento dice cuántas figuras están en su lugar y cuántas están pero en otro lugar, sin decir cuáles. Tres niveles: 3 figuras distintas de 4 (6 intentos), 4 distintas de 6 (8) y el clásico con repetidas (10). Avisa cuando un intento ya estaba descartado por las pistas anteriores. Las figuras se distinguen por la forma, no solo por el color.

## Experiencia

El sitio está pensado primero para celular:

- El inicio funciona como selector de desafíos y muestra el avance de cada uno (niveles resueltos, guardados en el navegador).
- Cada juego tiene su propia URL y una pantalla dedicada para jugar, sin distracciones.
- Las interacciones se resuelven con toques, pero también funcionan con teclado.
- El estado, las instrucciones y los resultados se comunican de forma accesible.
- Cada página tiene un botón para compartir con código QR (el desafío o el inicio), pensado para proyectar en clase.
- Un buzón de opiniones, en el inicio y debajo de cada desafío, envía una reacción y un comentario opcional al mismo Google Form de Misión Software. El campo del desafío va como `logicamente/<desafío>` (o `logicamente/portada`) para filtrarlo en la planilla.

## Estructura

```text
index.html                  # Selector de desafíos
assets/
├── base.css                # Identidad visual compartida
├── game.css                # Estructura común de las páginas de desafío
├── progreso.js             # Avance de cada desafío en el inicio
├── compartir.js            # Diálogo de compartir con QR (carga qrcode-generator desde jsDelivr al abrirlo)
├── opiniones.js            # Buzón de opiniones (Google Forms)
└── favicon.svg
desafios/
├── clave/                  # Clave secreta: index.html, clave.css, clave.js
├── hanoi/                  # Torres de Hanoi: index.html, hanoi.css, hanoi.js
├── jarras/                 # Las jarras de agua: index.html, jarras.css, jarras.js
│   └── iconos/             # Íconos SVG de llenar, vaciar y verter
├── luces/                  # Luces fuera: index.html, luces.css, luces.js
├── reinas/                 # Las ocho reinas: index.html, reinas.css, reinas.js
└── rio/                    # El cruce del río: index.html, rio.css, rio.js
    └── personajes/         # Ilustraciones SVG de cada personaje
tests/
├── helpers.js              # Servidor estático y navegador para las pruebas
└── *.test.js               # Una suite por desafío, más navegación, compartir y opiniones
vercel.json                 # Config de Vercel (URLs con barra final)
```

Es un sitio estático sin paso de build: los archivos del repo son los que se publican.

### Sumar un desafío

1. Crear `desafios/<nombre>/` con su `index.html`, CSS y JS.
2. Enlazar los estilos compartidos `../../assets/base.css` y `../../assets/game.css`, y los scripts `../../assets/compartir.js` y `../../assets/opiniones.js`, con el botón de compartir en el encabezado y el buzón (`data-opinion="<nombre>"`) debajo del juego, como en los demás.
3. Agregar la tarjeta en `index.html` (con `data-challenge="<nombre>"`), sus niveles en `assets/progreso.js` y el desafío en `CHALLENGES` de `tests/navegacion.test.js`. El juego guarda los ids de los niveles resueltos en `localStorage`, en `logicamente:<nombre>:resueltos`.
4. Sumar `tests/<nombre>.test.js` con sus pruebas.

Si el desafío genera partidas al azar, que acepte `?semilla=N` en la URL para repetirlas: así se pueden compartir y probar de forma determinista (ver `desafios/luces/`).

Usar siempre rutas relativas (nunca `/assets/...`) para que el sitio funcione tanto en la raíz de un dominio como en una subcarpeta de GitHub Pages.

## Publicación

- **GitHub Pages:** Settings → Pages → *Deploy from a branch* → `main` / `(root)`.
- **Vercel:** importar el repo sin framework, sin build command y con output directory `.` (la raíz).
- **Local:** servir la carpeta con cualquier servidor estático, por ejemplo `npx serve .`.

## Pruebas

Pruebas de punta a punta con [playwright-core](https://playwright.dev) y el runner nativo de Node, en un viewport de celular. Usan el Microsoft Edge instalado (no descargan navegadores):

```sh
npm install
npm test                         # con Edge
BROWSER_CHANNEL=chrome npm test  # con Chrome
```

Sirven el sitio en la raíz (como Vercel) y bajo `/logicamente/` (como GitHub Pages), y fallan ante cualquier error de consola o recurso con 404. No salen a internet: la librería de QR se sirve desde `node_modules` (el mismo archivo del CDN, verificado por su hash de integridad) y los envíos al Google Form se interceptan, así que nunca llega una opinión de prueba a la planilla.

---

Hecho para jugar con ideas, no solo con respuestas.
