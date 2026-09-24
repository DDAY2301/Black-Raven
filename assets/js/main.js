(() => {
  const root = document.documentElement;
  const buttons = [...document.querySelectorAll('[data-lang]')];
  const translatable = [...document.querySelectorAll('[data-sl][data-en]')];
  const altTranslatable = [...document.querySelectorAll('[data-alt-sl][data-alt-en]')];

  const applyLanguage = (lang) => {
    const safe = lang === 'en' ? 'en' : 'sl';
    root.lang = safe;
    localStorage.setItem('br-language', safe);
    translatable.forEach(el => {
      const value = el.dataset[safe];
      if (value !== undefined) el.innerHTML = value;
    });
    altTranslatable.forEach(el => {
      el.alt = safe === 'en' ? el.dataset.altEn : el.dataset.altSl;
    });
    buttons.forEach(btn => {
      const active = btn.dataset.lang === safe;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    const title = document.body.dataset.titleEn && safe === 'en' ? document.body.dataset.titleEn : document.body.dataset.titleSl;
    if (title) document.title = title;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.content = safe === 'en' ? document.body.dataset.descEn : document.body.dataset.descSl;
    }
  };

  buttons.forEach(btn => btn.addEventListener('click', () => applyLanguage(btn.dataset.lang)));
  applyLanguage(localStorage.getItem('br-language') || 'sl');

  const menuBtn = document.querySelector('.menu-button');
  const navLinks = document.querySelector('.nav-links');
  if (menuBtn && navLinks) {
    menuBtn.addEventListener('click', () => {
      const open = navLinks.classList.toggle('is-open');
      menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    navLinks.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
      navLinks.classList.remove('is-open');
      menuBtn.setAttribute('aria-expanded', 'false');
    }));
  }

  const lightbox = document.querySelector('.lightbox');
  if (lightbox) {
    const lbImg = lightbox.querySelector('img');
    const close = () => {
      lightbox.classList.remove('is-open');
      lightbox.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    };
    document.querySelectorAll('[data-lightbox]').forEach(btn => btn.addEventListener('click', () => {
      lbImg.src = btn.dataset.lightbox;
      lbImg.alt = btn.querySelector('img')?.alt || '';
      lightbox.classList.add('is-open');
      lightbox.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      lightbox.querySelector('button').focus();
    }));
    lightbox.querySelector('button').addEventListener('click', close);
    lightbox.addEventListener('click', e => { if (e.target === lightbox) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  }

  document.querySelectorAll('[data-year]').forEach(el => el.textContent = new Date().getFullYear());
})();
