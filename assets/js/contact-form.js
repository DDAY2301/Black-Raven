/* Pre-fill enquiry context and show a return notice after FormSubmit redirects back. */
(() => {
  const form = document.getElementById('contact-enquiry-form');
  const notice = document.getElementById('contact-form-success');
  if (!form || !notice) return;

  const url = new URL(window.location.href);
  const topic = (url.searchParams.get('topic') || '').trim().slice(0, 160);
  if (topic) {
    const topicField = document.getElementById('contact-topic');
    const topicDisplay = document.getElementById('contact-form-topic-display');
    const topicLabel = document.getElementById('contact-topic-label');
    if (topicField) topicField.value = topic;
    if (topicLabel) topicLabel.textContent = topic; // Text only, never inject HTML from the URL.
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

  if (url.searchParams.get('enquiry') !== 'sent') return;
  notice.hidden = false;
  notice.focus({ preventScroll: true });
  url.searchParams.delete('enquiry');
  try {
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  } catch (_) {
    /* History updates can be unavailable; the notice still works. */
  }
})();
