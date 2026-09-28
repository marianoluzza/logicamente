(() => {
  // Cada nivel: tamaño del tablero y cuántos toques necesita, como mínimo, cada tablero que se genera.
  const LEVELS = [
    { size: 3, min: 4 },
    { size: 4, min: 6 },
    { size: 5, min: 8 },
  ];
  const STORAGE_KEY = 'logicamente:luces:resueltos';
  const COLUMNS = 'ABCDE';

  const HINT = 'Pista: el orden de los toques no importa. Apagá la fila de arriba tocando la luz de abajo de cada prendida y seguí así fila por fila. Si quedan luces al final, probá empezar distinto en la primera fila.';

  const board = document.querySelector('#board');
  const countEl = document.querySelector('#count');
  const feedback = document.querySelector('#feedback');
  const tipEl = document.querySelector('#tip');
  const nextButton = document.querySelector('#next');
  const anotherButton = document.querySelector('#another');
  const levelButtons = [...document.querySelectorAll('.level')];

  // Generador pseudoaleatorio (mulberry32). Con ?semilla=N los tableros se repiten:
  // sirve para compartir una partida y para que las pruebas sean deterministas.
  const random = (seed => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
  })((() => {
    const seed = Number.parseInt(new URLSearchParams(location.search).get('semilla'), 10);
    return Number.isNaN(seed) ? Math.floor(Math.random() * 2 ** 32) : seed;
  })());

  // Niveles resueltos: comodidad por navegador, el juego funciona sin storage.
  const solved = (() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? []);
    } catch {
      return new Set();
    }
  })();
  const saveSolved = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...solved]));
    } catch {}
  };

  // Las casillas se identifican por índice: fila * size + columna.
  let level;
  let size;
  let start;       // tablero inicial, para reiniciar
  let lights;      // true = prendida
  let moves;
  let lastPressed; // para avisar cuando se toca dos veces seguidas la misma luz
  let hinted;
  let won;
  let focusIndex;

  const rowOf = index => Math.floor(index / size);
  const colOf = index => index % size;

  // La luz tocada y sus vecinas ortogonales dentro del tablero.
  const neighborhood = index => {
    const row = rowOf(index);
    const col = colOf(index);
    return [[row, col], [row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]]
      .filter(([r, c]) => r >= 0 && r < size && c >= 0 && c < size)
      .map(([r, c]) => r * size + c);
  };

  const press = (state, index) => {
    const next = [...state];
    neighborhood(index).forEach(i => { next[i] = !next[i]; });
    return next;
  };

  // Mínimo de toques para apagar todo. Elegida la primera fila, el resto queda forzado:
  // cada luz prendida se apaga tocando la de abajo ("arrastrar las luces"). Se prueban
  // todas las primeras filas y se queda con la solución más corta.
  const minimumPresses = initial => {
    let best = Infinity;
    for (let mask = 0; mask < 2 ** size; mask++) {
      let state = initial;
      let count = 0;
      const tap = index => {
        state = press(state, index);
        count++;
      };
      for (let col = 0; col < size; col++) if (mask & (1 << col)) tap(col);
      for (let index = size; index < size * size; index++) if (state[index - size]) tap(index);
      if (!state.includes(true)) best = Math.min(best, count);
    }
    return best;
  };

  // Se parte del tablero apagado y se tocan casillas distintas al azar, así siempre tiene solución.
  // Se descartan los que salen con menos toques de los pedidos, para que el nivel no se abarate.
  const generate = () => {
    for (;;) {
      const indexes = Array.from({ length: size * size }, (_, i) => i);
      let state = indexes.map(() => false);
      for (let i = 0; i < level.min; i++) {
        const j = i + Math.floor(random() * (indexes.length - i));
        [indexes[i], indexes[j]] = [indexes[j], indexes[i]];
        state = press(state, indexes[i]);
      }
      if (minimumPresses(state) === level.min) return state;
    }
  };

  const cells = () => [...board.children];
  const litCount = () => lights.filter(Boolean).length;
  const litText = count => (count === 1 ? '1 luz prendida' : `${count} luces prendidas`);

  const buildBoard = () => {
    board.style.setProperty('--size', size);
    board.replaceChildren(...Array.from({ length: size * size }, (_, index) => {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'bulb';
      cell.dataset.index = index;
      return cell;
    }));
  };

  const render = () => {
    cells().forEach((cell, index) => {
      cell.classList.toggle('on', lights[index]);
      cell.tabIndex = index === focusIndex ? 0 : -1;
      cell.setAttribute('aria-label',
        `Fila ${rowOf(index) + 1}, columna ${COLUMNS[colOf(index)]}: ${lights[index] ? 'prendida' : 'apagada'}`);
    });

    const last = level === LEVELS[LEVELS.length - 1];
    board.classList.toggle('completed', won);
    countEl.textContent = `${moves} / ${level.min} toques`;
    nextButton.hidden = !won || last;
    anotherButton.classList.toggle('primary', won && last);
    tipEl.textContent = hinted ? 'Pista: apagá fila por fila, de arriba hacia abajo.' : `Mínimo posible: ${level.min} toques`;
    levelButtons.forEach(button => {
      const buttonLevel = LEVELS[Number(button.dataset.level)];
      button.setAttribute('aria-pressed', String(buttonLevel === level));
      button.classList.toggle('solved', solved.has(buttonLevel.size));
    });
  };

  // Vuelve a empezar el tablero dado; sin tablero, genera uno nuevo del nivel actual.
  const restart = (initial = generate()) => {
    start = initial;
    lights = initial;
    moves = 0;
    lastPressed = null;
    hinted = false;
    won = false;
    feedback.textContent = `Apagá ${litCount() === 1 ? 'la luz prendida' : `las ${litCount()} luces prendidas`}.`;
    render();
  };

  const setLevel = index => {
    level = LEVELS[index];
    size = level.size;
    focusIndex = 0;
    buildBoard();
    restart();
  };

  const tapLight = index => {
    if (won) return;
    lights = press(lights, index);
    moves++;
    focusIndex = index;

    if (!lights.includes(true)) {
      won = true;
      solved.add(size);
      saveSolved();
      feedback.textContent = moves === level.min
        ? `¡Perfecto! Apagaste todo en el mínimo de ${level.min} toques.`
        : `¡Lo lograste en ${moves} toques! El mínimo es ${level.min}.`;
    } else if (index === lastPressed) {
      feedback.textContent = 'Tocar dos veces la misma luz la deja como estaba.';
    } else if (!hinted && moves >= level.min * 2) {
      hinted = true;
      feedback.textContent = HINT;
    } else {
      const count = litCount();
      feedback.textContent = `${count === 1 ? 'Queda' : 'Quedan'} ${litText(count)}.`;
    }
    lastPressed = index;

    render();
    if (won) (nextButton.hidden ? anotherButton : nextButton).focus();
  };

  // Tabindex itinerante: el tablero es una sola parada de Tab y las flechas mueven el foco.
  const moveFocus = (index, key) => {
    const row = rowOf(index);
    const col = colOf(index);
    const target = {
      ArrowUp: [Math.max(row - 1, 0), col],
      ArrowDown: [Math.min(row + 1, size - 1), col],
      ArrowLeft: [row, Math.max(col - 1, 0)],
      ArrowRight: [row, Math.min(col + 1, size - 1)],
    }[key];
    if (!target) return false;

    focusIndex = target[0] * size + target[1];
    render();
    cells()[focusIndex].focus();
    return true;
  };

  board.addEventListener('click', event => {
    const cell = event.target.closest('.bulb');
    if (cell) tapLight(Number(cell.dataset.index));
  });

  board.addEventListener('keydown', event => {
    const cell = event.target.closest('.bulb');
    if (cell && moveFocus(Number(cell.dataset.index), event.key)) event.preventDefault();
  });

  levelButtons.forEach(button => {
    button.addEventListener('click', () => setLevel(Number(button.dataset.level)));
  });

  nextButton.addEventListener('click', () => {
    setLevel(LEVELS.indexOf(level) + 1);
    cells()[0].focus();
  });

  document.querySelector('#reset').addEventListener('click', () => restart(start));
  anotherButton.addEventListener('click', () => {
    const wasWon = won;
    restart();
    // Tras ganar, el foco estaba en este botón: se lleva al tablero nuevo.
    if (wasWon) cells()[focusIndex].focus();
  });

  setLevel(0);
})();
