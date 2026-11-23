/* Black Raven: accessible, verified-events calendar. Dates are ISO calendar dates, never guessed. */
(() => {
  const root = document.getElementById('black-raven-calendar');
  if (!root) return;
  const grid = root.querySelector('[data-calendar-grid]');
  const heading = root.querySelector('[data-calendar-month]');
  const list = root.querySelector('[data-calendar-list]');
  const note = root.querySelector('[data-calendar-note]');
  const prev = root.querySelector('[data-calendar-prev]');
  const next = root.querySelector('[data-calendar-next]');
  const reset = root.querySelector('[data-calendar-today]');
  const endpoint = 'https://blackraven-contact.dan-grmusa.workers.dev/events';
  let events = [];
  let selectedDate = '';
  const now = new Date();
  let cursor = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));

  const lang = () => document.documentElement.lang === 'en' ? 'en' : 'sl';
  const t = (sl, en) => lang() === 'en' ? en : sl;
  const iso = (y, m, d) => [y, String(m + 1).padStart(2, '0'), String(d).padStart(2, '0')].join('-');
  const validDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + 'T12:00:00Z'));
  const clean = data => (Array.isArray(data?.events) ? data.events : []).filter(e =>
    e && e.status === 'published' && validDate(e.startDate) &&
    validDate(e.endDate || e.startDate) && typeof e.titleSl === 'string' &&
    (e.endDate || e.startDate) >= e.startDate
  ).sort((a, b) => a.startDate.localeCompare(b.startDate));
  const within = (e, day) => e.startDate <= day && (e.endDate || e.startDate) >= day;
  const monthName = date => new Intl.DateTimeFormat(lang() === 'en' ? 'en-GB' : 'sl-SI',
    { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
  const safeUrl = url => {
    try { const value = new URL(url); return value.protocol === 'https:' ? value.href : ''; }
    catch { return ''; }
  };
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  };

  function card(event) {
    const article = el('article', 'br-event-card');
    const date = event.startDate === (event.endDate || event.startDate)
      ? event.startDate : event.startDate + ' – ' + event.endDate;
    article.append(el('div', 'br-event-date', date));
    article.append(el('h3', '', lang() === 'en' ? (event.titleEn || event.titleSl) : event.titleSl));
    const location = event.location || '';
    if (location) article.append(el('p', 'br-event-location', location));
    const description = lang() === 'en' ? (event.descriptionEn || event.descriptionSl) : event.descriptionSl;
    if (description) article.append(el('p', 'br-event-description', description));
    const href = safeUrl(event.registrationUrl || event.sourceUrl);
    if (href) {
      const link = el('a', 'br-event-link', t('Podrobnosti in prijava ↗', 'Details and registration ↗'));
      link.href = href;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      article.append(link);
    } else {
      article.append(el('span', 'br-event-contact', t('Za informacije: info@blackraven.solutions', 'Enquiries: info@blackraven.solutions')));
    }
    return article;
  }

  function render() {
    const year = cursor.getUTCFullYear(), month = cursor.getUTCMonth();
    heading.textContent = monthName(cursor);
    grid.replaceChildren();
    const weekdays = lang() === 'en' ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      : ['Pon', 'Tor', 'Sre', 'Čet', 'Pet', 'Sob', 'Ned'];
    weekdays.forEach(day => grid.append(el('span', 'br-calendar-weekday', day)));
    const pad = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;
    for (let i = 0; i < pad; i++) grid.append(el('span', 'br-calendar-empty'));
    const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const today = iso(now.getFullYear(), now.getMonth(), now.getDate());
    for (let d = 1; d <= days; d++) {
      const day = iso(year, month, d);
      const count = events.filter(e => within(e, day)).length;
      const button = el('button', 'br-calendar-day', d);
      button.type = 'button';
      button.dataset.date = day;
      button.setAttribute('aria-label', day + (count ? ' — ' + count + ' ' + t('dogodkov', 'events') : ''));
      button.setAttribute('aria-pressed', String(selectedDate === day));
      if (day === today) button.classList.add('is-today');
      if (selectedDate === day) button.classList.add('is-selected');
      if (count) {
        button.classList.add('has-event');
        button.append(el('span', 'br-event-dot'));
      }
      button.addEventListener('click', () => {
        selectedDate = selectedDate === day ? '' : day;
        render();
      });
      grid.append(button);
    }
    const start = iso(year, month, 1);
    const end = iso(year, month, days);
    const filtered = events.filter(e => e.startDate <= end &&
      (e.endDate || e.startDate) >= start && (!selectedDate || within(e, selectedDate)));
    list.replaceChildren();
    filtered.forEach(e => list.append(card(e)));
    note.textContent = filtered.length
      ? t('Prikazani so potrjeni in objavljeni termini.', 'Only confirmed, published dates are shown.')
      : t('Za izbrano obdobje še ni potrjenih objavljenih terminov. Piši nam za informacije o naslednjih izvedbah.',
          'No confirmed dates have been published for this period. Contact us about upcoming courses.');
  }

  prev.addEventListener('click', () => {
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() - 1, 1));
    selectedDate = '';
    render();
  });
  next.addEventListener('click', () => {
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
    selectedDate = '';
    render();
  });
  reset.addEventListener('click', () => {
    cursor = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
    selectedDate = '';
    render();
  });
  new MutationObserver(render).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  render();

  async function load() {
    let data;
    try {
      const response = await fetch(endpoint, { headers: { Accept: 'application/json' }, cache: 'no-store' });
      if (!response.ok) throw new Error('API unavailable');
      data = await response.json();
    } catch (_) {
      try {
        const fallback = await fetch('data/events.json', { cache: 'no-store' });
        if (fallback.ok) data = await fallback.json();
      } catch (_) { /* Keep the calendar usable without network access. */ }
    }
    events = clean(data);
    render();
  }
  load();
})();
