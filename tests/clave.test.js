// Clave secreta: armar intentos, pistas, ganar y perder, semilla, niveles y accesibilidad.
// Uso: npm test   (BROWSER_CHANNEL=chrome npm test para usar Chrome)

import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { useSite, siteUrl, openPage, hasNoHorizontalScroll } from './helpers.js';

useSite();

const SEED = 2026;
const NAMES = ['círculo', 'triángulo', 'cuadrado', 'rombo', 'estrella', 'cruz'];

// Puntaje propio de las pruebas: figuras en su lugar y figuras en común en otro lugar.
const score = (secret, guess) => {
  const exact = guess.filter((s, i) => s === secret[i]).length;
  const common = NAMES.reduce((sum, _, symbol) =>
    sum + Math.min(secret.filter(s => s === symbol).length, guess.filter(s => s === symbol).length), 0);
  return { exact, near: common - exact };
};

const resultText = ({ exact, near }, length) => {
  if (!exact && !near) return 'Ninguna de estas figuras está en la clave.';
  if (near === length) return 'Todas están en la clave, pero ninguna en su lugar.';
  return `${[exact && `${exact} en su lugar`, near && `${near} en otro lugar`].filter(Boolean).join(' y ')}.`;
};

// Todas las claves posibles de un nivel.
const allCodes = (length, symbols, repeat) => {
  let codes = [[]];
  for (let i = 0; i < length; i++) {
    codes = codes.flatMap(code => Array.from({ length: symbols }, (_, s) => [...code, s])
      .filter(next => repeat || !code.includes(next.at(-1))));
  }
  return codes;
};

describe('Clave secreta', () => {
  let page;
  const feedback = () => page.locator('#feedback').textContent();
  const count = () => page.locator('#count').textContent();
  const keys = () => page.locator('.key');
  const guessSlots = () => page.locator('#guess .slot');
  const guessLabels = () => guessSlots().evaluateAll(els => els.map(el => el.getAttribute('aria-label')));
  const selectedSlot = () => page.locator('#guess .slot[aria-pressed="true"]').getAttribute('aria-label');
  const attemptTexts = () => page.locator('.attempts li .sr-only').allTextContents();
  const secretText = () => page.locator('#secret .sr-only').textContent();
  const chooseLevel = name => page.locator('.level', { hasText: name }).tap();
  const enter = async code => {
    for (const symbol of code) await keys().nth(symbol).tap();
  };
  const play = async code => {
    await enter(code);
    await page.locator('#try').tap();
  };

  before(async () => {
    page = await openPage();
  });

  after(async () => {
    assert.deepEqual(page.problems, []);
    await page.context().close();
  });

  // Contexto limpio: sin niveles resueltos guardados y con claves reproducibles.
  const load = async (level, seed = SEED) => {
    await page.goto(siteUrl(`desafios/clave/?semilla=${seed}`));
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    if (level) await chooseLevel(level);
  };

  // Juega con teclado hasta que termina la partida, lee la clave revelada y vuelve a cargar:
  // con la misma semilla, la clave de la partida nueva es la misma.
  const learnSecret = async (level, seed = SEED) => {
    await load(level, seed);
    const length = await guessSlots().count();
    // Sin foco en un botón, Enter prueba el intento.
    await page.evaluate(() => document.activeElement?.blur());
    for (let tries = 0; await page.locator('#guess').isVisible(); tries++) {
      assert.ok(tries < 10, 'la partida debería terminar en 10 intentos');
      for (let s = 1; s <= length; s++) await page.keyboard.press(String(s));
      await page.keyboard.press('Enter');
    }
    const secret = (await secretText()).replace(/^Clave secreta: |\.$/g, '').split(', ').map(name => NAMES.indexOf(name));
    await load(level, seed);
    return secret;
  };

  test('estado inicial', async () => {
    await load();
    assert.equal(await guessSlots().count(), 3);
    assert.equal(await keys().count(), 4);
    assert.deepEqual(await keys().evaluateAll(els => els.map(el => el.getAttribute('aria-label'))), NAMES.slice(0, 4));
    assert.equal(await count(), '0 / 6 intentos');
    assert.equal(await page.locator('.level[aria-pressed="true"]').textContent(), '3 de 4');
    assert.equal(await feedback(), 'La clave tiene 3 figuras distintas, elegidas entre estas 4. Tocá las figuras para armar tu intento.');
    // La clave no está en la página hasta que termina la partida.
    assert.equal(await secretText(), 'Clave secreta, oculta.');
    assert.equal(await page.locator('#secret .symbol').count(), 0);
    assert.equal(await selectedSlot(), 'Casilla 1: vacía');
    assert.ok(await page.locator('#next').isHidden());
  });

  test('armar un intento: llenar, elegir casilla, mover y borrar', async () => {
    await load();
    await enter([0, 1]);
    assert.deepEqual(await guessLabels(), ['Casilla 1: círculo', 'Casilla 2: triángulo', 'Casilla 3: vacía']);
    assert.equal(await selectedSlot(), 'Casilla 3: vacía');
    assert.equal(await page.locator('.key.used').count(), 2);

    // Elegir una casilla llena y cambiar su figura.
    await guessSlots().nth(0).tap();
    await enter([2]);
    assert.deepEqual(await guessLabels(), ['Casilla 1: cuadrado', 'Casilla 2: triángulo', 'Casilla 3: vacía']);
    assert.equal(await selectedSlot(), 'Casilla 3: vacía');

    // Sin repetidas: poner una figura que ya está la mueve.
    await enter([1]);
    assert.deepEqual(await guessLabels(), ['Casilla 1: cuadrado', 'Casilla 2: vacía', 'Casilla 3: triángulo']);
    assert.equal(await selectedSlot(), 'Casilla 2: vacía');

    // Borrar con la casilla vacía borra la anterior.
    await page.locator('#erase').tap();
    assert.deepEqual(await guessLabels(), ['Casilla 1: vacía', 'Casilla 2: vacía', 'Casilla 3: triángulo']);
    assert.equal(await selectedSlot(), 'Casilla 1: vacía');
  });

  test('no se puede probar un intento incompleto', async () => {
    await load();
    await enter([0]);
    await page.locator('#try').tap();
    assert.equal(await feedback(), 'Faltan 2 figuras para probar.');
    await enter([1]);
    await page.locator('#try').tap();
    assert.equal(await feedback(), 'Falta 1 figura para probar.');
    assert.equal(await count(), '0 / 6 intentos');
  });

  test('las pistas cuentan figuras en su lugar y en otro lugar', async () => {
    const secret = await learnSecret('4 de 6');
    const others = [0, 1, 2, 3, 4, 5].filter(s => !secret.includes(s));
    const guesses = [
      [secret[1], secret[2], secret[3], secret[0]],     // todas en otro lugar
      [secret[0], secret[1], secret[3], secret[2]],     // 2 y 2
      [others[0], others[1], secret[2], secret[1]],     // 1 y 1
    ];
    for (const guess of guesses) await play(guess);

    const expected = guesses.map((guess, i) =>
      `Intento ${i + 1}: ${guess.map(s => NAMES[s]).join(', ')}. ${resultText(score(secret, guess), 4)}`);
    assert.deepEqual(await attemptTexts(), expected);
    assert.equal(await count(), '3 / 8 intentos');

    // Los puntos coinciden con el texto: primero los llenos, después los huecos.
    const pegs = await page.locator('.attempts li').evaluateAll(rows =>
      rows.map(row => [...row.querySelectorAll('.peg')].map(peg => peg.classList[1]).join(' ')));
    assert.deepEqual(pegs, ['near near near near', 'exact exact near near', 'exact near none none']);
    assert.equal(await page.locator('#guess .row-number').textContent(), '4');
  });

  test('avisa cuando el intento ya estaba descartado', async () => {
    const secret = await learnSecret('4 de 6');
    const codes = allCodes(4, 6, false);
    const first = codes.find(code => code.join() !== secret.join());
    await play(first);
    const text = resultText(score(secret, first), 4);
    assert.equal(await feedback(), text);

    // Repetir el mismo intento: si fuera la clave, el intento 1 habría acertado todo.
    await play(first);
    assert.equal(await feedback(), `${text} Ojo: el intento 1 ya descartaba esa combinación.`);

    // Uno compatible con las pistas no lleva aviso.
    const consistent = codes.find(code => code.join() !== secret.join()
      && JSON.stringify(score(code, first)) === JSON.stringify(score(secret, first)));
    await play(consistent);
    assert.doesNotMatch(await feedback(), /Ojo/);
  });

  test('acertar en el primer intento revela la clave y lleva al siguiente nivel', async () => {
    const secret = await learnSecret();
    await play(secret);
    assert.equal(await feedback(), '¡En el primer intento! ¿Suerte o lógica?');
    assert.equal(await secretText(), `Clave secreta: ${secret.map(s => NAMES[s]).join(', ')}.`);
    assert.ok(await page.locator('#secret.won').isVisible());
    assert.ok(await page.locator('#guess').isHidden());
    assert.ok(await page.locator('#controls').isHidden());
    assert.equal(await page.evaluate(() => document.activeElement.id), 'next');

    await page.locator('#next').tap();
    assert.equal(await page.locator('.level[aria-pressed="true"]').textContent(), '4 de 6');
    assert.equal(await guessSlots().count(), 4);
    assert.equal(await keys().count(), 6);
    assert.equal(await count(), '0 / 8 intentos');
    assert.equal(await secretText(), 'Clave secreta, oculta.');
  });

  test('descubrirla en varios intentos', async () => {
    const secret = await learnSecret();
    const wrong = allCodes(3, 4, false).filter(code => code.join() !== secret.join());
    await play(wrong[0]);
    await play(wrong[1]);
    await play(secret);
    assert.equal(await feedback(), '¡La descubriste en 3 intentos!');
    assert.equal(await count(), '3 / 6 intentos');
  });

  test('perder revela la clave y ofrece otra', async () => {
    const secret = await learnSecret();
    const wrong = allCodes(3, 4, false).find(code => code.join() !== secret.join());
    for (let i = 0; i < 6; i++) await play(wrong);
    assert.equal(await feedback(), 'Se terminaron los intentos. Arriba está la clave.');
    assert.equal(await secretText(), `Clave secreta: ${secret.map(s => NAMES[s]).join(', ')}.`);
    assert.equal(await page.locator('#secret.won').count(), 0);
    assert.ok(await page.locator('#next').isHidden(), 'perder no habilita el siguiente nivel');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'another');
    assert.ok(await page.locator('#another.primary').isVisible());

    await page.locator('#another').tap();
    assert.equal(await count(), '0 / 6 intentos');
    assert.equal(await secretText(), 'Clave secreta, oculta.');
    assert.equal(await page.locator('.attempts li').count(), 0);
  });

  test('en el clásico las figuras se pueden repetir', async () => {
    await load('Clásico');
    assert.equal(await count(), '0 / 10 intentos');
    await enter([4, 4, 4, 4]);
    assert.deepEqual(await guessLabels(), ['Casilla 1: estrella', 'Casilla 2: estrella', 'Casilla 3: estrella', 'Casilla 4: estrella']);
    assert.equal(await page.locator('.key.used').count(), 0);
  });

  test('la misma semilla da la misma clave y otra semilla, otra', async () => {
    const a = await learnSecret('Clásico');
    const b = await learnSecret('Clásico');
    assert.deepEqual(a, b);
    const c = await learnSecret('Clásico', SEED + 1);
    const d = await learnSecret('Clásico', SEED + 2);
    assert.ok(a.join() !== c.join() || a.join() !== d.join(), 'otras semillas cambian la clave');
  });

  test('los niveles resueltos quedan marcados al recargar', async () => {
    const secret = await learnSecret();
    await play(secret);
    await page.reload();
    assert.deepEqual(await page.locator('.level').evaluateAll(els => els.map(el => el.classList.contains('solved'))),
      [true, false, false]);
  });

  test('se puede jugar con teclado', async () => {
    await load();
    await page.keyboard.press('1');
    await page.keyboard.press('2');
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Backspace');
    await page.keyboard.press('3');
    assert.deepEqual(await guessLabels(), ['Casilla 1: cuadrado', 'Casilla 2: vacía', 'Casilla 3: vacía']);

    // Números fuera de rango no hacen nada.
    await page.keyboard.press('5');
    assert.equal(await selectedSlot(), 'Casilla 2: vacía');

    await page.keyboard.press('4');
    await page.keyboard.press('1');
    await page.keyboard.press('Enter');
    assert.equal(await count(), '1 / 6 intentos');
    assert.match((await attemptTexts())[0], /^Intento 1: cuadrado, rombo, círculo\./);

    // Enter sobre un botón lo activa, sin probar el intento.
    await page.locator('#erase').focus();
    await page.keyboard.press('Enter');
    assert.equal(await count(), '1 / 6 intentos');
  });

  test('después de tocar las figuras, Enter prueba el intento', async () => {
    await load();
    await enter([0, 1, 2]);
    // El foco quedó en la última figura tocada, pero Enter no la vuelve a poner.
    assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), 'cuadrado');
    await page.keyboard.press('Enter');
    assert.equal(await count(), '1 / 6 intentos');
  });

  test('el clásico entra en un celular de 360px con todo tocable', async () => {
    const secret = await learnSecret('Clásico');
    const keyBox = await keys().nth(5).boundingBox();
    assert.ok(keyBox.width >= 44 && Math.abs(keyBox.width - keyBox.height) < 1, `figura de ${keyBox.width}×${keyBox.height}px`);
    const slotBox = await guessSlots().nth(3).boundingBox();
    assert.ok(slotBox.width >= 44 && slotBox.height >= 44, `casilla de ${slotBox.width}×${slotBox.height}px`);

    const wrong = [0, 1, 2, 3].map(i => (secret[i] + 1) % 6);
    for (let i = 0; i < 9; i++) await play(wrong);
    assert.ok(await hasNoHorizontalScroll(page));
  });
});
