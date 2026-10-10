(() => {
  const root = document.documentElement;
  const buttons = [...document.querySelectorAll('[data-lang]')];
  const translatable = [...document.querySelectorAll('[data-sl][data-en]')];
  const altTranslatable = [...document.querySelectorAll('[data-alt-sl][data-alt-en]')];

  const getSavedLanguage = () => {
    try { return localStorage.getItem('br-language') || 'sl'; }
    catch (_) { return 'sl'; }
  };
  const saveLanguage = (lang) => {
    try { localStorage.setItem('br-language', lang); }
    catch (_) { /* Private browsing or disabled storage must not break the page. */ }
  };
  const applyLanguage = (lang) => {
    const safe = lang === 'en' ? 'en' : 'sl';
    root.lang = safe;
    saveLanguage(safe);
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
    const menu = document.querySelector('.menu-button');
    if (menu) menu.setAttribute('aria-label', safe === 'en'
      ? (menu.getAttribute('aria-expanded') === 'true' ? 'Close menu' : 'Open menu')
      : (menu.getAttribute('aria-expanded') === 'true' ? 'Zapri meni' : 'Odpri meni'));
    const back = document.querySelector('.back-to-top');
    if (back) back.setAttribute('aria-label', safe === 'en' ? 'Back to top' : 'Nazaj na vrh');
    const dialog = document.querySelector('.lightbox');
    if (dialog) {
      dialog.setAttribute('aria-label', safe === 'en' ? 'Image preview' : 'Predogled fotografije');
      const close = dialog.querySelector('button');
      if (close) close.setAttribute('aria-label', safe === 'en' ? 'Close preview' : 'Zapri predogled');
    }
    const title = safe === 'en' ? document.body.dataset.titleEn : document.body.dataset.titleSl;
    if (title) document.title = title;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.content = safe === 'en' ? document.body.dataset.descEn : document.body.dataset.descSl;
  };

  buttons.forEach(btn => btn.addEventListener('click', () => applyLanguage(btn.dataset.lang)));
  applyLanguage(getSavedLanguage());

  const menuBtn = document.querySelector('.menu-button');
  const navLinks = document.querySelector('.nav-links');
  if (menuBtn && navLinks) {
    const setMenuOpen = (open) => {
      navLinks.classList.toggle('is-open', open);
      menuBtn.setAttribute('aria-expanded', String(open));
      menuBtn.setAttribute('aria-label', root.lang === 'en'
        ? (open ? 'Close menu' : 'Open menu')
        : (open ? 'Zapri meni' : 'Odpri meni'));
    };
    menuBtn.addEventListener('click', () => setMenuOpen(!navLinks.classList.contains('is-open')));
    navLinks.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setMenuOpen(false)));
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && navLinks.classList.contains('is-open')) {
        setMenuOpen(false);
        menuBtn.focus();
      }
    });
    document.addEventListener('click', e => {
      if (navLinks.classList.contains('is-open') && !e.target.closest('.site-header')) setMenuOpen(false);
    });
    window.addEventListener('resize', () => {
      if (window.innerWidth > 1160) setMenuOpen(false);
    });
  }

  const lightbox = document.querySelector('.lightbox');
  if (lightbox) {
    const lbImg = lightbox.querySelector('img');
    const closeButton = lightbox.querySelector('button');
    const photos = [...document.querySelectorAll('[data-lightbox]')];
    let previousFocus = null;
    let activeIndex = 0;
    const showImage = (index) => {
      activeIndex = (index + photos.length) % photos.length;
      const card = photos[activeIndex];
      if (!card) return;
      lbImg.src = card.dataset.lightbox;
      lbImg.alt = card.querySelector('img')?.alt || '';
      const caption = lightbox.querySelector('.lightbox-caption');
      if (caption) caption.textContent = card.querySelector('.field-gallery-meta strong')?.textContent || lbImg.alt;
    };
    const close = () => {
      if (!lightbox.classList.contains('is-open')) return;
      lightbox.classList.remove('is-open');
      lightbox.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      lbImg.removeAttribute('src');
      previousFocus?.focus();
    };
    photos.forEach((btn, index) => btn.addEventListener('click', () => {
      previousFocus = btn;
      showImage(index);
      lightbox.classList.add('is-open');
      lightbox.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      closeButton?.focus();
    }));
    closeButton?.addEventListener('click', close);
    lightbox.addEventListener('click', e => { if (e.target === lightbox) close(); });
    document.addEventListener('keydown', e => {
      if (!lightbox.classList.contains('is-open')) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      if (e.key === 'ArrowRight' && photos.length > 1) { e.preventDefault(); showImage(activeIndex + 1); }
      if (e.key === 'ArrowLeft' && photos.length > 1) { e.preventDefault(); showImage(activeIndex - 1); }
      if (e.key === 'Tab') { e.preventDefault(); closeButton?.focus(); }
    });
  }

  document.querySelectorAll('[data-year]').forEach(el => el.textContent = new Date().getFullYear());

  // Keep image surfaces stable on slow or failed loads.
  document.querySelectorAll('img').forEach(img => {
    const frame = img.closest('.section-visual, .gallery-hq-card, .proof-image, .community-visual, .info-hero-media, .info-photo-band figure, .field-guide-media, .family-flow-visual figure, .decade-card, .nature-story-pair figure');
    const markLoaded = () => {
      img.classList.add('is-loaded');
      frame?.classList.remove('image-failed');
    };
    const markFailed = () => {
      frame?.classList.add('image-failed');
    };
    if (img.complete && img.naturalWidth > 0) markLoaded();
    else {
      img.addEventListener('load', markLoaded, { once: true });
      img.addEventListener('error', markFailed, { once: true });
    }
  });

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
  backTop.setAttribute('aria-label', root.lang === 'en' ? 'Back to top' : 'Nazaj na vrh');
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
  backTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }));

  const header = document.querySelector('.site-header');
  if (header) {
    const syncHeader = () => header.classList.toggle('is-scrolled', window.scrollY > 24);
    syncHeader();
    window.addEventListener('scroll', syncHeader, { passive: true });
  }

  if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    root.classList.add('motion-ready');
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