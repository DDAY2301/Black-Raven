/* Show the return notice when FormSubmit redirects back to the website. */
(() => {
  const notice = document.getElementById('contact-form-success');
  if (!notice || !window.location.search) return;
  const url = new URL(window.location.href);
  if (url.searchParams.get('enquiry') !== 'sent') return;
  notice.hidden = false;
  notice.focus({ preventScroll: true });
  url.searchParams.delete('enquiry');
  try {
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  } catch (_) {
    /* History updates may be disabled; the notice still works. */
  }
})();
