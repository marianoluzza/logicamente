// Torres de Hanoi: reglas, resolución y accesibilidad.
// Uso: npm test   (BROWSER_CHANNEL=chrome npm test para usar Chrome)

import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { useSite, siteUrl, openPage, hasNoHorizontalScroll } from './helpers.js';

useSite();

describe('Torres de Hanoi', () => {
  let page;
  const towers = () => page.locator('.tower');
  const tap = index => towers().nth(index).tap();
  const feedback = () => page.locator('#feedback').textContent();
  const moves = () => page.locator('#moves').textContent();
  const diskCounts = () => towers().evaluateAll(els => els.map(el => el.querySelectorAll('.disk').length));
  const play = async steps => {
    for (const [from, to] of steps) {
      await tap(from);
      await tap(to);
    }
  };

  const OPTIMAL = [[0, 2], [0, 1], [2, 1], [0, 2], [1, 0], [1, 2], [0, 2]];
  // Solución óptima para n discos: pasar n-1 a la auxiliar, el grande al destino y los n-1 encima.
  const solve = (n, from = 0, to = 2, via = 1) =>
    n ? [...solve(n - 1, from, via, to), [from, to], ...solve(n - 1, via, to, from)] : [];
  const pressedLevel = () => page.locator('.level[aria-pressed="true"]').textContent();

  before(async () => {
    page = await openPage();
  });

  after(async () => {
    assert.deepEqual(page.problems, []);
    await page.context().close();
  });

  const load = () => page.goto(siteUrl('desafios/hanoi/'));

  test('estado inicial', async () => {
    await load();
    assert.equal(await moves(), '0 / 7');
    assert.equal(await page.locator('#tip').textContent(), 'Mínimo posible: 7 movimientos');
    assert.equal(await feedback(), 'Objetivo: llevar los 3 discos a la torre de destino.');
    assert.deepEqual(await diskCounts(), [3, 0, 0]);
  });

  test('los discos se apilan de mayor (abajo) a menor (arriba)', async () => {
    await load();
    const boxes = await towers().nth(0).locator('.disk').evaluateAll(els =>
      els.map(el => el.getBoundingClientRect()).map(({ top, width }) => ({ top, width })));
    const bottomToTop = [...boxes].sort((a, b) => b.top - a.top);
    assert.ok(bottomToTop[0].width > bottomToTop[1].width && bottomToTop[1].width > bottomToTop[2].width,
      `anchos de abajo hacia arriba: ${bottomToTop.map(b => Math.round(b.width)).join(', ')}`);
  });

  test('elegir una torre levanta el disco superior y marca destinos válidos', async () => {
    await load();
    await tap(0);
    assert.equal(await feedback(), 'Ahora elegí la torre de destino.');
    assert.deepEqual(await towers().evaluateAll(els => els.map(el => el.className)),
      ['tower active', 'tower target', 'tower target']);

    // El disco de arriba (el más chico) se desplaza; los demás no.
    const transforms = await towers().nth(0).locator('.disk').evaluateAll(els =>
      els.map(el => ({ size: el.className, lifted: getComputedStyle(el).transform !== 'none' })));
    assert.deepEqual(transforms.filter(d => d.lifted).map(d => d.size), ['disk d1']);
  });

  test('tocar la misma torre cancela la selección', async () => {
    await load();
    await tap(0);
    await tap(0);
    assert.equal(await feedback(), 'Movimiento cancelado.');
    assert.equal(await page.locator('.tower.active').count(), 0);
    assert.equal(await moves(), '0 / 7');
  });

  test('no se puede elegir una torre vacía', async () => {
    await load();
    await tap(1);
    assert.equal(await feedback(), 'Elegí una torre que tenga discos.');
    assert.equal(await page.locator('.tower.active').count(), 0);
  });

  test('rechaza poner un disco grande sobre uno chico', async () => {
    await load();
    await play([[0, 2]]);
    await tap(0);
    assert.equal(await page.locator('.tower.target').count(), 1, 'solo la torre vacía debería marcarse');
    await tap(2);
    assert.equal(await feedback(), 'Ese disco es más chico. Probá otra torre.');
    assert.deepEqual(await diskCounts(), [2, 0, 1]);
    assert.equal(await moves(), '1 / 7');
  });

  test('resolución óptima en 7 movimientos', async () => {
    await load();
    await play(OPTIMAL);
    assert.equal(await moves(), '7 / 7');
    assert.equal(await feedback(), '¡Perfecto! Lo resolviste en el mínimo de movimientos.');
    assert.deepEqual(await diskCounts(), [0, 0, 3]);

    // Una vez resuelto, el tablero ya no responde.
    await tap(2);
    assert.equal(await page.locator('.tower.active').count(), 0);

    // Queda guardado para mostrar el avance en el inicio.
    assert.equal(await page.evaluate(() => localStorage.getItem('logicamente:hanoi:resueltos')), '["3"]');
  });

  test('resolución con movimientos de más', async () => {
    await load();
    await play([[0, 1], [1, 2], ...OPTIMAL.slice(1)]);
    assert.equal(await moves(), '8 / 7');
    assert.equal(await feedback(), '¡Resuelto en 8 movimientos! El mínimo era 7.');
  });

  test('reiniciar vuelve al estado inicial', async () => {
    await load();
    await play(OPTIMAL.slice(0, 3));
    await page.locator('#reset').tap();
    assert.equal(await moves(), '0 / 7');
    assert.deepEqual(await diskCounts(), [3, 0, 0]);
  });

  test('se puede jugar con teclado', async () => {
    await load();
    await towers().nth(0).focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Space');
    assert.deepEqual(await diskCounts(), [2, 0, 1]);
  });

  test('arranca en 3 discos y se puede cambiar de nivel', async () => {
    await load();
    assert.equal(await pressedLevel(), '3 discos');
    assert.equal(await page.locator('.level').count(), 3);

    await page.locator('.level', { hasText: '5 discos' }).tap();
    assert.equal(await pressedLevel(), '5 discos');
    assert.equal(await moves(), '0 / 31');
    assert.equal(await page.locator('#tip').textContent(), 'Mínimo posible: 31 movimientos');
    assert.equal(await feedback(), 'Objetivo: llevar los 5 discos a la torre de destino.');
    assert.deepEqual(await diskCounts(), [5, 0, 0]);

    // Reiniciar se queda en el nivel elegido.
    await play([[0, 1]]);
    await page.locator('#reset').tap();
    assert.equal(await pressedLevel(), '5 discos');
    assert.deepEqual(await diskCounts(), [5, 0, 0]);
  });

  test('al resolver un nivel se marca y se puede pasar al siguiente', async () => {
    await load();
    await page.evaluate(() => localStorage.clear());
    await load();
    assert.equal(await page.locator('#next').isHidden(), true);

    await play(OPTIMAL);
    assert.equal(await page.locator('.level.solved').count(), 1);
    assert.equal(await page.locator('#next').isVisible(), true);
    // El foco pasa al botón para seguir con el teclado.
    assert.equal(await page.evaluate(() => document.activeElement.id), 'next');

    await page.locator('#next').tap();
    assert.equal(await pressedLevel(), '4 discos');
    assert.equal(await page.locator('#next').isHidden(), true);
    await play(solve(4));
    assert.equal(await moves(), '15 / 15');
    assert.equal(await feedback(), '¡Perfecto! Lo resolviste en el mínimo de movimientos.');

    await page.locator('#next').tap();
    await play(solve(5));
    assert.equal(await moves(), '31 / 31');
    assert.deepEqual(await diskCounts(), [0, 0, 5]);
    // Es el último nivel: no hay siguiente.
    assert.equal(await page.locator('#next').isHidden(), true);
    assert.equal(await page.locator('.level.solved').count(), 3);
    assert.deepEqual(JSON.parse(await page.evaluate(() => localStorage.getItem('logicamente:hanoi:resueltos'))), ['3', '4', '5']);

    // Al volver, los niveles resueltos siguen marcados.
    await load();
    assert.equal(await page.locator('.level.solved').count(), 3);
  });

  for (const width of [320, 360]) {
    test(`5 discos entran en la torre en un celular de ${width}px`, async () => {
      await page.setViewportSize({ width, height: 740 });
      await load();
      await page.locator('.level', { hasText: '5 discos' }).tap();

      const { tower, disks } = await towers().nth(0).evaluate(el => ({
        tower: el.getBoundingClientRect().toJSON(),
        disks: [...el.querySelectorAll('.disk')].map(d => d.getBoundingClientRect().toJSON()),
      }));
      disks.forEach(d => assert.ok(d.left >= tower.left && d.right <= tower.right && d.top >= tower.top,
        `disco fuera de la torre: ${JSON.stringify(d)}`));
      // Cada disco, bien distinguible del de abajo.
      const bottomToTop = [...disks].sort((a, b) => b.top - a.top);
      bottomToTop.slice(1).forEach((d, i) => assert.ok(bottomToTop[i].width - d.width >= 8,
        `anchos de abajo hacia arriba: ${bottomToTop.map(b => Math.round(b.width)).join(', ')}`));
      assert.ok(await hasNoHorizontalScroll(page));
      await page.setViewportSize({ width: 360, height: 740 });
    });
  }

  test('las torres anuncian cuántos discos tienen', async () => {
    await load();
    await play([[0, 1]]);
    assert.deepEqual(await towers().evaluateAll(els => els.map(el => el.getAttribute('aria-label'))),
      ['Origen: 2 discos', 'Auxiliar: 1 disco', 'Destino: 0 discos']);
  });
});
