// Luces fuera: toques, niveles, tableros con semilla, pistas y accesibilidad.
// Uso: npm test   (BROWSER_CHANNEL=chrome npm test para usar Chrome)

import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { useSite, siteUrl, openPage, hasNoHorizontalScroll } from './helpers.js';

useSite();

const SEED = 2026;

// La casilla tocada y sus vecinas ortogonales.
const neighborhood = (index, size) => {
  const row = Math.floor(index / size);
  const col = index % size;
  return [[row, col], [row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]]
    .filter(([r, c]) => r >= 0 && r < size && c >= 0 && c < size)
    .map(([r, c]) => r * size + c);
};

// Solución más corta por fuerza bruta: 2^(size²) combinaciones de toques, hasta 5×5 alcanza.
// Es independiente del método del juego, así también verifica el mínimo que anuncia.
const shortestSolution = (lights, size) => {
  const cellsCount = size * size;
  const effect = Array.from({ length: cellsCount }, (_, i) => neighborhood(i, size).reduce((m, j) => m | (1 << j), 0));
  const target = lights.reduce((m, on, i) => (on ? m | (1 << i) : m), 0);
  // Búsqueda por cantidad de toques creciente: la primera que apaga todo es la más corta.
  const search = (from, left, state, chosen) => {
    if (left === 0) return state === target ? chosen : null;
    for (let i = from; i <= cellsCount - left; i++) {
      const found = search(i + 1, left - 1, state ^ effect[i], [...chosen, i]);
      if (found) return found;
    }
    return null;
  };
  for (let k = 0; k <= cellsCount; k++) {
    const found = search(0, k, 0, []);
    if (found) return found;
  }
  return null;
};

describe('Luces fuera', () => {
  let page;
  const bulbs = () => page.locator('.bulb');
  const bulb = index => bulbs().nth(index);
  const feedback = () => page.locator('#feedback').textContent();
  const count = () => page.locator('#count').textContent();
  const lights = () => page.locator('.bulb').evaluateAll(els => els.map(el => el.classList.contains('on')));
  const size = async () => Math.sqrt(await bulbs().count());
  const chooseLevel = name => page.locator('.level', { hasText: name }).tap();
  const tapAll = async indexes => {
    for (const i of indexes) await bulb(i).tap();
  };
  const solve = async () => tapAll(shortestSolution(await lights(), await size()));

  before(async () => {
    page = await openPage();
  });

  after(async () => {
    assert.deepEqual(page.problems, []);
    await page.context().close();
  });

  // Contexto limpio: sin niveles resueltos guardados y con tableros reproducibles.
  const load = async (seed = SEED) => {
    await page.goto(siteUrl(`desafios/luces/?semilla=${seed}`));
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  };

  test('estado inicial', async () => {
    await load();
    assert.equal(await bulbs().count(), 9);
    assert.equal(await count(), '0 / 4 toques');
    assert.equal(await page.locator('.level[aria-pressed="true"]').textContent(), '3×3');
    assert.equal(await page.locator('#tip').textContent(), 'Mínimo posible: 4 toques');
    assert.ok(await page.locator('#next').isHidden());

    const lit = (await lights()).filter(Boolean).length;
    assert.ok(lit > 0);
    assert.equal(await feedback(), lit === 1 ? 'Apagá la luz prendida.' : `Apagá las ${lit} luces prendidas.`);
    const on = (await lights()).indexOf(true);
    assert.match(await bulb(on).getAttribute('aria-label'), /^Fila \d, columna [A-C]: prendida$/);
  });

  test('cada tablero generado necesita exactamente el mínimo anunciado', async () => {
    for (const seed of [1, 2, 3]) {
      await load(seed);
      for (const [name, min] of [['3×3', 4], ['4×4', 6], ['5×5', 8]]) {
        await chooseLevel(name);
        assert.equal((shortestSolution(await lights(), await size())).length, min, `${name} con semilla ${seed}`);
      }
    }
  });

  test('un toque cambia la luz y sus vecinas', async () => {
    await load();
    for (const [index, changed] of [[4, [1, 3, 4, 5, 7]], [0, [0, 1, 3]], [5, [2, 4, 5, 8]]]) {
      const before = await lights();
      await bulb(index).tap();
      const after = await lights();
      assert.deepEqual(after.flatMap((on, i) => (on !== before[i] ? [i] : [])), changed, `toque en ${index}`);
    }
    assert.equal(await count(), '3 / 4 toques');
  });

  test('tocar dos veces la misma luz la deja como estaba', async () => {
    await load();
    const before = await lights();
    await bulb(0).tap();
    const lit = (await lights()).filter(Boolean).length;
    assert.equal(await feedback(), lit === 1 ? 'Queda 1 luz prendida.' : `Quedan ${lit} luces prendidas.`);

    await bulb(0).tap();
    assert.deepEqual(await lights(), before);
    assert.equal(await feedback(), 'Tocar dos veces la misma luz la deja como estaba.');
    assert.equal(await count(), '2 / 4 toques');
  });

  test('resolver 3×3 en el mínimo bloquea el tablero y lleva al siguiente nivel', async () => {
    await load();
    await solve();
    assert.equal(await feedback(), '¡Perfecto! Apagaste todo en el mínimo de 4 toques.');
    assert.equal(await count(), '4 / 4 toques');
    assert.ok(await page.locator('#board.completed').isVisible());
    assert.equal(await page.evaluate(() => document.activeElement.id), 'next');

    // Resuelto: tocar el tablero ya no cambia nada.
    await bulb(4).tap();
    assert.ok((await lights()).every(on => !on));

    await page.locator('#next').tap();
    assert.equal(await bulbs().count(), 16);
    assert.equal(await count(), '0 / 6 toques');
    assert.equal(await page.locator('.level[aria-pressed="true"]').textContent(), '4×4');
  });

  test('resolver con toques de más', async () => {
    await load();
    const solution = shortestSolution(await lights(), 3);
    // Un toque ida y vuelta en una casilla que no es parte de la solución.
    const extra = [0, 1, 2, 3, 4, 5, 6, 7, 8].find(i => !solution.includes(i));
    await tapAll([extra, extra, ...solution]);
    assert.equal(await feedback(), '¡Lo lograste en 6 toques! El mínimo es 4.');
  });

  test('resolver 4×4 y 5×5', async () => {
    await load();
    await chooseLevel('4×4');
    await solve();
    assert.equal(await feedback(), '¡Perfecto! Apagaste todo en el mínimo de 6 toques.');

    await page.locator('#next').tap();
    await solve();
    assert.equal(await feedback(), '¡Perfecto! Apagaste todo en el mínimo de 8 toques.');
    assert.ok(await page.locator('#next').isHidden(), 'después del último nivel no hay siguiente');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'another');
    assert.ok(await page.locator('#another.primary').isVisible());
  });

  test('reiniciar vuelve al mismo tablero y otro tablero trae uno nuevo', async () => {
    await load();
    const initial = await lights();
    await bulb(0).tap();
    await bulb(8).tap();
    await page.locator('#reset').tap();
    assert.deepEqual(await lights(), initial);
    assert.equal(await count(), '0 / 4 toques');

    await page.locator('#another').tap();
    assert.notDeepEqual(await lights(), initial);
    assert.equal(await count(), '0 / 4 toques');
  });

  test('la misma semilla da los mismos tableros', async () => {
    await load();
    const first = await lights();
    await page.locator('#another').tap();
    const second = await lights();

    await page.reload();
    assert.deepEqual(await lights(), first);
    await page.locator('#another').tap();
    assert.deepEqual(await lights(), second);

    await load(SEED + 1);
    assert.notDeepEqual(await lights(), first, 'otra semilla, otro tablero');
  });

  test('la pista aparece al llegar al doble del mínimo', async () => {
    await load();
    // Alternar dos casillas: tras 8 toques el tablero vuelve al inicial, sin ganar por accidente.
    await tapAll([0, 1, 0, 1, 0, 1, 0]);
    assert.equal(await page.locator('#tip').textContent(), 'Mínimo posible: 4 toques');
    assert.doesNotMatch(await feedback(), /Pista/);

    await bulb(1).tap();
    assert.equal(await count(), '8 / 4 toques');
    assert.match(await feedback(), /^Pista: el orden de los toques no importa\./);
    assert.equal(await page.locator('#tip').textContent(), 'Pista: apagá fila por fila, de arriba hacia abajo.');

    // La pista se muestra una vez; después vuelve el conteo de luces.
    await bulb(2).tap();
    assert.match(await feedback(), /^Queda|^Quedan/);
  });

  test('los niveles resueltos quedan marcados al recargar', async () => {
    await load();
    await solve();
    await page.reload();
    assert.deepEqual(await page.locator('.level').evaluateAll(els => els.map(el => el.classList.contains('solved'))),
      [true, false, false]);
  });

  test('se puede jugar con teclado', async () => {
    await load();
    await page.locator('#reset').focus();
    // El tablero es una sola parada de Tab antes de Reiniciar.
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.index), '0');

    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowDown');
    const before = await lights();
    await page.keyboard.press('Enter');
    assert.notEqual((await lights())[4], before[4], 'Enter tocó la luz del centro');

    // Las flechas no salen del tablero.
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.index), '1');
  });

  test('el 5×5 entra en un celular de 360px con luces tocables', async () => {
    await load();
    await chooseLevel('5×5');
    assert.ok(await hasNoHorizontalScroll(page));
    const { width, height } = await bulb(0).boundingBox();
    assert.ok(width >= 44 && Math.abs(width - height) < 1, `luz de ${width}×${height}px`);
  });
});
