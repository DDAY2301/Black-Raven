(async () => {
  /* Browser-based visual and functional smoke test for Black Raven. */
  const { chromium } = require('playwright');
  const fs = require('fs');
  const path = require('path');
  
  const base = 'http://127.0.0.1:8765/';
  const pages = ['index.html', 'gallery.html', 'stories.html', 'info.html', 'zakaj-narava.html', 'o-nas.html', 'video.html', 'oprema.html'];
  const viewports = [
    { name: 'mobile', width: 375, height: 812 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1440, height: 900 }
  ];
  const out = path.join(process.cwd(), 'visual-qa');
  fs.mkdirSync(out, { recursive: true });
  const issues = [];
  const checks = [];
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  
  try {
    for (const screen of viewports) {
      const context = await browser.newContext({ viewport: { width: screen.width, height: screen.height }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
      const page = await context.newPage();
      for (const name of pages) {
        const tag = name.replace('.html', '') + '-' + screen.name;
        const errors = [];
        page.removeAllListeners('pageerror');
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(base + name, { waitUntil: 'load', timeout: 40000 });
        await page.evaluate(() => { for (const i of document.querySelectorAll('img[loading="lazy"]')) i.loading = 'eager'; });
        await page.waitForTimeout(600);
        const details = await page.evaluate(() => ({
          title: document.title,
          h1: document.querySelector('h1')?.textContent?.trim(),
          width: document.documentElement.scrollWidth,
          viewport: window.innerWidth,
          images: [...document.querySelectorAll('img')].filter(i => i.getAttribute('src')).map(i => ({ src: i.getAttribute('src'), loaded: i.complete && i.naturalWidth > 0 })),
          topNav: !!document.querySelector('.nav-links')
        }));
        if (details.width > details.viewport + 4) issues.push(tag + ': horizontal overflow ' + details.width + '/' + details.viewport);
        if (!details.h1) issues.push(tag + ': missing h1');
        for (const img of details.images.filter(i => !i.loaded)) issues.push(tag + ': broken/unfinished image ' + img.src);
        if (errors.length) issues.push(tag + ': uncaught JS errors ' + errors.join(' | '));
  
        // Verify language control and language persistence across pages.
        await page.locator('[data-lang="en"]').click();
        if ((await page.locator('html').getAttribute('lang')) !== 'en') issues.push(tag + ': English switch failed');
        await page.locator('[data-lang="sl"]').click();
        if ((await page.locator('html').getAttribute('lang')) !== 'sl') issues.push(tag + ': Slovenian switch failed');
  
        if (await page.locator('.menu-button').isVisible()) {
          await page.locator('.menu-button').click();
          if ((await page.locator('.menu-button').getAttribute('aria-expanded')) !== 'true') issues.push(tag + ': mobile menu did not open');
          await page.keyboard.press('Escape');
          if ((await page.locator('.menu-button').getAttribute('aria-expanded')) !== 'false') issues.push(tag + ': mobile menu did not close on Escape');
        } else if (!(await page.locator('.nav-links').isVisible())) {
          issues.push(tag + ': neither navigation nor menu button is visible');
        }
  
        // Exercise contact form validation and context without submitting any request.
        if (name === 'o-nas.html') {
          const contact = page.locator('#contact-enquiry-form');
          if (await contact.count() !== 1) issues.push(tag + ': missing contact form');
          else {
            const card = page.locator('.contact-form-card');
            const email = page.locator('.contact-direct-email');
            if (await email.count() !== 1) issues.push(tag + ': missing clean email footer');
            else {
              const geometry = await page.evaluate(() => {
                const card = document.querySelector('.contact-form-card')?.getBoundingClientRect();
                const email = document.querySelector('.contact-direct-email')?.getBoundingClientRect();
                const address = document.querySelector('.contact-direct-address')?.getBoundingClientRect();
                const column = document.querySelector('.about-contact-grid > div')?.getBoundingClientRect();
                return card && email && address && column
                  ? { cardBottom: card.bottom, emailTop: email.top, emailRight: email.right,
                      addressRight: address.right, columnRight: column.right, emailWidth: email.width }
                  : null;
              });
              if (!geometry || geometry.emailTop < geometry.cardBottom + 10 ||
                  geometry.addressRight > geometry.columnRight + 2 ||
                  geometry.emailRight > geometry.columnRight + 2) {
                issues.push(tag + ': contact details overflow or overlap the form');
              }
            }
            if (await page.locator('.contact-form-jump, .contact-email-alternative').count()) issues.push(tag + ': duplicate contact CTAs remain');
            const endPoint = await contact.getAttribute('data-endpoint');
            if (endPoint !== '') issues.push(tag + ': endpoint must be blank until verified');
            if (await contact.getAttribute('action') !== null) issues.push(tag + ': old external form action still present');
            if (!(await page.locator('.contact-form-submit').isDisabled())) issues.push(tag + ': form must be disabled when unconfigured');
            if (!(await page.locator('#contact-form-status').isVisible())) issues.push(tag + ': offline notice not visible');
            if (await page.locator('#contact-form-success').isVisible()) issues.push(tag + ': false success shown');
            const invalid = await contact.evaluate(el => !el.checkValidity());
            if (!invalid) issues.push(tag + ': empty required fields passed validation');
            await page.locator('#contact-name').fill('Browser Test');
            await page.locator('#contact-email').fill('visitor@example.org');
            await page.locator('#contact-message').fill('Test message without submission');
            if (!(await contact.evaluate(el => el.checkValidity()))) issues.push(tag + ': valid form failed validation');
            await page.goto(base + 'o-nas.html?topic=Osnovni%20te%C4%8Daj#contact-enquiry-form', { waitUntil: 'load' });
            if ((await page.locator('#contact-programme').inputValue()) !== 'Tecaji') issues.push(tag + ': programme prefill failed');
            if ((await page.locator('#contact-topic').inputValue()) !== 'Osnovni tečaj') issues.push(tag + ': topic prefill failed');
            await page.goto(base + name, { waitUntil: 'load' });
          }
        }

        if (name === 'gallery.html') {
          const first = page.locator('.field-gallery-card').first();
          await first.click();
          if (!(await page.locator('.lightbox').evaluate(el => el.classList.contains('is-open')))) issues.push(tag + ': lightbox did not open');
          await page.keyboard.press('ArrowRight');
          await page.keyboard.press('Escape');
          if ((await page.locator('.lightbox').getAttribute('aria-hidden')) !== 'true') issues.push(tag + ': lightbox did not close');
          if (!(await first.evaluate(el => el === document.activeElement))) issues.push(tag + ': lightbox focus not restored');
        }
  
        // Reveal below-fold content for an accurate full-page QA snapshot.
        await page.evaluate(() => document.querySelectorAll('.reveal, .micro-reveal').forEach(el => el.classList.add('is-visible')));
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(150);
        await page.screenshot({
          path: path.join(out, tag + '.png'),
          fullPage: ['index.html', 'info.html', 'o-nas.html'].includes(name),
          animations: 'disabled',
          timeout: 30000
        });
        checks.push({ tag, h1: details.h1, images: details.images.length, pageErrors: errors.length });
      }
      await page.close();
      await context.close();
    }
    // Integration mock: no real third-party requests, no customer data sent.
    const context = await browser.newContext({ viewport: { width: 900, height: 800 } });
    const page = await context.newPage();
    const mockEndpoint = 'https://formspree.io/f/mockbr98765';
    let accepted = 0;
    await page.route('**/o-nas.html', async route => {
      const response = await route.fetch();
      const html = (await response.text()).replace('data-endpoint=""', 'data-endpoint="' + mockEndpoint + '"');
      await route.fulfill({ response, body: html });
    });
    await page.route(mockEndpoint, async route => {
      accepted += 1;
      await route.fulfill({
        status: 200,
        headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' },
        body: JSON.stringify({ ok: true })
      });
    });
    await page.goto(base + 'o-nas.html', { waitUntil: 'load' });
    if (await page.locator('.contact-form-submit').isDisabled()) issues.push('contact AJAX mock: valid endpoint stayed disabled');
    await page.locator('#contact-name').fill('Browser Test');
    await page.locator('#contact-email').fill('visitor@example.org');
    await page.locator('#contact-message').fill('Safe mocked test message only');
    await page.locator('.contact-form-submit').click();
    try { await page.locator('#contact-form-success').waitFor({ state: 'visible', timeout: 5000 }); }
    catch (_) { issues.push('contact AJAX mock: no success after accepted response'); }
    if (accepted !== 1) issues.push('contact AJAX mock: request count ' + accepted);
    if (!page.url().startsWith(base + 'o-nas.html')) issues.push('contact AJAX mock: redirected away from site');
    await context.close();
  } finally {
    await browser.close();
  }
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ checked: checks, issues }, null, 2));
  console.log(JSON.stringify({ tests: checks.length, issues, screenshotDirectory: 'visual-qa' }, null, 2));
  if (issues.length) process.exit(1);
  
})().catch(e => { console.error(e); process.exit(1); });
