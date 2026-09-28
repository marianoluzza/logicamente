// Compartir con QR: diálogo, URL limpia, alternar entre desafío e inicio, copiar y errores.
// Uso: npm test   (BROWSER_CHANNEL=chrome npm test para usar Chrome)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { useSite, siteUrl, openPage, mockQrLibrary, QR_LIBRARY_URL } from './helpers.js';

useSite();

const qrcode = createRequire(import.meta.url)('qrcode-generator');

// Los módulos oscuros que debería dibujar el QR de un texto, en el mismo formato que el sitio.
const qrPath = text => {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  let path = '';
  for (let row = 0; row < qr.getModuleCount(); row++) {
    for (let col = 0; col < qr.getModuleCount(); col++) {
      if (qr.isDark(row, col)) path += `M${col + 4} ${row + 4}h1v1h-1z`;
    }
  }
  return path;
};

const bare = url => url.replace(/^https?:\/\//, '');

const open = async path => {
  const page = await openPage();
  await mockQrLibrary(page);
  await page.goto(siteUrl(path));
  return page;
};
const isOpen = page => page.locator('.share-dialog').evaluate(el => el.open);
const shownUrl = page => page.locator('.share-url').textContent();
const drawnPath = async page => {
  await page.locator('.share-qr svg').waitFor();
  return page.locator('.share-qr svg path').getAttribute('d');
};

test('en el inicio comparte la portada', async () => {
  const page = await open('');
  const button = page.locator('[data-share-open]');
  const box = await button.boundingBox();
  assert.ok(box.width >= 44 && box.height >= 44, `botón de ${box.width}×${box.height}px`);

  await button.tap();
  assert.ok(await isOpen(page));
  assert.ok(await page.locator('.share-toggle').isHidden(), 'en el inicio no hay nada que alternar');
  assert.equal(await shownUrl(page), bare(siteUrl('')));
  assert.equal(await drawnPath(page), qrPath(siteUrl('')));
  assert.equal(await page.locator('.share-qr').getAttribute('aria-label'), `Código QR para abrir ${bare(siteUrl(''))}`);

  await page.locator('.share-close').tap();
  assert.equal(await isOpen(page), false);

  assert.deepEqual(page.problems, []);
  await page.context().close();
});

test('en un desafío comparte la página sin la semilla, o el inicio', async () => {
  const page = await open('desafios/luces/?semilla=5');
  await page.locator('[data-share-open]').tap();
  assert.equal(await page.locator('.share-toggle [aria-pressed="true"]').textContent(), 'Este desafío');
  assert.equal(await shownUrl(page), bare(siteUrl('desafios/luces/')));
  assert.equal(await drawnPath(page), qrPath(siteUrl('desafios/luces/')));

  await page.locator('[data-share-target="home"]').tap();
  assert.equal(await shownUrl(page), bare(siteUrl('')));
  assert.equal(await drawnPath(page), qrPath(siteUrl('')));

  // Escape cierra y al volver a abrir arranca en "Este desafío".
  await page.keyboard.press('Escape');
  assert.equal(await isOpen(page), false);
  await page.locator('[data-share-open]').tap();
  assert.equal(await shownUrl(page), bare(siteUrl('desafios/luces/')));

  // Tocar el fondo también cierra.
  await page.mouse.click(5, 5);
  assert.equal(await isOpen(page), false);

  assert.deepEqual(page.problems, []);
  await page.context().close();
});

test('copiar el enlace', async () => {
  const page = await open('desafios/clave/');
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.locator('[data-share-open]').tap();
  await page.locator('[data-share-copy]').tap();
  assert.equal(await page.locator('.share-status').textContent(), '¡Enlace copiado!');
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), siteUrl('desafios/clave/'));

  assert.deepEqual(page.problems, []);
  await page.context().close();
});

test('si no carga la librería de QR, avisa y reintenta al volver a abrir', async () => {
  const page = await openPage();
  await page.route(QR_LIBRARY_URL, route => route.abort());
  await page.goto(siteUrl('desafios/hanoi/'));
  await page.locator('[data-share-open]').tap();
  await page.locator('.share-qr.error').waitFor();
  assert.equal(await page.locator('.share-qr').textContent(), 'No se pudo generar el QR. Podés copiar el enlace de abajo.');
  assert.equal(await shownUrl(page), bare(siteUrl('desafios/hanoi/')));

  await page.unroute(QR_LIBRARY_URL);
  await mockQrLibrary(page);
  await page.locator('.share-close').tap();
  await page.locator('[data-share-open]').tap();
  assert.equal(await drawnPath(page), qrPath(siteUrl('desafios/hanoi/')));

  // El único problema esperado es el pedido cortado a propósito.
  assert.ok(page.problems.every(problem => /Failed to load resource/.test(problem)), page.problems.join('\n'));
  await page.context().close();
});
