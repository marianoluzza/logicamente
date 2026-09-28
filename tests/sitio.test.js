// Pruebas de punta a punta con playwright-core y el Edge instalado en la máquina.
// Uso: npm test   (BROWSER_CHANNEL=chrome npm test para usar Chrome)

import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' };

// Servidor estático que imita GitHub Pages: sirve el repo bajo un prefijo
// y redirige las carpetas sin barra final.
const serve = prefix => createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://x');
  if (!pathname.startsWith(prefix)) return res.writeHead(404).end();

  const file = join(ROOT, normalize(decodeURIComponent(pathname.slice(prefix.length))));
  try {
    if ((await stat(file)).isDirectory()) {
      if (!pathname.endsWith('/')) return res.writeHead(301, { Location: `${pathname}/` }).end();
      return res.writeHead(200, { 'Content-Type': TYPES['.html'] }).end(await readFile(join(file, 'index.html')));
    }
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(await readFile(file));
  } catch {
    res.writeHead(404).end();
  }
});

const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));

let browser;
const servers = {};

before(async () => {
  browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL ?? 'msedge' });
  for (const prefix of ['/', '/logicamente/']) {
    const server = serve(prefix);
    servers[prefix] = { server, base: `http://127.0.0.1:${await listen(server)}${prefix}` };
  }
});

after(async () => {
  await browser?.close();
  Object.values(servers).forEach(({ server }) => server.close());
});

// Página de celular que registra errores de consola y requests fallidos.
const openPage = async () => {
  const context = await browser.newContext({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  page.problems = [];
  page.on('pageerror', error => page.problems.push(`pageerror: ${error.message}`));
  page.on('console', msg => msg.type() === 'error' && page.problems.push(`console: ${msg.text()} (${msg.location().url})`));
  page.on('response', response => response.status() >= 400 && page.problems.push(`${response.status()} ${response.url()}`));
  return page;
};

const hasNoHorizontalScroll = page => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

describe('navegación', () => {
  for (const prefix of ['/', '/logicamente/']) {
    test(`inicio → Hanoi → inicio servido en ${prefix}`, async () => {
      const page = await openPage();
      await page.goto(servers[prefix].base);

      assert.equal(await page.title(), 'Lógicamente — Desafíos de lógica');
      // El CSS compartido cargó si la marca tiene el fondo amarillo.
      assert.equal(await page.locator('.brand-mark').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(245, 200, 76)');
      assert.ok(await hasNoHorizontalScroll(page), 'el inicio no debe tener scroll horizontal');

      await page.locator('a.challenge', { hasText: 'Torres de Hanoi' }).tap();
      await page.waitForURL(`${servers[prefix].base}desafios/hanoi/`);
      assert.equal(await page.locator('.disk').count(), 3);
      assert.ok(await hasNoHorizontalScroll(page), 'Hanoi no debe tener scroll horizontal');

      await page.locator('.back').tap();
      await page.waitForURL(servers[prefix].base);

      assert.deepEqual(page.problems, []);
      await page.context().close();
    });
  }

  test('una URL sin barra final redirige y carga los estilos', async () => {
    const page = await openPage();
    await page.goto(`${servers['/logicamente/'].base}desafios/hanoi`);

    assert.equal(page.url(), `${servers['/logicamente/'].base}desafios/hanoi/`);
    assert.equal(await page.locator('.tower').first().evaluate(el => getComputedStyle(el).flexDirection), 'column-reverse');
    assert.deepEqual(page.problems, []);
    await page.context().close();
  });
});

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

  before(async () => {
    page = await openPage();
  });

  after(async () => {
    assert.deepEqual(page.problems, []);
    await page.context().close();
  });

  const load = () => page.goto(`${servers['/logicamente/'].base}desafios/hanoi/`);

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

  test('las torres anuncian cuántos discos tienen', async () => {
    await load();
    await play([[0, 1]]);
    assert.deepEqual(await towers().evaluateAll(els => els.map(el => el.getAttribute('aria-label'))),
      ['Origen: 2 discos', 'Auxiliar: 1 disco', 'Destino: 0 discos']);
  });
});
