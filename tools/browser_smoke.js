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
            if (endPoint !== 'https://blackraven-contact.dan-grmusa.workers.dev/contact') issues.push(tag + ': wrong first-party endpoint');
            if (await contact.getAttribute('action') !== null) issues.push(tag + ': old external form action still present');
            // The button is disabled when no SMTP endpoint is ready; it may become
            // enabled when the owner's Worker has successfully authenticated.
            const canSubmit = !(await page.locator('.contact-form-submit').isDisabled());
            if (!canSubmit && !(await page.locator('#contact-form-status').isVisible())) issues.push(tag + ': unavailable form has no status notice');
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
    // Browser integration mocks: these never transmit any real email.
    const context = await browser.newContext({ viewport: { width: 900, height: 800 } });
    const workerOrigin = 'https://blackraven-contact.dan-grmusa.workers.dev';
    const workerEndpoint = workerOrigin + '/contact';
    const fakeCors = { 'access-control-allow-origin': '*', 'content-type': 'application/json' };
    const page = await context.newPage();
    let accepted = 0;
    let staleRequests = 0;
    await page.route('https://api.blackraven.solutions/**', async route => {
      staleRequests++;
      await route.abort();
    });
    await page.route(workerOrigin + '/ready', route => route.fulfill({
      status: 200,
      headers: fakeCors,
      body: JSON.stringify({ ready: true })
    }));
    await page.route(workerEndpoint, async route => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'POST, OPTIONS',
          'access-control-allow-headers': 'Content-Type'
        }
      });
      accepted++;
      const submitted = route.request().postDataJSON();
      if (submitted.name !== 'Browser Test' || submitted.email !== 'visitor@example.org' ||
          submitted.message !== 'Safe mocked test message only') {
        issues.push('contact direct Worker: malformed JSON payload');
      }
      await route.fulfill({ status: 202, headers: fakeCors, body: JSON.stringify({ accepted: true }) });
    });
    await page.goto(base + 'o-nas.html', { waitUntil: 'load' });
    try {
      await page.waitForFunction(() => !document.querySelector('.contact-form-submit')?.disabled, null, { timeout: 7000 });
    } catch (_) { issues.push('contact direct Worker: readiness did not enable submit'); }
    if (!(await page.locator('.contact-form-submit').isDisabled())) {
      await page.locator('#contact-name').fill('Browser Test');
      await page.locator('#contact-email').fill('visitor@example.org');
      await page.locator('#contact-message').fill('Safe mocked test message only');
      await page.locator('.contact-form-submit').click();
      try { await page.locator('#contact-form-success').waitFor({ state: 'visible', timeout: 5000 }); }
      catch (_) { issues.push('contact direct Worker: success not shown after 202 accepted'); }
    }
    if (accepted !== 1) issues.push('contact direct Worker: expected one send, got ' + accepted);
    if (staleRequests) issues.push('contact direct Worker: called obsolete API hostname');
    if (!page.url().startsWith(base + 'o-nas.html')) issues.push('contact direct Worker: redirected away from site');

    // Regression: SMTP TLS verification may exceed the old 3.5s client timeout.
    // A simulated 5s response must still unlock the form.
    const slowPage = await context.newPage();
    await slowPage.route(workerOrigin + '/ready', async route => {
      await new Promise(resolve => setTimeout(resolve, 5000));
      await route.fulfill({ status: 200, headers: fakeCors, body: JSON.stringify({ ready: true }) });
    });
    await slowPage.goto(base + 'o-nas.html', { waitUntil: 'load' });
    try {
      await slowPage.waitForFunction(() => !document.querySelector('.contact-form-submit')?.disabled, null, { timeout: 11000 });
    } catch (_) { issues.push('contact slow SMTP readiness: button remained disabled after 5 seconds'); }
    await slowPage.close();

    // Regression: transient 503 must recover without reloading the page.
    const recoveryPage = await context.newPage();
    let readyCalls = 0;
    await recoveryPage.route(workerOrigin + '/ready', async route => {
      readyCalls++;
      await route.fulfill({
        status: readyCalls === 1 ? 503 : 200,
        headers: fakeCors,
        body: JSON.stringify({ ready: readyCalls > 1 })
      });
    });
    await recoveryPage.goto(base + 'o-nas.html', { waitUntil: 'load' });
    try {
      await recoveryPage.waitForFunction(() =>
        document.querySelector('#contact-form-status')?.textContent?.includes('nedosegljivo'),
        null, { timeout: 7000 });
      await recoveryPage.evaluate(() => window.dispatchEvent(new Event('online')));
      await recoveryPage.waitForFunction(() => !document.querySelector('.contact-form-submit')?.disabled, null, { timeout: 7000 });
    } catch (_) { issues.push('contact transient offline: did not recover after online event'); }
    await recoveryPage.close();
    await context.close();
  } finally {
    await browser.close();
  }
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ checked: checks, issues }, null, 2));
  console.log(JSON.stringify({ tests: checks.length, issues, screenshotDirectory: 'visual-qa' }, null, 2));
  if (issues.length) process.exit(1);
  
})().catch(e => { console.error(e); process.exit(1); });
