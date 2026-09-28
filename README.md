# Lógicamente

**Desafíos de lógica para pensar, probar y resolver.**

Lógicamente es una colección de juegos breves basados en problemas clásicos de razonamiento. La idea es que cada desafío invite a modelar una situación, explorar estrategias, equivocarse sin costo y llegar a una solución propia.

El proyecto nace como una forma de acercar el pensamiento computacional a través del juego: antes de escribir código, hay que entender un problema, identificar restricciones y construir un camino posible.

## Probarlo

La versión publicada está disponible en [logicamente.mluzza.chatgpt.site](https://logicamente.mluzza.chatgpt.site).

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
dist/
├── index.html                 # Selector de desafíos
├── assets/
│   ├── css/base.css            # Identidad visual compartida
│   ├── css/hanoi.css           # Estilos exclusivos de Hanoi
│   └── js/hanoi.js             # Lógica del juego
└── desafios/
    └── hanoi/index.html        # Página de Torres de Hanoi
```

Cada desafío nuevo puede sumar su página, estilos y lógica sin cargar código innecesario en el resto del sitio.

## Próximo paso

Incorporar **Las nueve reinas** como segundo desafío completo, con un tablero táctil y una forma clara de mostrar cuándo una configuración es válida.

---

Hecho para jugar con ideas, no solo con respuestas.
