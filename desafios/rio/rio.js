(() => {
  const STORAGE_KEY = 'logicamente:rio:resueltos';
  const BANK_NAMES = ['partida', 'llegada'];

  const sheepAndWolves = kind => [1, 2, 3].map(n => ({
    id: `${kind}-${n}`,
    kind,
    name: `${kind === 'oveja' ? 'Oveja' : 'Lobo'} ${n}`,
  }));

  // Cada nivel es solo datos: personajes, capacidad del bote, quién rema y qué no puede pasar.
  // check recibe las dos orillas (con el bote ya descargado) y devuelve el problema, si lo hay.
  const LEVELS = [
    {
      id: 'granjero',
      rules: 'El granjero tiene que cruzar con el lobo, la cabra y el repollo. En el bote entra él y uno más. Sin el granjero, el lobo se come a la cabra y la cabra se come el repollo.',
      min: 7,
      capacity: 2,
      characters: [
        { id: 'granjero', kind: 'granjero', name: 'Granjero' },
        { id: 'lobo', kind: 'lobo', name: 'Lobo' },
        { id: 'cabra', kind: 'cabra', name: 'Cabra' },
        { id: 'repollo', kind: 'repollo', name: 'Repollo' },
      ],
      canRow: crew => (crew.some(c => c.id === 'granjero') ? null : 'Solo el granjero sabe remar.'),
      check: banks => {
        for (const bank of banks) {
          const has = id => bank.some(c => c.id === id);
          if (has('granjero')) continue;
          if (has('lobo') && has('cabra')) return { message: 'El lobo se comió a la cabra.', culprits: ['lobo', 'cabra'] };
          if (has('cabra') && has('repollo')) return { message: 'La cabra se comió el repollo.', culprits: ['cabra', 'repollo'] };
        }
        return null;
      },
    },
    {
      id: 'ovejas',
      rules: 'Tres ovejas y tres lobos tienen que cruzar. En el bote entran dos y cualquiera puede remar. Si en una orilla hay más lobos que ovejas, las ovejas corren peligro.',
      min: 11,
      capacity: 2,
      characters: [...sheepAndWolves('oveja'), ...sheepAndWolves('lobo')],
      canRow: () => null,
      check: banks => {
        for (const [index, bank] of banks.entries()) {
          const sheep = bank.filter(c => c.kind === 'oveja').length;
          const wolves = bank.filter(c => c.kind === 'lobo').length;
          if (sheep > 0 && wolves > sheep) {
            return {
              message: `Los lobos superan a las ovejas en la orilla de ${BANK_NAMES[index]}.`,
              culprits: bank.map(c => c.id),
            };
          }
        }
        return null;
      },
    },
  ];

  const rulesEl = document.querySelector('#rules');
  const countEl = document.querySelector('#count');
  const feedback = document.querySelector('#feedback');
  const tipEl = document.querySelector('#tip');
  const banksEl = [0, 1].map(side => document.querySelector(`#bank-${side}`));
  const bankSlots = banksEl.map(bank => bank.querySelector('.slots'));
  const boatEl = document.querySelector('#boat');
  const boatSlots = boatEl.querySelector('.slots');
  const crossButton = document.querySelector('#cross');
  const undoButton = document.querySelector('#undo');
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

  let level;
  let buttons;   // id → <button> del personaje
  let side;      // id → 0 (partida) o 1 (llegada)
  let boatSide;
  let boat;      // ids a bordo
  let trips;
  let history;
  let status;    // 'playing' | 'failed' | 'won'
  let culprits;

  const character = id => level.characters.find(c => c.id === id);
  const crew = () => [...boat].map(character);
  const banks = () => [0, 1].map(s => level.characters.filter(c => side[c.id] === s));

  const createButton = ({ id, kind }) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'character';
    button.dataset.id = id;
    button.dataset.kind = kind;
    const img = document.createElement('img');
    img.src = `personajes/${kind}.svg`;
    img.alt = '';
    button.append(img);
    return button;
  };

  const render = () => {
    // Mover un botón en el DOM le quita el foco: se lo devolvemos después.
    const focused = document.activeElement?.dataset?.id;

    level.characters.forEach(({ id, name }) => {
      const button = buttons[id];
      const aboard = boat.has(id);
      (aboard ? boatSlots : bankSlots[side[id]]).append(button);
      button.classList.toggle('culprit', culprits.includes(id));
      button.setAttribute('aria-label', aboard ? `${name}, en el bote` : `${name}, en la orilla de ${BANK_NAMES[side[id]]}`);
    });
    if (focused && buttons[focused]) buttons[focused].focus();

    const names = crew().map(c => c.name);
    boatEl.classList.toggle('at-arrival', boatSide === 1);
    boatEl.setAttribute('aria-label',
      `Bote en la orilla de ${BANK_NAMES[boatSide]}: ${names.length ? `con ${names.join(' y ')}` : 'vacío'}`);
    banksEl.forEach((bank, index) => bank.classList.toggle('boat-here', index === boatSide));

    crossButton.textContent = boatSide === 0 ? 'Cruzar ↓' : 'Cruzar ↑';
    crossButton.disabled = status !== 'playing';
    undoButton.disabled = !history.length || status === 'won';
    undoButton.classList.toggle('primary', status === 'failed');
    nextButton.hidden = status !== 'won' || level === LEVELS[LEVELS.length - 1];

    countEl.textContent = `${trips} / ${level.min} viajes`;
    levelButtons.forEach(button => {
      const buttonLevel = LEVELS[Number(button.dataset.level)];
      button.setAttribute('aria-pressed', String(buttonLevel === level));
      button.classList.toggle('solved', solved.has(buttonLevel.id));
    });
  };

  const setLevel = index => {
    level = LEVELS[index];
    buttons = Object.fromEntries(level.characters.map(c => [c.id, createButton(c)]));
    side = Object.fromEntries(level.characters.map(c => [c.id, 0]));
    boatSide = 0;
    boat = new Set();
    trips = 0;
    history = [];
    status = 'playing';
    culprits = [];

    [...bankSlots, boatSlots].forEach(slots => slots.replaceChildren());
    rulesEl.textContent = level.rules;
    tipEl.textContent = `Mínimo posible: ${level.min} viajes`;
    feedback.textContent = 'Tocá a quién querés subir al bote.';
    render();
  };

  const toggleBoard = id => {
    if (status !== 'playing') return;
    const { name } = character(id);

    if (boat.has(id)) {
      boat.delete(id);
      feedback.textContent = `${name} baja del bote.`;
    } else if (side[id] !== boatSide) {
      feedback.textContent = 'El bote está en la otra orilla.';
      return;
    } else if (boat.size === level.capacity) {
      feedback.textContent = `En el bote entran ${level.capacity}.`;
      return;
    } else {
      boat.add(id);
      feedback.textContent = `${name} sube al bote.`;
    }
    render();
  };

  const cross = () => {
    if (status !== 'playing') return;
    if (!boat.size) {
      feedback.textContent = 'Alguien tiene que remar.';
      return;
    }
    const problem = level.canRow(crew());
    if (problem) {
      feedback.textContent = problem;
      return;
    }

    history.push({ side: { ...side }, boatSide, trips });
    boatSide = 1 - boatSide;
    boat.forEach(id => { side[id] = boatSide; });
    boat.clear();
    trips += 1;

    const failure = level.check(banks());
    if (failure) {
      status = 'failed';
      culprits = failure.culprits;
      feedback.textContent = `${failure.message} Deshacé el viaje para seguir.`;
    } else if (level.characters.every(c => side[c.id] === 1)) {
      status = 'won';
      solved.add(level.id);
      saveSolved();
      feedback.textContent = trips === level.min
        ? `¡Perfecto! Cruzaste en el mínimo de ${level.min} viajes.`
        : `¡Lo lograste en ${trips} viajes! El mínimo es ${level.min}.`;
    } else {
      feedback.textContent = 'Bien. ¿Quién cruza ahora?';
    }

    render();
    // El botón Cruzar se deshabilita al terminar: el foco pasa a la acción que sigue.
    if (status === 'failed') undoButton.focus();
    if (status === 'won' && !nextButton.hidden) nextButton.focus();
  };

  const undo = () => {
    const previous = history.pop();
    if (!previous || status === 'won') return;
    ({ side, boatSide, trips } = previous);
    boat = new Set();
    status = 'playing';
    culprits = [];
    feedback.textContent = 'Viaje deshecho.';
    render();
  };

  [...bankSlots, boatSlots].forEach(slots => slots.addEventListener('click', event => {
    const button = event.target.closest('.character');
    if (button) toggleBoard(button.dataset.id);
  }));

  crossButton.addEventListener('click', cross);
  undoButton.addEventListener('click', () => {
    undo();
    // Sin más historial, Deshacer se deshabilita y perdería el foco.
    if (undoButton.disabled) crossButton.focus();
  });
  document.querySelector('#reset').addEventListener('click', () => setLevel(LEVELS.indexOf(level)));
  nextButton.addEventListener('click', () => {
    setLevel(LEVELS.indexOf(level) + 1);
    buttons[level.characters[0].id].focus();
  });
  levelButtons.forEach(button => {
    button.addEventListener('click', () => setLevel(Number(button.dataset.level)));
  });

  setLevel(0);
})();
