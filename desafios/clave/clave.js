(() => {
  // Cada figura se distingue por la forma; el color solo ayuda a verla rápido.
  const SYMBOLS = [
    { name: 'círculo', shape: '<circle cx="12" cy="12" r="9"/>' },
    { name: 'triángulo', shape: '<path d="M12 2.5 22 20.5H2z"/>' },
    { name: 'cuadrado', shape: '<rect x="3.5" y="3.5" width="17" height="17" rx="2"/>' },
    { name: 'rombo', shape: '<path d="M12 1.5 22.5 12 12 22.5 1.5 12z"/>' },
    { name: 'estrella', shape: '<path d="m12 1.8 3.1 6.4 7 1-5.1 4.9 1.2 7L12 17.8l-6.2 3.3 1.2-7L1.9 9.2l7-1z"/>' },
    { name: 'cruz', shape: '<path d="M8.5 2.5h7v6h6v7h-6v6h-7v-6h-6v-7h6z"/>' },
  ];

  // Cada nivel: largo de la clave, cuántas figuras entran en juego, si se repiten e intentos disponibles.
  const LEVELS = [
    { id: '3-de-4', length: 3, symbols: 4, repeat: false, tries: 6,
      intro: 'La clave tiene 3 figuras distintas, elegidas entre estas 4.' },
    { id: '4-de-6', length: 4, symbols: 6, repeat: false, tries: 8,
      intro: 'La clave tiene 4 figuras distintas, elegidas entre estas 6.' },
    { id: 'clasico', length: 4, symbols: 6, repeat: true, tries: 10,
      intro: 'La clave tiene 4 figuras elegidas entre estas 6, y alguna puede repetirse.' },
  ];
  const STORAGE_KEY = 'logicamente:clave:resueltos';

  const LOCK = {
    closed: '<rect x="4.5" y="10" width="15" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2.2"/>',
    open: '<rect x="4.5" y="10" width="15" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 7.6-1.8" fill="none" stroke="currentColor" stroke-width="2.2"/>',
  };

  const countEl = document.querySelector('#count');
  const feedback = document.querySelector('#feedback');
  const secretEl = document.querySelector('#secret');
  const attemptsEl = document.querySelector('#attempts');
  const guessEl = document.querySelector('#guess');
  const keypad = document.querySelector('#keypad');
  const controls = document.querySelector('#controls');
  const tryButton = document.querySelector('#try');
  const nextButton = document.querySelector('#next');
  const anotherButton = document.querySelector('#another');
  const levelButtons = [...document.querySelectorAll('.level')];

  // Generador pseudoaleatorio (mulberry32). Con ?semilla=N las claves se repiten:
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

  let level;
  let secret;
  let attempts; // por intento: { guess, exact, near }
  let guess;    // índice de figura por casilla, o null si está vacía
  let cursor;   // casilla donde va la próxima figura
  let status;   // 'playing' | 'won' | 'lost'

  const icon = (content, className = 'symbol') =>
    `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${content}</svg>`;
  const symbolIcon = index => icon(SYMBOLS[index].shape, `symbol s${index}`);
  const names = code => code.map(index => SYMBOLS[index].name).join(', ');

  const generate = () => {
    const pool = Array.from({ length: level.symbols }, (_, i) => i);
    return Array.from({ length: level.length }, () => {
      if (level.repeat) return pool[Math.floor(random() * pool.length)];
      return pool.splice(Math.floor(random() * pool.length), 1)[0];
    });
  };

  // Figuras en su lugar, y figuras en común que están en otro lugar. Es simétrico:
  // da lo mismo cuál es la clave y cuál el intento.
  const score = (a, b) => {
    const exact = a.filter((symbol, i) => symbol === b[i]).length;
    const common = SYMBOLS.reduce((sum, _, symbol) =>
      sum + Math.min(a.filter(s => s === symbol).length, b.filter(s => s === symbol).length), 0);
    return { exact, near: common - exact };
  };

  const resultText = ({ exact, near }) => {
    if (!exact && !near) return 'Ninguna de estas figuras está en la clave.';
    if (near === level.length) return 'Todas están en la clave, pero ninguna en su lugar.';
    return `${[exact && `${exact} en su lugar`, near && `${near} en otro lugar`].filter(Boolean).join(' y ')}.`;
  };

  const pegs = ({ exact, near }) => {
    const kinds = Array.from({ length: level.length }, (_, i) => (i < exact ? 'exact' : i < exact + near ? 'near' : 'none'));
    return `<span class="pegs" aria-hidden="true">${kinds.map(kind => `<span class="peg ${kind}"></span>`).join('')}</span>`;
  };

  const slots = code => `<span class="slots" aria-hidden="true">${code.map(index =>
    `<span class="slot">${index === null ? '?' : symbolIcon(index)}</span>`).join('')}</span>`;

  const buildLevel = () => {
    const board = document.querySelector('#board');
    board.style.setProperty('--length', level.length);
    controls.style.setProperty('--symbols', level.symbols);

    // Mismas columnas que los intentos: número, casillas y (vacío) el lugar de las pistas.
    const number = Object.assign(document.createElement('span'), { className: 'row-number' });
    number.setAttribute('aria-hidden', 'true');
    const guessSlots = Object.assign(document.createElement('span'), { className: 'slots' });
    guessSlots.replaceChildren(...Array.from({ length: level.length }, (_, i) => {
      const slot = document.createElement('button');
      slot.type = 'button';
      slot.className = 'slot';
      slot.dataset.index = i;
      return slot;
    }));
    guessEl.replaceChildren(number, guessSlots);

    keypad.replaceChildren(...SYMBOLS.slice(0, level.symbols).map((symbol, i) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'key';
      button.dataset.symbol = i;
      button.innerHTML = symbolIcon(i);
      button.setAttribute('aria-label', symbol.name);
      button.setAttribute('aria-keyshortcuts', String(i + 1));
      return button;
    }));
  };

  const render = () => {
    const over = status !== 'playing';

    // La clave solo llega al DOM cuando termina la partida.
    secretEl.innerHTML = `<span class="sr-only">${over ? `Clave secreta: ${names(secret)}.` : 'Clave secreta, oculta.'}</span>`
      + `<span class="row-number" aria-hidden="true">${icon(status === 'won' ? LOCK.open : LOCK.closed, 'lock')}</span>`
      + slots(over ? secret : secret.map(() => null));
    secretEl.classList.toggle('revealed', over);
    secretEl.classList.toggle('won', status === 'won');

    attemptsEl.innerHTML = attempts.map((attempt, i) =>
      `<li class="code-row"><span class="sr-only">Intento ${i + 1}: ${names(attempt.guess)}. ${resultText(attempt)}</span>`
      + `<span class="row-number" aria-hidden="true">${i + 1}</span>${slots(attempt.guess)}${pegs(attempt)}</li>`).join('');

    guessEl.hidden = over;
    guessEl.querySelector('.row-number').textContent = attempts.length + 1;
    guessEl.querySelectorAll('.slot').forEach((slot, i) => {
      const symbol = guess[i];
      slot.innerHTML = symbol === null ? '' : symbolIcon(symbol);
      slot.setAttribute('aria-label', `Casilla ${i + 1}: ${symbol === null ? 'vacía' : SYMBOLS[symbol].name}`);
      slot.setAttribute('aria-pressed', String(i === cursor));
    });

    controls.hidden = over;
    keypad.querySelectorAll('.key').forEach(key => {
      key.classList.toggle('used', !level.repeat && guess.includes(Number(key.dataset.symbol)));
    });

    const last = level === LEVELS[LEVELS.length - 1];
    countEl.textContent = `${attempts.length} / ${level.tries} intentos`;
    nextButton.hidden = status !== 'won' || last;
    anotherButton.classList.toggle('primary', over && nextButton.hidden);
    levelButtons.forEach(button => {
      const buttonLevel = LEVELS[Number(button.dataset.level)];
      button.setAttribute('aria-pressed', String(buttonLevel === level));
      button.classList.toggle('solved', solved.has(buttonLevel.id));
    });
  };

  const newGame = () => {
    secret = generate();
    attempts = [];
    guess = secret.map(() => null);
    cursor = 0;
    status = 'playing';
    feedback.textContent = `${level.intro} Tocá las figuras para armar tu intento.`;
    render();
  };

  const setLevel = index => {
    level = LEVELS[index];
    buildLevel();
    newGame();
  };

  const place = symbol => {
    if (status !== 'playing') return;
    // Sin repetidas, elegir una figura que ya está la mueve a la casilla actual.
    if (!level.repeat) {
      const other = guess.indexOf(symbol);
      if (other !== -1 && other !== cursor) guess[other] = null;
    }
    guess[cursor] = symbol;
    // Sigue en la próxima casilla vacía hacia la derecha; si no hay, en la primera vacía.
    const empty = guess.flatMap((s, i) => (s === null ? [i] : []));
    cursor = empty.find(i => i > cursor) ?? empty[0] ?? cursor;
    render();
  };

  // Como la tecla de borrar: vacía la casilla actual o, si ya está vacía, la anterior.
  const erase = () => {
    if (status !== 'playing') return;
    if (guess[cursor] === null && cursor > 0) cursor--;
    guess[cursor] = null;
    render();
  };

  const submit = () => {
    if (status !== 'playing') return;
    const missing = guess.filter(s => s === null).length;
    if (missing) {
      feedback.textContent = missing === 1 ? 'Falta 1 figura para probar.' : `Faltan ${missing} figuras para probar.`;
      return;
    }

    const result = score(secret, guess);
    // Si este intento fuera la clave, ¿los anteriores habrían recibido las mismas pistas?
    const discardedBy = attempts.findIndex(attempt => {
      const { exact, near } = score(attempt.guess, guess);
      return exact !== attempt.exact || near !== attempt.near;
    });
    attempts.push({ guess, ...result });
    guess = secret.map(() => null);
    cursor = 0;

    if (result.exact === level.length) {
      status = 'won';
      solved.add(level.id);
      saveSolved();
      feedback.textContent = attempts.length === 1
        ? '¡En el primer intento! ¿Suerte o lógica?'
        : `¡La descubriste en ${attempts.length} intentos!`;
    } else if (attempts.length === level.tries) {
      status = 'lost';
      feedback.textContent = 'Se terminaron los intentos. Arriba está la clave.';
    } else {
      feedback.textContent = resultText(result) + (discardedBy === -1
        ? ''
        : ` Ojo: el intento ${discardedBy + 1} ya descartaba esa combinación.`);
    }

    render();
    if (status !== 'playing') (nextButton.hidden ? anotherButton : nextButton).focus();
    else guessEl.scrollIntoView({ block: 'nearest' });
  };

  guessEl.addEventListener('click', event => {
    const slot = event.target.closest('.slot');
    if (!slot || status !== 'playing') return;
    cursor = Number(slot.dataset.index);
    render();
  });

  keypad.addEventListener('click', event => {
    const key = event.target.closest('.key');
    if (key) place(Number(key.dataset.symbol));
  });

  // Enter prueba el intento, salvo en un botón al que se llegó con Tab: ahí lo activa.
  // Así, tras tocar una figura con el mouse, Enter no la vuelve a poner.
  let pointerFocus = false;
  document.addEventListener('pointerdown', () => { pointerFocus = true; });

  document.addEventListener('keydown', event => {
    if (event.key === 'Tab') pointerFocus = false;
    if (status !== 'playing' || event.ctrlKey || event.metaKey || event.altKey) return;
    const number = Number(event.key);
    if (number >= 1 && number <= level.symbols) {
      place(number - 1);
    } else if (event.key === 'Backspace') {
      erase();
    } else if (event.key === 'Enter' && (pointerFocus || !event.target.closest('button, a'))) {
      submit();
    } else {
      return;
    }
    event.preventDefault();
  });

  document.querySelector('#erase').addEventListener('click', erase);
  tryButton.addEventListener('click', submit);
  anotherButton.addEventListener('click', () => {
    newGame();
    keypad.querySelector('.key').focus();
  });
  nextButton.addEventListener('click', () => {
    setLevel(LEVELS.indexOf(level) + 1);
    keypad.querySelector('.key').focus();
  });
  levelButtons.forEach(button => {
    button.addEventListener('click', () => setLevel(Number(button.dataset.level)));
  });

  setLevel(0);
})();
