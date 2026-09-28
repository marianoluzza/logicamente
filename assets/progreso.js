// Avance en el inicio: lee los niveles resueltos que guarda cada desafío y los muestra en su tarjeta.
(() => {
  // Ids de los niveles de cada desafío, tal como los guarda en logicamente:<desafío>:resueltos.
  const LEVELS = {
    hanoi: ['3', '4', '5'],
    reinas: ['4', '6', '8'],
    rio: ['granjero', 'ovejas'],
    jarras: ['3-5', '8-5-3', '4-9'],
    luces: ['3', '4', '5'],
    clave: ['3-de-4', '4-de-6', 'clasico'],
  };

  const solvedCount = challenge => {
    try {
      const stored = JSON.parse(localStorage.getItem(`logicamente:${challenge}:resueltos`));
      return Array.isArray(stored) ? LEVELS[challenge].filter(id => stored.map(String).includes(id)).length : 0;
    } catch {
      return 0;
    }
  };

  const cards = [...document.querySelectorAll('[data-challenge]')];
  let complete = 0;

  cards.forEach(card => {
    const total = LEVELS[card.dataset.challenge].length;
    const solved = solvedCount(card.dataset.challenge);
    const state = solved === total ? 'complete' : solved ? 'partial' : 'new';
    const text = {
      complete: '✓ Completo',
      partial: `${solved} de ${total} niveles`,
      new: total === 1 ? '1 nivel' : `${total} niveles`,
    }[state];
    const dots = Array.from({ length: total }, (_, i) => `<span${i < solved ? ' class="on"' : ''}></span>`).join('');

    if (state === 'complete') complete++;
    card.classList.toggle('complete', state === 'complete');
    const badge = card.querySelector('.badge');
    badge.dataset.state = state;
    // Completo ya lo dice el tilde; los puntos quedan para el avance parcial.
    badge.innerHTML = state === 'complete' ? text : `<span class="dots" aria-hidden="true">${dots}</span>${text}`;
  });

  document.querySelector('#overall').textContent = complete
    ? `${complete} de ${cards.length} completos`
    : `${cards.length} desafíos`;
})();
