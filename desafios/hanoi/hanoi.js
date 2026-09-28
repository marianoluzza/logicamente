(() => {
  // Cada nivel se identifica por la cantidad de discos. Los estilos (.d1 … .d5) cubren hasta 5.
  const LEVELS = [3, 4, 5];
  const TOWER_NAMES = ['Origen', 'Auxiliar', 'Destino'];
  const STORAGE_KEY = 'logicamente:hanoi:resueltos';

  const towerButtons = [...document.querySelectorAll('.tower')];
  const feedback = document.querySelector('#feedback');
  const movesEl = document.querySelector('#moves');
  const tipEl = document.querySelector('#tip');
  const nextButton = document.querySelector('#next');
  const levelButtons = [...document.querySelectorAll('.level')];

  // Niveles resueltos: comodidad por navegador, el juego funciona sin storage.
  // Se guardan como texto, igual que antes de que hubiera niveles.
  const solved = (() => {
    try {
      return new Set((JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? []).map(String));
    } catch {
      return new Set();
    }
  })();
  const saveSolved = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...solved]));
    } catch {}
  };

  // Cada torre es una pila: el último elemento es el disco de arriba.
  let disks;
  let minMoves;
  let towers;
  let selected;
  let moves;
  let completed;

  const top = tower => tower[tower.length - 1];

  const canMove = (from, to) => {
    const disk = top(towers[from]);
    const target = top(towers[to]);
    return disk !== undefined && (target === undefined || target > disk);
  };

  const render = () => {
    towerButtons.forEach((button, index) => {
      const tower = towers[index];

      button.classList.toggle('active', selected === index);
      button.classList.toggle('target', selected !== null && index !== selected && canMove(selected, index));
      button.setAttribute('aria-label', `${TOWER_NAMES[index]}: ${tower.length} disco${tower.length === 1 ? '' : 's'}`);

      button.querySelectorAll('.disk').forEach(disk => disk.remove());
      tower.forEach(size => {
        const disk = document.createElement('span');
        disk.className = `disk d${size}`;
        disk.setAttribute('aria-hidden', 'true');
        button.append(disk);
      });
    });

    movesEl.textContent = `${moves} / ${minMoves}`;
    tipEl.textContent = `Mínimo posible: ${minMoves} movimientos`;
    nextButton.hidden = !completed || disks === LEVELS[LEVELS.length - 1];
    levelButtons.forEach(button => {
      const level = Number(button.dataset.disks);
      button.setAttribute('aria-pressed', String(level === disks));
      button.classList.toggle('solved', solved.has(String(level)));
    });
  };

  const reset = () => {
    towers = [Array.from({ length: disks }, (_, i) => disks - i), [], []];
    selected = null;
    moves = 0;
    completed = false;
    feedback.textContent = `Objetivo: llevar los ${disks} discos a la torre de destino.`;
    render();
  };

  const setLevel = level => {
    disks = level;
    minMoves = 2 ** disks - 1;
    document.querySelector('#board').style.setProperty('--disks', disks);
    reset();
  };

  const selectTower = index => {
    if (completed) return;

    if (selected === null) {
      if (!towers[index].length) {
        feedback.textContent = 'Elegí una torre que tenga discos.';
        return;
      }
      selected = index;
      feedback.textContent = 'Ahora elegí la torre de destino.';
      render();
      return;
    }

    if (selected === index) {
      selected = null;
      feedback.textContent = 'Movimiento cancelado.';
      render();
      return;
    }

    if (!canMove(selected, index)) {
      feedback.textContent = 'Ese disco es más chico. Probá otra torre.';
      return;
    }

    towers[index].push(towers[selected].pop());
    selected = null;
    moves += 1;

    if (towers[2].length === disks) {
      completed = true;
      solved.add(String(disks));
      saveSolved();
      feedback.textContent = moves === minMoves
        ? '¡Perfecto! Lo resolviste en el mínimo de movimientos.'
        : `¡Resuelto en ${moves} movimientos! El mínimo era ${minMoves}.`;
    } else {
      feedback.textContent = 'Bien. Seguí buscando el camino.';
    }

    render();
    if (completed && !nextButton.hidden) nextButton.focus();
  };

  towerButtons.forEach(button => {
    button.addEventListener('click', () => selectTower(Number(button.dataset.tower)));
  });
  levelButtons.forEach(button => {
    button.addEventListener('click', () => setLevel(Number(button.dataset.disks)));
  });

  nextButton.addEventListener('click', () => {
    setLevel(LEVELS[LEVELS.indexOf(disks) + 1]);
    towerButtons[0].focus();
  });

  document.querySelector('#reset').addEventListener('click', reset);

  setLevel(LEVELS[0]);

  // WebMCP (experimental): expone el juego a agentes del navegador, si el navegador lo soporta.
  const context = document.modelContext;
  if (context?.registerTool) {
    const state = () => ({ disks, towers, moves, completed });
    const noInput = { type: 'object', properties: {}, additionalProperties: false };
    const register = tool => {
      try {
        Promise.resolve(context.registerTool(tool)).catch(() => {});
      } catch (_) {}
    };

    register({
      name: 'get_hanoi_state',
      title: 'Ver estado de Hanoi',
      description: 'Devuelve el estado actual del desafío Torres de Hanoi.',
      inputSchema: noInput,
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute: state,
    });

    register({
      name: 'restart_hanoi',
      title: 'Reiniciar Hanoi',
      description: 'Reinicia el desafío Torres de Hanoi.',
      inputSchema: noInput,
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: () => {
        reset();
        return state();
      },
    });
  }
})();
