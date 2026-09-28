(() => {
  // Los estilos (.d1 … .d3) cubren hasta 3 discos.
  const DISKS = 3;
  const MIN_MOVES = 2 ** DISKS - 1;
  const TOWER_NAMES = ['Origen', 'Auxiliar', 'Destino'];
  // Un solo nivel, identificado por la cantidad de discos: el inicio lo lee para mostrar el avance.
  const STORAGE_KEY = 'logicamente:hanoi:resueltos';

  const towerButtons = [...document.querySelectorAll('.tower')];
  const feedback = document.querySelector('#feedback');
  const movesEl = document.querySelector('#moves');
  const tipEl = document.querySelector('#tip');

  // Cada torre es una pila: el último elemento es el disco de arriba.
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

    movesEl.textContent = `${moves} / ${MIN_MOVES}`;
  };

  const reset = () => {
    towers = [Array.from({ length: DISKS }, (_, i) => DISKS - i), [], []];
    selected = null;
    moves = 0;
    completed = false;
    feedback.textContent = `Objetivo: llevar los ${DISKS} discos a la torre de destino.`;
    render();
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

    if (towers[2].length === DISKS) {
      completed = true;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([String(DISKS)]));
      } catch {}
      feedback.textContent = moves === MIN_MOVES
        ? '¡Perfecto! Lo resolviste en el mínimo de movimientos.'
        : `¡Resuelto en ${moves} movimientos! El mínimo era ${MIN_MOVES}.`;
    } else {
      feedback.textContent = 'Bien. Seguí buscando el camino.';
    }

    render();
  };

  towerButtons.forEach(button => {
    button.addEventListener('click', () => selectTower(Number(button.dataset.tower)));
  });
  document.querySelector('#reset').addEventListener('click', reset);

  tipEl.textContent = `Mínimo posible: ${MIN_MOVES} movimientos`;
  reset();

  // WebMCP (experimental): expone el juego a agentes del navegador, si el navegador lo soporta.
  const context = document.modelContext;
  if (context?.registerTool) {
    const state = () => ({ towers, moves, completed });
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
