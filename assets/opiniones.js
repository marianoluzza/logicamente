// Buzón de opiniones: cada [data-opinion="<lugar>"] se convierte en un formulario breve.
// Adaptado de mision-software: usa el mismo Google Form ("Encuesta Desafíos"), sin login ni backend
// propio. El campo del desafío va como "logicamente/<lugar>" para separar las respuestas en la planilla.
(() => {
  const FORM_ID = '1FAIpQLSdv5tJEm5kWS_02t1NdXUPEYzNFPlnhDwSv-muedKbG-LfAdQ';
  const FORM_ACTION = `https://docs.google.com/forms/d/e/${FORM_ID}/formResponse`;
  const FORM_VIEW = `https://docs.google.com/forms/d/e/${FORM_ID}/viewform`;
  const FIELDS = {
    challenge: 'entry.813562710',
    reaction: 'entry.1989693293',
    comment: 'entry.1490432713',
  };
  const STORAGE_KEY = 'logicamente:opiniones:enviadas';
  const REACTIONS = [
    ['😐', 'Meh'],
    ['🙂', 'Bien'],
    ['🤩', '¡Genial!'],
  ];

  const readSent = () => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return Array.isArray(stored) ? stored : [];
    } catch {
      return [];
    }
  };
  const markSent = place => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...new Set([...readSent(), place])]));
    } catch {}
  };

  const renderThanks = slot => {
    slot.innerHTML = '<p class="opinion-thanks" tabindex="-1">¡Gracias! Tu opinión nos ayuda a mejorar.</p>';
  };

  const renderForm = slot => {
    const place = slot.dataset.opinion;
    const question = slot.dataset.opinionQuestion || '¿Qué te pareció este desafío?';
    const commentId = `opinion-comment-${place}`;

    slot.innerHTML = `
      <form class="opinion" novalidate>
        <fieldset class="opinion-reactions">
          <legend class="opinion-question">${question}</legend>
          ${REACTIONS.map(([emoji, label]) => `
            <label class="opinion-reaction">
              <input type="radio" name="reaction" value="${emoji} ${label}">
              <span><span aria-hidden="true">${emoji}</span> ${label}</span>
            </label>`).join('')}
        </fieldset>
        <label class="opinion-label" for="${commentId}">¿Qué agregarías o cambiarías? <span>(opcional)</span></label>
        <textarea id="${commentId}" name="comment" rows="3" maxlength="500" placeholder="No pongas tu nombre ni datos personales."></textarea>
        <div class="opinion-footer">
          <button class="pill-button" type="submit">Enviar</button>
          <p class="opinion-status" role="status" aria-live="polite"></p>
        </div>
      </form>`;

    slot.querySelector('form').addEventListener('submit', event => {
      event.preventDefault();
      submit(slot, event.currentTarget, place);
    });
  };

  const submit = async (slot, form, place) => {
    const reaction = form.elements.reaction.value;
    const comment = form.elements.comment.value.trim();
    const status = form.querySelector('.opinion-status');
    const button = form.querySelector('[type="submit"]');

    if (!reaction && !comment) {
      status.textContent = 'Elegí una reacción o escribí algo antes de enviar.';
      return;
    }

    button.disabled = true;
    status.textContent = 'Enviando…';
    const challenge = `logicamente/${place}`;

    try {
      // Google no habilita CORS: con no-cors la respuesta es opaca y solo se detectan errores de red.
      await fetch(FORM_ACTION, {
        method: 'POST',
        mode: 'no-cors',
        body: new URLSearchParams({
          [FIELDS.challenge]: challenge,
          [FIELDS.reaction]: reaction,
          [FIELDS.comment]: comment,
        }),
      });
      markSent(place);
      renderThanks(slot);
      slot.querySelector('.opinion-thanks').focus();
    } catch {
      const fallback = new URL(FORM_VIEW);
      fallback.searchParams.set('usp', 'pp_url');
      fallback.searchParams.set(FIELDS.challenge, challenge);
      status.innerHTML = `No se pudo enviar. <a href="${fallback.href}" target="_blank" rel="noopener">Probá desde Google Forms</a>.`;
      button.disabled = false;
    }
  };

  const sent = readSent();
  document.querySelectorAll('[data-opinion]').forEach(slot => {
    if (sent.includes(slot.dataset.opinion)) renderThanks(slot);
    else renderForm(slot);
  });
})();
