(() => {
  const STORAGE_KEY = 'logicamente:jarras:resueltos';
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const LITER = 18; // alto de un litro en unidades del viewBox: las jarras crecen con su capacidad

  // Cada nivel es solo datos: capacidades, agua inicial, si hay canilla y qué hay que medir.
  // target marca las jarras que brillan al ganar; goal decide si el nivel está resuelto.
  const LEVELS = [
    {
      id: '3-5',
      rules: 'Tenés una jarra de 3\u00a0L, otra de 5\u00a0L y una canilla. Podés llenarlas, vaciarlas y pasar agua de una a otra. Medí exactamente 4\u00a0L.',
      min: 6,
      capacities: [3, 5],
      start: [0, 0],
      tap: true,
      target: 4,
      goal: amounts => amounts.includes(4),
    },
    {
      id: '8-5-3',
      rules: 'La jarra de 8\u00a0L está llena y no hay canilla ni desagüe: solo podés pasar agua de una jarra a otra. Repartila en dos mitades de 4\u00a0L.',
      min: 7,
      capacities: [8, 5, 3],
      start: [8, 0, 0],
      tap: false,
      target: 4,
      goal: amounts => amounts.filter(a => a === 4).length === 2,
    },
    {
      id: '4-9',
      rules: 'Con una jarra de 4\u00a0L, otra de 9\u00a0L y la canilla, medí exactamente 6\u00a0L.',
      min: 8,
      capacities: [4, 9],
      start: [0, 0],
      tap: true,
      target: 6,
      goal: amounts => amounts.includes(6),
    },
  ];

  const rulesEl = document.querySelector('#rules');
  const countEl = document.querySelector('#count');
  const feedback = document.querySelector('#feedback');
  const tipEl = document.querySelector('#tip');
  const jugsEl = document.querySelector('#jugs');
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
  let jugs;      // por jarra: { column, button, water, amount, fill, empty }
  let amounts;   // litros en cada jarra
  let selected;  // índice de la jarra elegida para verter, o null
  let moves;
  let history;
  let status;    // 'playing' | 'won'
  let poured;    // si ya pasó agua alguna vez en este nivel: hasta entonces se recuerda cómo hacerlo

  const POUR_HINT = 'Para pasar agua, tocá una jarra y después otra.';

  const name = index => `la jarra de ${level.capacities[index]}\u00a0L`;
  const capitalize = text => text[0].toUpperCase() + text.slice(1);

  const svg = (tag, attributes) => {
    const el = document.createElementNS(SVG_NS, tag);
    Object.entries(attributes).forEach(([key, value]) => el.setAttribute(key, value));
    return el;
  };

  // Dibujo de la jarra (basado en jarra.svg): cuerpo de 60 de ancho, alto según la capacidad,
  // una marca por litro y el agua como un rectángulo que se escala desde el fondo.
  const createJugSvg = (capacity, index) => {
    const height = capacity * LITER;
    const bottom = 20 + height;
    const handleTop = 30;
    const handleBottom = handleTop + Math.min(50, height * 0.6);
    const body = { x: 20, y: 20, width: 60, height, rx: 6 };
    const clipId = `jug-clip-${index}`;

    const root = svg('svg', { viewBox: `0 0 120 ${bottom + 4}`, 'aria-hidden': 'true', focusable: 'false' });
    const clip = svg('clipPath', { id: clipId });
    clip.append(svg('rect', body));
    const defs = svg('defs', {});
    defs.append(clip);

    // El recorte va en un grupo: así escalar el agua no deforma las esquinas redondeadas.
    const waterGroup = svg('g', { 'clip-path': `url(#${clipId})` });
    const water = svg('rect', { ...body, rx: 0, class: 'water' });
    waterGroup.append(water, svg('rect', { x: 24, y: 24, width: 8, height: height - 8, rx: 4, class: 'shine' }));

    const ticks = Array.from({ length: capacity - 1 }, (_, i) => {
      const y = bottom - (i + 1) * LITER;
      return svg('line', { x1: 20, y1: y, x2: 30, y2: y, class: 'tick' });
    });

    const middle = (handleTop + handleBottom) / 2;
    root.append(
      defs,
      svg('path', { d: `M 80 ${handleTop} Q 112 ${handleTop} 112 ${middle} Q 112 ${handleBottom} 80 ${handleBottom}`, class: 'handle' }),
      svg('rect', { ...body, class: 'glass' }),
      waterGroup,
      ...ticks,
      svg('rect', { ...body, class: 'outline' }),
    );
    return { root, water };
  };

  const createTapButton = (action, label) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `tap ${action}`;
    button.dataset.action = action;
    const icon = document.createElement('span');
    icon.className = 'icon';
    icon.setAttribute('aria-hidden', 'true');
    button.append(icon, label);
    return button;
  };

  const createJug = (capacity, index) => {
    const column = document.createElement('div');
    column.className = 'jug-column';
    column.dataset.index = index;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'jug';
    button.dataset.capacity = capacity;
    const { root, water } = createJugSvg(capacity, index);
    const hint = document.createElement('span');
    hint.className = 'pour-hint';
    hint.setAttribute('aria-hidden', 'true');
    button.append(root, hint);

    const amount = document.createElement('span');
    amount.className = 'amount';
    column.append(button, amount);

    const jug = { column, button, water, amount };
    if (level.tap) {
      jug.fill = createTapButton('fill', 'Llenar');
      jug.empty = createTapButton('empty', 'Vaciar');
      const taps = document.createElement('div');
      taps.className = 'taps';
      taps.append(jug.fill, jug.empty);
      column.append(taps);
    }
    return jug;
  };

  const render = () => {
    const won = status === 'won';
    jugs.forEach((jug, index) => {
      const capacity = level.capacities[index];
      const amount = amounts[index];
      jug.water.style.transform = `scaleY(${amount / capacity})`;
      jug.amount.textContent = `${amount} / ${capacity}\u00a0L`;
      jug.button.setAttribute('aria-label', `Jarra de ${capacity}\u00a0L, con ${amount}\u00a0L`);
      jug.button.setAttribute('aria-pressed', String(selected === index));
      jug.column.classList.toggle('target', selected !== null && selected !== index && amount < capacity);
      jug.column.classList.toggle('goal', won && amount === level.target);
      if (jug.fill) {
        jug.fill.setAttribute('aria-label', `Llenar ${name(index)}`);
        jug.empty.setAttribute('aria-label', `Vaciar ${name(index)}`);
        jug.fill.disabled = won;
        jug.empty.disabled = won;
      }
    });
    jugsEl.classList.toggle('done', won);

    undoButton.disabled = !history.length || won;
    nextButton.hidden = !won || level === LEVELS[LEVELS.length - 1];

    countEl.textContent = `${moves} / ${level.min} movimientos`;
    levelButtons.forEach(button => {
      const buttonLevel = LEVELS[Number(button.dataset.level)];
      button.setAttribute('aria-pressed', String(buttonLevel === level));
      button.classList.toggle('solved', solved.has(buttonLevel.id));
    });
  };

  const setLevel = index => {
    level = LEVELS[index];
    jugs = level.capacities.map(createJug);
    amounts = [...level.start];
    selected = null;
    moves = 0;
    history = [];
    status = 'playing';
    poured = false;

    jugsEl.replaceChildren(...jugs.map(jug => jug.column));
    rulesEl.textContent = level.rules;
    tipEl.textContent = `Mínimo posible: ${level.min} movimientos`;
    feedback.textContent = level.tap
      ? 'Empezá llenando una jarra. Después tocala y tocá otra para pasarle el agua.'
      : POUR_HINT;
    render();
  };

  // Aplica un movimiento que cambia el agua: lo cuenta, lo guarda para deshacer y revisa si ganó.
  const commit = (next, message) => {
    history.push({ amounts, moves });
    amounts = next;
    selected = null;
    moves += 1;

    if (level.goal(amounts)) {
      status = 'won';
      solved.add(level.id);
      saveSolved();
      feedback.textContent = moves === level.min
        ? `¡Perfecto! Lo lograste en el mínimo de ${level.min} movimientos.`
        : `¡Lo lograste en ${moves} movimientos! El mínimo es ${level.min}.`;
    } else {
      feedback.textContent = poured ? message : `${message} ${POUR_HINT}`;
    }
    render();
    if (status === 'won' && !nextButton.hidden) nextButton.focus();
  };

  const fill = index => {
    if (status !== 'playing') return;
    const capacity = level.capacities[index];
    if (amounts[index] === capacity) {
      selected = null;
      feedback.textContent = `${capitalize(name(index))} ya está llena.`;
      render();
      return;
    }
    commit(amounts.map((a, i) => (i === index ? capacity : a)), `Llenaste ${name(index)}.`);
  };

  const empty = index => {
    if (status !== 'playing') return;
    if (amounts[index] === 0) {
      selected = null;
      feedback.textContent = `${capitalize(name(index))} ya está vacía.`;
      render();
      return;
    }
    commit(amounts.map((a, i) => (i === index ? 0 : a)), `Vaciaste ${name(index)}.`);
  };

  const pour = (from, to) => {
    const liters = Math.min(amounts[from], level.capacities[to] - amounts[to]);
    if (!liters) {
      feedback.textContent = `${capitalize(name(to))} ya está llena.`;
      return;
    }
    const next = [...amounts];
    next[from] -= liters;
    next[to] += liters;
    poured = true;
    commit(next, `Pasaste ${liters}\u00a0L de ${name(from)} a la de ${level.capacities[to]}\u00a0L.`);
  };

  const tapJug = index => {
    if (status !== 'playing') return;
    if (selected === index) {
      selected = null;
      feedback.textContent = `Soltaste ${name(index)}.`;
    } else if (selected !== null) {
      pour(selected, index);
    } else if (!amounts[index]) {
      feedback.textContent = level.tap
        ? `${capitalize(name(index))} está vacía: llenala o elegí una con agua.`
        : `${capitalize(name(index))} está vacía: elegí una con agua.`;
    } else {
      selected = index;
      feedback.textContent = `Elegiste ${name(index)}. ¿A cuál pasás el agua?`;
    }
    render();
  };

  const undo = () => {
    const previous = history.pop();
    if (!previous || status === 'won') return;
    ({ amounts, moves } = previous);
    selected = null;
    feedback.textContent = 'Movimiento deshecho.';
    render();
  };

  jugsEl.addEventListener('click', event => {
    const column = event.target.closest('.jug-column');
    if (!column) return;
    const index = Number(column.dataset.index);
    const tap = event.target.closest('.tap');
    if (tap) (tap.dataset.action === 'fill' ? fill : empty)(index);
    else if (event.target.closest('.jug')) tapJug(index);
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && selected !== null && status === 'playing') tapJug(selected);
  });

  undoButton.addEventListener('click', () => {
    undo();
    // Sin más historial, Deshacer se deshabilita y perdería el foco.
    if (undoButton.disabled) jugs[0].button.focus();
  });
  document.querySelector('#reset').addEventListener('click', () => setLevel(LEVELS.indexOf(level)));
  nextButton.addEventListener('click', () => {
    setLevel(LEVELS.indexOf(level) + 1);
    jugs[0].button.focus();
  });
  levelButtons.forEach(button => {
    button.addEventListener('click', () => setLevel(Number(button.dataset.level)));
  });

  setLevel(0);
})();
