// Las ocho reinas: niveles, conflictos, resolución y accesibilidad.
// Uso: npm test   (BROWSER_CHANNEL=chrome npm test para usar Chrome)

import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { useSite, siteUrl, openPage, hasNoHorizontalScroll } from './helpers.js';

useSite();

// Una solución por nivel: la columna de la reina en cada fila.
const SOLUTIONS = {
  4: [1, 3, 0, 2],
  6: [1, 3, 5, 0, 2, 4],
  8: [0, 4, 7, 5, 2, 6, 1, 3],
};

describe('Las ocho reinas', () => {
  let page;
  const cells = () => page.locator('.cell');
  const cell = (row, col, size) => cells().nth(row * size + col);
  const feedback = () => page.locator('#feedback').textContent();
  const count = () => page.locator('#count').textContent();
  const conflicted = () => page.locator('.cell.conflict').evaluateAll(els => els.map(el => Number(el.dataset.index)));
  const solve = async size => {
    for (const [row, col] of SOLUTIONS[size].entries()) await cell(row, col, size).tap();
  };

  before(async () => {
    page = await openPage();
  });

  after(async () => {
    assert.deepEqual(page.problems, []);
    await page.context().close();
  });

  // Contexto limpio: sin niveles resueltos guardados de pruebas anteriores.
  const load = async () => {
    await page.goto(siteUrl('desafios/reinas/'));
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  };

  test('estado inicial', async () => {
    await load();
    assert.equal(await cells().count(), 16);
    assert.equal(await count(), '0 / 4 reinas');
    assert.equal(await feedback(), 'Ubicá 4 reinas sin que se ataquen.');
    assert.equal(await page.locator('.level[aria-pressed="true"]').textContent(), '4×4');
    assert.ok(await page.locator('#next').isHidden());
  });

  test('tocar una casilla pone una reina y volver a tocarla la saca', async () => {
    await load();
    await cell(0, 1, 4).tap();
    assert.equal(await count(), '1 / 4 reinas');
    assert.equal(await feedback(), 'Bien. Faltan 3.');
    assert.equal(await cell(0, 1, 4).getAttribute('aria-label'), 'Fila 1, columna B: reina');

    await cell(0, 1, 4).tap();
    assert.equal(await count(), '0 / 4 reinas');
    assert.equal(await page.locator('.cell.queen').count(), 0);
  });

  for (const [kind, second] of [['fila', [0, 3]], ['columna', [3, 0]], ['diagonal', [2, 2]]]) {
    test(`marca el conflicto por ${kind} y lo quita al sacar la reina`, async () => {
      await load();
      await cell(0, 0, 4).tap();
      await cell(...second, 4).tap();
      assert.deepEqual(await conflicted(), [0, second[0] * 4 + second[1]].sort((a, b) => a - b));
      assert.equal(await feedback(), 'Hay reinas que se atacan.');
      assert.equal(await cell(0, 0, 4).getAttribute('aria-label'), 'Fila 1, columna A: reina, en conflicto');

      await cell(...second, 4).tap();
      assert.deepEqual(await conflicted(), []);
    });
  }

  test('no deja poner más reinas que el tamaño del tablero', async () => {
    await load();
    for (const col of [0, 1, 2, 3]) await cell(0, col, 4).tap();
    await cell(1, 0, 4).tap();
    assert.equal(await count(), '4 / 4 reinas');
    assert.equal(await feedback(), 'Ya hay 4 reinas: sacá una para moverla.');
  });

  test('resolver 4×4 bloquea el tablero y lleva al siguiente nivel', async () => {
    await load();
    await solve(4);
    assert.equal(await feedback(), '¡Lo lograste! Ninguna reina se ataca.');
    assert.ok(await page.locator('#board.completed').isVisible());

    // Resuelto: tocar el tablero ya no cambia nada.
    await cell(0, 1, 4).tap();
    assert.equal(await count(), '4 / 4 reinas');

    await page.locator('#next').tap();
    assert.equal(await cells().count(), 36);
    assert.equal(await count(), '0 / 6 reinas');
    assert.equal(await page.locator('.level[aria-pressed="true"]').textContent(), '6×6');
  });

  test('resolver 6×6 y el clásico 8×8', async () => {
    await load();
    await page.locator('.level', { hasText: '6×6' }).tap();
    await solve(6);
    assert.equal(await feedback(), '¡Lo lograste! Ninguna reina se ataca.');

    await page.locator('#next').tap();
    await solve(8);
    assert.equal(await feedback(), '¡Resolviste el clásico! Ocho reinas en paz.');
    assert.ok(await page.locator('#next').isHidden(), 'después del último nivel no hay siguiente');
  });

  test('el selector de nivel cambia el tamaño y vacía el tablero', async () => {
    await load();
    await cell(0, 0, 4).tap();
    await page.locator('.level', { hasText: '8×8' }).tap();
    assert.equal(await cells().count(), 64);
    assert.equal(await count(), '0 / 8 reinas');
  });

  test('reiniciar vacía el tablero del nivel actual', async () => {
    await load();
    await cell(0, 0, 4).tap();
    await cell(1, 1, 4).tap();
    await page.locator('#reset').tap();
    assert.equal(await page.locator('.cell.queen').count(), 0);
    assert.equal(await cells().count(), 16);
  });

  test('los niveles resueltos quedan marcados al recargar', async () => {
    await load();
    await solve(4);
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
    await page.keyboard.press('Enter');
    assert.equal(await cell(1, 1, 4).getAttribute('aria-label'), 'Fila 2, columna B: reina');

    // Las flechas no salen del tablero.
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.index), '1');
  });

  test('el 8×8 entra en un celular de 360px con casillas tocables', async () => {
    await load();
    await page.locator('.level', { hasText: '8×8' }).tap();
    assert.ok(await hasNoHorizontalScroll(page));
    const { width, height } = await cell(0, 0, 8).boundingBox();
    assert.ok(width >= 35 && Math.abs(width - height) < 1, `casilla de ${width}×${height}px`);
  });
});
