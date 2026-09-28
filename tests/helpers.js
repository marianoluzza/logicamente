// Infraestructura compartida de las pruebas de punta a punta:
// servidor estático, navegador (Edge instalado vía playwright-core) y páginas de celular.

import { before, after } from 'node:test';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' };

// Raíz (como Vercel) y subcarpeta (como GitHub Pages).
export const PREFIXES = ['/', '/logicamente/'];

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

// Levanta el navegador y los servidores para el archivo de pruebas que la llame.
export const useSite = () => {
  before(async () => {
    browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL ?? 'msedge' });
    for (const prefix of PREFIXES) {
      const server = serve(prefix);
      servers[prefix] = { server, base: `http://127.0.0.1:${await listen(server)}${prefix}` };
    }
  });

  after(async () => {
    await browser?.close();
    Object.values(servers).forEach(({ server }) => server.close());
  });
};

export const siteUrl = (path = '', prefix = '/logicamente/') => `${servers[prefix].base}${path}`;

// Página de celular que registra errores de consola y requests fallidos.
export const openPage = async () => {
  const context = await browser.newContext({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  page.problems = [];
  page.on('pageerror', error => page.problems.push(`pageerror: ${error.message}`));
  page.on('console', msg => msg.type() === 'error' && page.problems.push(`console: ${msg.text()} (${msg.location().url})`));
  page.on('response', response => response.status() >= 400 && page.problems.push(`${response.status()} ${response.url()}`));
  return page;
};

export const hasNoHorizontalScroll = page => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

// La librería de QR del diálogo de compartir se sirve desde node_modules: mismo archivo que el CDN
// (coincide el hash de integridad), sin depender de la red.
export const QR_LIBRARY_URL = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js';
export const mockQrLibrary = page => page.route(QR_LIBRARY_URL, route => route.fulfill({
  path: join(ROOT, 'node_modules/qrcode-generator/qrcode.js'),
  contentType: 'text/javascript',
  headers: { 'Access-Control-Allow-Origin': '*' },
}));
