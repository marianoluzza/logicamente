// El cruce del río: niveles, reglas de cada orilla, deshacer y accesibilidad.
// Uso: npm test   (BROWSER_CHANNEL=chrome npm test para usar Chrome)

import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { useSite, siteUrl, openPage, hasNoHorizontalScroll } from './helpers.js';

useSite();

// Soluciones óptimas: cada viaje dice cuántos de cada tipo suben al bote.
const GRANJERO = [
  { granjero: 1, cabra: 1 },
  { granjero: 1 },
  { granjero: 1, lobo: 1 },
  { granjero: 1, cabra: 1 },
  { granjero: 1, repollo: 1 },
  { granjero: 1 },
  { granjero: 1, cabra: 1 },
];

const OVEJAS = [
  { lobo: 2 }, { lobo: 1 }, { lobo: 2 }, { lobo: 1 },
  { oveja: 2 }, { oveja: 1, lobo: 1 }, { oveja: 2 },
  { lobo: 1 }, { lobo: 2 }, { lobo: 1 }, { lobo: 2 },
];

describe('El cruce del río', () => {
  let page;
  const feedback = () => page.locator('#feedback').textContent();
  const count = () => page.locator('#count').textContent();
  const boatSide = async () => ((await page.locator('#boat.at-arrival').count()) ? 1 : 0);
  const ids = selector => page.locator(`${selector} .character`).evaluateAll(els => els.map(el => el.dataset.id));
  const activeId = () => page.evaluate(() => document.activeElement.id || document.activeElement.dataset.id);

  // Sube desde la orilla del bote los primeros n personajes de cada tipo.
  const board = async load => {
    const side = await boatSide();
    for (const [kind, n] of Object.entries(load)) {
      for (let i = 0; i < n; i++) await page.locator(`#bank-${side} .character[data-kind="${kind}"]`).first().tap();
    }
  };
  const trip = async load => {
    await board(load);
    await page.locator('#cross').tap();
  };
  const play = async trips => {
    for (const load of trips) await trip(load);
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
    await page.goto(siteUrl('desafios/rio/'));
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  };

  test('estado inicial', async () => {
    await load();
    assert.deepEqual(await ids('#bank-0'), ['granjero', 'lobo', 'cabra', 'repollo']);
    assert.deepEqual(await ids('#boat'), []);
    assert.equal(await boatSide(), 0);
    assert.equal(await count(), '0 / 7 viajes');
    assert.equal(await page.locator('.level[aria-pressed="true"]').textContent(), 'Granjero');
    assert.ok(await page.locator('#undo').isDisabled());
    assert.ok(await page.locator('#next').isHidden());
    // Los SVG de los personajes cargaron.
    assert.ok(await page.locator('.character img').evaluateAll(imgs => imgs.every(img => img.complete && img.naturalWidth > 0)));
  });

  test('subir y bajar del bote, con capacidad para dos', async () => {
    await load();
    await board({ cabra: 1 });
    assert.deepEqual(await ids('#boat'), ['cabra']);
    assert.equal(await page.locator('[data-id="cabra"]').getAttribute('aria-label'), 'Cabra, en el bote');

    await board({ granjero: 1, lobo: 1 });
    assert.equal(await feedback(), 'En el bote entran 2.');
    assert.deepEqual(await ids('#boat'), ['granjero', 'cabra']);

    await page.locator('#boat [data-id="cabra"]').tap();
    assert.deepEqual(await ids('#boat'), ['granjero']);
    assert.equal(await feedback(), 'Cabra baja del bote.');
  });

  test('no se puede cruzar sin remero ni sin el granjero', async () => {
    await load();
    await page.locator('#cross').tap();
    assert.equal(await feedback(), 'Alguien tiene que remar.');

    await board({ cabra: 1 });
    await page.locator('#cross').tap();
    assert.equal(await feedback(), 'Solo el granjero sabe remar.');
    assert.equal(await boatSide(), 0);
    assert.equal(await count(), '0 / 7 viajes');
  });

  test('no se puede subir a alguien de la otra orilla', async () => {
    await load();
    await trip({ granjero: 1, cabra: 1 });
    await page.locator('#bank-0 [data-id="lobo"]').tap();
    assert.equal(await feedback(), 'El bote está en la otra orilla.');
    assert.deepEqual(await ids('#boat'), []);
  });

  test('un viaje prohibido se muestra y se deshace', async () => {
    await load();
    await trip({ granjero: 1, repollo: 1 });
    assert.equal(await feedback(), 'El lobo se comió a la cabra. Deshacé el viaje para seguir.');
    assert.deepEqual(await ids('#bank-0'), ['lobo', 'cabra']);
    assert.deepEqual(await page.locator('.character.culprit').evaluateAll(els => els.map(el => el.dataset.id)), ['lobo', 'cabra']);
    assert.ok(await page.locator('#cross').isDisabled());
    assert.ok(await page.locator('#undo.primary').isVisible());

    // Bloqueado: tocar personajes no hace nada.
    await page.locator('[data-id="granjero"]').tap();
    assert.deepEqual(await ids('#boat'), []);

    await page.locator('#undo').tap();
    assert.equal(await feedback(), 'Viaje deshecho.');
    assert.equal(await count(), '0 / 7 viajes');
    assert.equal(await boatSide(), 0);
    assert.equal(await page.locator('.character.culprit').count(), 0);
    assert.deepEqual(await ids('#bank-0'), ['granjero', 'lobo', 'cabra', 'repollo']);
  });

  test('deshacer en medio de la partida vuelve un viaje atrás', async () => {
    await load();
    await play(GRANJERO.slice(0, 3));
    assert.equal(await count(), '3 / 7 viajes');
    await page.locator('#undo').tap();
    assert.equal(await count(), '2 / 7 viajes');
    assert.equal(await boatSide(), 0);
    assert.deepEqual(await ids('#bank-1'), ['cabra']);
  });

  test('nivel Granjero en 7 viajes y paso a Ovejas y lobos', async () => {
    await load();
    await play(GRANJERO);
    assert.equal(await feedback(), '¡Perfecto! Cruzaste en el mínimo de 7 viajes.');
    assert.deepEqual(await ids('#bank-1'), ['granjero', 'lobo', 'cabra', 'repollo']);
    assert.equal(await count(), '7 / 7 viajes');
    assert.ok(await page.locator('#undo').isDisabled());

    await page.locator('#next').tap();
    assert.equal(await page.locator('.level[aria-pressed="true"]').textContent(), 'Ovejas y lobos');
    assert.equal(await page.locator('#bank-0 .character').count(), 6);
    assert.equal(await count(), '0 / 11 viajes');
  });

  test('nivel Granjero con viajes de más', async () => {
    await load();
    await play([{ granjero: 1, cabra: 1 }, { granjero: 1, cabra: 1 }, ...GRANJERO]);
    assert.equal(await feedback(), '¡Lo lograste en 9 viajes! El mínimo es 7.');
  });

  test('nivel Ovejas y lobos en 11 viajes', async () => {
    await load();
    await page.locator('.level', { hasText: 'Ovejas y lobos' }).tap();
    await play(OVEJAS);
    assert.equal(await feedback(), '¡Perfecto! Cruzaste en el mínimo de 11 viajes.');
    assert.equal(await page.locator('#bank-1 .character').count(), 6);
    assert.ok(await page.locator('#next').isHidden(), 'después del último nivel no hay siguiente');
  });

  test('en Ovejas y lobos no puede haber más lobos que ovejas', async () => {
    await load();
    await page.locator('.level', { hasText: 'Ovejas y lobos' }).tap();
    await trip({ oveja: 2 });
    assert.equal(await feedback(), 'Los lobos superan a las ovejas en la orilla de partida. Deshacé el viaje para seguir.');
    assert.equal(await page.locator('#bank-0 .character.culprit').count(), 4);
  });

  test('los niveles resueltos quedan marcados al recargar', async () => {
    await load();
    await play(GRANJERO);
    await page.reload();
    assert.deepEqual(await page.locator('.level').evaluateAll(els => els.map(el => el.classList.contains('solved'))),
      [true, false]);
  });

  test('se puede jugar con teclado', async () => {
    await load();
    await page.locator('[data-id="granjero"]').focus();
    await page.keyboard.press('Enter');
    assert.deepEqual(await ids('#boat'), ['granjero']);
    assert.equal(await activeId(), 'granjero', 'el foco sigue al personaje que subió');

    await page.keyboard.press('Tab');
    assert.equal(await activeId(), 'cross');
    await page.keyboard.press('Enter');
    assert.equal(await feedback(), 'El lobo se comió a la cabra. Deshacé el viaje para seguir.');
    assert.equal(await activeId(), 'undo', 'tras un error el foco pasa a Deshacer');

    await page.keyboard.press('Enter');
    assert.equal(await activeId(), 'cross', 'sin historial, el foco vuelve a Cruzar');
  });

  test('Ovejas y lobos entra en un celular de 360px con personajes tocables', async () => {
    await load();
    await page.locator('.level', { hasText: 'Ovejas y lobos' }).tap();
    assert.ok(await hasNoHorizontalScroll(page));
    const tops = await page.locator('#bank-0 .character').evaluateAll(els => els.map(el => el.getBoundingClientRect().top));
    assert.equal(new Set(tops).size, 1, 'los 6 personajes entran en una fila');
    const { width, height } = await page.locator('.character').first().boundingBox();
    assert.ok(width >= 44 && height >= 44, `personaje de ${width}×${height}px`);
  });
});
