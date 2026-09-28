// Buzón de opiniones: formulario, envío al Google Form (interceptado), agradecimiento y errores.
// Uso: npm test   (BROWSER_CHANNEL=chrome npm test para usar Chrome)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { useSite, siteUrl, openPage, hasNoHorizontalScroll } from './helpers.js';

useSite();

const FORM = 'https://docs.google.com/forms/d/e/1FAIpQLSdv5tJEm5kWS_02t1NdXUPEYzNFPlnhDwSv-muedKbG-LfAdQ';
const GOOGLE = 'https://docs.google.com/**';

// Nunca se envía nada real: los pedidos a Google se interceptan y se guardan para revisarlos.
const open = async path => {
  const page = await openPage();
  page.sent = [];
  await page.route(GOOGLE, route => {
    page.sent.push({ url: route.request().url(), body: Object.fromEntries(new URLSearchParams(route.request().postData())) });
    return route.fulfill({ status: 200, body: '' });
  });
  await page.goto(siteUrl(path));
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  return page;
};
const status = page => page.locator('.opinion-status').textContent();
const send = page => page.locator('.opinion [type="submit"]').tap();

test('el inicio pregunta por el sitio y envía la opinión como logicamente/portada', async () => {
  const page = await open('');
  assert.equal(await page.locator('.opinion-question').textContent(), '¿Qué te pareció Lógicamente?');

  await send(page);
  assert.equal(await status(page), 'Elegí una reacción o escribí algo antes de enviar.');
  assert.equal(page.sent.length, 0);

  await page.locator('.opinion-reaction', { hasText: 'Bien' }).tap();
  await page.locator('.opinion textarea').fill('  Más niveles de luces  ');
  await send(page);
  await page.locator('.opinion-thanks').waitFor();

  assert.deepEqual(page.sent, [{
    url: `${FORM}/formResponse`,
    body: {
      'entry.813562710': 'logicamente/portada',
      'entry.1989693293': '🙂 Bien',
      'entry.1490432713': 'Más niveles de luces',
    },
  }]);
  assert.equal(await page.locator('.opinion-thanks').textContent(), '¡Gracias! Tu opinión nos ayuda a mejorar.');
  assert.equal(await page.evaluate(() => document.activeElement.className), 'opinion-thanks');

  // Queda recordado en este navegador, solo para ese lugar.
  await page.reload();
  assert.ok(await page.locator('.opinion-thanks').isVisible());
  await page.goto(siteUrl('desafios/reinas/'));
  assert.equal(await page.locator('.opinion-question').textContent(), '¿Qué te pareció este desafío?');

  assert.deepEqual(page.problems, []);
  await page.context().close();
});

test('cada desafío se identifica en el envío, aunque sea solo un comentario', async () => {
  const page = await open('desafios/jarras/');
  await page.locator('.opinion textarea').fill('El de 4 y 9 me costó');
  await send(page);
  await page.locator('.opinion-thanks').waitFor();
  assert.equal(page.sent[0].body['entry.813562710'], 'logicamente/jarras');
  assert.equal(page.sent[0].body['entry.1989693293'], '');

  assert.deepEqual(page.problems, []);
  await page.context().close();
});

test('si falla el envío, ofrece el formulario de Google', async () => {
  const page = await open('desafios/clave/');
  await page.unroute(GOOGLE);
  await page.route(GOOGLE, route => route.abort());

  await page.locator('.opinion-reaction', { hasText: 'Genial' }).tap();
  await send(page);
  const link = page.locator('.opinion-status a');
  await link.waitFor();
  assert.equal(await status(page), 'No se pudo enviar. Probá desde Google Forms.');
  const href = new URL(await link.getAttribute('href'));
  assert.equal(href.origin + href.pathname, `${FORM}/viewform`);
  assert.equal(href.searchParams.get('entry.813562710'), 'logicamente/clave');
  assert.equal(await page.locator('.opinion [type="submit"]').isDisabled(), false, 'se puede reintentar');

  assert.ok(page.problems.every(problem => /Failed to load resource/.test(problem)), page.problems.join('\n'));
  await page.context().close();
});

test('el buzón entra en un celular de 360px con reacciones tocables', async () => {
  const page = await open('desafios/rio/');
  assert.ok(await hasNoHorizontalScroll(page));
  const heights = await page.locator('.opinion-reaction > span').evaluateAll(els => els.map(el => el.getBoundingClientRect().height));
  assert.ok(heights.every(height => height >= 44), `reacciones de ${heights}px`);

  assert.deepEqual(page.problems, []);
  await page.context().close();
});
