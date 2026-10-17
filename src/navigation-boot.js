// Run before the first paint so page navigation never starts from a white canvas.
(() => {
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const supportsReveal = 'onpagereveal' in window;
  const reloading = performance.getEntriesByType('navigation')[0]?.type === 'reload';
  let pending = false;
  try {
    const entry = JSON.parse(sessionStorage.getItem('portfolio-navigation') || 'null');
    pending = Boolean(!reloading && entry && Date.now() - entry.at < 15000 &&
      new URL(entry.url).pathname.replace(/\/$/, '') === location.pathname.replace(/\/$/, ''));
    sessionStorage.removeItem('portfolio-navigation');
  } catch {}
  try {
    const previous = document.referrer && new URL(document.referrer);
    pending ||= Boolean(!reloading && previous && previous.origin === location.origin && previous.pathname !== location.pathname);
  } catch {}
  if (pending) root.classList.add('page-navigation');
  let resolve, resolved = false;
  const state = window.__portfolioNavigation = {
    transition: null,
    pending,
    ready: new Promise(done => resolve = done),
  };
  function ready(event) {
    if (resolved) return;
    resolved = true;
    state.transition = event?.viewTransition || null;
    if (state.transition) root.classList.add('page-navigation');
    if (pending && !state.transition && !reduced) root.classList.add('page-fallback-entering');
    resolve(state.transition);
  }
  if (supportsReveal) {
    addEventListener('pagereveal', ready, { once: true });
    addEventListener('load', () => setTimeout(() => ready(), 0), { once: true });
  }
  else {
    if (pending && !reduced) root.classList.add('page-fallback-entering');
    document.addEventListener('DOMContentLoaded', () => ready(), { once: true });
  }
  if (!reduced) root.classList.add('page-motion-enabled');
  setTimeout(() => {
    if (!window.__pageMotionReady) root.classList.remove('page-motion-enabled', 'page-fallback-entering');
  }, 4000);
})();
