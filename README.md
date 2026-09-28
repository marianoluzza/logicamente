# Lógicamente

**Desafíos de lógica para pensar, probar y resolver.**

Lógicamente es una colección de juegos breves basados en problemas clásicos de razonamiento. La idea es que cada desafío invite a modelar una situación, explorar estrategias, equivocarse sin costo y llegar a una solución propia.

El proyecto nace como una forma de acercar el pensamiento computacional a través del juego: antes de escribir código, hay que entender un problema, identificar restricciones y construir un camino posible.

## Probarlo

El sitio puede publicarse en GitHub Pages y Vercel siguiendo las instrucciones de la sección [Publicación](#publicación).

## Desafíos

### Disponible

- **Torres de Hanoi** — Mové los discos entre tres torres sin colocar uno grande sobre otro más chico. Incluye contador de movimientos, validación de reglas y reconocimiento de la solución óptima en 7 pasos.

### Próximamente

- **Las nueve reinas** — Ubicá nueve reinas en el tablero sin que puedan atacarse.
- **El cruce del río** — Encontrá una secuencia segura para llevar a todos a la otra orilla.
- **Jarras de agua** — Medí una cantidad exacta usando recipientes de capacidades distintas.

## Experiencia

El sitio está pensado primero para celular:

- El inicio funciona como selector de desafíos.
- Cada juego tiene su propia URL y una pantalla dedicada para jugar, sin distracciones.
- Las interacciones se resuelven con toques, pero también funcionan con teclado.
- El estado, las instrucciones y los resultados se comunican de forma accesible.

## Estructura

```text
index.html                  # Selector de desafíos
assets/
└── base.css                # Identidad visual compartida
desafios/
└── hanoi/
    ├── index.html          # Página de Torres de Hanoi
    ├── hanoi.css           # Estilos exclusivos de Hanoi
    └── hanoi.js            # Lógica del juego
vercel.json                 # Config de Vercel (URLs con barra final)
```

Es un sitio estático sin paso de build: los archivos del repo son los que se publican.

### Sumar un desafío

1. Crear `desafios/<nombre>/` con su `index.html`, CSS y JS.
2. Enlazar el estilo compartido con `../../assets/base.css`.
3. Agregar la tarjeta en `index.html`.

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

Sirven el sitio en la raíz (como Vercel) y bajo `/logicamente/` (como GitHub Pages), y fallan ante cualquier error de consola o recurso con 404.

## Próximo paso

Incorporar **Las nueve reinas** como segundo desafío completo, con un tablero táctil y una forma clara de mostrar cuándo una configuración es válida.

---

Hecho para jugar con ideas, no solo con respuestas.
