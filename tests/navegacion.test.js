// Navegación entre el inicio y los desafíos, servida en la raíz y bajo /logicamente/.
// Uso: npm test   (BROWSER_CHANNEL=chrome npm test para usar Chrome)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PREFIXES, useSite, siteUrl, openPage, hasNoHorizontalScroll } from './helpers.js';

useSite();

// Cada desafío: título de la tarjeta, carpeta y un elemento que prueba que el juego arrancó.
const CHALLENGES = [
  { title: 'Torres de Hanoi', path: 'desafios/hanoi/', ready: '.disk', count: 3 },
  { title: 'Las ocho reinas', path: 'desafios/reinas/', ready: '.cell', count: 16 },
  { title: 'El cruce del río', path: 'desafios/rio/', ready: '.character', count: 4 },
  { title: 'Las jarras de agua', path: 'desafios/jarras/', ready: '.jug', count: 2 },
  { title: 'Luces fuera', path: 'desafios/luces/', ready: '.bulb', count: 9 },
  { title: 'Clave secreta', path: 'desafios/clave/', ready: '.key', count: 4 },
];

test('el inicio enlaza los desafíos disponibles', async () => {
  const page = await openPage();
  await page.goto(siteUrl());

  assert.equal(await page.title(), 'Lógicamente — Desafíos de lógica');
  assert.equal(await page.locator('#overall').textContent(), `${CHALLENGES.length} desafíos`);
  assert.deepEqual(await page.locator('a.challenge h3').allTextContents(), CHALLENGES.map(c => c.title));
  // El CSS compartido cargó si la marca tiene el fondo amarillo.
  assert.equal(await page.locator('.brand-mark').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(245, 200, 76)');
  assert.ok(await hasNoHorizontalScroll(page), 'el inicio no debe tener scroll horizontal');

  assert.deepEqual(page.problems, []);
  await page.context().close();
});

test('el inicio muestra el avance guardado de cada desafío', async () => {
  const page = await openPage();
  await page.goto(siteUrl());
  const badges = () => page.locator('.challenge .badge').evaluateAll(els => els.map(el => [el.dataset.state, el.textContent]));

  await page.evaluate(() => localStorage.clear());
  await page.reload();
  assert.deepEqual(await badges(), [
    ['new', '3 niveles'], ['new', '3 niveles'], ['new', '2 niveles'], ['new', '3 niveles'], ['new', '3 niveles'], ['new', '3 niveles'],
  ]);

  // Mismos formatos que guarda cada juego: números o ids, y datos de más o rotos se ignoran.
  // Hanoi guardaba solo "3" cuando tenía un único nivel: ahora cuenta como 1 de 3.
  await page.evaluate(() => {
    localStorage.setItem('logicamente:hanoi:resueltos', '["3"]');
    localStorage.setItem('logicamente:reinas:resueltos', '[4, 8]');
    localStorage.setItem('logicamente:rio:resueltos', '["granjero", "ovejas", "viejo"]');
    localStorage.setItem('logicamente:luces:resueltos', 'no es json');
    localStorage.setItem('logicamente:clave:resueltos', '["clasico"]');
  });
  await page.reload();
  assert.deepEqual(await badges(), [
    ['partial', '1 de 3 niveles'], ['partial', '2 de 3 niveles'], ['complete', '✓ Completo'],
    ['new', '3 niveles'], ['new', '3 niveles'], ['partial', '1 de 3 niveles'],
  ]);
  assert.equal(await page.locator('#overall').textContent(), '1 de 6 completos');
  assert.equal(await page.locator('.challenge.complete').count(), 1);
  // El borde pasa a menta con una transición corta: se espera el color final.
  await page.waitForFunction(() =>
    getComputedStyle(document.querySelector('.challenge.complete')).borderTopColor === 'rgb(120, 224, 193)', null, { timeout: 2000 });
  assert.equal(await page.locator('.challenge').nth(1).locator('.dots .on').count(), 2);

  assert.deepEqual(page.problems, []);
  await page.context().close();
});

for (const prefix of PREFIXES) {
  for (const { title, path, ready, count } of CHALLENGES) {
    test(`inicio → ${title} → inicio servido en ${prefix}`, async () => {
      const page = await openPage();
      await page.goto(siteUrl('', prefix));

      await page.locator('a.challenge', { hasText: title }).tap();
      await page.waitForURL(siteUrl(path, prefix));
      assert.equal(await page.locator(ready).count(), count);
      assert.ok(await hasNoHorizontalScroll(page), `${title} no debe tener scroll horizontal`);

      await page.locator('.back').tap();
      await page.waitForURL(siteUrl('', prefix));

      assert.deepEqual(page.problems, []);
      await page.context().close();
    });
  }
}

test('una URL sin barra final redirige y carga los estilos', async () => {
  const page = await openPage();
  await page.goto(siteUrl('desafios/hanoi'));

  assert.equal(page.url(), siteUrl('desafios/hanoi/'));
  assert.equal(await page.locator('.tower').first().evaluate(el => getComputedStyle(el).flexDirection), 'column-reverse');
  assert.deepEqual(page.problems, []);
  await page.context().close();
});
