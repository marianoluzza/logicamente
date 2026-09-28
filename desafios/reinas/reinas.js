(() => {
  const LEVELS = [4, 6, 8];
  const STORAGE_KEY = 'logicamente:reinas:resueltos';
  const COLUMNS = 'ABCDEFGH';
  const QUEEN = '♛︎'; // U+FE0E: que se dibuje como texto y no como emoji.

  const board = document.querySelector('#board');
  const countEl = document.querySelector('#count');
  const feedback = document.querySelector('#feedback');
  const nextButton = document.querySelector('#next');
  const levelButtons = [...document.querySelectorAll('.level')];

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
  let size;
  let queens;
  let completed;
  let focusIndex;

  const rowOf = index => Math.floor(index / size);
  const colOf = index => index % size;

  const attacks = (a, b) => {
    const rows = Math.abs(rowOf(a) - rowOf(b));
    const cols = Math.abs(colOf(a) - colOf(b));
    return rows === 0 || cols === 0 || rows === cols;
  };

  // Devuelve las casillas con reinas que atacan o son atacadas.
  const conflicts = () => {
    const list = [...queens];
    const attacked = new Set();
    list.forEach((a, i) => list.slice(i + 1).forEach(b => {
      if (attacks(a, b)) {
        attacked.add(a);
        attacked.add(b);
      }
    }));
    return attacked;
  };

  const cells = () => [...board.children];

  const buildBoard = () => {
    board.style.setProperty('--size', size);
    board.replaceChildren(...Array.from({ length: size * size }, (_, index) => {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = (rowOf(index) + colOf(index)) % 2 ? 'cell' : 'cell light';
      cell.dataset.index = index;
      return cell;
    }));
  };

  const render = () => {
    const attacked = conflicts();

    cells().forEach((cell, index) => {
      const hasQueen = queens.has(index);
      const inConflict = attacked.has(index);
      const state = hasQueen ? (inConflict ? 'reina, en conflicto' : 'reina') : 'vacía';

      cell.textContent = hasQueen ? QUEEN : '';
      cell.classList.toggle('queen', hasQueen);
      cell.classList.toggle('conflict', inConflict);
      cell.tabIndex = index === focusIndex ? 0 : -1;
      cell.setAttribute('aria-label', `Fila ${rowOf(index) + 1}, columna ${COLUMNS[colOf(index)]}: ${state}`);
    });

    board.classList.toggle('completed', completed);
    countEl.textContent = `${queens.size} / ${size} reinas`;
    nextButton.hidden = !completed || size === LEVELS[LEVELS.length - 1];
    levelButtons.forEach(button => {
      const level = Number(button.dataset.size);
      button.setAttribute('aria-pressed', String(level === size));
      button.classList.toggle('solved', solved.has(level));
    });
  };

  const setLevel = level => {
    size = level;
    queens = new Set();
    completed = false;
    focusIndex = 0;
    feedback.textContent = `Ubicá ${size} reinas sin que se ataquen.`;
    buildBoard();
    render();
  };

  const toggleQueen = index => {
    if (completed) return;

    if (queens.has(index)) {
      queens.delete(index);
    } else if (queens.size === size) {
      feedback.textContent = `Ya hay ${size} reinas: sacá una para moverla.`;
      return;
    } else {
      queens.add(index);
    }

    focusIndex = index;
    const missing = size - queens.size;

    if (conflicts().size) {
      feedback.textContent = 'Hay reinas que se atacan.';
    } else if (missing === 0) {
      completed = true;
      solved.add(size);
      saveSolved();
      feedback.textContent = size === LEVELS[LEVELS.length - 1]
        ? '¡Resolviste el clásico! Ocho reinas en paz.'
        : '¡Lo lograste! Ninguna reina se ataca.';
    } else {
      feedback.textContent = `Bien. ${missing === 1 ? 'Falta 1' : `Faltan ${missing}`}.`;
    }

    render();
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
    const cell = event.target.closest('.cell');
    if (cell) toggleQueen(Number(cell.dataset.index));
  });

  board.addEventListener('keydown', event => {
    const cell = event.target.closest('.cell');
    if (cell && moveFocus(Number(cell.dataset.index), event.key)) event.preventDefault();
  });

  levelButtons.forEach(button => {
    button.addEventListener('click', () => setLevel(Number(button.dataset.size)));
  });

  nextButton.addEventListener('click', () => {
    setLevel(LEVELS[LEVELS.indexOf(size) + 1]);
    cells()[0].focus();
  });

  document.querySelector('#reset').addEventListener('click', () => setLevel(size));

  setLevel(LEVELS[0]);
})();
