// Compartir con código QR: botón [data-share-open] en el encabezado de cada página.
// Adaptado de mision-software. La librería de QR se carga recién al abrir el diálogo.
(() => {
  // compartir.js vive en assets/, así que la raíz del sitio está un nivel arriba.
  const HOME_URL = new URL('../', document.currentScript.src).href;
  const QR_LIBRARY = {
    src: 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js',
    integrity: 'sha384-8FWZA6BGMXhsfO+BLtrJK0We6gg5o1JyO8xQm6peWDEUs17ACA5ziE/NIAkl9z2k',
  };

  // URL más corta posible: sin hash, sin query (ni ?semilla) y sin index.html, para que el QR tenga menos módulos.
  const cleanUrl = href => {
    const url = new URL(href);
    url.hash = '';
    url.search = '';
    url.pathname = url.pathname.replace(/index\.html$/, '');
    return url.href;
  };
  const PAGE_URL = cleanUrl(location.href);

  let qrLibrary = null;
  let target = 'page';
  let renderId = 0;

  const loadQrLibrary = () => {
    if (window.qrcode) return Promise.resolve(window.qrcode);
    qrLibrary ??= new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = QR_LIBRARY.src;
      script.integrity = QR_LIBRARY.integrity;
      script.crossOrigin = 'anonymous';
      script.onload = () => (window.qrcode ? resolve(window.qrcode) : reject(new Error('qrcode no disponible')));
      script.onerror = () => {
        // Permite reintentar la próxima vez que se abra el diálogo.
        qrLibrary = null;
        script.remove();
        reject(new Error('No se pudo cargar la librería de QR'));
      };
      document.head.append(script);
    });
    return qrLibrary;
  };

  const renderQr = (qrcode, text) => {
    const QUIET_ZONE = 4;
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();

    const count = qr.getModuleCount();
    const size = count + QUIET_ZONE * 2;
    let path = '';
    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        if (qr.isDark(row, col)) path += `M${col + QUIET_ZONE} ${row + QUIET_ZONE}h1v1h-1z`;
      }
    }
    // Módulos oscuros sobre blanco: los QR invertidos escanean peor.
    return `<svg viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" aria-hidden="true"><rect width="${size}" height="${size}" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
  };

  const currentUrl = () => (target === 'home' ? HOME_URL : PAGE_URL);

  const update = async dialog => {
    const url = currentUrl();
    const displayUrl = url.replace(/^https?:\/\//, '');
    const qrBox = dialog.querySelector('.share-qr');
    const id = ++renderId;

    dialog.querySelectorAll('[data-share-target]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.shareTarget === target));
    });
    dialog.querySelector('.share-url').textContent = displayUrl;
    dialog.querySelector('.share-status').textContent = '';
    qrBox.setAttribute('aria-label', `Código QR para abrir ${displayUrl}`);
    qrBox.classList.remove('error');
    if (!window.qrcode) qrBox.textContent = 'Generando QR…';

    try {
      const qrcode = await loadQrLibrary();
      // Si cambiaron de opción mientras cargaba la librería, gana la última.
      if (id !== renderId) return;
      qrBox.innerHTML = renderQr(qrcode, url);
    } catch {
      if (id !== renderId) return;
      qrBox.classList.add('error');
      qrBox.textContent = 'No se pudo generar el QR. Podés copiar el enlace de abajo.';
    }
  };

  const copy = async dialog => {
    const status = dialog.querySelector('.share-status');
    try {
      await navigator.clipboard.writeText(currentUrl());
      status.textContent = '¡Enlace copiado!';
    } catch {
      status.textContent = 'No se pudo copiar. Mantené presionado el enlace para copiarlo.';
    }
  };

  const createDialog = () => {
    const dialog = document.createElement('dialog');
    dialog.className = 'share-dialog';
    dialog.setAttribute('aria-labelledby', 'share-title');
    dialog.innerHTML = `
      <div class="share-body">
        <div class="share-header">
          <h2 id="share-title">Compartir</h2>
          <button class="share-close" type="button" aria-label="Cerrar">✕</button>
        </div>
        <div class="share-toggle" role="group" aria-label="Qué compartir">
          <button type="button" data-share-target="page" aria-pressed="true">Este desafío</button>
          <button type="button" data-share-target="home" aria-pressed="false">Inicio</button>
        </div>
        <div class="share-qr" role="img"></div>
        <p class="share-url"></p>
        <div class="share-actions">
          <button class="pill-button primary" type="button" data-share-copy>Copiar enlace</button>
          <button class="pill-button" type="button" data-share-native>Compartir…</button>
        </div>
        <p class="share-status" role="status" aria-live="polite"></p>
      </div>`;

    // En el inicio "Este desafío" e "Inicio" son la misma URL.
    dialog.querySelector('.share-toggle').hidden = PAGE_URL === HOME_URL;
    dialog.querySelector('[data-share-native]').hidden = typeof navigator.share !== 'function';

    dialog.addEventListener('click', event => {
      // Un clic fuera de .share-body cae sobre el propio dialog, es decir, el fondo.
      if (event.target === dialog || event.target.closest('.share-close')) {
        dialog.close();
        return;
      }
      const targetButton = event.target.closest('[data-share-target]');
      if (targetButton) {
        target = targetButton.dataset.shareTarget;
        update(dialog);
      } else if (event.target.closest('[data-share-copy]')) {
        copy(dialog);
      } else if (event.target.closest('[data-share-native]')) {
        // Cancelar el menú nativo también rechaza la promesa: no hay nada que avisar.
        navigator.share({ title: document.title, url: currentUrl() }).catch(() => {});
      }
    });

    document.body.append(dialog);
    return dialog;
  };

  document.addEventListener('click', event => {
    if (!event.target.closest('[data-share-open]')) return;
    const dialog = document.querySelector('.share-dialog') ?? createDialog();
    target = 'page';
    update(dialog);
    dialog.showModal();
  });
})();
