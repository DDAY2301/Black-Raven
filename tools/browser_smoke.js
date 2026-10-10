(async () => {
  /* Browser-based visual and functional smoke test for Black Raven. */
  const { chromium } = require('playwright');
  const fs = require('fs');
  const path = require('path');
  
  const base = 'http://127.0.0.1:8765/';
  const pages = ['index.html', 'gallery.html', 'stories.html', 'info.html', 'zakaj-narava.html', 'o-nas.html'];
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
  
        if (screen.width <= 980) {
          await page.locator('.menu-button').click();
          if ((await page.locator('.menu-button').getAttribute('aria-expanded')) !== 'true') issues.push(tag + ': mobile menu did not open');
          await page.keyboard.press('Escape');
          if ((await page.locator('.menu-button').getAttribute('aria-expanded')) !== 'false') issues.push(tag + ': mobile menu did not close on Escape');
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
  } finally {
    await browser.close();
  }
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ checked: checks, issues }, null, 2));
  console.log(JSON.stringify({ tests: checks.length, issues, screenshotDirectory: 'visual-qa' }, null, 2));
  if (issues.length) process.exit(1);
  
})().catch(e => { console.error(e); process.exit(1); });
