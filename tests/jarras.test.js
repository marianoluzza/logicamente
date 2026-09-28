// Las jarras de agua: llenar, vaciar, verter, niveles, deshacer y accesibilidad.
// Uso: npm test   (BROWSER_CHANNEL=chrome npm test para usar Chrome)

import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { useSite, siteUrl, openPage, hasNoHorizontalScroll } from './helpers.js';

useSite();

// Soluciones óptimas: ['llenar', i], ['vaciar', i] o [origen, destino] para verter.
const TRES_Y_CINCO = [['llenar', 1], [1, 0], ['vaciar', 0], [1, 0], ['llenar', 1], [1, 0]];
const OCHO_CINCO_TRES = [[0, 1], [1, 2], [2, 0], [1, 2], [0, 1], [1, 2], [2, 0]];
const CUATRO_Y_NUEVE = [['llenar', 1], [1, 0], ['vaciar', 0], [1, 0], ['vaciar', 0], [1, 0], ['llenar', 1], [1, 0]];

describe('Las jarras de agua', () => {
  let page;
  // Entre la cantidad y la L va un espacio duro; las pruebas lo leen como espacio común.
  const plain = text => text?.replaceAll(' ', ' ');
  const feedback = async () => plain(await page.locator('#feedback').textContent());
  const count = () => page.locator('#count').textContent();
  const amounts = async () => (await page.locator('.amount').allTextContents()).map(plain);
  const jug = index => page.locator('.jug').nth(index);
  const label = async locator => plain(await locator.getAttribute('aria-label'));
  const activeLabel = async () => plain(await page.evaluate(() => document.activeElement.id || document.activeElement.getAttribute('aria-label')));

  const move = async ([action, index]) => {
    if (action === 'llenar') return page.locator('.tap.fill').nth(index).tap();
    if (action === 'vaciar') return page.locator('.tap.empty').nth(index).tap();
    await jug(action).tap();
    await jug(index).tap();
  };
  const play = async moves => {
    for (const m of moves) await move(m);
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
    await page.goto(siteUrl('desafios/jarras/'));
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  };
  const chooseLevel = name => page.locator('.level', { hasText: name }).tap();

  test('estado inicial', async () => {
    await load();
    assert.deepEqual(await amounts(), ['0 / 3 L', '0 / 5 L']);
    assert.equal(await count(), '0 / 6 movimientos');
    assert.equal(await page.locator('.level[aria-pressed="true"]').textContent(), '3 y 5');
    assert.equal(await label(jug(1)), 'Jarra de 5 L, con 0 L');
    // La unidad nunca queda sola en otra línea.
    for (const text of [await page.locator('#rules').textContent(), ...await page.locator('.amount').allTextContents()]) {
      assert.doesNotMatch(text, /\d L/, `espacio común antes de la L en "${text}"`);
    }
    assert.equal(await label(page.locator('.tap.fill').nth(0)), 'Llenar la jarra de 3 L');
    assert.ok(await page.locator('#undo').isDisabled());
    assert.ok(await page.locator('#next').isHidden());

    // Las jarras crecen con su capacidad.
    const heights = await page.locator('.jug svg').evaluateAll(els => els.map(el => el.getBoundingClientRect().height));
    assert.ok(heights[1] > heights[0] * 1.3, `alturas ${heights}`);

    // Los íconos de las máscaras cargaron.
    const icons = await page.evaluate(() => Promise.all(['gota', 'descartar', 'transferir'].map(async name => {
      const img = new Image();
      img.src = `iconos/${name}.svg`;
      await img.decode();
      return img.naturalWidth;
    })));
    assert.ok(icons.every(width => width > 0));
  });

  test('llenar, verter y vaciar', async () => {
    await load();
    assert.equal(await feedback(), 'Empezá llenando una jarra. Después tocala y tocá otra para pasarle el agua.');
    await move(['llenar', 1]);
    assert.deepEqual(await amounts(), ['0 / 3 L', '5 / 5 L']);
    assert.equal(await feedback(), 'Llenaste la jarra de 5 L. Para pasar agua, tocá una jarra y después otra.');

    await jug(1).tap();
    assert.equal(await jug(1).getAttribute('aria-pressed'), 'true');
    assert.equal(await feedback(), 'Elegiste la jarra de 5 L. ¿A cuál pasás el agua?');
    assert.equal(await page.locator('.jug-column.target').count(), 1, 'la jarra de 3 L puede recibir');

    await jug(0).tap();
    assert.deepEqual(await amounts(), ['3 / 3 L', '2 / 5 L']);
    assert.equal(await feedback(), 'Pasaste 3 L de la jarra de 5 L a la de 3 L.');
    assert.equal(await page.locator('.jug[aria-pressed="true"]').count(), 0);

    // Ya pasó agua una vez: no hace falta seguir recordando cómo.
    await move(['vaciar', 0]);
    assert.deepEqual(await amounts(), ['0 / 3 L', '2 / 5 L']);
    assert.equal(await feedback(), 'Vaciaste la jarra de 3 L.');
    assert.equal(await count(), '3 / 6 movimientos');
  });

  test('los movimientos sin efecto no cuentan', async () => {
    await load();
    await jug(0).tap();
    assert.equal(await feedback(), 'La jarra de 3 L está vacía: llenala o elegí una con agua.');
    assert.equal(await jug(0).getAttribute('aria-pressed'), 'false');

    await move(['vaciar', 0]);
    assert.equal(await feedback(), 'La jarra de 3 L ya está vacía.');

    await move(['llenar', 0]);
    await move(['llenar', 0]);
    assert.equal(await feedback(), 'La jarra de 3 L ya está llena.');

    await move(['llenar', 1]);
    await move([1, 0]);
    assert.equal(await feedback(), 'La jarra de 3 L ya está llena.');
    assert.equal(await jug(1).getAttribute('aria-pressed'), 'true', 'la jarra sigue elegida');

    await jug(1).tap();
    assert.equal(await feedback(), 'Soltaste la jarra de 5 L.');
    assert.equal(await count(), '2 / 6 movimientos');
  });

  test('deshacer vuelve un movimiento atrás', async () => {
    await load();
    await play(TRES_Y_CINCO.slice(0, 3));
    assert.equal(await count(), '3 / 6 movimientos');
    await page.locator('#undo').tap();
    assert.equal(await feedback(), 'Movimiento deshecho.');
    assert.equal(await count(), '2 / 6 movimientos');
    assert.deepEqual(await amounts(), ['3 / 3 L', '2 / 5 L']);
  });

  test('nivel 3 y 5 en 6 movimientos y paso a 8, 5 y 3', async () => {
    await load();
    await play(TRES_Y_CINCO);
    assert.equal(await feedback(), '¡Perfecto! Lo lograste en el mínimo de 6 movimientos.');
    assert.deepEqual(await amounts(), ['3 / 3 L', '4 / 5 L']);
    assert.equal(await label(page.locator('.jug-column.goal .jug')), 'Jarra de 5 L, con 4 L');
    assert.ok(await page.locator('#undo').isDisabled());
    assert.ok(await page.locator('.tap.fill').first().isDisabled());

    // Resuelto: tocar las jarras no hace nada.
    await jug(1).tap();
    assert.equal(await page.locator('.jug[aria-pressed="true"]').count(), 0);

    await page.locator('#next').tap();
    assert.equal(await page.locator('.level[aria-pressed="true"]').textContent(), '8, 5 y 3');
    assert.deepEqual(await amounts(), ['8 / 8 L', '0 / 5 L', '0 / 3 L']);
    assert.equal(await count(), '0 / 7 movimientos');
  });

  test('nivel 3 y 5 con movimientos de más', async () => {
    await load();
    await play([['llenar', 0], ['vaciar', 0], ...TRES_Y_CINCO]);
    assert.equal(await feedback(), '¡Lo lograste en 8 movimientos! El mínimo es 6.');
  });

  test('nivel 8, 5 y 3: sin canilla, repartir en 4 y 4', async () => {
    await load();
    await chooseLevel('8, 5 y 3');
    assert.equal(await page.locator('.tap').count(), 0, 'no hay botones de llenar ni vaciar');
    assert.equal(await feedback(), 'Para pasar agua, tocá una jarra y después otra.');
    await jug(1).tap();
    assert.equal(await feedback(), 'La jarra de 5 L está vacía: elegí una con agua.');
    await play(OCHO_CINCO_TRES);
    assert.equal(await feedback(), '¡Perfecto! Lo lograste en el mínimo de 7 movimientos.');
    assert.deepEqual(await amounts(), ['4 / 8 L', '4 / 5 L', '0 / 3 L']);
    assert.equal(await page.locator('.jug-column.goal').count(), 2);
  });

  test('nivel 4 y 9 en 8 movimientos', async () => {
    await load();
    await chooseLevel('4 y 9');
    await play(CUATRO_Y_NUEVE);
    assert.equal(await feedback(), '¡Perfecto! Lo lograste en el mínimo de 8 movimientos.');
    assert.deepEqual(await amounts(), ['4 / 4 L', '6 / 9 L']);
    assert.ok(await page.locator('#next').isHidden(), 'después del último nivel no hay siguiente');
  });

  test('los niveles resueltos quedan marcados al recargar', async () => {
    await load();
    await play(TRES_Y_CINCO);
    await page.reload();
    assert.deepEqual(await page.locator('.level').evaluateAll(els => els.map(el => el.classList.contains('solved'))),
      [true, false, false]);
  });

  test('se puede jugar con teclado', async () => {
    await load();
    await page.locator('.tap.fill').nth(1).focus();
    await page.keyboard.press('Enter');
    assert.deepEqual(await amounts(), ['0 / 3 L', '5 / 5 L']);

    await jug(1).focus();
    await page.keyboard.press('Enter');
    assert.equal(await jug(1).getAttribute('aria-pressed'), 'true');
    await page.keyboard.press('Escape');
    assert.equal(await jug(1).getAttribute('aria-pressed'), 'false');
    assert.equal(await feedback(), 'Soltaste la jarra de 5 L.');

    await page.keyboard.press('Enter');
    await jug(0).focus();
    await page.keyboard.press('Enter');
    assert.deepEqual(await amounts(), ['3 / 3 L', '2 / 5 L']);
    assert.equal(await activeLabel(), 'Jarra de 3 L, con 3 L', 'el foco queda en la jarra que recibió el agua');
  });

  test('8, 5 y 3 entra en un celular de 360px con jarras tocables', async () => {
    await load();
    await chooseLevel('8, 5 y 3');
    assert.ok(await hasNoHorizontalScroll(page));
    const tops = await page.locator('.amount').evaluateAll(els => els.map(el => el.getBoundingClientRect().top));
    assert.equal(new Set(tops).size, 1, 'las 3 jarras entran en una fila');
    const { width, height } = await jug(2).boundingBox();
    assert.ok(width >= 44 && height >= 44, `jarra de ${width}×${height}px`);
  });

  test('3 y 5 tiene botones de canilla tocables', async () => {
    await load();
    const box = await page.locator('.tap').first().boundingBox();
    assert.ok(box.width >= 44 && box.height >= 44, `botón de ${box.width}×${box.height}px`);
    assert.ok(await hasNoHorizontalScroll(page));
  });
});
