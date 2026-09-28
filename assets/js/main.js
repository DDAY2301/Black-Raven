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
    const title = safe === 'en' ? document.body.dataset.titleEn : document.body.dataset.titleSl;
    if (title) document.title = title;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.content = safe === 'en' ? document.body.dataset.descEn : document.body.dataset.descSl;
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
      lightbox.querySelector('button')?.focus();
    }));
    lightbox.querySelector('button')?.addEventListener('click', close);
    lightbox.addEventListener('click', e => { if (e.target === lightbox) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  }

  document.querySelectorAll('[data-year]').forEach(el => el.textContent = new Date().getFullYear());

  // FAQ accordion
  document.querySelectorAll('.faq-question').forEach(button => {
    button.addEventListener('click', () => {
      const item = button.closest('.faq-item');
      const answer = item?.querySelector('.faq-answer');
      if (!item || !answer) return;

      const isOpen = button.getAttribute('aria-expanded') === 'true';

      document.querySelectorAll('.faq-question[aria-expanded="true"]').forEach(openButton => {
        if (openButton === button) return;
        openButton.setAttribute('aria-expanded', 'false');
        const openItem = openButton.closest('.faq-item');
        openItem?.classList.remove('is-open');
        const openAnswer = openItem?.querySelector('.faq-answer');
        if (openAnswer) openAnswer.hidden = true;
      });

      button.setAttribute('aria-expanded', String(!isOpen));
      item.classList.toggle('is-open', !isOpen);
      answer.hidden = isOpen;
    });
  });

  // Page progress and back-to-top affordance
  const progress = document.createElement('div');
  progress.className = 'page-progress';
  progress.setAttribute('aria-hidden', 'true');
  document.body.appendChild(progress);

  const backTop = document.createElement('button');
  backTop.className = 'back-to-top';
  backTop.type = 'button';
  backTop.setAttribute('aria-label', 'Back to top');
  backTop.innerHTML = '<span>↑</span>';
  document.body.appendChild(backTop);

  const syncProgress = () => {
    const max = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
    const ratio = Math.min(Math.max(window.scrollY / max, 0), 1);
    progress.style.transform = `scaleX(${ratio})`;
    backTop.classList.toggle('is-visible', window.scrollY > 700);
  };
  syncProgress();
  window.addEventListener('scroll', syncProgress, { passive: true });
  backTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  const header = document.querySelector('.site-header');
  if (header) {
    const syncHeader = () => header.classList.toggle('is-scrolled', window.scrollY > 24);
    syncHeader();
    window.addEventListener('scroll', syncHeader, { passive: true });
  }

  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const targets = document.querySelectorAll('main > section:not(:first-child)');
    targets.forEach(el => el.classList.add('reveal'));
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: .08, rootMargin: '0px 0px -40px 0px' });
    targets.forEach(el => observer.observe(el));

    const staggerGroups = [
      '.field-index-list a',
      '.course-row',
      '.workshop-list article',
      '.expedition-list article',
      '.visual-preview-item',
      '.archive-item',
      '.field-note'
    ];
    staggerGroups.forEach(selector => {
      document.querySelectorAll(selector).forEach((el, index) => {
        el.style.setProperty('--stagger', `${Math.min(index, 7) * 55}ms`);
        el.classList.add('micro-reveal');
      });
    });

    const microObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          microObserver.unobserve(entry.target);
        }
      });
    }, { threshold: .06, rootMargin: '0px 0px -20px 0px' });

    document.querySelectorAll('.micro-reveal').forEach(el => microObserver.observe(el));
  }
})();