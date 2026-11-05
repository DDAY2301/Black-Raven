/* Black Raven contact form: secure, same-page submission; fail closed until configured. */
(() => {
  const form = document.getElementById('contact-enquiry-form');
  const status = document.getElementById('contact-form-status');
  const success = document.getElementById('contact-form-success');
  const submitButton = form?.querySelector('button[type="submit"]');
  if (!form || !status || !success || !submitButton) return;

  const message = {
    offline: {
      sl: 'Pošiljanje prek obrazca je začasno nedosegljivo. Piši neposredno na info@blackraven.solutions.',
      en: 'Online form sending is temporarily unavailable. Please email info@blackraven.solutions instead.'
    },
    sending: { sl: 'Pošiljam povpraševanje …', en: 'Sending your enquiry …' },
    failed: {
      sl: 'Pošiljanje ni uspelo. Preveri povezavo in poskusi ponovno ali piši neposredno na e-pošto.',
      en: 'Sending failed. Check your connection and retry, or contact us by email.'
    },
    limit: {
      sl: 'Preveč poskusov. Poskusi ponovno čez nekaj minut.',
      en: 'Too many attempts. Please try again in a few minutes.'
    }
  };

  const setStatus = (key, hide = false) => {
    const { sl, en } = message[key];
    status.dataset.sl = sl;
    status.dataset.en = en;
    status.textContent = document.documentElement.lang === 'en' ? en : sl;
    status.hidden = hide;
  };

  // Use only the HTTPS endpoint of our own API. SMTP credentials stay server-side.
  // Do not enable until the backend is deployed and verified.
  const endpoint = (form.dataset.endpoint || '').trim();
  const configured = endpoint === 'https://api.blackraven.solutions/contact';
  submitButton.disabled = !configured;
  setStatus('offline', configured);

  const url = new URL(window.location.href);
  const topic = (url.searchParams.get('topic') || '').trim().slice(0, 160);
  if (topic) {
    const topicField = document.getElementById('contact-topic');
    const topicDisplay = document.getElementById('contact-form-topic-display');
    const topicLabel = document.getElementById('contact-topic-label');
    if (topicField) topicField.value = topic;
    if (topicLabel) topicLabel.textContent = topic;
    if (topicDisplay) topicDisplay.hidden = false;

    const programme = document.getElementById('contact-programme');
    const mapping = [
      [/tečaj|tecaj|informacije pred|oprema za/i, 'Tecaji'],
      [/tabor/i, 'Tabori'],
      [/delavn|zdravilna energija|divja hrana|prižiganja ognja|gozdna šola|robinzoni|rojstni dan/i, 'Delavnice'],
      [/team building/i, 'Team building'],
      [/sumatra|kanada|ekspedic/i, 'Ekspedicije']
    ];
    const chosen = mapping.find(([pattern]) => pattern.test(topic));
    if (programme && chosen) programme.value = chosen[1];
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault(); // Never navigate to a third-party form website.
    success.hidden = true;
    if (!configured) {
      setStatus('offline');
      return;
    }
    if (!form.reportValidity()) return;
    if ((form.elements.namedItem('_gotcha')?.value || '').trim()) return;

    submitButton.disabled = true;
    submitButton.setAttribute('aria-busy', 'true');
    setStatus('sending');
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          name: form.elements.namedItem('name')?.value || '',
          email: form.elements.namedItem('email')?.value || '',
          programme: form.elements.namedItem('programme')?.value || '',
          topic: form.elements.namedItem('topic')?.value || '',
          message: form.elements.namedItem('message')?.value || '',
          _gotcha: form.elements.namedItem('_gotcha')?.value || ''
        }),
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        mode: 'cors',
        credentials: 'omit',
        redirect: 'error',
        referrerPolicy: 'strict-origin-when-cross-origin',
        cache: 'no-store',
        signal: controller.signal
      });

      if (response.status === 429) {
        setStatus('limit');
        return;
      }
      const result = await response.json().catch(() => ({}));
      if (response.status !== 202 || result.accepted !== true) {
        setStatus('failed');
        return;
      }

      // Our SMTP relay accepted the request; only inbox delivery testing confirms arrival.
      status.hidden = true;
      form.reset();
      success.hidden = false;
      success.focus({ preventScroll: true });
    } catch (_) {
      setStatus('failed');
    } finally {
      window.clearTimeout(timeout);
      submitButton.disabled = false;
      submitButton.removeAttribute('aria-busy');
    }
  });
})();
